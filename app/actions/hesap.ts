"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { loadCurrentProfile } from "@/lib/current-profile";
import { ADMIN_ROLES } from "@/lib/project-labels";
import { onayGecerli } from "@/lib/hesap-silme";

/*
  Hesap silme talebi ve geri alma.

  Süreç iki aşamalı (gerekçesi lib/hesap-silme.ts): talep anında erişim
  kapanır, veri BEKLEME_GUNU kadar durur, süre dolunca cron kalıcı siler
  (app/api/cron/hesap-silme).

  Talep bir BAYRAK yazıyor; hiçbir şeyi silmiyor ve ArvoOS'a haber
  vermiyor. Köprünün "close" çağrısı yalnızca kalıcı silme anında
  yapılıyor: bekleme süresi içinde geri dönen kullanıcının
  anonimleştirilmiş abone kaydını geri getirmek gerekirdi ve o yol, hatanın
  sessizce saklanacağı bir yol.
*/

export async function hesapSilmeTalebi(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return SESSION_MISSING;

  const profile = await loadCurrentProfile();
  /*
    İç ekip kendi hesabını buradan silemez. Founder ya da system_admin
    hesabı yalnızca kendi verisini değil, kurumların kılavuzlarını ve
    kurulumu da yöneten hesaptır; yanlışlıkla basılan bir düğmeyle
    gitmemeli. Gerekirse veritabanından bilerek silinir.
  */
  if (profile?.role && ADMIN_ROLES.includes(profile.role)) {
    return { error: "İç ekip hesapları bu ekrandan silinemez. Sistem yöneticisiyle görüşün." };
  }

  // Onay için kişi KENDİ e-postasını yazıyor; karşılaştırma lib/hesap-silme.ts'te.
  if (!onayGecerli(formData.get("onay"), user.email)) {
    return { error: "Onaylamak için e-posta adresinizi birebir yazın." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ silme_talebi_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length) {
    console.error("[hesap-silme] talep yazılamadı", error?.message);
    return { error: "Silme talebi kaydedilemedi. Lütfen tekrar deneyin." };
  }

  /*
    Talepten hemen sonra oturum kapatılıyor. "Erişim hemen kapanır" sözünün
    karşılığı bu: panel kapısı (app/dashboard/layout.tsx) zaten engelliyor
    ama açık kalan bir sekmenin sunucu eylemleri için ayrıca bir tur
    koruma. Çıkış başarısız olsa bile kapı duruyor, bu yüzden hata akışı
    durdurmuyor.
  */
  const { error: cikisHatasi } = await supabase.auth.signOut();
  if (cikisHatasi) console.error("[hesap-silme] oturum kapatılamadı", cikisHatasi.message);

  revalidatePath("/dashboard", "layout");
  redirect("/?bilgi=hesap-silme-talebi");
}

/** Bekleme süresi içinde vazgeçme: bayrak siliniyor, her şey geri geliyor. */
export async function hesapSilmeyiIptal(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return SESSION_MISSING;

  const { data, error } = await supabase
    .from("profiles")
    .update({ silme_talebi_at: null })
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length) {
    console.error("[hesap-silme] talep geri alınamadı", error?.message);
    return { error: "Silme talebi geri alınamadı. Lütfen tekrar deneyin." };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true, message: "Hesabınız geri geldi; silme talebi iptal edildi." };
}
