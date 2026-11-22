import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  aramaKunyesiniKontrolEt,
  bagimsizDizin,
  KontrolKuyrugu,
  kontrolAnahtari,
  KunyeOnbellegi,
  servisHatasi,
  type KontrolGirdisi,
} from "@/lib/arama-kunye-kontrolu";
import { kayitlariBirlestir, type AramaKaydi } from "@/lib/literatur-arama";
import type { Getir } from "@/lib/kanit/dizin";

/*
  Makale Bul otomatik künye kontrolü (20.11.2026). Ağ sahte: hangi
  adreslere gidildiği de kaydedilir, çünkü kuralın yarısı "AYNI dizine
  yeniden sorma"dır.
*/
const DOI = "10.1145/1542476.1542528";
const BASLIK = "Trace-based just-in-time type specialization for dynamic languages";
const crossrefIs = (o: Partial<{ title: string; family: string[]; yil: number; doi: string; dergi: string }> = {}) => ({
  message: {
    DOI: o.doi ?? DOI,
    title: [o.title ?? BASLIK],
    author: (o.family ?? ["Gal", "Eich"]).map((family) => ({ family, given: "A." })),
    issued: { "date-parts": [[o.yil ?? 2009]] },
    "container-title": [o.dergi ?? "Proceedings of PLDI"],
  },
});
const openAlexIs = (o: Partial<{ title: string; adlar: string[]; yil: number; doi: string | null }> = {}) => ({
  title: o.title ?? BASLIK,
  authorships: (o.adlar ?? ["Andreas Gal", "Brendan Eich"]).map((display_name) => ({ author: { display_name } })),
  publication_year: o.yil ?? 2009,
  doi: o.doi === null ? null : `https://doi.org/${o.doi ?? DOI}`,
  primary_location: { source: { display_name: "PLDI" } },
});
function sahteAg(yanitlar: Record<string, { durum: number; veri: unknown } | "hata">) {
  const istenen: string[] = [];
  const getir: Getir = async (adres) => {
    istenen.push(adres);
    const anahtar = Object.keys(yanitlar).find((k) => adres.includes(k));
    if (!anahtar) return { durum: 404, veri: null };
    const y = yanitlar[anahtar];
    if (y === "hata") throw new Error("ağ yok");
    return y;
  };
  return { getir, istenen };
}
const girdi = (o: Partial<KontrolGirdisi> = {}): KontrolGirdisi => ({
  baslik: BASLIK,
  yazarlar: ["Andreas Gal", "Brendan Eich"],
  kunyeYazarlari: null,
  yil: 2009,
  dergi: null,
  doi: DOI,
  saglayici: "openalex",
  ...o,
});

describe("bağımsızlık: aynı dizine yeniden sorulmaz", () => {
  test("OpenAlex sonucu Crossref'e, Crossref sonucu OpenAlex'e sorulur", async () => {
    assert.equal(bagimsizDizin("openalex"), "crossref");
    const a = sahteAg({ "api.crossref.org": { durum: 200, veri: crossrefIs() } });
    const s1 = await aramaKunyesiniKontrolEt(girdi(), a.getir);
    assert.equal(s1.durum, "eslesti");
    assert.equal(s1.dizin, "crossref");
    assert.ok(a.istenen.every((u) => u.includes("api.crossref.org")), a.istenen.join());
    const b = sahteAg({ "api.openalex.org": { durum: 200, veri: openAlexIs() } });
    const s2 = await aramaKunyesiniKontrolEt(girdi({ saglayici: "crossref", kunyeYazarlari: "Gal, A., & Eich, B." }), b.getir);
    assert.equal(s2.durum, "eslesti");
    assert.equal(s2.dizin, "openalex");
    assert.ok(b.istenen.every((u) => u.includes("api.openalex.org")), b.istenen.join());
  });
  test("iki dizinden birden gelen sonuç: iki HAM künye karşılaştırılır, ağa çıkılmaz", async () => {
    const birlesik = kayitlariBirlestir([
      [{ ...temelKayit("openalex"), yil: 2009 }],
      [{ ...temelKayit("crossref"), yil: 2008, kunyeYazarlari: "Gal, A., & Eich, B." }],
    ])[0];
    // Birleşik kaydın yılı OpenAlex'ten; ham künyeler ayrı ayrı korunur.
    assert.equal(birlesik.yil, 2009);
    assert.equal(birlesik.ham?.crossref?.yil, 2008);
    const a = sahteAg({});
    const s = await aramaKunyesiniKontrolEt(birlesik, a.getir);
    assert.equal(a.istenen.length, 0);
    // 2009 / 2008: bir yıl fark (çevrim içi / sayı) belirsiz sayılmaz; sayı yılı (OpenAlex) kullanılır.
    assert.equal(s.durum, "eslesti", s.neden.tr);
    assert.match(s.neden.tr, /bir farklı/);
  });
});

