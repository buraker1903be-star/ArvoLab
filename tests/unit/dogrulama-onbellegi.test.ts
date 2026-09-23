import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import type { ParsedReference } from "@/lib/apa7";
import {
  verifyAcademicReferences,
  type DogrulamaOnbellegi,
  type OnbellekKaydi,
} from "@/lib/academic-reference-verification";
import { dogrulamaAnahtari } from "@/lib/kaynak-anahtari";

/*
  Önbelleğin sözü: daha önce bakılmış künye için AĞA GİDİLMEZ ve ağ sınırı
  yalnızca bakılmamışlara harcanır. Testler bunu fetch'i sayarak
  kanıtlıyor — "herhalde gitmiyordur" demek yetmez, 120 kaynaklı bir tezin
  denetlenebilmesi tam olarak buna bağlı.
*/

const kunye = (baslik: string, yil = "2020"): ParsedReference => ({
  raw: `Yazar, A. (${yil}). ${baslik}.`,
  authors: ["Yazar, A."],
  year: yil,
  title: baslik,
  issues: [],
});

const kayit = (status: OnbellekKaydi["status"] = "verified"): OnbellekKaydi => ({
  status,
  bestMatch: null,
  matches: [],
});

/** Verilen künyeleri bilen, çağrıları sayan sahte önbellek. */
function sahteOnbellek(bilinenler: ParsedReference[]) {
  const depo = new Map<string, OnbellekKaydi>();
  for (const k of bilinenler) {
    const anahtar = dogrulamaAnahtari(k);
    if (anahtar) depo.set(anahtar, kayit());
  }
  const yazilanlar: { anahtar: string; kayit: OnbellekKaydi }[] = [];
  const onbellek: DogrulamaOnbellegi = {
    async oku(anahtarlar) {
      return new Map(anahtarlar.flatMap((a) => (depo.has(a) ? [[a, depo.get(a)!] as const] : [])));
    },
    async yaz(girisler) {
      yazilanlar.push(...girisler);
    },
  };
  return { onbellek, yazilanlar };
}

let istekSayisi = 0;
const gercekFetch = globalThis.fetch;

