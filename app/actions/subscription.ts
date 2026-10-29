"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/app/actions/profile";
import { kurumKrediOdemesiBaslat, startCreditCheckout, startSubscriptionCheckout } from "@/lib/subscription";
import { faturalamaKapsamim } from "@/lib/faturalama-sunucu";
import { kurumKrediHataAnahtari } from "@/lib/kart-odeme";

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
  // Kurum yolundaki gibi yalnızca https: köprü yanıtı bozulursa başka bir şemaya gidilmesin.
  if (!result?.checkoutUrl || !/^https:\/\//i.test(result.checkoutUrl)) redirect("/dashboard?error=odeme-baslatilamadi");
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
  // Kurumun kredisini kurum yöneticisi alır (kurumKrediSatinAl).
  if (profile?.organization_id) redirect("/dashboard/abonelik?hata=kurum");

  const paket = String(formData.get("paket") ?? "").trim();
  if (!/^[a-z0-9_-]{1,32}$/i.test(paket)) redirect("/dashboard/abonelik?hata=paket");

  const result = await startCreditCheckout({ id: user.id, email: user.email, fullName: profile?.full_name }, paket);
  if (!result?.checkoutUrl || !/^https:\/\//i.test(result.checkoutUrl)) redirect("/dashboard/abonelik?hata=odeme");
  redirect(result.checkoutUrl);
}

/*
  Kurumun "Kredi satın al" düğmesi (28.10.2026, kurum sahibinin kararı:
  ArvoOS panelinde yalnızca "Abonelik ve faturalama" kaldı, kurum
  yöneticisi krediyi buradan alıyor). Eskiden kurum üyesi bu sayfadan
  ArvoOS paneline gönderiliyordu.

  Yetki faturaları görmekle AYNI karar (faturalamaKapsamim): kurumun
  Akademik Yöneticisi kendi kurumu için, iç ekip kurum seçicide seçtiği
  kurum için. Köprü kurumu kimliğiyle tanıyor, kişiyi tanımıyor; bu
  denetim burada yapılmazsa herhangi bir kurum üyesi (ya da işlemi
  doğrudan çağıran biri) başka bir kurum adına ödeme bağlantısı açabilirdi.
  Kurum kimliği formdan ALINMAZ, kapsamdan gelir.

  Abonelik kapısı YOK: ödeme yolları asla kapatılmaz (lib/access.ts).
*/
export async function kurumKrediSatinAl(formData: FormData) {
  const kapsamim = await faturalamaKapsamim();
  if (!kapsamim) redirect("/?error=session-missing");
  const { kapsam } = kapsamim;
  if (!kapsam || kapsam.tur !== "kurum") redirect("/dashboard/abonelik?hata=kurum");

  const paket = String(formData.get("paket") ?? "").trim();
  if (!/^[a-z0-9_-]{1,32}$/i.test(paket)) redirect("/dashboard/abonelik?hata=paket");

  const sonuc = await kurumKrediOdemesiBaslat(kapsam.kurumId, paket);
  /* platform_self: seçili kurum ArvoOS'un kendisi (lib/subscription.ts → platformKurumu). */
  if (!sonuc.ok) redirect(`/dashboard/abonelik?hata=${kurumKrediHataAnahtari(sonuc.hata)}`);
  redirect(sonuc.veri);
}
