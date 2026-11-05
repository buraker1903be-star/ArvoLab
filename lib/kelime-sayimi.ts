/*
  KELİME SAYIMI — TEK KURAL (Signature OS 4.3.5, B7). Saf modül; testi
  tests/unit/kelime-sayimi.test.ts ve tests/editor/kelime-sayimi.test.ts.

  ESKİ HATA: aynı belge için iki sayaç vardı. Kayıtta saklanan sayı
  (özet, Çalışmalarım, ana sayfa) her boşluk türünde bölüyor ama satır
  sonunu (hardBreak) BOŞ sayıp iki sözcüğü birleştiriyordu; editördeki
  canlı sayı (Tiptap CharacterCount) yalnızca düz boşlukta bölüyor,
  bölünmez boşlukta (NBSP), sekmede ve öteki Unicode boşluklarında
  bölmüyordu. Örnek tezde kayıt 6.304, editör 6.354; Word'den gelen
  "p<NBSP><<NBSP>0,05" gibi yazımlarda ters yönde ayrışıyordu. Canlıda
  aynı tezin özetinde 6.221, editöründe 6.168 görüldü.

  ÜRÜN KURALI:
  - Sözcük, her Unicode boşluğuyla (NBSP, ince boşluk, sekme, satır sonu
    dahil) ayrılan boş olmayan parçadır — Word'ün saydığı gibi; tek başına
    duran "—" de bir sözcüktür. Bilerek böyle: editörün öteden beri
    gösterdiği sayı bu ve yazım ritmi (lib/yazim-ritmi.ts) kayıtlı
    sayıların FARKINDAN hesaplanıyor; kuralı gereğinden fazla değiştirmek
    geçişten sonraki ilk kayıtta sahte bir "silindi" günü üretirdi.
    Değişen yalnızca iki hata: satır sonu ve Unicode boşlukları.
  - Satır sonu, resim, yatay çizgi ve dipnot işareti sözcük AYIRICIDIR.
  - Dipnot METİNLERİ SAYILMAZ (gövde kelime sayısı). Kapak ve ön sayfa
    alanları belgenin düğümü değil, sayılmaz. Kaynakça bölümü belgenin
    parçası olduğu için sayılır.
  - Editör ve kayıt aynı metni (bloklar ve yaprak düğümler boşlukla
    ayrılmış) aynı fonksiyonla sayar: editörde CharacterCount'un
    wordCounter'ı bu fonksiyondur (lib/tiptap-extensions.ts).

  Kayıtlı sayı son KAYITTAKİ hâldir; editör canlıdır. Otomatik kayıttan
  sonra ikisi eşittir. Eski kayıtların sayısı topluca değiştirilmez;
  çalışma bir sonraki kayıtta yeni kurala göre yazılır.
*/

// \s Unicode boşluklarının hepsini kapsar (NBSP, U+2000–200A, U+202F, U+205F, U+3000, sekme, satır sonları).
const AYIRICI = /\s+/u;

export function kelimeSay(metin: string): number {
  if (!metin) return 0;
  let sayi = 0;
  for (const parca of metin.split(AYIRICI)) if (parca) sayi++;
  return sayi;
}
