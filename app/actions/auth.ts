"use server";

import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { DIL_CEREZI, dilMi, type Metin } from "@/lib/dil";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADRES_SINIRI, GIRIS_PENCERESI_SQL, IP_SINIRI, girisAnahtarlari, girisKilitliMi } from "@/lib/giris-siniri";
import { sendEmail } from "@/lib/email/resend";
import { accountExistsEmail, resetPasswordEmail, signUpConfirmEmail } from "@/lib/email/auth-emails";
import { kayitGirdisiniDenetle } from "@/lib/kayit";
import { oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { siteOrigin } from "@/lib/site-url";
import { authConfirmLink } from "@/lib/auth-link";
import { after } from "next/server";
import { randomBytes } from "node:crypto";
import { onayKaydiYaz, onayKopyasiGonder } from "@/lib/sozlesme/onay-yaz";

const MIN_PASSWORD_LENGTH = 8;
/* Kayıt doğrulamasından sonra şifrenin belirlendiği sayfa (G1). */
const ILK_SIFRE_YOLU = "/reset-password?ilk=1";

// Yalnızca panel içi yollara dönülür; dış adrese yönlendirme (open redirect) engellenir.
function safeNextPath(raw: string) {
  return raw.startsWith("/dashboard") && !raw.startsWith("//") ? raw : "/dashboard";
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const nextQuery = next === "/dashboard" ? "" : `&next=${encodeURIComponent(next)}`;

  if (!email || !password) {
    redirect(`/?error=missing-credentials${nextQuery}`);
  }

  /*
    Hız sınırı (lib/giris-siniri.ts): yalnızca hatalı denemeler sayılır.
    Sunucu anahtarı yoksa ya da sayaç okunamazsa giriş ENGELLENMEZ — sayaç
    bir korumadır, girişin ön koşulu değil.
  */
  const istek = await headers();
  const ip = (istek.get("x-forwarded-for") ?? "").split(",")[0].trim() || "bilinmiyor";
  const anahtar = girisAnahtarlari(email, ip);
  let sayacIstemcisi: ReturnType<typeof createAdminClient> | null = null;
  try {
    sayacIstemcisi = createAdminClient();
  } catch {
    sayacIstemcisi = null;
  }
  if (sayacIstemcisi) {
    const { data: sayaclar, error: sayacHatasi } = await sayacIstemcisi
      .from("auth_rate_limits")
      .select("key, count, window_start")
      .in("key", [anahtar.adres, anahtar.ip]);
    if (sayacHatasi) {
      console.error("[giriş] hız sınırı okunamadı:", sayacHatasi.message);
    } else {
      const simdi = Date.now();
      const bul = (k: string) => (sayaclar ?? []).find((s) => s.key === k);
      if (girisKilitliMi(bul(anahtar.adres), ADRES_SINIRI, simdi) || girisKilitliMi(bul(anahtar.ip), IP_SINIRI, simdi)) {
        console.warn("[giriş] hız sınırı:", ip);
        redirect(`/?error=too-many-attempts${nextQuery}`);
      }
    }
  }

  const supabase = await createClient();
  const { data: oturum, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error && sayacIstemcisi) {
    const sayac = sayacIstemcisi;
    const sonuc = await Promise.all([
      sayac.rpc("rate_limit_hit", { p_key: anahtar.adres, p_limit: ADRES_SINIRI, p_window: GIRIS_PENCERESI_SQL }),
      sayac.rpc("rate_limit_hit", { p_key: anahtar.ip, p_limit: IP_SINIRI, p_window: GIRIS_PENCERESI_SQL }),
    ]);
    const hata = sonuc.find((r) => r.error)?.error;
    if (hata) console.error("[giriş] hatalı deneme sayılamadı:", hata.message);
  } else if (!error && sayacIstemcisi) {
    /* Başarılı giriş adresin hatalı deneme sayacını sıfırlar; IP sayacı (ortak ağ) kendi penceresiyle düşer. */
    const { error: silmeHatasi } = await sayacIstemcisi.from("auth_rate_limits").delete().eq("key", anahtar.adres);
    if (silmeHatasi) console.error("[giriş] sayaç sıfırlanamadı:", silmeHatasi.message);
  }

  if (error) {
    /*
      Doğrulanmamış adres ayrı söyleniyor. Eskiden her hata "e-posta veya
      şifre hatalı" oluyordu: kaydolup bağlantıya henüz tıklamayan kullanıcı
      DOĞRU şifreyle bu mesajı alıyor, şifresini değiştirmeye uğraşıyordu.
      Supabase bu kodu yalnızca şifre doğruysa döndürür; adresin kayıtlı
      olup olmadığını sızdırmaz.
    */
    if (error.code === "email_not_confirmed") redirect(`/?error=email-not-confirmed${nextQuery}`);
    redirect(`/?error=invalid-credentials${nextQuery}`);
  }

  /*
    TEK CİHAZDA OTURUM (02.11.2026, lib/tek-oturum.ts): bu giriş, hesabın
    öteki cihazlardaki oturumlarını kapatır. O cihazlar bir sonraki istekte
    (proxy.ts) ya da en geç bir dakika içinde (OturumGozcusu) "başka bir
    cihazdan giriş yapıldı" uyarısıyla giriş ekranına düşer. Kapatılamazsa
    giriş yine sürer — kişiyi kendi girişinden etmek, eski oturumun bir süre
    daha açık kalmasından kötü; hata günlüğe gider.
  */
  {
    const { error: digerleriHatasi } = await supabase.auth.signOut({ scope: "others" });
    if (digerleriHatasi) console.error("[giriş] öteki oturumlar kapatılamadı:", digerleriHatasi.message);
  }

  /*
    Profildeki dil tercihi bu tarayıcının çerezine aktarılır: telefonda
    İngilizce seçen öğrenci bilgisayarda girişte de İngilizce görür.
    Tercih yoksa ya da okunamazsa mevcut çerez neyse o kalır.
  */
  if (oturum.user) {
    const { data: profil, error: profilHatasi } = await supabase
      .from("profiles")
      .select("arayuz_dili")
      .eq("id", oturum.user.id)
      .maybeSingle();
    if (profilHatasi) console.error("[giriş] dil tercihi okunamadı:", profilHatasi.message);
    if (dilMi(profil?.arayuz_dili)) {
      (await cookies()).set(DIL_CEREZI, profil.arayuz_dili, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    }
  }

  redirect(next);
}

/*
  Kendi kaydolan kullanıcı.

  Bugüne kadar ArvoLab'a yalnızca ArvoOS panelinden (kurum üyeliğiyle)
  girilebiliyordu; bireysel abone hesabını kendisi açamıyordu. Kapının
  arkasındaki her şey hazırdı — deneme süresi ilk girişte ArvoOS
  köprüsünde başlıyor (lib/access.ts → ensureSubscription) — eksik olan
  tek parça bu formdu.

  Hesap DOĞRULANANA KADAR açılmıyor: generateLink("signup") kullanıcıyı
  onaysız oluşturuyor, bağlantıya tıklanınca doğrulanıyor.

  ŞİFRE DOĞRULAMADAN SONRA (G1, 06.11.2026). Eskiden şifre kayıtta
  alınıyordu. Adresi bilen biri, sahibinden önce onaysız hesap açıp kendi
  şifresini koyabiliyordu; sahibin sonraki kaydı hata vermiyor (GoTrue
  onaysız hesapta generateLink'e yeni şifreyi YOK SAYIP yalnızca yeni
  bağlantı üretiyor) ve sahip doğrulayınca hesap SALDIRGANIN şifresiyle
  açılıyordu (Test'te doğrulandı). Artık:
   - hesap tahmin edilemez, hiçbir yerde saklanmayan rastgele bir şifreyle
     açılıyor (GoTrue signup türü şifre istiyor);
   - doğrulama bağlantısı şifre belirleme sayfasına gidiyor
     (/reset-password?ilk=1; /auth/confirm signup türünde bunu zorunlu
     kılıyor);
   - veritabanı onay anında, onaydan önce konmuş HER şifreyi siliyor
     (migration 20261106184046) — hesap doğrudan /auth/v1/signup'tan ya da
     ArvoOS'tan gelse bile.

  Şifre sıfırlamadaki iki ilke burada da geçerli:
   - E-postayı biz gönderiyoruz (Supabase'in gönderim sınırı üretim için
     yetersiz, şablon da bizim kimliğimizde değil).
   - Ekranda hiçbir durumda "bu adres kayıtlı" denmiyor; adresin kayıtlı
     olup olmadığı sızmamalı. Adresin SAHİBİNE e-postayla söylemek
     sızıntı değil, yardım (accountExistsEmail).
*/
const EPOSTA_GONDERILEMEDI: Metin = {
  tr: "Doğrulama e-postası şu anda gönderilemedi. Birkaç dakika sonra aynı bilgilerle tekrar deneyin; sorun sürerse \"Şifremi unuttum\" ile yeni bağlantı isteyebilirsiniz.",
  en: "The verification email could not be sent right now. Try again in a few minutes with the same details; if it persists, request a new link with \"Forgot password\".",
};
const KAYIT_YAPILAMIYOR: Metin = {
  tr: "Kayıt şu anda yapılamıyor. Birazdan tekrar deneyin.",
  en: "Sign-up is not available right now. Try again shortly.",
};

export async function signUp(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const denetim = kayitGirdisiniDenetle({
    email: formData.get("email"),
    adSoyad: formData.get("fullName"),
    telefon: formData.get("phone"),
    kvkk: formData.get("kvkk") === "on",
    sozlesme: formData.get("sozlesme") === "on",
    sozlesmeOkundu: formData.get("sozlesmeOkundu") === "1",
    iletisimIzni: formData.get("iletisim") === "on",
  });
  const t = await ceviri();
  if ("hata" in denetim) return { error: t(denetim.hata) };
  const { email, adSoyad, telefon, iletisimIzni } = denetim.deger;

  let admin;
  try {
    admin = createAdminClient();
  } catch (adminError) {
    console.error("Kayıt: sunucu anahtarı yok", adminError);
    return { error: t(KAYIT_YAPILAMIYOR) };
  }

  /*
    Hız sınırı şifre sıfırlamadakinden DAR: kayıt, var olmayan adreslere de
    posta gönderdiği için kötüye kullanıldığında bizim alan adımızı spam
    listesine düşürür. Saatte adres başına 3, IP başına 10.
  */
  const istek = await headers();
  const ip = (istek.get("x-forwarded-for") ?? "").split(",")[0].trim() || "bilinmiyor";
  const izin = await Promise.all([
    admin.rpc("rate_limit_hit", { p_key: `kayit:${email}`, p_limit: 3, p_window: "1 hour" }),
    admin.rpc("rate_limit_hit", { p_key: `kayit-ip:${ip}`, p_limit: 10, p_window: "1 hour" }),
  ]);
  if (izin.some((sonuc) => sonuc.error)) {
    console.error("Kayıt hız sınırı okunamadı:", izin.find((sonuc) => sonuc.error)?.error?.message);
  } else if (izin.some((sonuc) => sonuc.data === false)) {
    console.warn("Kayıt hız sınırı:", ip);
    return { error: t({ tr: "Çok fazla deneme yapıldı. Bir saat sonra tekrar deneyin.", en: "Too many attempts. Try again in an hour." }) };
  }

  const origin = await siteOrigin();
  const simdi = new Date().toISOString();
  /*
    Telefon ve iletişim izni (02.11.2026) kullanıcı üst verisinde: profiles'ta
    telefon sütunu yok ve ArvoOS abone kaydı da e-postayla eşleşiyor. İletişim
    izni ZAMANIYLA tutulur (ticari elektronik ileti onayının kanıtı; izin
    verilmediyse alan hiç yazılmaz).
  */
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    // Kimsenin bilmediği tek kullanımlık değer; onay anında veritabanı siler.
    password: `${randomBytes(32).toString("base64url")}aA1!`,
    options: {
      data: {
        full_name: adSoyad,
        phone: telefon,
        kvkk_onay_at: simdi,
        ...(iletisimIzni ? { iletisim_izni_at: simdi } : {}),
      },
    },
  });

  if (error) {
    // Zaten kayıtlı adres: ekranda ayırt edilmiyor, sahibine e-posta gidiyor.
    if (/already|registered|exists/i.test(error.message)) {
      const gonderim = await sendEmail({ to: email, ...accountExistsEmail(origin, `${origin}/forgot-password`, await aktifDil()) });
      return gonderim.ok ? { success: true } : { error: t(EPOSTA_GONDERILEMEDI) };
    }
    console.error("Kayıt bağlantısı üretilemedi:", error.message);
    return { error: t(KAYIT_YAPILAMIYOR) };
  }

  const token = data.properties?.hashed_token;
  if (!token) {
    console.error("Kayıt: doğrulama belirteci boş");
    return { error: t(KAYIT_YAPILAMIYOR) };
  }

  /*
    KAYITTA VERİLEN SÖZLEŞME ONAYI (02.11.2026). Kayıt penceresindeki kutu
    ancak metin sonuna kadar okununca işaretlenebiliyor (lib/kayit.ts denetler);
    onay panel içindeki onayla AYNI kayda, aynı delillerle (IP, cihaz, konum)
    'kayit' olayıyla yazılır. Böylece kullanıcı ilk girişte aynı sözleşmeyi
    ikinci kez onaylamaz (lib/sozlesme/onay-durumu.ts yürürlükteki sürümün
    kaydına bakıyor).
    Yazılamazsa kayıt DÜŞMEZ: kullanıcı ilk girişte panel içindeki onay
    penceresini görür — delil yine alınır, yalnızca bir adım fazla olur.
    Kopya e-postası doğrulama postasını bekletmez (after).
  */
  const dil = await aktifDil();
  const yazim = data.user?.id
    ? await onayKaydiYaz(admin, istek, { userId: data.user.id, eposta: email, adSoyad, organizationId: null, dil, olay: "kayit", odemeReferansi: null })
    : ({ ok: false } as const);
  if (yazim.ok) after(() => onayKopyasiGonder(email, dil, yazim.kopya));
  /*
    Deneme süresinin kaç gün olduğunu ArvoLab bilmiyor: değer ArvoOS'ta
    product_plans tablosunda ve okumak için bir uç nokta yok. Uydurmak
    yerine genel cümle kuruluyor.
  */
  const gonderim = await sendEmail({ to: email, ...signUpConfirmEmail(authConfirmLink(origin, token, "signup", ILK_SIFRE_YOLU), null, await aktifDil()) });
  /*
    Gönderim düştüyse "posta kutunuza bakın" demek, hiç gelmeyecek bir
    bağlantıyı bekletmek ve hesabı açılamaz bırakmak demekti. İki dal da
    (yeni ve kayıtlı adres) aynı mesajı veriyor; adresin kayıtlı olup
    olmadığı sızmıyor.
  */
  return gonderim.ok ? { success: true } : { error: t(EPOSTA_GONDERILEMEDI) };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/forgot-password?error=missing-email");
  }
  await sifirlamaBaglantisiGonder(email);
  // Hesabın var olup olmadığını sızdırmamak için her durumda aynı mesaj gösterilir.
  redirect("/forgot-password?sent=1");
}

