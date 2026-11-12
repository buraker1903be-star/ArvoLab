import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ParsedReference } from "@/lib/apa7";
import {
  verifyAcademicReferences,
  type DogrulamaOnbellegi,
  type OnbellekKaydi,
} from "@/lib/academic-reference-verification";
import { aranacakMi, pdfHukmuErtelenirMi, PDF_EN_FAZLA_BAYT } from "@/lib/kaynak-pdf";
import { kaynakOzeti, kaynakcaIstemi } from "@/lib/ai/kaynakca-denetimi";

/*
  Phase 5.0a (12.11.2026): geçici dizin arızası "bulunamadı" değildir.

  Eskiden Crossref ve OpenAlex'e ulaşılamadığında (zaman aşımı, 429, 5xx)
  düşen istek boş başarılı cevap sayılıyordu: doğru yazılmış künye
  "Kayıt bulunamadı" diye kırmızı görünüyor, 7 gün önbellekte kalıyor,
  PDF araması "künye kontrol edilmeli" yazıyor ve asistana "dizinde
  bulunamadı" diye gidiyordu. Kural (AGENTS.md, kanıt maddesi): dizine
  ulaşılamadığında künye sonucu yazılmaz.
*/

type Dizin = "dus" | "bos" | Record<string, unknown>[];

const gercekFetch = globalThis.fetch;
let crossref: Dizin = "bos";
let openalex: Dizin = "bos";

