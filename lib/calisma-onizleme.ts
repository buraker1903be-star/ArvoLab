/*
  BELGE ÖNİZLEMESİ (22.11.2026, Çalışmalarım sadeleştirmesi).

  Öne çıkan çalışmanın kartında belgenin küçük bir önizlemesi duruyor.
  Önizleme KAYDEDİLMİŞ içerikten üretilir (`project_manuscripts.content`,
  TipTap/ProseMirror JSON): editör BAŞLATILMAZ, kayıt tetiklenmez, hiçbir
  şey yazılmaz. Sayfayı açıp kapatmak belgeyi ya da `updated_at`'i
  değiştirmez — önizleme yalnızca okur.

  Neden ayrı bir saf modül: içerik JSON'u kullanıcıdan gelir ve biçimi
  sürümden sürüme değişebilir. Burada yalnızca METİN toplanır; HTML
  üretilmez, düğüm türlerine güvenilmez, bilinmeyen yapı sessizce atlanır.
  Böylece bozuk ya da beklenmedik bir belge sayfayı düşürmez.

  Boş belgede BOŞ döner: çağıran taraf o zaman önizleme kutusunu hiç
  çizmez. Sahte metin ya da "yükleniyor" çizgileri gösterilmez — olmayan
  bir içeriği varmış gibi göstermek, öğrencinin yazdığını sandığı bir
  metni aramasına yol açar.

  Saf modül; testi tests/unit/calisma-onizleme.test.ts.
*/

export type BelgeOnizlemesi = {
  /** İlk başlık düğümünün metni; yoksa null. */
  baslik: string | null;
  /** Başlıktan sonraki ilk paragraflar, kısaltılmış. */
  satirlar: string[];
};

/** Önizlemede en çok kaç paragraf ve her birinde en çok kaç karakter gösterilir. */
export const ONIZLEME_SATIR = 6;
export const ONIZLEME_KARAKTER = 180;
/** Tarama bütçesi: çok büyük bir belgede ilk düğümlerden sonrası okunmaz. */
const EN_FAZLA_DUGUM = 400;

type Dugum = { type?: unknown; text?: unknown; content?: unknown };

const metinTopla = (dugum: Dugum, derinlik = 0): string => {
  if (derinlik > 8) return "";
  if (typeof dugum?.text === "string") return dugum.text;
  const icerik = Array.isArray(dugum?.content) ? (dugum.content as Dugum[]) : [];
  return icerik.map((alt) => metinTopla(alt, derinlik + 1)).join("");
};

const duzle = (metin: string) => metin.replace(/\s+/g, " ").trim();
const kirp = (metin: string) => (metin.length > ONIZLEME_KARAKTER ? `${metin.slice(0, ONIZLEME_KARAKTER).trimEnd()}…` : metin);

/**
 * Kaydedilmiş belge JSON'undan önizleme. Girdi her şey olabilir (null,
 * dize, bozuk nesne): hiçbir durumda fırlatmaz, en kötü ihtimalle boş
 * önizleme döner.
 */
export function belgeOnizlemesi(icerik: unknown): BelgeOnizlemesi {
  const bos: BelgeOnizlemesi = { baslik: null, satirlar: [] };
  if (!icerik || typeof icerik !== "object") return bos;
  const kok = icerik as Dugum;
  const blok = Array.isArray(kok.content) ? (kok.content as Dugum[]) : [];
  if (!blok.length) return bos;

  let baslik: string | null = null;
  const satirlar: string[] = [];
  for (const dugum of blok.slice(0, EN_FAZLA_DUGUM)) {
    if (satirlar.length >= ONIZLEME_SATIR) break;
    const metin = duzle(metinTopla(dugum));
    if (!metin) continue;
    /*
      İlk başlık kartın üstünde ayrı duruyor (taslakta "Giriş"). Sonraki
      başlıklar da satır olarak girer: önizleme belgenin akışını gösterir,
      yalnızca ilk bölümü değil.
    */
    if (baslik === null && dugum.type === "heading") {
      baslik = kirp(metin);
      continue;
    }
    satirlar.push(kirp(metin));
  }
  return { baslik, satirlar };
}

/** Önizlemede gösterilecek bir şey var mı (yoksa kutu hiç çizilmez). */
export const onizlemeDolu = (onizleme: BelgeOnizlemesi) => Boolean(onizleme.baslik) || onizleme.satirlar.length > 0;
