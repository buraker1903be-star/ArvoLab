"use server";

import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { accountExistsEmail, resetPasswordEmail, signUpConfirmEmail } from "@/lib/email/auth-emails";
import { kayitGirdisiniDenetle } from "@/lib/kayit";
import { oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { siteOrigin } from "@/lib/site-url";
import { authConfirmLink } from "@/lib/auth-link";

const MIN_PASSWORD_LENGTH = 8;

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

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
  onaysız oluşturuyor, bağlantıya tıklanınca doğrulanıyor. Böylece
  başkasının e-postasıyla kayıt denemesi kimseye hesap açmıyor.

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
    sifre: formData.get("password"),
    adSoyad: formData.get("fullName"),
    kvkk: formData.get("kvkk") === "on",
  });
  const t = await ceviri();
  if ("hata" in denetim) return { error: t(denetim.hata) };
  const { email, sifre, adSoyad } = denetim.deger;

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
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password: sifre,
    options: { data: { full_name: adSoyad, kvkk_onay_at: new Date().toISOString() } },
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
    Deneme süresinin kaç gün olduğunu ArvoLab bilmiyor: değer ArvoOS'ta
    product_plans tablosunda ve okumak için bir uç nokta yok. Uydurmak
    yerine genel cümle kuruluyor.
  */
  const gonderim = await sendEmail({ to: email, ...signUpConfirmEmail(authConfirmLink(origin, token, "signup", "/dashboard"), null, await aktifDil()) });
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
    redirect("/forgot-password?sent=1");
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
    redirect("/forgot-password?sent=1");
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

  // Hesabın var olup olmadığını sızdırmamak için her durumda aynı mesaj gösterilir.
  redirect("/forgot-password?sent=1");
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
