import { countWords, type TiptapDoc } from "@/lib/tiptap-text";

/*
  EKRANDA GÖSTERİLEN KELİME SAYISI (UX S1-A, 07.11.2026). Saf modül;
  testi tests/unit/kelime-gosterimi.test.ts.

  ESKİ HATA: aynı tez için ana sayfa ve Çalışmalarım 6.304, editör
  6.354 diyordu. Editör canlı sayıyor (lib/kelime-sayimi.ts, B7 kuralı);
  ötekiler kayıttaki word_count'u okuyor ve o sayı kuralın birleştirildiği
  güne (4.3.5, B7) kadar ESKİ kuralla yazılmıştı. Eski kayıtlar bilerek
  toplu güncellenmiyor; ilk kayıtta kendiliğinden düzeliyor.

  KARAR (A yaklaşımı, kurum sahibinin onayıyla): içeriğin ZATEN okunduğu
  ya da ucuzca okunabildiği yerde sayı içerikten, editörle AYNI fonksiyonla
  (countWords) hesaplanır. İçerik okunmayan yerde (personel listeleri:
  kurumun bütün tezleri) kayıttaki sayı kalır — orada eski kayıtlar
  ilk kayda kadar farklı görünebilir. Veritabanına hiçbir şey yazılmaz;
  sayım algoritması değişmez.

  Yazım ritmi (lib/yazim-ritmi.ts) KAYITLI sayıların farkıyla çalışır;
  ona içerikten sayılan değer verilmez, yoksa bugüne sahte bir artış yazılır.
*/

/** Öğrencinin listesinde içerikten sayılacak en çok çalışma (en son düzenlenenler). */
export const ICERIKTEN_SAYIM_SINIRI = 12;

const belgeMi = (deger: unknown): deger is TiptapDoc =>
  typeof deger === "object" && deger !== null && (deger as { type?: unknown }).type === "doc";

/** İçerik varsa editörle aynı sayım; yoksa kayıttaki sayı. */
export function gosterilecekKelime(satir: { content?: unknown; word_count?: number | null }): number {
  return belgeMi(satir.content) ? countWords(satir.content) : (satir.word_count ?? 0);
}

/** İçerikten sayılacak çalışmalar: adaylar arasından en son düzenlenen `sinir` tanesi. */
export function icerikleSayilacaklar(
  adaylar: readonly { id: string; guncellendi: string }[],
  sinir: number = ICERIKTEN_SAYIM_SINIRI,
): string[] {
  return [...adaylar]
    .sort((a, b) => b.guncellendi.localeCompare(a.guncellendi))
    .slice(0, Math.max(0, sinir))
    .map((a) => a.id);
}
