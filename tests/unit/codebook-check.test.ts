import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseCodebook } from "../../lib/codebook-check";

const ayristir = (...satirlar: string[]) => parseCodebook(satirlar.join("\n"));
const kod = (sonuc: ReturnType<typeof parseCodebook>, ad: string) =>
  sonuc.codes.find((k) => k.name === ad);

describe("frekans yalnızca ayraçla okunur", () => {
  /*
    EN AĞIR HATA. Satır sonundaki her sayı frekans sayılıyordu ve kod adının
    içindeki sayı frekansa dönüşüyordu: "COVID-19" → ad "COVID", frekans 19.
    Sayı girdide geçiyordu ama BAŞKA BİR ANLAMDA — bu, sayıyı hiç yoktan
    üretmekten daha sinsi.
  */
  test("kod adındaki sayı frekans sayılmıyor", () => {
    const sonuc = ayristir("COVID-19", "Sanayi 4.0", "Tema 1");
    assert.equal(kod(sonuc, "COVID-19")?.frequency, null);
    assert.equal(kod(sonuc, "Sanayi 4.0")?.frequency, null);
    assert.equal(kod(sonuc, "Tema 1")?.frequency, null);
    assert.equal(sonuc.totalFrequency, 0);
    // Uydurma frekans "tek kullanımlık kod" tavsiyesi de üretiyordu.
    assert.deepEqual(sonuc.singleUseCodes, []);
  });

  test("iki nokta ile ayrılan frekans okunuyor", () => {
    assert.equal(kod(ayristir("Motivasyon eksikliği: 15"), "Motivasyon eksikliği")?.frequency, 15);
  });

  test("parantezli frekans okunuyor", () => {
    assert.equal(kod(ayristir("Öğretmen desteği (8)"), "Öğretmen desteği")?.frequency, 8);
  });

  test("sekme ile ayrılan frekans okunuyor (MAXQDA dışa aktarımı)", () => {
    assert.equal(kod(ayristir("Zaman yönetimi\t7"), "Zaman yönetimi")?.frequency, 7);
  });

  test("boşluklu tire ayraçtır, bitişik tire değildir", () => {
    assert.equal(kod(ayristir("Akran baskısı - 4"), "Akran baskısı")?.frequency, 4);
    assert.equal(kod(ayristir("COVID-19"), "COVID-19")?.frequency, null);
  });

  test("frekansı olmayan kodlar ayrı listeleniyor", () => {
    const sonuc = ayristir("Kod A: 3", "Kod B");
    assert.deepEqual(sonuc.emptyFrequencyCodes, ["Kod B"]);
    // Kısmi toplam: bilinmeyenler sıfır sayılmıyor, ayrıca bildiriliyor.
    assert.equal(sonuc.totalFrequency, 3);
  });

  test("sıfır frekans gerçek bir değerdir", () => {
    const sonuc = ayristir("Hiç kullanılmayan kod: 0");
    assert.equal(kod(sonuc, "Hiç kullanılmayan kod")?.frequency, 0);
    assert.deepEqual(sonuc.emptyFrequencyCodes, []);
  });
});

describe("liste kalitesi", () => {
  test("tekrar eden adlar büyük/küçük harften bağımsız yakalanıyor", () => {
    const sonuc = ayristir("Motivasyon: 5", "MOTİVASYON: 3");
    assert.equal(sonuc.duplicates.length, 1);
  });

  /* Eskiden karşılaştırma anahtarı (küçük harfli hâli) gösteriliyordu ve
     kullanıcı o satırı kendi listesinde bulamıyordu. */
  test("tekrar eden ad kullanıcının yazdığı gibi gösteriliyor", () => {
    assert.deepEqual(ayristir("Motivasyon: 5", "MOTİVASYON: 3").duplicates, ["Motivasyon"]);
  });

  test("tek kullanımlık kodlar frekansı 1 olanlardır", () => {
    assert.deepEqual(ayristir("A: 1", "B: 2", "C: 1").singleUseCodes, ["A", "C"]);
  });

  test("frekansa göre azalan sıralanıyor", () => {
    assert.deepEqual(ayristir("A: 2", "B: 9", "C: 5").codes.map((k) => k.name), ["B", "C", "A"]);
  });

  test("boş satırlar atlanıyor", () => {
    assert.equal(ayristir("A: 1", "", "   ", "B: 2").totalCodes, 2);
  });

  test("sondaki ayraç kod adına yapışmıyor", () => {
    assert.equal(kod(ayristir("Kod adı:"), "Kod adı")?.frequency, null);
  });
});
