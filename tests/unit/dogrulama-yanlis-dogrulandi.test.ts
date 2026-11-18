import { describe, test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ParsedReference } from "@/lib/apa7";
import { parseReferenceEntry } from "@/lib/apa7";
import { verifyAcademicReferences, pdfSatirinaDoi, type DogrulamaOnbellegi, type OnbellekKaydi } from "@/lib/academic-reference-verification";
import { dogrulamaAnahtari } from "@/lib/kaynak-anahtari";

/*
  RC06l (17.11.2026) gerçek dizin kabulünde YANLIŞ "doğrulandı": iki farklı
  yazarın 2021 tarihli "Guest editorial" künyesi, Journal of Forestry'nin
  1972 tarihli, yazarsız "Guest Editorial"ına (10.1093/jof/70.7.395)
  doğrulandı ve önbelleğe 90 günlüğüne `verified` yazıldı.

  Kök neden: birebir aynı başlık tek başına 0,82 puan (eşik 0,78), yıl
  tutmasa bile; yazar kapısı yazarsız adayı "bilinmiyor" sayıp geçiriyordu.
  Örnek tablo kaydedilmiş gerçek dizin yanıtı
  (tests/fixtures/dogrulama-guest-editorial.json): Crossref gövdesi birebir,
  OpenAlex anahtarsız istekte 429 (RC06l koşusunda da 429 idi).
*/
type Ornek = {
  kunyeler: Record<"heidingsfelder" | "sohret", string>;
  rc06lOnbellekSatiri: { anahtar: string; durum: "verified"; enIyi: NonNullable<OnbellekKaydi["bestMatch"]> };
  crossref: { durum: number; govde: unknown };
  openalex: { durum: number; govde: unknown };
};
const ORNEK = JSON.parse(readFileSync(new URL("../fixtures/dogrulama-guest-editorial.json", import.meta.url), "utf8")) as Ornek;
const YANLIS_DOI = "10.1093/jof/70.7.395";
const H = parseReferenceEntry(ORNEK.kunyeler.heidingsfelder);
const S = parseReferenceEntry(ORNEK.kunyeler.sohret);

const gercekFetch = globalThis.fetch;
let istekler: string[] = [];
let dizinKapali = false;

