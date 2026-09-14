"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/auth-guards";
import { siteOrigin } from "@/lib/site-url";

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

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    console.error(error);
    if (error.status === 429) {
      redirect("/forgot-password?error=rate-limited");
    }
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
