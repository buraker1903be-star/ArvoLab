"use server";

import { createClient } from "@/lib/supabase/server";
import { aiHataMesaji, sor } from "@/lib/ai/saglayici";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { asistanHakkiVar, asistanKapisi } from "@/lib/ai/erisim";
import { asistanKaydet } from "@/lib/ai/kayit";
import { belgeMetniOku } from "@/lib/document-extract";
import { PDF_EN_FAZLA_BAYT } from "@/lib/kaynak-pdf";
import {
  SORU_EN_UZUN,
  ilgiliSayfalar,
  kaynakCevabiCozumle,
  kaynakCevabiDenetle,
  kaynakIstemi,
  type KaynakAlintisi,
  type KaynakMesaji,
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
/* Kaynak PDF'leri için tek sınır (lib/kaynak-pdf.ts, kovanın sınırıyla
   aynı). Eskiden burada 25 MB yazıyordu: PDF'ler en fazla 20 MB
   indirilebildiği ve yüklenebildiği için denetim hiç tetiklenmiyor,
   tetiklenseydi de yanlış sınırı söylüyordu. */
const EN_BUYUK_PDF = PDF_EN_FAZLA_BAYT;

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
};

export async function kaynaklaSohbet(girdi: {
  projectId: string;
  pdfId: string;
  soru: string;
  gecmis?: KaynakMesaji[];
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
  const { data: satir, error } = await supabase
    .from("kaynak_pdfleri")
    .select("id, kunye, depo_yolu")
    .eq("id", girdi.pdfId)
    .eq("project_id", girdi.projectId)
    .maybeSingle();
  if (error) {
    console.error("[kaynak-sohbeti] satır okunamadı:", error.message);
    return { hata: t({ tr: "Kaynak okunamadı; tekrar deneyin.", en: "The source could not be read; try again." }) };
  }
  if (!satir?.depo_yolu) return { hata: t({ tr: "Bu kaynağın PDF'i yok; önce PDF'i bulun ya da yükleyin.", en: "This source has no PDF; find or upload it first." }) };

  const { data: dosya, error: indirmeHatasi } = await supabase.storage.from("project-files").download(satir.depo_yolu);
  if (indirmeHatasi || !dosya) {
    console.error("[kaynak-sohbeti] PDF indirilemedi:", indirmeHatasi?.message);
    return { hata: t({ tr: "PDF açılamadı; sayfayı yenileyip tekrar deneyin.", en: "The PDF couldn't be opened; refresh and try again." }) };
  }
  if (dosya.size > EN_BUYUK_PDF) return { hata: t({ tr: "PDF çok büyük (en fazla 20 MB).", en: "The PDF is too large (20 MB at most)." }) };

  let sayfalar: { num: number; text: string }[];
  try {
    const okunan = await belgeMetniOku(Buffer.from(await dosya.arrayBuffer()), "pdf");
    sayfalar = okunan.sayfalar ?? [{ num: 1, text: okunan.metin }];
  } catch (hata) {
    console.error("[kaynak-sohbeti] metin çıkarılamadı:", hata);
    return { hata: t({ tr: "PDF'in metni okunamadı.", en: "The PDF's text could not be read." }) };
  }
  /* Taranmış PDF: sayfalar resim, metin yok. Boş metinle soran model "kaynakta yok" derdi; doğrusu nedenini söylemek. */
  if (sayfalar.reduce((n, s) => n + s.text.trim().length, 0) < 200)
    return { hata: t({ tr: "Bu PDF taranmış bir görüntü gibi görünüyor; içindeki metin okunamıyor.", en: "This PDF looks like a scanned image; its text can't be read." }) };

  const gecmis: KaynakMesaji[] = (Array.isArray(girdi.gecmis) ? girdi.gecmis : [])
    .filter((m) => m && (m.rol === "kullanici" || m.rol === "asistan") && typeof m.metin === "string")
    .slice(-6);
  const { secilen, kirpildi } = ilgiliSayfalar(sayfalar, soru);
  const { mesajlar, kayitBaglami } = kaynakIstemi({ kunye: satir.kunye, sayfalar: secilen, soru, gecmis, dil });

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
    };
  } catch (hata) {
    const mesaj = aiHataMesaji(hata, dil) ?? t({ tr: "Asistan yanıt veremedi.", en: "The assistant couldn't respond." });
    console.error("[kaynak-sohbeti] başarısız", mesaj);
    await asistanKaydet({ ...ortak, durum: "failed" });
    return { hata: mesaj };
  }
}
