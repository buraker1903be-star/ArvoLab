"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/app/actions/profile";
import { startCreditCheckout, startSubscriptionCheckout } from "@/lib/subscription";

// Bireysel abonenin "Aboneliği başlat / yenile" düğmesi. Tutar ArvoOS'ta
// belirlenir; buradan tutar gönderilmez, yalnızca kim olduğu ve kullanıcının
// seçtiği plan (aylık/yıllık) bildirilir.

export async function payArvolabSubscription(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/?error=session-missing");

  const profile = await getCurrentProfile();
  if (profile?.organization_id) {
    // Kurum üyesinin aboneliğini kurumu öder; kişisel ödeme almayalım.
    redirect("/dashboard?error=kurum-aboneligi");
  }

  // Plan kodu ArvoOS'un bildirdiği listeden gelir; doğrulaması ArvoOS'ta.
  const planCode = String(formData.get("plan") ?? "").trim().slice(0, 64) || null;
  const result = await startSubscriptionCheckout({ id: user.id, email: user.email, fullName: profile?.full_name }, planCode);
  if (!result?.checkoutUrl) redirect("/dashboard?error=odeme-baslatilamadi");
  redirect(result.checkoutUrl);
}

/*
  Bireysel abonenin "Kredi satın al" düğmesi (Abonelik ve kredi sayfası).
  Tutar ve kredi miktarı ArvoOS'ta paket kodundan belirlenir; buradan
  yalnızca kod gider. Ödeme onaylanınca ArvoOS krediyi ArvoLab'daki
  bakiyeye yükler (ai_bireysel_kredi_yukle).

  Abonelik kapısı YOK: ödeme yolları asla kapatılmaz (lib/access.ts).
  Aboneliği kapalı kullanıcıya kredi satılmaması kararı ArvoOS'ta:
  kullanamayacağı krediye para almamak için orada reddediliyor.
*/
export async function krediSatinAl(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) redirect("/?error=session-missing");

  const profile = await getCurrentProfile();
  // Kurumun kredisini kurum yöneticisi ArvoOS panelinden alır.
  if (profile?.organization_id) redirect("/dashboard/abonelik?hata=kurum");

  const paket = String(formData.get("paket") ?? "").trim();
  if (!/^[a-z0-9_-]{1,32}$/i.test(paket)) redirect("/dashboard/abonelik?hata=paket");

  const result = await startCreditCheckout({ id: user.id, email: user.email, fullName: profile?.full_name }, paket);
  if (!result?.checkoutUrl) redirect("/dashboard/abonelik?hata=odeme");
  redirect(result.checkoutUrl);
}