function temelKayit(saglayici: "openalex" | "crossref"): AramaKaydi {
  return { kimlik: DOI, baslik: BASLIK, yazarlar: ["Andreas Gal", "Brendan Eich"], kunyeYazarlari: null, yil: 2009, tur: "article", dergi: null, doi: DOI, url: `https://doi.org/${DOI}`, atifSayisi: null, acikErisim: false, acikErisimUrl: null, saglayici };
}

describe("beş durum", () => {
  test("yıl iki yıldan fazla farklı → belirsiz; tamamlama yok", async () => {
    const a = sahteAg({ "api.crossref.org": { durum: 200, veri: crossrefIs({ yil: 2014 }) } });
    const s = await aramaKunyesiniKontrolEt(girdi(), a.getir);
    assert.equal(s.durum, "belirsiz");
    assert.match(s.neden.tr, /yıl/);
    assert.equal(s.tamamlama, null);
  });
  test("yalnızca DOI farklı (aynı çalışmanın iki sürümü) → belirsiz, sürüm uyarısıyla", async () => {
    // TraceMonkey: PLDI bildirisi 10.1145/1542476.1542528, SIGPLAN Notices 10.1145/1543135.1542528.
    const birlesik = kayitlariBirlestir([
      [{ ...temelKayit("openalex"), doi: "10.1145/1543135.1542528", kimlik: "10.1145/1543135.1542528" }],
      [{ ...temelKayit("crossref"), kunyeYazarlari: "Gal, A., & Eich, B." }],
    ])[0];
    const s = await aramaKunyesiniKontrolEt(birlesik, sahteAg({}).getir);
    assert.equal(s.durum, "belirsiz");
    assert.match(s.neden.tr, /başka bir sürümü/);
    assert.equal(s.tamamlama, null);
  });
  test("ilk yazar tutmuyor → belirsiz", async () => {
    const a = sahteAg({ "api.crossref.org": { durum: 200, veri: crossrefIs({ family: ["Smith", "Jones"] }) } });
    assert.equal((await aramaKunyesiniKontrolEt(girdi(), a.getir)).durum, "belirsiz");
  });
  test("DOI başka bir başlığa çıkıyor → belirsiz (yanlış kaynak hükmü değil)", async () => {
    const a = sahteAg({ "api.crossref.org": { durum: 200, veri: crossrefIs({ title: "A completely unrelated paper about soil chemistry" }) } });
    const s = await aramaKunyesiniKontrolEt(girdi(), a.getir);
    assert.equal(s.durum, "belirsiz");
    assert.match(s.neden.tr, /başka bir başlığa/);
  });
  test("arama sonucunda yıl yok → eksik; öteki dizinin yılı eklemede kullanılır", async () => {
    const a = sahteAg({ "api.crossref.org": { durum: 200, veri: crossrefIs() } });
    const s = await aramaKunyesiniKontrolEt(girdi({ yil: null }), a.getir);
    assert.equal(s.durum, "eksik");
    assert.equal(s.tamamlama?.yil, 2009);
  });
  test("yazar bilgisi yok → eksik, tamamlama yok (yazar teyit edilmedi)", async () => {
    const a = sahteAg({ "api.crossref.org": { durum: 200, veri: crossrefIs() } });
    const s = await aramaKunyesiniKontrolEt(girdi({ yazarlar: [], yil: null }), a.getir);
    assert.equal(s.durum, "eksik");
    assert.equal(s.tamamlama, null);
  });
  test("soyadı öneki: 'van der Berg' (Crossref) ↔ 'Jan van der Berg' (OpenAlex) eşleşir", async () => {
    const a = sahteAg({ "api.crossref.org": { durum: 200, veri: crossrefIs({ family: ["van der Berg"] }) } });
    assert.equal((await aramaKunyesiniKontrolEt(girdi({ yazarlar: ["Jan van der Berg"] }), a.getir)).durum, "eslesti");
  });
  test("DOI öteki dizinde yok (404) → kontrol edilemedi, kalıcı, 'yanlış' demez", async () => {
    const a = sahteAg({});
    const s = await aramaKunyesiniKontrolEt(girdi(), a.getir);
    assert.equal(s.durum, "kontrol_edilemedi");
    assert.equal(s.gecici, false);
    assert.match(s.neden.tr, /yanlış olduğu anlamına gelmez/);
  });
  test("servis hatası (ağ, 5xx, 429) → kontrol edilemedi, GEÇİCİ", async () => {
    for (const y of ["hata", { durum: 503, veri: null }, { durum: 429, veri: null }] as const) {
      const a = sahteAg({ "api.crossref.org": y });
      const s = await aramaKunyesiniKontrolEt(girdi(), a.getir);
      assert.equal(s.durum, "kontrol_edilemedi");
      assert.equal(s.gecici, true);
      assert.match(s.neden.tr, /ulaşılamadı/);
    }
  });
});

