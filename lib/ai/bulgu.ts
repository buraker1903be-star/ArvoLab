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

/*
  Künye izi: modelin ürettiği metinde kaynak künyesi (Yazar, A. (2020))
  geçiyor mu? Asistanın en zararlı hatası uydurma kaynak önermektir; istemde
  yasak ama kodda da bakılır (AGENTS.md: "Asistan kaynak önermez").

  Burada duruyor çünkü artık iki yetenek kullanıyor: literatür taraması
  (bulgu listesi üzerinde) ve belge geri bildirimi (düz metin üzerinde).
  Regex tek yerde kalsın; kopyası ilk düzeltmede ayrışırdı.
*/
/*
  Sözcük başı \b ile aranıyordu ve JavaScript'te \b ASCII tabanlıdır: "Ş"
  sözcük karakteri sayılmadığı için ÖNÜNDE sınır oluşmuyor — ne satır
  başında ne boşluktan sonra. Sonuç, Türkçe bir üründe en pahalı türden
  sessiz açıktı: Şahin, Özdemir, Çelik, Ünal, İnce gibi Türkiye'nin en
  yaygın soyadlarıyla uydurulmuş künyeler denetimden hiç geçmiyordu.
  Yılmaz ve Demir yakalanıyordu, Şahin yakalanmıyordu.

  Harf kümesi artık Unicode özelliğiyle (\p{Lu}, \p{Ll}) tanımlı; elle
  sayılan bir alfabe hep eksik kalır. Sınır da \b yerine "önünde harf
  yok" olarak yazıldı.
*/
const KUNYE = /(?<!\p{L})\p{Lu}\p{Ll}+,\s*\p{Lu}\.\s*\(\d{4}\)/u;

export function kunyeIziMetinde(metin: string): boolean {
  return KUNYE.test(metin);
}

export type Dogrulama = { gecti: true } | { gecti: false; uydurulan: string[] };

export type DogrulamaSecenegi = {
  /** Doğrulanmış ek kaynaklar (ör. tespit edilen istatistiklerin APA karşılığı). */
  ekKaynaklar?: string[];
};

/**
 * Bulgularda gönderilen bağlamda geçmeyen sayı var mı? Varsa cevap
 * gösterilmez: hangi sayının uydurulduğunu kullanıcı ayıklayamaz, bir
 * kısmı doğru olan bir listeye güvenmek en tehlikelisidir.
 *
 * NEREDE UYGULANIR: denetim sayısal bir VERİ değeri taşıyorsa — analizde
 * p değeri ve etki büyüklüğü, kaynakçada yıl, cilt, sayfa. Literatür
 * tavsiyesinde böyle bir değer yoktur; oradaki sayılar "COVID-19",
 * "2000'ler", "son 15-20 yıl" gibi alan bilgisidir ve canlıda (20.09.2026)
 * kusursuz iki tarama stratejisini üst üste düşürdü. Oraya muafiyet
 * eklemek yerine denetim hiç uygulanmıyor; literatürün asıl riski uydurma
 * KAYNAK ve onu kunyeIzi yakalıyor.
 */
export function bulgulariDogrula(bulgular: Bulgu[], kaynak: string, secenek: DogrulamaSecenegi = {}): Dogrulama {
  const cikti = bulgular.map((b) => `${b.baslik} ${b.aciklama}`).join("\n");
  const uydurulan = uydurmaSayilar(cikti, kaynak, ...(secenek.ekKaynaklar ?? []));
  return uydurulan.length ? { gecti: false, uydurulan } : { gecti: true };
}
