import type { SupabaseClient } from "@supabase/supabase-js";
import type { Metin } from "./dil";
import { belgeMetniOku } from "./document-extract";
import { PDF_EN_FAZLA_BAYT } from "./kaynak-pdf";
import { PDF_ISLEM_PENCERE, pdfIslemAnahtari, pdfIslemHakki, pdfIslemKarari } from "./pdf-islem-siniri";
import { SinirliOnbellek } from "./sinirli-onbellek";
import { adminIstemcisiVarsa } from "./supabase/admin";

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

type Cozumleme = { ok: true; sayfalar: PdfSayfaMetni[] } | { ok: false; hata: Metin };

/*
  ÖNBELLEK (17.11.2026, RELEASE CLOSURE 05): çıkarılmış sayfa metni sunucu
  sürecinin belleğinde, sınırlı (lib/sinirli-onbellek.ts). Anahtar PDF'in
  depo yolu: yollar her yüklemede yeni bir rastgele kimlik taşıyor ve
  dosyalar üzerine yazılmıyor (upsert: false, lib/kaynak-pdf-yazimi.ts),
  yani aynı yolun içeriği değişmez — eski içerik riski yok; PDF yenilenirse
  satır yeni yolu gösterir, eski kayıt ömrü dolunca düşer.

  YETKİ her okumada, önbellekten ÖNCE: satır kullanıcının kendi istemcisiyle
  (RLS) okunur ve depo nesnesine erişimi HEAD isteğiyle (depolama politikası)
  yeniden sınanır. Satır politikası ile depolama politikası birebir aynı
  değil (satır çalışmayı görebilen herkese, dosya klasör sahibine, çalışmayı
  görebilene ve kurum gözetimine açık); bu yüzden satırı okuyabilmek tek
  başına yetmez. Önbellek yalnızca serverless örneğin kendi belleği; örnekler
  arasında paylaşılmaz.

  Aynı PDF için aynı anda gelen istekler TEK çözümlemeyi bekler (süren işler
  haritası): on eşzamanlı seçim on kez 20 MB indirmez, sayaçtan da bir
  birim düşer.
*/
const SAYFA_ONBELLEGI = new SinirliOnbellek<PdfSayfaMetni[]>({
  enCokKayit: 16,
  enCokBirim: 12_000_000,
  omurMs: 10 * 60 * 1000,
  birim: (sayfalar) => sayfalar.reduce((n, s) => n + s.text.length, 0),
});
const SUREN = new Map<string, Promise<Cozumleme>>();

const SINIR_DOLDU = (hak: number): Metin => ({
  tr: `Bir saatte en çok ${hak} PDF işlenebiliyor; bu sınıra ulaştınız. Aynı PDF'te yaptığınız seçimler etkilenmez; yeni bir PDF için biraz sonra tekrar deneyin.`,
  en: `Up to ${hak} PDFs can be processed per hour and you've reached that limit. Selections in a PDF you already opened aren't affected; try a new PDF a little later.`,
});
const SAYAC_ARIZASI: Metin = {
  tr: "PDF işleme sayacına şu anda ulaşılamıyor; güvenlik için PDF işlenmedi. Biraz sonra tekrar deneyin.",
  en: "The PDF processing counter is unavailable right now, so the PDF wasn't processed for safety. Please try again shortly.",
};

async function pdfIslemIzni(kullaniciId: string, iz: string): Promise<Metin | null> {
  const hak = pdfIslemHakki(process.env.PDF_ISLEM_SAATLIK);
  const admin = adminIstemcisiVarsa();
  let cevap: { data: unknown; error: { message: string } | null } | null = null;
  if (admin) {
    try {
      cevap = await admin.rpc("rate_limit_hit", { p_key: pdfIslemAnahtari(kullaniciId), p_limit: hak, p_window: PDF_ISLEM_PENCERE });
    } catch (hata) {
      cevap = { data: null, error: { message: hata instanceof Error ? hata.message : String(hata) } };
    }
  }
  const karar = pdfIslemKarari({ sayacVar: Boolean(admin), hata: cevap?.error, veri: cevap?.data });
  if (karar === "izin") return null;
  if (karar === "doldu") return SINIR_DOLDU(hak);
  console.error(`${iz} PDF işlem sayacı çalışmadı:`, admin ? (cevap?.error?.message ?? "beklenmeyen cevap") : "sunucu anahtarı yok");
  return SAYAC_ARIZASI;
}

async function cozumle(supabase: SupabaseClient, depoYolu: string, iz: string): Promise<Cozumleme> {
  const { data: dosya, error: indirmeHatasi } = await supabase.storage.from("project-files").download(depoYolu);
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
  return { ok: true, sayfalar };
}

export async function kaynakPdfSayfalari(
  supabase: SupabaseClient,
  kullaniciId: string,
  projectId: string,
  pdfId: string,
  iz = "[kaynak-pdf]",
): Promise<PdfOkumaSonucu> {
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
  const depoYolu: string = satir.depo_yolu;
  const bitir = (c: Cozumleme): PdfOkumaSonucu => (c.ok ? { ok: true, kunye: satir.kunye, doi: satir.doi ?? null, sayfalar: c.sayfalar } : c);

  const onbellekte = SAYFA_ONBELLEGI.get(depoYolu);
  const suren = SUREN.get(depoYolu);
  if (onbellekte || suren) {
    // Önbellek ya da başkasının süren çözümlemesi: depo erişimi bu kullanıcı için yeniden sınanır.
    const { data: var_, error: erisimHatasi } = await supabase.storage.from("project-files").exists(depoYolu);
    if (erisimHatasi || var_ !== true) {
      console.error(`${iz} önbellekteki PDF'e depo erişimi doğrulanamadı:`, erisimHatasi?.message ?? "erişim yok");
      return { ok: false, hata: { tr: "PDF açılamadı; sayfayı yenileyip tekrar deneyin.", en: "The PDF couldn't be opened; refresh and try again." } };
    }
    if (onbellekte) return bitir({ ok: true, sayfalar: onbellekte });
    return bitir(await suren!);
  }

  /*
    Pahalı iş (indirme + metin çıkarma) yalnızca sayaç izin verirse. İş, haritaya
    yukarıdaki SUREN.get ile AYNI eşzamanlı adımda (arada await yok) yazılır;
    sayaç çağrısı işin İÇİNDE. Eskiden önce sayaç bekleniyor, iş haritaya sonra
    yazılıyordu: o ağ gidiş-dönüşü sırasında gelen eşzamanlı istekler de haritayı
    boş görüyor, her biri sayaçtan bir birim düşüp PDF'i ayrıca indiriyordu
    (RC06, 17.11.2026, next start: aynı süreçte 10 eşzamanlı istek → 2 çözümleme,
    iki örnekte 3). Bekleyenler sonucu paylaşır; depo erişimleri yukarıda
    kendileri için ayrıca sınanmıştı. Tekilleştirme yalnızca SÜREÇ İÇİNDE:
    serverless örnekleri arasında paylaşılan bir önbellek yok.
  */
  const is = (async (): Promise<Cozumleme> => {
    const sinir = await pdfIslemIzni(kullaniciId, iz);
    if (sinir) return { ok: false, hata: sinir };
    const c = await cozumle(supabase, depoYolu, iz);
    if (c.ok) SAYFA_ONBELLEGI.set(depoYolu, c.sayfalar);
    return c;
  })();
  SUREN.set(depoYolu, is);
  try {
    return bitir(await is);
  } finally {
    SUREN.delete(depoYolu);
  }
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
