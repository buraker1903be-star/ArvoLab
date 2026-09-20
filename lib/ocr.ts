/*
  Taranmış (görüntü) PDF'lerden metin çıkarma.

  Türk üniversitelerinin kılavuzlarının bir bölümü, imzalı nüshanın
  taratılmasıyla üretilmiş görüntü PDF'lerdir. pdf-parse bunlardan BOŞ metin
  döndürüyor; hata da vermiyor. Sonuç: kural çıkarımı hiçbir şey bulamıyor,
  güven 0 çıkıyor ve kayıt sessizce "inceleme gerekli"de kalıyordu. Kimse
  belgenin okunamadığını bilmiyordu — kılavuz sanki kötü yazılmış gibi
  görünüyordu.

  OCR yalnızca GEREKTİĞİNDE çalışır: metin zaten çıkmışsa dokunulmaz.
  Sayfa sayısı sınırlı tutulur; kılavuzun kimliği (kapak) ve biçim kuralları
  ilk sayfalarda olur, 70 sayfalık bir belgenin tamamını taramak gece
  turunun bütçesini yer.

  OCR metni GÜRÜLTÜLÜDÜR. Ölçüldü: "GAZİ ÜNİVERSİTESİ" doğru okunurken
  "ÜNİVERSİTESİ" bir yerde "ONİVER" çıkabiliyor. Bu yüzden OCR'dan gelen
  çıkarım hiçbir zaman "tek adım onaya hazır" sayılmaz; yönetici gözüyle
  bakmalıdır (supabase/migrations/…_kilavuz_ocr.sql).
*/

/** OCR'a girilecek en fazla sayfa; kapak ve ilk kural sayfaları yeterli. */
const EN_FAZLA_SAYFA = 8;

/** Sayfa başına ortalama bu kadar karakterden azsa belge taranmış sayılır. */
const SAYFA_BASINA_ESIK = 100;

export type OcrSonucu = { metin: string; sayfa: number; guven: number };

/**
 * Belge taranmış (görüntü) bir PDF mi?
 *
 * Metin PDF'i sayfa başına binlerce karakter verir; taranmış olan neredeyse
 * hiç vermez. Eşik ortada tutuldu: kapağı metin, gövdesi görüntü olan
 * karma belgeler de OCR'a girsin.
 */
export function taranmisBelgeMi(metin: string, sayfaSayisi: number): boolean {
  if (sayfaSayisi <= 0) return false;
  return metin.trim().length / sayfaSayisi < SAYFA_BASINA_ESIK;
}

/**
 * PDF'in ilk sayfalarını görüntüye çevirip OCR ile okur.
 *
 * Başarısızlık akışı düşürmez: OCR yapılamazsa boş metin döner ve çağıran
 * eski davranışa (metinsiz belge) geri düşer. Kılavuz taraması, tek bir
 * belgenin okunamaması yüzünden durmamalı.
 */
export async function pdfMetniniOcrIleOku(veri: Buffer, sayfaSayisi: number): Promise<OcrSonucu> {
  const sayfa = Math.min(sayfaSayisi || 1, EN_FAZLA_SAYFA);

  try {
    /*
      pdf.js tarayıcı API'lerini bekliyor; sunucuda @napi-rs/canvas
      karşılıklarıyla besleniyor (guideline-scan.ts ile aynı kalıp).
    */
    const canvas = await import("@napi-rs/canvas");
    Object.assign(globalThis, {
      DOMMatrix: globalThis.DOMMatrix ?? canvas.DOMMatrix,
      ImageData: globalThis.ImageData ?? canvas.ImageData,
      Path2D: globalThis.Path2D ?? canvas.Path2D,
    });

    const { PDFParse } = await import("pdf-parse");
    const ayristirici = new PDFParse({ data: veri });
    let goruntuler: Buffer<ArrayBuffer>[] = [];
    try {
      // scale 2: 1'de Türkçe aksanlar okunamıyor, 3'te süre iki katına çıkıyor.
      const cekim = await ayristirici.getScreenshot({ first: 1, last: sayfa, scale: 2 });
      goruntuler = (cekim.pages ?? [])
        .map((p: { data?: Uint8Array; dataUrl?: string }) =>
          p.data ? Buffer.from(p.data) : p.dataUrl ? Buffer.from(p.dataUrl.split(",").pop() ?? "", "base64") : null,
        )
        .filter((b): b is Buffer<ArrayBuffer> => Boolean(b?.length));
    } finally {
      await ayristirici.destroy();
    }
    if (!goruntuler.length) return { metin: "", sayfa: 0, guven: 0 };

    const { createWorker } = await import("tesseract.js");
    const { tmpdir } = await import("node:os");
    /*
      cachePath /tmp olmalı: tesseract.js dil verisini (tur/eng) indirip
      diske yazıyor ve varsayılan yeri çalışma dizini. Vercel'de dosya
      sistemi /tmp dışında SALT OKUNUR; varsayılanla ilk OCR denemesi
      üretimde yazma hatasıyla düşerdi. /tmp sıcak örnekte kalıcı olduğu
      için indirme her istekte tekrarlanmaz.
    */
    // Türkçe + İngilizce: kılavuzlarda İngilizce özet ve terimler yaygın.
    const isci = await createWorker(["tur", "eng"], undefined, { cachePath: tmpdir() });
    const parcalar: string[] = [];
    const guvenler: number[] = [];
    try {
      for (const goruntu of goruntuler) {
        const { data } = await isci.recognize(goruntu);
        parcalar.push(data.text ?? "");
        if (typeof data.confidence === "number") guvenler.push(data.confidence);
      }
    } finally {
      await isci.terminate();
    }

    return {
      metin: parcalar.join("\n"),
      sayfa: goruntuler.length,
      guven: guvenler.length ? guvenler.reduce((a, b) => a + b, 0) / guvenler.length / 100 : 0,
    };
  } catch (hata) {
    console.error("[ocr] okunamadı:", hata instanceof Error ? hata.message : hata);
    return { metin: "", sayfa: 0, guven: 0 };
  }
}
