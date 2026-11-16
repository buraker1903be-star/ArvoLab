"use server";

import { createClient } from "@/lib/supabase/server";
import { aiHataMesaji, sor } from "@/lib/ai/saglayici";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { asistanHakkiVar, asistanKapisi } from "@/lib/ai/erisim";
import { asistanKaydet } from "@/lib/ai/kayit";
import { kaynakPdfSayfalari, SECIM_RET_METNI } from "@/lib/kaynak-pdf-okuma";
import { secimSayfalari, secimiDogrula } from "@/lib/pdf-secim";
import {
  SORU_EN_UZUN,
  ilgiliSayfalar,
  kaynakCevabiCozumle,
  kaynakCevabiDenetle,
  kaynakIstemi,
  type KaynakAlintisi,
  type KaynakMesaji,
  type SeciliPasaj,
} from "@/lib/ai/kaynak-sohbeti";

/*
  KAYNAKLA SOHBET EYLEMİ (03.11.2026). Kurallar lib/ai/kaynak-sohbeti.ts'te.

  PDF istemciden GELMEZ: kaynak_pdfleri satırı (RLS: çalışmanın klasörü)
  ve depodaki dosya sunucuda okunur. Başkasının çalışmasının PDF kimliği
  gönderilse satır dönmez. Metin her soruda yeniden çıkarılır: tipik bir
  makalede bir saniyenin altında; ayrı bir metin tablosu tutmak, PDF
  değiştiğinde bayat kalacak ikinci bir kopya demekti.

  Dış maliyet doğurduğu için abonelik kapısından geçer (asistanKapisi).
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type KaynakSohbetYaniti = {
  hata?: string;
  odemeGerekli?: boolean;
  bulundu?: boolean;
  cevap?: string;
  alintilar?: KaynakAlintisi[];
  /** Kaynak bütçeye sığmadı: bu kadar sayfa okunmadı */
  okunmayanSayfa?: number;
  kayitId?: string | null;
  krediUyarisi?: string;
  /** Seçim kaynak metninde doğrulanamadı (neden); cevap üretilmedi. */
  secimReddi?: "kisa" | "uzun" | "sayfa_yok" | "metinde_yok";
  /** Doğrulanmış seçim: sunucunun kendi metninden kesilen pasaj ve sayfası. */
  secim?: { sayfa: number; metin: string };
  /** Cevabın ilişkilendirildiği kaynak (PDF satırının künyesi). */
  kunye?: string;
};