beforeEach(() => {
  istekSayisi = 0;
  // Ağ isteği sayılıyor; gövde önemsiz, doğrulama "bulunamadı" der.
  globalThis.fetch = (async () => {
    istekSayisi += 1;
    return new Response(JSON.stringify({ message: { items: [] }, results: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = gercekFetch;
});

describe("doğrulama önbelleği", () => {
  test("hepsi önbellekteyse ağa hiç gidilmez", async () => {
    const kunyeler = [kunye("Örgütsel bağlılık"), kunye("İş doyumu"), kunye("Motivasyon kuramları")];
    const { onbellek } = sahteOnbellek(kunyeler);

    const sonuc = await verifyAcademicReferences(kunyeler, 25, onbellek);

    assert.equal(istekSayisi, 0);
    assert.equal(sonuc.length, 3);
    assert.ok(sonuc.every((satir) => satir.status === "verified"));
  });

  /*
    Asıl kazanç: eskiden sınır kaynakçanın İLK 25'ine uygulanıyordu ve
    ötesine hiç bakılamıyordu. Artık sınır yalnızca bakılmamışlara
    harcanıyor, yani uzun kaynakça birkaç turda kapanıyor.
  */
  test("önbellekten gelenler ağ sınırından düşmez", async () => {
    const kunyeler = Array.from({ length: 30 }, (_, i) => kunye(`Çalışma başlığı ${i}`));
    const bilinen = kunyeler.slice(0, 28);
    const { onbellek } = sahteOnbellek(bilinen);

    const sonuc = await verifyAcademicReferences(kunyeler, 25, onbellek);

    // Kalan 2 künye için iki dizin: künye başına 2 istek.
    assert.equal(istekSayisi, 4);
    assert.equal(sonuc.length, 30);
  });

  test("sınır aşıldığında fazlası bu turda bakılmadan kalır", async () => {
    const kunyeler = Array.from({ length: 10 }, (_, i) => kunye(`Başlık ${i}`));
    const { onbellek } = sahteOnbellek([]);

    const sonuc = await verifyAcademicReferences(kunyeler, 3, onbellek);

    assert.equal(istekSayisi, 6);
    // Ekran "kalan N kaynağa bakılmadı" diyebilsin diye eksik dönüyor.
    assert.equal(sonuc.length, 3);
  });

  test("sonuçlar kaynakça sırasını korur", async () => {
    const kunyeler = [kunye("Aaa birinci"), kunye("Bbb ikinci"), kunye("Ccc üçüncü")];
    // Ortadaki önbellekte; diğer ikisi ağdan gelecek.
    const { onbellek } = sahteOnbellek([kunyeler[1]]);

    const sonuc = await verifyAcademicReferences(kunyeler, 25, onbellek);

    assert.deepEqual(sonuc.map((satir) => satir.reference), kunyeler.map((k) => k.raw));
  });

  test("ağdan gelen sonuç önbelleğe yazılır", async () => {
    const kunyeler = [kunye("Yeni bir çalışma")];
    const { onbellek, yazilanlar } = sahteOnbellek([]);

    await verifyAcademicReferences(kunyeler, 25, onbellek);

    assert.equal(yazilanlar.length, 1);
    assert.equal(yazilanlar[0].anahtar, dogrulamaAnahtari(kunyeler[0]));
  });

  /*
    Yetersiz veri ağa gitmeden belli oluyor; saklamanın getirisi yok ve
    anahtarı da üretilemiyor.
  */
  test("yetersiz künye ağa da önbelleğe de gitmez", async () => {
    const kisa: ParsedReference = { raw: "Yılmaz", authors: null, year: null, title: null, issues: [] };
    const { onbellek, yazilanlar } = sahteOnbellek([]);

    const sonuc = await verifyAcademicReferences([kisa], 25, onbellek);

    assert.equal(istekSayisi, 0);
    assert.equal(yazilanlar.length, 0);
    assert.equal(sonuc[0].status, "insufficient_data");
  });

  /*
    Önbellek bir hızlandırma. Okunamaması denetimi durdurmamalı — aksi
    halde önbellek arızası bütün atıf kontrolünü çökertirdi.
  */
  test("önbellek okunamazsa doğrulama yine çalışır", async () => {
    const bozuk: DogrulamaOnbellegi = {
      async oku() { throw new Error("bağlantı yok"); },
      async yaz() { throw new Error("bağlantı yok"); },
    };

    const sonuc = await verifyAcademicReferences([kunye("Bir çalışma")], 25, bozuk);

    assert.equal(sonuc.length, 1);
    assert.equal(istekSayisi, 2);
  });

  test("önbellek verilmezse eski davranış sürüyor", async () => {
    const sonuc = await verifyAcademicReferences([kunye("Bir çalışma")], 25);
    assert.equal(sonuc.length, 1);
    assert.equal(istekSayisi, 2);
  });

  /*
    ÖNBELLEK SONUÇ DİZİSİNDE ORTADAN BOŞLUK BIRAKABİLİR: bu turda
    bakılmamış bir künyenin yerine bir sonraki gelir. Ekran eskiden sonucu
    kaynakçayla SIRAYLA eşliyordu (sonuç hep ilk N künyeydi); önbellekle
    bu, bir künyenin biçim sorunlarını başka künyeye yapıştırmaya
    dönüşüyordu. Eşleme artık ham metinle yapılıyor
    (citation-check-form.tsx) ve boşluğun gerçekliği burada sabitleniyor.
  */
  test("bakılmamış künye aradan atlanır; sıra indeksle eşlenemez", async () => {
    const kunyeler = [kunye("Birinci calisma"), kunye("Ikinci calisma"), kunye("Ucuncu calisma")];
    const { onbellek } = sahteOnbellek([kunyeler[2]]);

    const sonuc = await verifyAcademicReferences(kunyeler, 1, onbellek);

    assert.deepEqual(sonuc.map((satir) => satir.reference), [kunyeler[0].raw, kunyeler[2].raw]);
    // İkinci künye dizide yok: sonuc[1] onun sonucu DEĞİL.
    assert.notEqual(sonuc[1].reference, kunyeler[1].raw);
  });
});
