/*
  Çalışma listesinde hangi kayıtların tutarsızlık taramasına gireceği.

  Onay anındaki uyarı (lib/onay-uyarisi.ts) kontrolöre durumu söylüyor ama
  ONAYDAN SONRA söylüyor. Kontrolörün listede, tıklamadan önce görmesi daha
  iyi. Sorun maliyet: tarama müsveddenin TAM METNİNİ istiyor; listedeki her
  çalışma için çekmek kart listesini ağırlaştırır (kart sayacı bilerek
  yalnızca word_count okuyor — lib/writing-stats.ts).

  Bu yüzden taranacak küme daraltılır. Absans anlam taşımaz: taranmayan
  kartta da, temiz kartta da rozet yok. Rozet yalnızca OLUMLU bir iddiadır
  ("burada şu var"); "burada bir şey yok" iddiası hiç kurulmaz — o iddianın
  yeri çalışma merkezidir.

  Saf modül; testi tests/unit/toplu-tutarsizlik.test.ts.
*/

/** Taramaya aday çalışmanın karar için gereken alanları. */
export type TaramaAdayi = {
  id: string;
  /** Kontrolör onayı verilmiş mi? */
  onayli: boolean;
  /** Müsveddenin kelime sayısı (tam metin çekilmeden bilinen tek ölçü). */
  kelime: number;
  /** Son düzenleme; taze olanlar önce taranır. */
  guncellendi: string | null;
};

/*
  metinListeTutarsizliklari 200 karakterden kısa metinde hiçbir şey
  söylemiyor. Ortalama Türkçe kelime ~7 karakter; 40 kelime altını
  taramak boşuna tam metin çekmek olurdu.
*/
const EN_AZ_KELIME = 40;

/** Tek seferde kaç çalışmanın tam metni çekilir. */
export const TARAMA_SINIRI = 12;

/**
 * Taranacak çalışma kimlikleri.
 *
 * Onaylılar dışarıda: kontrolör kararını zaten vermiş, ona tekrar tekrar
 * uyarı göstermek kararını sorgulamak olur. Yazılmamış müsveddeler de
 * dışarıda — orada tutarsızlık değil, henüz yazılmamış bir metin vardır.
 */
export function taranacakCalismalar(adaylar: TaramaAdayi[], sinir = TARAMA_SINIRI): string[] {
  return adaylar
    .filter((aday) => !aday.onayli && aday.kelime >= EN_AZ_KELIME)
    .sort((a, b) => (b.guncellendi ?? "").localeCompare(a.guncellendi ?? ""))
    .slice(0, Math.max(0, sinir))
    .map((aday) => aday.id);
}
