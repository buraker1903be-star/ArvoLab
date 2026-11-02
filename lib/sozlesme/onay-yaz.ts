import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Dil } from "@/lib/dil";
import { kullanimSozlesmesi, sozlesmeDuzMetni, SOZLESME_SURUMU } from "@/lib/sozlesme/kullanim-sozlesmesi";
import { konumOku, konumYazisi } from "@/lib/sozlesme/konum";
import { sendEmail } from "@/lib/email/resend";
import { sozlesmeOnayEmail } from "@/lib/email/auth-emails";

/*
  SÖZLEŞME ONAY KAYDINI YAZMAK (02.11.2026'da app/actions/sozlesme.ts'ten
  ayrıldı). İki yol aynı kaydı yazıyor: panel içindeki onay penceresi
  (sozlesmeyiOnayla) ve kayıt penceresindeki sözleşme kutusu (signUp). Kayıt
  bir DELİL; iki yerde ayrı yazılsaydı biri IP'yi, öteki konumu unuturdu.

  Bilerek "use server" DEĞİL (AGENTS.md): buradaki her export dışarıdan
  çağrılabilir bir uç noktaya dönüşürdü — onay kaydını kimin adına
  yazacağını çağıranın söylediği bir uç nokta.

  Delil değeri sunucunun okuduklarından gelir: IP, cihaz/tarayıcı ve dil
  istek BAŞLIKLARINDAN, zaman veritabanının saatinden (onaylandi default
  now()), metin özeti sunucudaki metinden.
*/

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** İstemcinin IP'si: Vercel x-forwarded-for'un ilk girdisini istemci olarak yazar. */
export function istemciIp(h: Headers): string | null {
  const ileri = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (ileri || h.get("x-real-ip") || "").slice(0, 100) || null;
}

export type OnayKopyasi = {
  onaylandi: string;
  surum: string;
  ozet: string;
  ip: string | null;
  konum: string | null;
  cihaz: string | null;
  odemeReferansi: string | null;
};

export async function onayKaydiYaz(
  admin: Admin,
  h: Headers,
  girdi: {
    userId: string;
    eposta: string | null;
    adSoyad: string | null;
    organizationId: string | null;
    dil: Dil;
    olay: "giris" | "odeme_sonrasi" | "kayit";
    odemeReferansi: string | null;
  },
): Promise<{ ok: true; kopya: OnayKopyasi } | { ok: false }> {
  const ozet = createHash("sha256").update(sozlesmeDuzMetni(girdi.dil), "utf8").digest("hex");
  const ip = istemciIp(h);
  const cihaz = (h.get("user-agent") ?? "").slice(0, 1000) || null;
  // Yaklaşık konum barındırıcının IP başlıklarından (lib/sozlesme/konum; 29.10.2026).
  const konum = konumOku((ad) => h.get(ad));

  const satir = {
    user_id: girdi.userId,
    belge: "kullanim_sozlesmesi",
    surum: SOZLESME_SURUMU,
    dil: girdi.dil,
    metin_ozeti: ozet,
    olay: girdi.olay,
    odeme_referansi: girdi.odemeReferansi,
    // Çağıranlar yalnızca okuma tamamlandıysa buraya gelir (kayıtta lib/kayit.ts, panelde sozlesmeyiOnayla).
    kaydirma_tamamlandi: true,
    ip,
    kullanici_araci: cihaz,
    tarayici_dili: (h.get("accept-language") ?? "").slice(0, 200) || null,
    eposta: girdi.eposta,
    ad_soyad: girdi.adSoyad,
    organization_id: girdi.organizationId,
  };
  const konumlu = { ...satir, ulke: konum.ulke, bolge: konum.bolge, sehir: konum.sehir, enlem: konum.enlem, boylam: konum.boylam, saat_dilimi: konum.saatDilimi };
  let { data: kayit, error } = await admin.from("sozlesme_onaylari").insert(konumlu).select("onaylandi").single();
  /*
    Konum sütunları henüz yoksa (kod 20261029163058 migration'ından önce
    canlıya çıktıysa) onay KONUMSUZ yazılır: aksi hâlde insert düşer ve
    kullanıcı kapatılamaz pencerede kalırdı. Konum bir sonraki onayda gelir.
  */
  if (error && (error.code === "PGRST204" || error.code === "42703")) {
    console.error("[sözleşme] konum sütunları yok; onay konumsuz yazılıyor", error.message);
    ({ data: kayit, error } = await admin.from("sozlesme_onaylari").insert(satir).select("onaylandi").single());
  }
  if (error || !kayit) {
    console.error("[sözleşme] onay yazılamadı", girdi.olay, error?.code, error?.message);
    return { ok: false };
  }
  return {
    ok: true,
    kopya: { onaylandi: kayit.onaylandi as string, surum: SOZLESME_SURUMU, ozet, ip, konum: konumYazisi(konum), cihaz, odemeReferansi: girdi.odemeReferansi },
  };
}

/*
  Kopyanın gönderimi ve SONUCUN günlüğe yazılması. Eskiden sendEmail'in
  dönüşü okunmuyordu: başarılı gönderim hiçbir iz bırakmıyordu, kullanıcı
  "e-posta gelmedi" dediğinde gönderimin denenip denenmediği, sağlayıcının
  kabul edip etmediği günlükten anlaşılamıyordu (29.10.2026). Şimdi her
  sonuç (Resend ileti kimliğiyle) günlükte.
*/
export async function onayKopyasiGonder(eposta: string, dil: Dil, kayit: OnayKopyasi): Promise<boolean> {
  try {
    const sonuc = await sendEmail({
      to: eposta,
      ...sozlesmeOnayEmail(
        {
          ...kullanimSozlesmesi(dil),
          surum: kayit.surum,
          ozet: kayit.ozet,
          zaman: new Date(kayit.onaylandi).toLocaleString(dil === "en" ? "en-GB" : "tr-TR", { timeZone: "Europe/Istanbul" }) + " (Europe/Istanbul)",
          ip: kayit.ip,
          konum: kayit.konum,
          cihaz: kayit.cihaz,
          odemeReferansi: kayit.odemeReferansi,
        },
        dil,
      ),
    });
    if (sonuc.ok) console.info("[sözleşme] kopya e-postası gönderildi", sonuc.id ?? "(kimlik yok)");
    else console.error("[sözleşme] kopya e-postası gönderilemedi", sonuc.reason);
    return sonuc.ok;
  } catch (sorun) {
    console.error("[sözleşme] kopya e-postası gönderilemedi", sorun instanceof Error ? sorun.message : sorun);
    return false;
  }
}
