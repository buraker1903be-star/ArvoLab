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

import type { Dil } from "@/lib/dil";

/** OCR'a girilecek en fazla sayfa; kapak ve ilk kural sayfaları yeterli. */
const EN_FAZLA_SAYFA = 8;


/**
 * OCR sonucu.
 *
 * `hata`: OCR hiç KOŞAMADIYSA sebebi. Boş metin tek başına yetmiyordu —
 * "belgede yazı yok" ile "OCR çalıştırılamadı" aynı görünüyordu ve ikincisi
 * kimseye söylenmiyordu (bkz. ocrCalismadiUyarisi, ocrEksikDosyaUyarisi).
 */
export type OcrSonucu = { metin: string; sayfa: number; guven: number; hata?: string };

/**
 * getCore'un isteyebileceği çekirdekler; hangisi seçileceği wasm özellik
 * algılamasına göre çalışma anında belli olur (next.config.ts'te hepsi izde).
 *
 * Eskiden yalnızca LSTM sürümlerine bakılıyordu; tesseract.js 7.0.0 Node'da
 * ise tam çekirdeği istiyor (gerekçe next.config.ts'te). Ön denetim
 * "dosyalar tamam" deyip geçiyor, işçi 26.10.2026 gecesi
 * tesseract-core-relaxedsimd'yi bulamadan ölüyordu.
 */
const CEKIRDEKLER = ["", "-simd", "-relaxedsimd"].flatMap((tur) => [`tesseract-core${tur}`, `tesseract-core${tur}-lstm`]);

/** İşçinin kendi içinden istediği, izleyicinin göremediği paketler. */
const ISCI_PAKETLERI = ["bmp-js", "is-url", "regenerator-runtime", "wasm-feature-detect"];

/** Süreç başına bir kez bakılır: aynı turda onlarca kılavuz taranıyor. */
let eksikDosyalar: string | null | undefined;

/**
 * OCR'ın dağıtım paketinde eksik olan dosyaları; hiçbiri eksik değilse null.
 *
 * NEDEN ÖNCEDEN BAKILIYOR: tesseract.js işçiyi `new Worker(yol)` ile
 * başlatıyor ve hatayı `worker.onerror` ile dinliyor. Oysa worker_threads
 * `onerror` diye bir şey bilmiyor, 'error' OLAYI yayıyor; dinleyicisi
 * olmayan olay Node'da yakalanmamış istisnaya dönüşüyor. Yani eksik
 * dosyanın hatası aşağıdaki try/catch'e HİÇ düşmüyor, bütün isteği
 * öldürüyor: /api/cron/guideline-refresh 05.10–25.10.2026 arası her gece
 * MODULE_NOT_FOUND ile düştü, o turların keşfi ve taraması hiç koşmadı
 * (günlük: lib/cron-gunlugu.ts, pakete ekleme: next.config.ts).
 *
 * YALNIZCA KANIT VARSA ENGELLER: yol çözülemezse null döner ve OCR denenir.
 * Tersi, çözümleme tabanının değiştiği bir ortamda OCR'ı sessizce tamamen
 * kapatmak olurdu — düzeltmeye çalıştığımız sessizliğin aynısı.
 */
