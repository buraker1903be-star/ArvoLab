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

function kirp(deger: unknown, sinir: number) {
  return String(deger ?? "").replace(/\s+/g, " ").trim().slice(0, sinir);
}

/**
 * Modelin yanıtını bulgulara çevirir. Model bazen JSON'u kod çitiyle ya da
 * açıklama cümlesiyle sarıyor; sıkı bir JSON.parse tek bir fazladan kelimede
 * bütün cevabı çöpe atıyordu.
 */
export function bulgulariCozumle(ham: string): Bulgu[] {
  const bas = ham.indexOf("{");
  const son = ham.lastIndexOf("}");
  if (bas === -1 || son <= bas) return [];

  let veri: unknown;
  try {
    veri = JSON.parse(ham.slice(bas, son + 1));
  } catch {
    return [];
  }

  const liste = (veri as { bulgular?: unknown })?.bulgular;
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

/**
 * Bulgularda gönderilen bağlamda geçmeyen sayı var mı? Varsa cevap
 * gösterilmez: hangi sayının uydurulduğunu kullanıcı ayıklayamaz, bir
 * kısmı doğru olan bir listeye güvenmek en tehlikelisidir.
 */
export function bulgulariDogrula(bulgular: Bulgu[], kaynak: string, ...ekKaynaklar: string[]): Dogrulama {
  const cikti = bulgular.map((b) => `${b.baslik} ${b.aciklama}`).join("\n");
  const uydurulan = uydurmaSayilar(cikti, kaynak, ...ekKaynaklar);
  return uydurulan.length ? { gecti: false, uydurulan } : { gecti: true };
}