/*
  GİRİŞ EKRANINDAKİ "ŞİFREMİ UNUTTUM" PENCERESİ (02.11.2026, kurum sahibinin
  isteği; app/_components/sifre-sifirlama-penceresi.tsx). Sayfa yolu
  (requestPasswordReset) yönlendirmeyle sonuç bildiriyor, pencere kalmalı:
  aynı iş sonucu DÖNDÜREREK yapılıyor. Mantık tek yerde
  (sifirlamaBaglantisiGonder); iki yol da adresin kayıtlı olup olmadığını
  sızdırmıyor, sınıra takılan da "gönderildi" görüyor.
*/
export type SifirlamaDurumu = { durum: "bos" | "eksik" | "gonderildi" };

export async function sifreSifirlamaIste(_onceki: SifirlamaDurumu, formData: FormData): Promise<SifirlamaDurumu> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { durum: "eksik" };
  await sifirlamaBaglantisiGonder(email);
  return { durum: "gonderildi" };
}

/* "use server" dosyasında export EDİLMİYOR: dışarıdan çağrılabilen bir uç nokta olmasın. */
async function sifirlamaBaglantisiGonder(email: string): Promise<void> {
  /*
    Bağlantıyı biz üretip e-postayı kendimiz gönderiyoruz. Supabase'in yerleşik
    gönderimi üretim için değil: saatlik sınırı çok düşük ve aşıldığında şifre
    sıfırlama isteyen kullanıcı hiç e-posta alamıyor. Ayrıca kendi şablonumuz
    ArvoLab kimliğinde.
  */
  let admin;
  try {
    admin = createAdminClient();
  } catch (adminError) {
    console.error("Şifre sıfırlama: sunucu anahtarı yok", adminError);
    return;
  }

  /*
    Hız sınırı: aynı adrese 15 dakikada en fazla 3, aynı IP'den en fazla 10.
    Sınır olmadan biri döngüyle çağırıp kayıtlı bir adrese sınırsız e-posta
    yağdırabiliyor ve her yeni bağlantı öncekini geçersiz kıldığı için kurbanın
    şifre sıfırlaması kilitleniyordu. Sayaç veritabanında (migration
    20260924100002); sunucu her istekte başka bir örnekte çalışabiliyor.
    Sınıra takılan da "gönderildi" görür: hangi adreslerin kayıtlı olduğu
    sızmasın.
  */
  const istek = await headers();
  const ip = (istek.get("x-forwarded-for") ?? "").split(",")[0].trim() || "bilinmiyor";
  const izin = await Promise.all([
    admin.rpc("rate_limit_hit", { p_key: `sifre:${email.toLowerCase()}`, p_limit: 3, p_window: "15 minutes" }),
    admin.rpc("rate_limit_hit", { p_key: `sifre-ip:${ip}`, p_limit: 10, p_window: "15 minutes" }),
  ]);
  const engellendi = izin.some((sonuc) => sonuc.data === false);
  if (izin.some((sonuc) => sonuc.error)) {
    // Sayaç okunamadıysa (tablo yok, geçici arıza) akış durmaz; e-posta gider.
    console.error("Şifre sıfırlama hız sınırı okunamadı:", izin.find((sonuc) => sonuc.error)?.error?.message);
  }
  if (engellendi) {
    console.warn("Şifre sıfırlama hız sınırı:", ip);
    return;
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (error) {
    /*
      Kayıtlı olmayan e-posta da hata döndürür. Mesajı ayırmıyoruz: hangi
      adreslerin kayıtlı olduğunu öğrenmek için kullanılabilirdi.
    */
    console.warn("Şifre sıfırlama bağlantısı üretilemedi:", error.message);
  } else {
    // action_link değil: o bağlantı oturumu #access_token ile döndürür, sunucu göremez (lib/auth-link.ts).
    const token = data.properties?.hashed_token;
    if (token) await sendEmail({ to: email, ...resetPasswordEmail(authConfirmLink(await siteOrigin(), token, "recovery"), await aktifDil()) });
  }
}

function passwordErrorMessage(code: string | undefined): Metin {
  switch (code) {
    case "same_password":
      return { tr: "Yeni şifre mevcut şifrenizden farklı olmalı.", en: "The new password must be different from your current one." };
    case "weak_password":
      return {
        tr: "Şifre yeterince güçlü değil; harf, rakam ve sembolleri birlikte kullanın.",
        en: "The password is not strong enough; combine letters, numbers and symbols.",
      };
    case "reauthentication_needed":
      return {
        tr: "Güvenlik nedeniyle çıkış yapıp yeniden giriş yaptıktan sonra tekrar deneyin.",
        en: "For security reasons, sign out, sign in again and then retry.",
      };
    default:
      return { tr: "Şifre güncellenemedi. Lütfen tekrar deneyin.", en: "The password could not be updated. Please try again." };
  }
}

async function applyNewPassword(formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const t = await ceviri();

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: t({ tr: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`, en: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }) };
  }
  if (password !== passwordConfirm) {
    return { error: t({ tr: "Şifreler eşleşmiyor.", en: "The passwords do not match." }) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: t({
        tr: "Oturumunuzun süresi dolmuş. Lütfen yeniden şifre sıfırlama bağlantısı isteyin.",
        en: "Your session has expired. Please request a new password reset link.",
      }),
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error(error);
    return { error: t(passwordErrorMessage(error.code)) };
  }
  return { success: true };
}

/** E-postadaki sıfırlama bağlantısıyla gelen kullanıcı için; başarıda panele yönlendirir. */
export async function resetPassword(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const result = await applyNewPassword(formData);
  if (result.error) return result;
  redirect("/dashboard");
}

/** Ayarlar sayfasından, oturumu açık kullanıcı için. */
export async function changePassword(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  return applyNewPassword(formData);
}

/*
  Diğer cihazlardaki oturumları kapatır; bu cihazdaki açık kalır.

  Ayarlar'daki şifre satırı "diğer cihazlardaki oturumlarınız açık
  kalabilir" diyordu ama bunun bir çaresi yoktu: ortak bilgisayarda
  (kütüphane, laboratuvar) açık unutulan oturumu kapatmanın tek yolu
  şifre değiştirmek bile değildi. Kapı yok (lib/access.ts): engellenen
  kullanıcı da kendi hesabını koruyabilmeli.
*/
export async function digerOturumlariKapat(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: await oturumYokMesaji() };

  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    console.error("[oturum] diğer oturumlar kapatılamadı", error.message);
    const t = await ceviri();
    return { error: t({ tr: "Oturumlar kapatılamadı. Lütfen tekrar deneyin.", en: "Sessions could not be signed out. Please try again." }) };
  }
  return { success: true };
}