async function ocrDosyalariEksikMi(): Promise<string | null> {
  if (eksikDosyalar !== undefined) return eksikDosyalar;
  eksikDosyalar = null;
  try {
    const { createRequire } = await import("node:module");
    const { existsSync } = await import("node:fs");
    const yolu = await import("node:path");
    /*
      Çözümleme tabanı çalışma dizini: Vercel'de fonksiyonun kökü (hatadaki
      /ROOT), yerelde depo kökü. Her ikisinde de node_modules oradan aranır.
    */
    const coz = createRequire(yolu.join(process.cwd(), "ocr-cozumleme.cjs"));
    const tesseractKok = yolu.dirname(coz.resolve("tesseract.js/package.json"));
    const cekirdekKok = yolu.dirname(coz.resolve("tesseract.js-core/package.json"));

    const eksik = [
      // Düşen dosyanın kendisi.
      yolu.join(tesseractKok, "src", "worker-script", "node", "index.js"),
      ...CEKIRDEKLER.flatMap((ad) => [yolu.join(cekirdekKok, `${ad}.js`), yolu.join(cekirdekKok, `${ad}.wasm`)]),
    ].filter((dosya) => !existsSync(dosya));

    for (const paket of ISCI_PAKETLERI) {
      try {
        coz.resolve(`${paket}/package.json`);
      } catch {
        // İşçinin ilk satırında isteniyor; eksikse işçi aynı şekilde ölür.
        eksik.push(paket);
      }
    }

    /*
      Paket adları yeter, tam yol değil: Vercel'deki kök (/ROOT) ve yereldeki
      yol farklı, uyarıyı okuyan için ikisi de gürültü.

      İlk üçü yazılıyor çünkü bir eksiklik genellikle hepsini birden
      getiriyor (yerelde taklit edildi: 11 satır) ve panelde ekranı kaplayan
      bir uyarı okunmuyor. Tam listeyi günlük tutuyor.
    */
    const adlar = eksik.map((dosya) => dosya.replace(/^.*node_modules\//, ""));
    eksikDosyalar = adlar.length
      ? adlar.length > 3
        ? `${adlar.slice(0, 3).join(", ")} ve ${adlar.length - 3} dosya daha`
        : adlar.join(", ")
      : null;
  } catch {
    eksikDosyalar = null;
  }
  return eksikDosyalar;
}

/**
 * Yöneticiye gösterilecek uyarı: belge taranmış ama OCR okuyamadı.
 *
 * Sebep metne giriyor: "kural çıkarılamadı" diyen çıplak bir not, yöneticiyi
 * belgeyi ya da adresi düzeltmeye uğraştırır (lib/guideline-scan.ts'teki
 * kilavuzDegilUyarisi ile aynı ders). Bozuk PDF de bellek de buraya düşer;
 * bu yüzden metin suçlu aramıyor, yalnızca sebebi söylüyor.
 */
export function ocrCalismadiUyarisi(sebep: string, dil: Dil = "tr"): string {
  if (dil === "en") {
    return `The document consists of scanned images but could not be read with OCR (${sebep}); no rules could be extracted.`;
  }
  return `Belge taranmış görüntüden oluşuyor ama OCR ile okunamadı (${sebep}); kurallar çıkarılamadı.`;
}

/**
 * Sebep belge değil DAĞITIM olduğunda ayrı metin.
 *
 * Yöneticinin yapacağı iş bambaşka: belgeye bakmak değil, eksik dosyaları
 * pakete eklemek. 05.10–25.10.2026 arasında kimse bunu bilmiyordu.
 */
export function ocrEksikDosyaUyarisi(eksik: string, dil: Dil = "tr"): string {
  if (dil === "en") {
    return `${ocrCalismadiUyarisi(`OCR files are missing on the server: ${eksik}`, dil)} `
      + "This is a server problem, not a problem with the guideline; the files must be added to the deployment bundle (next.config.ts).";
  }
  return `${ocrCalismadiUyarisi(`OCR dosyaları sunucuda yok: ${eksik}`)} `
    + "Bu, kılavuzun değil sunucunun sorunu; dosyalar dağıtım paketine eklenmeli (next.config.ts).";
}

/*
  Karar ayrı dosyada (lib/taranmis-belge.ts): Belge Kontrol de kullanıyor
  ve bu dosyayı import etmek, tesseract'ın dinamik import'u yüzünden
  OCR paketini o rotanın dağıtımına da sokardı.
*/
export { taranmisBelgeMi } from "@/lib/taranmis-belge";

/**
 * PDF'in ilk sayfalarını görüntüye çevirip OCR ile okur.
 *
 * Başarısızlık akışı düşürmez: OCR yapılamazsa boş metin döner ve çağıran
 * eski davranışa (metinsiz belge) geri düşer. Kılavuz taraması, tek bir
 * belgenin okunamaması yüzünden durmamalı.
 */
/* `dil` yalnızca `hata` alanındaki uyarının dilini seçer; OCR'ın kendisi dilden bağımsız. */
export async function pdfMetniniOcrIleOku(veri: Buffer, sayfaSayisi: number, dil: Dil = "tr"): Promise<OcrSonucu> {
  const sayfa = Math.min(sayfaSayisi || 1, EN_FAZLA_SAYFA);

  /*
    Sayfaları görüntüye çevirmeden ÖNCE bakılıyor: işçi yoksa 8 sayfayı
    iki kat ölçekte çizmek tur bütçesinden boşa harcanan saniyelerdir.
  */
  const eksik = await ocrDosyalariEksikMi();
  if (eksik) {
    console.error(`[ocr] işçi dosyaları dağıtım paketinde yok, OCR atlandı: ${eksik}`);
    return { metin: "", sayfa: 0, guven: 0, hata: ocrEksikDosyaUyarisi(eksik, dil) };
  }

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
    const mesaj = hata instanceof Error ? hata.message : String(hata);
    console.error("[ocr] okunamadı:", mesaj);
    /*
      Eskiden burada yalnızca boş metin dönüyordu: dil verisi inemediğinde
      ya da bellek yetmediğinde kayıt "kural çıkmadı" diye görünüyor,
      sebebi yalnızca sunucu günlüğünde kalıyordu. Artık sebep kaydın
      uyarılarına da giriyor.
    */
    return { metin: "", sayfa: 0, guven: 0, hata: ocrCalismadiUyarisi(mesaj, dil) };
  }
}
