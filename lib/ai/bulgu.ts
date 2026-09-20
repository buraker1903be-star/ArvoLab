/*
  Asistanın her yeteneğinin ortak çıktısı: bulgu listesi.

  Yetenekler yalnızca sistem istemiyle ve topladıkları bağlamla ayrışır;
  yanıtın biçimi, çözümlenmesi ve uydurma sayı denetimi hepsinde aynıdır.
  Bu dosya o ortak kısmı tutar — ikinci yetenek yazılırken analiz denetiminin
  çözümleyicisi kopyalanacaktı, kopya da ilk düzeltmede ayrışırdı.

  Saf modül; testi tests/unit/ai-analiz-yorumu.test.ts.
*/

import { uydurmaSayilar } from "./sayi-denetimi";

export type BulguTuru = "uyari" | "oneri" | "bilgi";
export type Bulgu = { tur: BulguTuru; baslik: string; aciklama: string };

const EN_FAZLA_BULGU = 12;

/** Her yeteneğin sistem isteminin sonuna eklenen ortak yanıt sözleşmesi. */
export const YANIT_BICIMI = `YANIT BİÇİMİ: Yalnızca şu JSON nesnesini döndür, başka hiçbir şey yazma:
{"bulgular":[{"tur":"uyari","baslik":"kısa başlık","aciklama":"tek paragraf açıklama"}]}
- "tur": ciddi bir hata/eksik için "uyari", iyileştirme için "oneri", yalnızca dikkat çekmek için "bilgi".
- "baslik": en fazla 60 karakter.
- "aciklama": en fazla 400 karakter, Türkçe, hazır cümle içermez.
- En fazla 8 bulgu. Denetlenecek bir şey bulamazsan boş dizi döndür.`;

/*
  Yanıttaki JSON'u okur. İki gerçek sorunu çözüyor:

  1. Model JSON'u kod çitiyle ya da açıklama cümlesiyle sarabiliyor; sıkı bir
     JSON.parse tek fazladan kelimede bütün cevabı çöpe atıyordu.
  2. Yanıt jeton sınırında KESİLEBİLİYOR. Canlıda (20.09.2026) claude-sonnet-5
     üç bulgunun ikisini eksiksiz yazdı, üçüncüsünün ortasında kesildi; JSON
     kapanmadığı için üçü birden atıldı ve kullanıcı "denetlenebilir bir yapı
     bulamadı" gördü. Tamamlanmış bulguları atmanın anlamı yok: son tam
     nesneye kadar kırpılıp dizi kapatılıyor.
*/
export function jsonOku(ham: string): unknown {
  const bas = ham.indexOf("{");
  const son = ham.lastIndexOf("}");
  if (bas === -1 || son <= bas) return null;

  const golge = ham.slice(bas, son + 1);
  try {
    return JSON.parse(golge);
  } catch {
    // Kesik yanıt: golge son TAM nesnede bitiyor, geriye diziyi ve kök
    // nesneyi kapatmak kalıyor.
    for (const kapanis of ["]}", "}]}"]) {
      try {
        return JSON.parse(golge + kapanis);
      } catch {
        continue;
      }
    }
    return null;
  }
}

function kirp(deger: unknown, sinir: number) {
  return String(deger ?? "").replace(/\s+/g, " ").trim().slice(0, sinir);
}

/** Modelin yanıtını bulgulara çevirir (kesik yanıt dahil, bkz. jsonOku). */
export function bulgulariCozumle(ham: string): Bulgu[] {
  const liste = (jsonOku(ham) as { bulgular?: unknown } | null)?.bulgular;
  if (!Array.isArray(liste)) return [];

  return liste
    .map((satir) => {
      const row = (satir ?? {}) as Record<string, unknown>;
      const tur = String(row.tur ?? "");
      return {
        tur: (tur === "uyari" || tur === "oneri" ? tur : "bilgi") as BulguTuru,
        baslik: kirp(row.baslik, 60),
        aciklama: kirp(row.aciklama, 400),
      };
    })
    .filter((bulgu) => bulgu.baslik && bulgu.aciklama)
    .slice(0, EN_FAZLA_BULGU);
}

export type Dogrulama = { gecti: true } | { gecti: false; uydurulan: string[] };

export type DogrulamaSecenegi = {
  /** Doğrulanmış ek kaynaklar (ör. tespit edilen istatistiklerin APA karşılığı). */
  ekKaynaklar?: string[];
  /**
   * Yıl benzeri değerleri serbest bırakır. Yalnızca literatür yeteneğinde
   * açılır: orada "harmanlanmış öğrenme 2000'ler başından beri" gibi ifadeler
   * kullanıcının verisine dair bir iddia değil, alan bilgisidir ve canlıda
   * (20.09.2026) kusursuz bir tarama stratejisini tümden düşürdü. Analiz ve
   * kaynakça yeteneklerinde KAPALI kalır: orada uydurulan bir yıl doğrudan
   * yanıltır.
   */
  yillarSerbest?: boolean;
};

const YIL = /^(1[89]|20)\d{2}$/;

/**
 * Bulgularda gönderilen bağlamda geçmeyen sayı var mı? Varsa cevap
 * gösterilmez: hangi sayının uydurulduğunu kullanıcı ayıklayamaz, bir
 * kısmı doğru olan bir listeye güvenmek en tehlikelisidir.
 */
export function bulgulariDogrula(bulgular: Bulgu[], kaynak: string, secenek: DogrulamaSecenegi = {}): Dogrulama {
  const cikti = bulgular.map((b) => `${b.baslik} ${b.aciklama}`).join("\n");
  const uydurulan = uydurmaSayilar(cikti, kaynak, ...(secenek.ekKaynaklar ?? [])).filter(
    (deger) => !(secenek.yillarSerbest && YIL.test(deger)),
  );
  return uydurulan.length ? { gecti: false, uydurulan } : { gecti: true };
}
