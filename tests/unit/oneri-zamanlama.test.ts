import assert from "node:assert/strict";
import test from "node:test";
import {
  OTOMATIK_EN_AZ_ARALIK_MS,
  OTOMATIK_EN_AZ_YENI_KARAKTER,
  OneriOnbellegi,
  oneriAnahtari,
  otomatikIstekKarari,
  type OneriBaglami,
} from "@/lib/ai/oneri-zamanlama";
import { SAATLIK_HAKTAN_MUAF_GOREVLER, saatlikHakaSayilir } from "@/lib/ai/sinirlar";

/*
  Satır içi önerinin sıklığı ve önbelleği (21.11.2026). Eskiden otomatik
  öneri her 1,5 sn duraksamada istek atıyordu: dakikada 6,6 istek, ortak
  saatlik 20 hak ~3 dakikada bitiyordu.
*/
test("otomatik: ilk istek beklemeden gider", () => {
  assert.deepEqual(otomatikIstekKarari({ simdi: 1_000, sonIstek: null, yeniKarakter: 0 }), { tur: "gonder" });
});

test("otomatik: 40 yeni karakterden azsa istek yok (süre dolmuş olsa da)", () => {
  assert.deepEqual(otomatikIstekKarari({ simdi: 100_000, sonIstek: 0, yeniKarakter: OTOMATIK_EN_AZ_YENI_KARAKTER - 1 }), { tur: "yok" });
});

test("otomatik: karakter yeterli, süre dolmadıysa kalan süre kadar bekler; dolunca gider", () => {
  assert.deepEqual(otomatikIstekKarari({ simdi: 3_000, sonIstek: 0, yeniKarakter: 40 }), { tur: "bekle", ms: OTOMATIK_EN_AZ_ARALIK_MS - 3_000 });
  assert.deepEqual(otomatikIstekKarari({ simdi: OTOMATIK_EN_AZ_ARALIK_MS, sonIstek: 0, yeniKarakter: 40 }), { tur: "gonder" });
});

const B: OneriBaglami = { calisma: "p1", belgeDili: "tr", atifStili: "apa7", bolum: "Giriş", konum: 120, oncesi: "Uzun bir giriş paragrafı burada biter ve" };

test("önbellek: bağlamın tamamı aynıysa öneri döner", () => {
  const o = new OneriOnbellegi();
  o.koy(B, { metin: " öğrenciler", kayit: "k1" }, 0);
  assert.deepEqual(o.al({ ...B }, 1_000), { metin: " öğrenciler", kayit: "k1" });
});

test("önbellek: belge, dil, stil, bölüm, imleç ya da önceki metin farklıysa öneri GÖSTERİLMEZ", () => {
  const o = new OneriOnbellegi();
  o.koy(B, { metin: " öğrenciler", kayit: "k1" }, 0);
  for (const farkli of [
    { calisma: "p2" },
    { belgeDili: "en" },
    { atifStili: "ieee" },
    { bolum: "Yöntem" },
    { konum: 121 },
    // Son 200 karakter aynı, öncesi farklı: yalnızca kuyruğu anahtar yapan bir önbellek bunu eşlerdi.
    { oncesi: `Başka bir paragraf. ${"x".repeat(10)}${B.oncesi}` },
  ]) {
    assert.equal(o.al({ ...B, ...farkli }, 1_000), null, JSON.stringify(farkli));
  }
});

test("önbellek: anahtar kuyruk değil bütün bağlam", () => {
  const kuyruk = "a".repeat(200);
  assert.notEqual(oneriAnahtari({ ...B, oncesi: `X${kuyruk}` }), oneriAnahtari({ ...B, oncesi: `Y${kuyruk}` }));
});

test("önbellek: ömrü dolan kayıt düşer; sınır aşılınca en eski gider", () => {
  const o = new OneriOnbellegi(2, 1_000);
  o.koy(B, { metin: "a", kayit: null }, 0);
  assert.equal(o.al(B, 1_001), null);
  o.koy({ ...B, konum: 1 }, { metin: "1", kayit: null }, 0);
  o.koy({ ...B, konum: 2 }, { metin: "2", kayit: null }, 0);
  o.koy({ ...B, konum: 3 }, { metin: "3", kayit: null }, 0);
  assert.equal(o.boyut, 2);
  assert.equal(o.al({ ...B, konum: 1 }, 10), null);
  assert.deepEqual(o.al({ ...B, konum: 3 }, 10), { metin: "3", kayit: null });
});

/*
  Saatlik hakkın tek istisnası (21.11.2026): satır içi tamamlama. Öteki
  bütün görevler (sohbet dahil) ortak saatlik hakka sayılmaya devam eder.
*/
test("saatlik hak: yalnızca tamamlama muaf, öteki görevler sayılır", () => {
  assert.deepEqual([...SAATLIK_HAKTAN_MUAF_GOREVLER], ["tamamla"]);
  assert.equal(saatlikHakaSayilir("tamamla"), false);
  for (const g of ["serbest", "devam", "paragraf", "akademik", "kisalt", "genislet", "anahat", ""]) assert.equal(saatlikHakaSayilir(g), true, g);
});