beforeEach(() => {
  istekler = [];
  dizinKapali = false;
  globalThis.fetch = (async (adres: string) => {
    const u = new URL(String(adres));
    istekler.push(`${u.hostname}${u.pathname}`);
    if (dizinKapali) throw new Error("fetch failed");
    if (u.hostname === "api.crossref.org" && u.pathname === "/works") {
      return new Response(JSON.stringify(ORNEK.crossref.govde), { status: ORNEK.crossref.durum, headers: { "content-type": "application/json" } });
    }
    if (u.hostname === "api.openalex.org") {
      return new Response(JSON.stringify(ORNEK.openalex.govde), { status: ORNEK.openalex.durum, headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = gercekFetch;
});

function ortakOnbellek(baslangic: Record<string, OnbellekKaydi> = {}) {
  const tablo = new Map<string, OnbellekKaydi>(Object.entries(baslangic));
  const onbellek: DogrulamaOnbellegi = {
    async oku(anahtarlar) {
      return new Map(anahtarlar.filter((a) => tablo.has(a)).map((a) => [a, tablo.get(a)!]));
    },
    async yaz(girisler) {
      for (const g of girisler) tablo.set(g.anahtar, g.kayit);
    },
  };
  return { onbellek, tablo };
}

describe("DOI'siz yanlış 'doğrulandı' (RC06l, gerçek dizin yanıtı)", () => {
  test("soğuk: iki kullanıcının 'Guest editorial' künyesi 1972 yazarsız esere doğrulanmaz", async () => {
    const { onbellek, tablo } = ortakOnbellek();
    const [h] = await verifyAcademicReferences([H], 25, onbellek);
    const [s] = await verifyAcademicReferences([S], 25, onbellek);
    for (const sonuc of [h, s]) {
      assert.notEqual(sonuc.status, "verified", `${sonuc.reference} doğrulandı`);
      // Kesin eşleşme yoksa PDF satırına da başka eserin DOI'si geçmez.
      assert.equal(pdfSatirinaDoi(sonuc), null);
    }
    for (const [anahtar, kayit] of tablo) assert.ok(!(kayit.status === "verified" && kayit.bestMatch?.doi === YANLIS_DOI), `${anahtar} önbelleğe verified yazıldı`);
  });

  test("belirsiz aday uygun olduğunda 'olası eşleşme' olarak kalır (gösterilir, kesin sayılmaz)", async () => {
    const [h] = await verifyAcademicReferences([H], 25);
    assert.equal(h.status, "possible_match");
    assert.equal(h.bestMatch?.doi, YANLIS_DOI);
  });

  test("sıcak: RC06l'de yazılan yanlış verified satır yeniden sunulmaz; dizine yeniden sorulup düzeltilir", async () => {
    const satir = ORNEK.rc06lOnbellekSatiri;
    assert.equal(dogrulamaAnahtari(H), satir.anahtar, "kurgu: anahtar RC06l satırıyla aynı olmalı");
    const { onbellek, tablo } = ortakOnbellek({ [satir.anahtar]: { status: "verified", bestMatch: satir.enIyi, matches: [satir.enIyi] } });
    const [h] = await verifyAcademicReferences([H], 25, onbellek);
    assert.notEqual(h.status, "verified");
    assert.ok(istekler.length > 0, "yanlış kayıt dizine sorulmadan kullanıldı");
    assert.notEqual(tablo.get(satir.anahtar)?.status, "verified", "yanlış verified satır yerinde kaldı");
  });

  test("sıcak, dizin kapalıyken: yanlış verified satır yine sunulmaz (ulaşılamadı)", async () => {
    const satir = ORNEK.rc06lOnbellekSatiri;
    const { onbellek } = ortakOnbellek({ [satir.anahtar]: { status: "verified", bestMatch: satir.enIyi, matches: [] } });
    dizinKapali = true;
    const [h] = await verifyAcademicReferences([H], 25, onbellek);
    assert.notEqual(h.status, "verified");
    assert.equal(h.status, "ulasilamadi");
  });
});

/*
  Kurallar (DOI'siz eşleşme): eksik bilgi olumlu kanıt sayılmaz.
  Aday kayıt Crossref biçiminde sahte dizinden döner; künye ile aday tek
  tek değiştirilerek her kural ayrı sınanır.
*/
describe("DOI'siz 'doğrulandı' kuralları", () => {
  const BASLIK = "Remote learning and student wellbeing in first-year cohorts";
  const aday = (o: { yil?: number | null; aile?: string | null }) => ({
    DOI: "10.5555/kural.aday",
    title: [BASLIK],
    ...(o.aile === null ? {} : { author: [{ given: "A.", family: o.aile ?? "Kaya" }] }),
    ...(o.yil === null ? {} : { issued: { "date-parts": [[o.yil ?? 2021]] } }),
  });
  const kunye = (o: { yil?: string | null; yazar?: string | null }): ParsedReference => ({
    raw: `${o.yazar ?? ""} (${o.yil ?? "t.y."}). ${BASLIK}. Journal of Synthetic Studies.`,
    authors: o.yazar ? [o.yazar] : null,
    year: o.yil ?? null,
    title: BASLIK,
    issues: [],
  });
  const koş = async (k: ParsedReference, a: ReturnType<typeof aday>) => {
    globalThis.fetch = (async (adres: string) => {
      const u = new URL(String(adres));
      const govde = u.hostname === "api.crossref.org" ? { message: { items: [a] } } : { results: [] };
      return new Response(JSON.stringify(govde), { status: 200 });
    }) as unknown as typeof fetch;
    return (await verifyAcademicReferences([k], 25))[0].status;
  };

  test("yıl ve yazar tutuyorsa doğrulanır (±1 yıl toleransı)", async () => {
    assert.equal(await koş(kunye({ yil: "2021", yazar: "Kaya, A." }), aday({ yil: 2021 })), "verified");
    assert.equal(await koş(kunye({ yil: "2021", yazar: "Kaya, A." }), aday({ yil: 2022 })), "verified");
  });

  test("yıl farkı ±1 dışındaysa doğrulanmaz", async () => {
    assert.notEqual(await koş(kunye({ yil: "2021", yazar: "Kaya, A." }), aday({ yil: 2019 })), "verified");
    assert.notEqual(await koş(kunye({ yil: "2021", yazar: "Kaya, A." }), aday({ yil: 1972 })), "verified");
  });

  test("künyede yazar varken adayın yazar bilgisi yoksa doğrulanmaz", async () => {
    assert.notEqual(await koş(kunye({ yil: "2021", yazar: "Kaya, A." }), aday({ yil: 2021, aile: null })), "verified");
  });

  test("künyede yıl varken adayın yılı yoksa doğrulanmaz (eksik yıl olumlu kanıt değil)", async () => {
    assert.notEqual(await koş(kunye({ yil: "2021", yazar: "Kaya, A." }), aday({ yil: null })), "verified");
  });

  test("künyede ne yıl ne yazar varsa başlık tek başına doğrulamaz", async () => {
    assert.notEqual(await koş(kunye({ yil: null, yazar: null }), aday({})), "verified");
  });

  test("yazarı tutmayan aday doğrulanmaz (önceki kural korunur)", async () => {
    assert.notEqual(await koş(kunye({ yil: "2021", yazar: "Demir, B." }), aday({ yil: 2021 })), "verified");
  });
});
