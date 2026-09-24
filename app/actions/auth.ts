"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { accountExistsEmail, resetPasswordEmail, signUpConfirmEmail } from "@/lib/email/auth-emails";
import { kayitGirdisiniDenetle } from "@/lib/kayit";
import type { ActionResult } from "@/lib/auth-guards";
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
export async function signUp(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const denetim = kayitGirdisiniDenetle({
    email: formData.get("email"),
    sifre: formData.get("password"),
    adSoyad: formData.get("fullName"),
    kvkk: formData.get("kvkk") === "on",
  });
  if ("hata" in denetim) return { error: denetim.hata };
  const { email, sifre, adSoyad } = denetim.deger;

  let admin;
  try {
    admin = createAdminClient();
  } catch (adminError) {
    console.error("Kayıt: sunucu anahtarı yok", adminError);
    return { error: "Kayıt şu anda yapılamıyor. Birazdan tekrar deneyin." };
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
    return { error: "Çok fazla deneme yapıldı. Bir saat sonra tekrar deneyin." };
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
      await sendEmail({ to: email, ...accountExistsEmail(origin, `${origin}/forgot-password`) });
      return { success: true };
    }
    console.error("Kayıt bağlantısı üretilemedi:", error.message);
    return { error: "Kayıt şu anda yapılamıyor. Birazdan tekrar deneyin." };
  }

  const token = data.properties?.hashed_token;
  if (!token) {
    console.error("Kayıt: doğrulama belirteci boş");
    return { error: "Kayıt şu anda yapılamıyor. Birazdan tekrar deneyin." };
  }
  /*
    Deneme süresinin kaç gün olduğunu ArvoLab bilmiyor: değer ArvoOS'ta
    product_plans tablosunda ve okumak için bir uç nokta yok. Uydurmak
    yerine genel cümle kuruluyor.
  */
  await sendEmail({ to: email, ...signUpConfirmEmail(authConfirmLink(origin, token, "signup", "/dashboard"), null) });
  return { success: true };
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
    if (token) await sendEmail({ to: email, ...resetPasswordEmail(authConfirmLink(await siteOrigin(), token, "recovery")) });
  }

  // Hesabın var olup olmadığını sızdırmamak için her durumda aynı mesaj gösterilir.
  redirect("/forgot-password?sent=1");
}

function passwordErrorMessage(code: string | undefined) {
  switch (code) {
    case "same_password":
      return "Yeni şifre mevcut şifrenizden farklı olmalı.";
    case "weak_password":
      return "Şifre yeterince güçlü değil; harf, rakam ve sembolleri birlikte kullanın.";
    case "reauthentication_needed":
      return "Güvenlik nedeniyle çıkış yapıp yeniden giriş yaptıktan sonra tekrar deneyin.";
    default:
      return "Şifre güncellenemedi. Lütfen tekrar deneyin.";
  }
}

async function applyNewPassword(formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.` };
  }
  if (password !== passwordConfirm) {
    return { error: "Şifreler eşleşmiyor." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Oturumunuzun süresi dolmuş. Lütfen yeniden şifre sıfırlama bağlantısı isteyin." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error(error);
    return { error: passwordErrorMessage(error.code) };
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
