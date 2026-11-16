import type { SupabaseClient } from "@supabase/supabase-js";
import type { Metin } from "./dil";
import { belgeMetniOku } from "./document-extract";
import { PDF_EN_FAZLA_BAYT } from "./kaynak-pdf";

/*
  KAYNAK PDF'İNİN SAYFA METNİ (16.11.2026). Bilerek "use server" DEĞİL
  (AGENTS.md): yardımcı, iki sunucu işlemi kullanıyor — kaynakla sohbet
  (app/actions/ai-kaynak-sohbeti.ts) ve görüntüleyicide seçilen pasajın
  doğrulanması (app/actions/kaynak-pdf.ts). Eskiden bu dizi yalnızca
  sohbetin içindeydi; ikinci bir kopya, PDF sınırı ya da taranmış PDF
  kuralı değiştiğinde sapacaktı.

  Satır ve dosya ÇAĞIRANIN istemcisiyle okunur (RLS: çalışmanın klasörü;
  depolama politikası): başkasının PDF kimliği gönderilirse satır dönmez.
*/

export type PdfSayfaMetni = { num: number; text: string };

export type PdfOkumaSonucu =
  | { ok: true; kunye: string; doi: string | null; sayfalar: PdfSayfaMetni[] }
  | { ok: false; hata: Metin };

export async function kaynakPdfSayfalari(supabase: SupabaseClient, projectId: string, pdfId: string, iz = "[kaynak-pdf]"): Promise<PdfOkumaSonucu> {
  const { data: satir, error } = await supabase
    .from("kaynak_pdfleri")
    .select("id, kunye, doi, depo_yolu")
    .eq("id", pdfId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) {
    console.error(`${iz} satır okunamadı:`, error.message);
    return { ok: false, hata: { tr: "Kaynak okunamadı; tekrar deneyin.", en: "The source could not be read; try again." } };
  }
  if (!satir?.depo_yolu) return { ok: false, hata: { tr: "Bu kaynağın PDF'i yok; önce PDF'i bulun ya da yükleyin.", en: "This source has no PDF; find or upload it first." } };

  const { data: dosya, error: indirmeHatasi } = await supabase.storage.from("project-files").download(satir.depo_yolu);
  if (indirmeHatasi || !dosya) {
    console.error(`${iz} PDF indirilemedi:`, indirmeHatasi?.message);
    return { ok: false, hata: { tr: "PDF açılamadı; sayfayı yenileyip tekrar deneyin.", en: "The PDF couldn't be opened; refresh and try again." } };
  }
  /* Kaynak PDF'leri için tek sınır (lib/kaynak-pdf.ts, kovanın sınırıyla aynı). */
  if (dosya.size > PDF_EN_FAZLA_BAYT) return { ok: false, hata: { tr: "PDF çok büyük (en fazla 20 MB).", en: "The PDF is too large (20 MB at most)." } };

  let sayfalar: PdfSayfaMetni[];
  try {
    const okunan = await belgeMetniOku(Buffer.from(await dosya.arrayBuffer()), "pdf");
    sayfalar = okunan.sayfalar ?? [{ num: 1, text: okunan.metin }];
  } catch (hata) {
    console.error(`${iz} metin çıkarılamadı:`, hata);
    return { ok: false, hata: { tr: "PDF'in metni okunamadı.", en: "The PDF's text could not be read." } };
  }
  /* Taranmış PDF: sayfalar resim, metin yok. Boş metinle soran model "kaynakta yok" derdi; doğrusu nedenini söylemek. */
  if (sayfalar.reduce((n, s) => n + s.text.trim().length, 0) < 200)
    return { ok: false, hata: { tr: "Bu PDF taranmış bir görüntü gibi görünüyor; içindeki metin okunamıyor.", en: "This PDF looks like a scanned image; its text can't be read." } };

  return { ok: true, kunye: satir.kunye, doi: satir.doi ?? null, sayfalar };
}

/* Seçim doğrulamasının ret metinleri (sohbet ve atıf aynı metni gösterir). */
export const SECIM_RET_METNI: Record<"kisa" | "uzun" | "sayfa_yok" | "metinde_yok", Metin> = {
  kisa: { tr: "Seçim çok kısa; en az birkaç kelimelik bir pasaj seçin.", en: "The selection is too short; select a passage of at least a few words." },
  uzun: { tr: "Seçim çok uzun; en fazla bir paragraf seçin.", en: "The selection is too long; select at most one paragraph." },
  sayfa_yok: { tr: "Seçilen sayfa PDF'te bulunamadı.", en: "The selected page wasn't found in the PDF." },
  metinde_yok: {
    tr: "Seçtiğiniz metin PDF'in metin katmanında birebir bulunamadı. İki sütunlu sayfada sütunlar arası seçim ya da taranmış sayfa olabilir; tek sütundan daha kısa bir pasaj seçin.",
    en: "The text you selected wasn't found word for word in the PDF's text layer. This can happen across columns or on scanned pages; select a shorter passage from a single column.",
  },
};