describe("DOI'siz sonuç: başlıkla arama", () => {
  test("başlığı tutan tek aday → karşılaştırılır, DOI tamamlanır", async () => {
    const a = sahteAg({ "api.crossref.org/works?": { durum: 200, veri: { message: { items: [crossrefIs().message] } } } });
    const s = await aramaKunyesiniKontrolEt(girdi({ doi: null }), a.getir);
    assert.equal(s.durum, "eslesti");
    assert.equal(s.tamamlama?.doi, DOI.toLowerCase());
  });
  test("aynı başlıkta farklı yıllı iki yayın → belirsiz", async () => {
    const iki = [crossrefIs().message, crossrefIs({ doi: "10.1145/1543135.1542528", yil: 2010 }).message];
    const a = sahteAg({ "api.crossref.org/works?": { durum: 200, veri: { message: { items: iki } } } });
    const s = await aramaKunyesiniKontrolEt(girdi({ doi: null, yil: 2009 }), a.getir);
    assert.equal(s.durum, "belirsiz");
    assert.match(s.neden.tr, /birden çok/);
  });
  test("başlığı tutan aday yok → kontrol edilemedi (kalıcı)", async () => {
    const a = sahteAg({ "api.openalex.org/works?": { durum: 200, veri: { results: [openAlexIs({ title: "Unrelated" })] } } });
    const s = await aramaKunyesiniKontrolEt(girdi({ doi: null, saglayici: "crossref" }), a.getir);
    assert.equal(s.durum, "kontrol_edilemedi");
    assert.equal(s.gecici, false);
  });
});

describe("önbellek ve kuyruk", () => {
  test("önbellek: geçici sonuç yazılmaz, süre dolunca düşer", () => {
    let zaman = 0;
    const o = new KunyeOnbellegi(1000, 2, () => zaman);
    o.koy("a", servisHatasi("crossref"));
    assert.equal(o.al("a"), null);
    const kalici = { ...servisHatasi("crossref"), gecici: false };
    o.koy("a", kalici);
    assert.equal(o.al("a"), kalici);
    zaman = 2000;
    assert.equal(o.al("a"), null);
    o.koy("1", kalici);
    o.koy("2", kalici);
    o.koy("3", kalici);
    assert.equal(o.al("1"), null, "en eski atılır");
  });
  test("anahtar içerikten: aynı içerik aynı anahtar, alan değişince farklı", () => {
    assert.equal(kontrolAnahtari(girdi()), kontrolAnahtari(girdi()));
    assert.notEqual(kontrolAnahtari(girdi()), kontrolAnahtari(girdi({ yil: 2010 })));
    assert.notEqual(kontrolAnahtari(girdi()), kontrolAnahtari(girdi({ saglayici: "crossref" })));
  });
  test("kuyruk: en çok N eşzamanlı, görünürler öne, yeni arama bekleyenleri atar, eski nesil işaretli döner", async () => {
    const sozler = new Map<string, () => void>();
    let enCok = 0;
    const bitenler: [number, string][] = [];
    const k = new KontrolKuyrugu<string>(
      2,
      (a) => new Promise((r) => { sozler.set(a, () => r(a)); enCok = Math.max(enCok, k.durum.ucusta); }),
      (n, a) => bitenler.push([n, a]),
    );
    const n1 = k.yeniArama(["a", "b", "c", "d", "e"]);
    k.one(["e"]);
    assert.deepEqual([...sozler.keys()], ["a", "b"]);
    sozler.get("a")!();
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(sozler.has("e"), "görünür olan (e) sıradakilerin önüne geçti");
    const n2 = k.yeniArama(["x", "b"]);
    sozler.get("b")!();
    sozler.get("e")!();
    await new Promise((r) => setTimeout(r, 0));
    assert.ok(!sozler.has("c") && !sozler.has("d"), "eski aramanın bekleyenleri atıldı");
    assert.ok(sozler.has("x"));
    assert.ok(enCok <= 2);
    assert.deepEqual(bitenler.find(([, a]) => a === "e"), [n1, "e"], "eski aramanın yanıtı eski nesille döner");
    assert.notEqual(n1, n2);
  });
});