beforeEach(() => {
  crossref = "bos";
  openalex = "bos";
  globalThis.fetch = (async (adres: string) => {
    const crossrefMi = String(adres).includes("crossref");
    const dizin = crossrefMi ? crossref : openalex;
    if (dizin === "dus") return new Response("Too Many Requests", { status: 429 });
    const ogeler = dizin === "bos" ? [] : dizin;
    const govde = crossrefMi ? { message: { items: ogeler } } : { results: ogeler };
    return new Response(JSON.stringify(govde), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = gercekFetch;
});

const kunye: ParsedReference = {
  raw: "Yılmaz, A. (2020). Öğretmenlerde örgütsel bağlılık ve iş doyumu ilişkisi. Eğitim Dergisi, 12(3), 1-20.",
  authors: ["Yılmaz, A."],
  year: "2020",
  title: "Öğretmenlerde örgütsel bağlılık ve iş doyumu ilişkisi",
  issues: [],
};

const crossrefKaydi = (soyad: string) => ({
  DOI: "10.1234/abc.2020.1",
  title: ["Öğretmenlerde örgütsel bağlılık ve iş doyumu ilişkisi"],
  author: [{ given: "A.", family: soyad }],
  issued: { "date-parts": [[2020]] },
});
const openalexKaydi = (ad: string) => ({
  id: "https://openalex.org/W1",
  title: "Öğretmenlerde örgütsel bağlılık ve iş doyumu ilişkisi",
  authorships: [{ author: { display_name: ad } }],
  publication_year: 2020,
  doi: "https://doi.org/10.1234/abc.2020.1",
});

function sayanOnbellek() {
  const yazilanlar: { anahtar: string; kayit: OnbellekKaydi }[] = [];
  const onbellek: DogrulamaOnbellegi = {
    async oku() {
      return new Map();
    },
    async yaz(girisler) {
      yazilanlar.push(...girisler);
    },
  };
  return { onbellek, yazilanlar };
}

const dogrula = async () => {
  const { onbellek, yazilanlar } = sayanOnbellek();
  const [sonuc] = await verifyAcademicReferences([kunye], 25, onbellek);
  return { sonuc, yazilanlar };
};

describe("dizin erişim hatası: kabul matrisi", () => {
  test("iki dizin de düşerse 'ulasilamadi' ve önbelleğe yazılmaz", async () => {
    crossref = "dus";
    openalex = "dus";
    const { sonuc, yazilanlar } = await dogrula();
    assert.equal(sonuc.status, "ulasilamadi");
    assert.equal(sonuc.bestMatch, null);
    assert.equal(yazilanlar.length, 0);
  });

  test("zaman aşımı / bağlantı hatası da 'ulasilamadi'", async () => {
    globalThis.fetch = (async () => {
      throw new Error("The operation was aborted due to timeout");
    }) as unknown as typeof fetch;
    const { sonuc, yazilanlar } = await dogrula();
    assert.equal(sonuc.status, "ulasilamadi");
    assert.equal(yazilanlar.length, 0);
  });

  test("bir dizin düşer, öteki boş dönerse 'ulasilamadi' (iki yön)", async () => {
    crossref = "dus";
    openalex = "bos";
    assert.equal((await dogrula()).sonuc.status, "ulasilamadi");
    crossref = "bos";
    openalex = "dus";
    assert.equal((await dogrula()).sonuc.status, "ulasilamadi");
  });

  test("bir dizin düşer, ötekinin eşleşmesi zayıfsa yine 'ulasilamadi' (yeterli olumlu kanıt yok)", async () => {
    crossref = "dus";
    openalex = [{ ...openalexKaydi("Ali Yılmaz"), title: "Hemşirelerde tükenmişlik", publication_year: 2011 }];
    assert.equal((await dogrula()).sonuc.status, "ulasilamadi");
  });

  test("iki dizin de cevap verip boş dönerse 'not_found' ve önbelleğe yazılır (eski davranış)", async () => {
    const { sonuc, yazilanlar } = await dogrula();
    assert.equal(sonuc.status, "not_found");
    assert.deepEqual(yazilanlar.map((y) => y.kayit.status), ["not_found"]);
  });

  test("bir dizin düşer, öteki güçlü eşleşme bulursa 'verified' korunur", async () => {
    crossref = "dus";
    openalex = [openalexKaydi("A. Yılmaz")];
    const { sonuc, yazilanlar } = await dogrula();
    assert.equal(sonuc.status, "verified");
    assert.equal(sonuc.bestMatch?.provider, "openalex");
    assert.deepEqual(yazilanlar.map((y) => y.kayit.status), ["verified"]);
  });

  test("yeterli kısmi eşleşme (yazar tutmuyor) bir dizin düşse de 'possible_match'", async () => {
    crossref = [crossrefKaydi("Taş")];
    openalex = "dus";
    const { sonuc } = await dogrula();
    assert.equal(sonuc.status, "possible_match");
    assert.equal(sonuc.bestMatch?.provider, "crossref");
  });
});

describe("önbellek ve eski kayıtlar", () => {
  test("süre tablosunda 'ulasilamadi' 0: yazma süzgeci onu atar", () => {
    const kaynak = readFileSync("lib/dogrulama-onbellegi.ts", "utf8");
    assert.match(kaynak, /ulasilamadi: 0,/);
    assert.match(kaynak, /\.filter\(\(giris\) => SURE\[giris\.kayit\.status\] > 0\)/);
  });

  test("önbellekten gelen eski 'not_found' kaydı olduğu gibi okunur (ağa gidilmez)", async () => {
    let istek = 0;
    globalThis.fetch = (async () => {
      istek += 1;
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const onbellek: DogrulamaOnbellegi = {
      async oku(anahtarlar) {
        return new Map(anahtarlar.map((a) => [a, { status: "not_found", bestMatch: null, matches: [] } as OnbellekKaydi]));
      },
      async yaz() {},
    };
    const [sonuc] = await verifyAcademicReferences([kunye], 25, onbellek);
    assert.equal(sonuc.status, "not_found");
    assert.equal(istek, 0);
  });

  test("eski denetim kaydında 'unreachable' alanı yok: okuyan taraf 0 sayar", () => {
    const eylem = readFileSync("app/actions/citation-check.ts", "utf8");
    assert.match(eylem, /unreachable: academicVerification\.filter\(\(item\) => item\.status === "ulasilamadi"\)\.length/);
    assert.match(eylem, /unreachable\?: number/);
    const ekran = readFileSync("app/dashboard/citations/citation-check-form.tsx", "utf8");
    assert.match(ekran, /const ulasilamayan = result\?\.verificationSummary\.unreachable \?\? 0;/);
  });
});

describe("PDF araması geçici arızayı 'kayıt yok' yapmaz", () => {
  test("'ulasilamadi' + DOI: PDF yine aranır", () => {
    assert.equal(aranacakMi("ulasilamadi", "10.1234/abc"), true);
    assert.equal(pdfHukmuErtelenirMi("ulasilamadi", "10.1234/abc"), false);
  });
  test("'ulasilamadi' + DOI yok: satır yazılmaz (hüküm ertelenir)", () => {
    assert.equal(pdfHukmuErtelenirMi("ulasilamadi", null), true);
    assert.equal(pdfHukmuErtelenirMi("not_found", null), false);
    assert.equal(pdfHukmuErtelenirMi("insufficient_data", null), false);
  });
  test("'kayit_yok' yalnızca gerçek 'not_found'tan doğar ve ertelenen künye ondan önce atlanır", () => {
    const eylem = readFileSync("app/actions/kaynak-pdf.ts", "utf8");
    assert.match(eylem, /if \(k\.dogrulama === "not_found"\) \{\s*durum = "kayit_yok";/);
    assert.ok(eylem.indexOf("pdfHukmuErtelenirMi(k.dogrulama") < eylem.indexOf('durum = "kayit_yok"'));
  });
  test("kaynak sohbeti ortak 20 MB sabitini kullanıyor", () => {
    assert.equal(PDF_EN_FAZLA_BAYT, 20 * 1024 * 1024);
    const sohbet = readFileSync("app/actions/ai-kaynak-sohbeti.ts", "utf8");
    assert.match(sohbet, /const EN_BUYUK_PDF = PDF_EN_FAZLA_BAYT;/);
    assert.doesNotMatch(sohbet, /25 \* 1024 \* 1024|en fazla 25 MB|25 MB at most/);
  });
});

describe("asistan geçici arızayı akademik yokluk diye okumaz", () => {
  test("özet etiketi 'bulunamadı' DEĞİL, bilinmediğini söylüyor", () => {
    const ozet = kaynakOzeti([{ sira: 1, ham: kunye.raw, durum: "ulasilamadi" }]);
    assert.match(ozet, /\[1\] dizine ulaşılamadı \(geçici erişim sorunu; dizinde olup olmadığı BİLİNMİYOR\)/);
    assert.doesNotMatch(ozet, /dizinde bulunamadı/);
  });
  test("sistem istemi bu kayıtlar için şüphe bulgusunu yasaklıyor", () => {
    const { mesajlar } = kaynakcaIstemi({ kaynaklar: [{ sira: 1, ham: kunye.raw, durum: "ulasilamadi" }] });
    const sistem = String(mesajlar[0]?.metin ?? "");
    assert.match(sistem, /"dizine ulaşılamadı" bir sonuç DEĞİLDİR/);
    assert.match(sistem, /ASLA söyleme/);
  });
  test("sunucu eylemi 'ulasilamadi'yı 'veri yetersiz'e çevirmiyor", () => {
    const eylem = readFileSync("app/actions/ai-kaynakca.ts", "utf8");
    assert.match(eylem, /new Set<KaynakDurumu>\(\[[^\]]*"ulasilamadi"\]\)/);
  });
});
