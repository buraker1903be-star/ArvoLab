"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/app/actions/profile";
import { ceviri } from "@/lib/dil-sunucu";
import { KART_KIMLIGI, istemciIpsi, kartHataAnahtari, siparisNoMu } from "@/lib/kart-odeme";
import { KART_CEREZI_AZAMI, KART_CEREZI_OMRU, KART_CEREZI_YOLU, kartCereziAdi, kartOturumuOku, kartOturumuYaz } from "@/lib/kart-oturumu";
import { kartOdemesiBaslat, kartOnayiBildir, kayitliKartSil, otomatikYenilemeKapat } from "@/lib/subscription";

/*
  KARTLA ÖDEME VE KAYITLI KART (28.10.2026). Bireysel abonenin işlemleri;
  ödeme ArvoOS'ta (lib/subscription.ts → kart köprüsü).

  Abonelik kapısı YOK, bilerek (lib/access.ts listesi): ödeme yolu asla
  kapatılmaz, kart silmek ve otomatik yenilemeyi kapatmak da aboneliği
  kapalı kullanıcının kendi parasını korumasıdır.

  Kurum üyesine kişisel ödeme alınmaz (payArvolabSubscription ile aynı
  kural); ArvoOS da 409 organization_license ile reddediyor, burada
  önceden kesilmesi kullanıcıya doğru uyarıyı daha erken veriyor.
*/

async function bireyselKullanici() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const profile = await getCurrentProfile();
  return { id: user.id, email: user.email, fullName: profile?.full_name ?? null, kurumlu: Boolean(profile?.organization_id) };
}

async function istekIpsi() {
  const h = await headers();
  return istemciIpsi(h.get("x-forwarded-for"), h.get("x-real-ip"));
}

/**
 * "Kartla öde" düğmesi. Ödeme kaydı BURADA açılır, kart sayfasının
 * çiziminde değil: sayfa yenilendikçe ya da önceden getirildikçe ArvoOS'ta
 * yeni ödeme kaydı birikmesin. Sayfanın ihtiyacı olan yanıt kısa ömürlü
 * bir çerezle taşınır (lib/kart-oturumu.ts).
 */
export async function kartlaOdemeBaslat() {
  const kullanici = await bireyselKullanici();
  if (!kullanici) redirect("/?error=session-missing");
  if (kullanici.kurumlu) redirect("/dashboard/abonelik?hata=kart_kurum");

  const ip = await istekIpsi();
  if (!ip) redirect("/dashboard/abonelik?hata=kart_ip");

  const sonuc = await kartOdemesiBaslat(kullanici, ip);
  if (!sonuc.ok) redirect(`/dashboard/abonelik?hata=${kartHataAnahtari(sonuc.hata)}`);

  const deger = kartOturumuYaz(kullanici.id, sonuc.veri);
  if (deger.length > KART_CEREZI_AZAMI) {
    console.error("[kart] ödeme oturumu çereze sığmıyor", deger.length);
    redirect("/dashboard/abonelik?hata=kart");
  }
  (await cookies()).set(kartCereziAdi(sonuc.veri.merchantOid), deger, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: KART_CEREZI_YOLU,
    maxAge: KART_CEREZI_OMRU,
  });
  redirect(`${KART_CEREZI_YOLU}/${sonuc.veri.merchantOid}`);
}

/**
 * Kart formu PayTR'ye gönderilmeden hemen önce çağrılır: kullanıcının
 * "kartımı kaydet" kararı (işaretli ya da DEĞİL) ödemeden önce ArvoOS'a
 * yazılmalı. Hata dönerse form gönderilmez.
 */
export async function kartOnayiKaydet(merchantOid: string, autoRenew: boolean): Promise<{ error?: string }> {
  const t = await ceviri();
  const kullanici = await bireyselKullanici();
  if (!kullanici) return { error: t({ tr: "Oturumunuz sona erdi; yeniden giriş yapın.", en: "Your session has ended; please sign in again." }) };

  /*
    Sipariş numarası istemciden geliyor: yalnızca bu tarayıcıda, bu
    kullanıcı için açılmış bir ödeme oturumu varsa kabul edilir. Yoksa
    biri başka bir sipariş numarasına kendi adına onay yazdırmaya
    çalışabilirdi (ArvoOS da kullanıcıyı ayrıca eşliyor).
  */
  const oturum = siparisNoMu(merchantOid)
    ? kartOturumuOku((await cookies()).get(kartCereziAdi(merchantOid))?.value, merchantOid, kullanici.id)
    : null;
  if (!oturum) {
    return {
      error: t({
        tr: "Ödeme oturumunun süresi doldu. Abonelik sayfasına dönüp ödemeyi yeniden başlatın.",
        en: "The payment session has expired. Return to the subscription page and start the payment again.",
      }),
    };
  }

  const ip = await istekIpsi();
  if (!ip) return { error: t({ tr: "Bağlantınızın adresi okunamadı; sayfayı yenileyip tekrar deneyin.", en: "Your connection address could not be read; refresh the page and try again." }) };

  const sonuc = await kartOnayiBildir(kullanici, merchantOid, autoRenew === true, ip);
  if (!sonuc.ok) {
    return {
      error: t({
        tr: "Tercihiniz kaydedilemedi, ödeme gönderilmedi. Biraz sonra tekrar deneyin.",
        en: "Your choice could not be saved, so the payment was not sent. Try again shortly.",
      }),
    };
  }
  return {};
}

export async function otomatikYenilemeyiKapat() {
  const kullanici = await bireyselKullanici();
  if (!kullanici) redirect("/?error=session-missing");
  const sonuc = await otomatikYenilemeKapat(kullanici);
  redirect(sonuc.ok ? "/dashboard/abonelik?kart=yenileme_kapali" : "/dashboard/abonelik?hata=kart_islem");
}

export async function kayitliKartiSil(formData: FormData) {
  const kullanici = await bireyselKullanici();
  if (!kullanici) redirect("/?error=session-missing");
  const kartId = String(formData.get("kart") ?? "").trim();
  if (!KART_KIMLIGI.test(kartId)) redirect("/dashboard/abonelik?hata=kart_islem");
  const sonuc = await kayitliKartSil(kullanici, kartId);
  redirect(sonuc.ok ? "/dashboard/abonelik?kart=silindi" : "/dashboard/abonelik?hata=kart_islem");
}