export async function kaynaklaSohbet(girdi: {
  projectId: string;
  pdfId: string;
  soru: string;
  gecmis?: KaynakMesaji[];
  /** Görüntüleyicide seçilen pasaj (PDF sayfası, 1 tabanlı). Sunucuda doğrulanır. */
  secim?: { sayfa: number; metin: string } | null;
}): Promise<KaynakSohbetYaniti> {
  const t = await ceviri();
  const dil = await aktifDil();
  if (!UUID.test(String(girdi.projectId ?? "")) || !UUID.test(String(girdi.pdfId ?? "")))
    return { hata: t({ tr: "Kaynak bulunamadı.", en: "Source not found." }) };
  const soru = String(girdi.soru ?? "").slice(0, SORU_EN_UZUN).trim();
  if (soru.length < 3) return { hata: t({ tr: "Kaynağa sormak istediğinizi yazın.", en: "Write what you want to ask the source." }) };

  const kapi = await asistanKapisi(dil);
  if (!kapi.ok) return { hata: kapi.hata, odemeGerekli: kapi.odemeGerekli };

  const supabase = await createClient();
  const okuma = await kaynakPdfSayfalari(supabase, girdi.projectId, girdi.pdfId, "[kaynak-sohbeti]");
  if (!okuma.ok) return { hata: t(okuma.hata) };
  const { sayfalar } = okuma;
  const satir = { kunye: okuma.kunye };

  /*
    SEÇİLİ PASAJ (16.11.2026, Yazım Stüdyosu): görüntüleyicide seçilen metin
    sunucunun sayfa metninde doğrulanır (lib/pdf-secim.ts); asistana
    istemcinin metni değil, kaynaktan kesilen kanonik parça gider. Doğrulama
    model çağrısından ÖNCE: reddedilen seçim asistan hakkı harcamaz.
  */
  let secim: SeciliPasaj | null = null;
  let sonrakiSayfaya = false;
  if (girdi.secim) {
    const sonuc = secimiDogrula(String(girdi.secim.metin ?? ""), sayfalar, Number(girdi.secim.sayfa));
    if (!sonuc.gecti) return { hata: t(SECIM_RET_METNI[sonuc.neden]), secimReddi: sonuc.neden };
    secim = { sayfa: sonuc.sayfa, metin: sonuc.kanonik };
    sonrakiSayfaya = Boolean(sonuc.sonrakiSayfaya);
  }

  const gecmis: KaynakMesaji[] = (Array.isArray(girdi.gecmis) ? girdi.gecmis : [])
    .filter((m) => m && (m.rol === "kullanici" || m.rol === "asistan") && typeof m.metin === "string")
    .slice(-6);
  /* Seçim varsa okunacak sayfalar seçimin çevresi (lib/pdf-secim.ts); yoksa soruyla en ilgili sayfalar. */
  const { secilen, kirpildi } = secim ? { secilen: secimSayfalari(sayfalar, secim.sayfa, sonrakiSayfaya), kirpildi: 0 } : ilgiliSayfalar(sayfalar, soru);
  const { mesajlar, kayitBaglami } = kaynakIstemi({ kunye: satir.kunye, sayfalar: secilen, soru, gecmis, dil, secim });

  const hakHatasi = await asistanHakkiVar(kapi.kullaniciId, dil);
  if (hakHatasi) return { hata: hakHatasi };

  const basladi = Date.now();
  const ortak = { kullaniciId: kapi.kullaniciId, calismaId: girdi.projectId, yetenek: "kaynak" as const, baglam: kayitBaglami, basladi };
  try {
    const yanit = await sor(mesajlar, { yetenek: "kaynak", jsonBekle: true, sicaklik: 0, enFazlaJeton: 2_500, zamanAsimiMs: 100_000 });
    const cevap = kaynakCevabiCozumle(yanit.metin);
    if (!cevap) {
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: "bos", model: yanit.model, cikti: yanit.metin });
      return { hata: t({ tr: "Asistan bir cevap üretemedi; soruyu biraz daha açık yazın.", en: "The assistant couldn't answer; rephrase the question." }) };
    }
    const denetim = kaynakCevabiDenetle(cevap, secilen, soru);
    if (!denetim.gecti) {
      await asistanKaydet({ ...ortak, durum: "rejected", redNedeni: denetim.neden, model: yanit.model, cikti: yanit.metin, bulgular: { ayrinti: denetim.ayrinti } });
      return {
        hata:
          denetim.neden === "alinti"
            ? t({
                tr: "Asistanın gösterdiği alıntı kaynakta birebir bulunamadığı için cevap gösterilmedi. Soruyu farklı sorup tekrar deneyin.",
                en: "The answer wasn't shown because the quote the assistant gave isn't in the source word for word. Rephrase and try again.",
              })
            : denetim.neden === "kunye"
              ? t({ tr: "Asistan kaynakta olmayan bir atıf yazdığı için cevap gösterilmedi.", en: "The answer wasn't shown because the assistant cited something that isn't in the source." })
              : t({
                  tr: `Asistan kaynakta olmayan bir sayı yazdığı için cevap gösterilmedi (${denetim.ayrinti.slice(0, 3).join(", ")}).`,
                  en: `The answer wasn't shown because the assistant wrote a number that isn't in the source (${denetim.ayrinti.slice(0, 3).join(", ")}).`,
                }),
      };
    }
    const kayitId = await asistanKaydet({ ...ortak, durum: "completed", model: yanit.model, cikti: yanit.metin, bulgular: denetim.cevap });
    return {
      bulundu: denetim.cevap.bulundu,
      cevap: denetim.cevap.cevap,
      alintilar: denetim.cevap.alintilar,
      okunmayanSayfa: kirpildi || undefined,
      kayitId,
      krediUyarisi: kapi.uyari ?? undefined,
      secim: secim ?? undefined,
      kunye: satir.kunye,
    };
  } catch (hata) {
    const mesaj = aiHataMesaji(hata, dil) ?? t({ tr: "Asistan yanıt veremedi.", en: "The assistant couldn't respond." });
    console.error("[kaynak-sohbeti] başarısız", mesaj);
    await asistanKaydet({ ...ortak, durum: "failed" });
    return { hata: mesaj };
  }
}
