import assert from "node:assert/strict";
import test from "node:test";
import { crossrefKunyesi, DOI_SORGU_MESAJI, doiSorgula, type CrossrefSonucu, type DoiSorguBaglami } from "@/lib/doi-sorgu";
import type { KotaKarari } from "@/lib/dizin-kotasi-kurali";
import type { DoiMetadata } from "@/lib/doi";

/*
  DOI ile künye (lookupDoi) sırası ve sınıflandırması (DOI kotası,
  07.11.2026). Her senaryo hangi bağımlılığın ÇAĞRILDIĞINI da sayar:
  hak düşmemesi gereken yerde hakDus'un hiç çağrılmaması, dış istek
  gitmemesi gereken yerde crossref'in hiç çağrılmaması asıl sözleşme.
*/

const META: DoiMetadata = {
  doi: "10.1000/abc",
  title: "Bir makale",
  authors: "Yılmaz, A.",
  year: "2020",
  sourceType: "article",
  containerTitle: null,
  volume: null,
  issue: null,
  pages: null,
  publisher: null,
  publicationPlace: null,
};

function baglam(o: Partial<{
  yetki: "tamam" | "yetkisiz" | "okunamadi";
  kutuphane: DoiMetadata | null;
  abonelik: boolean;
  kota: KotaKarari;
  crossref: CrossrefSonucu;
}> = {}) {
  const sayac = { yetki: 0, kutuphane: 0, abonelik: 0, hak: 0, crossref: 0, anahtar: "" };
  const b: DoiSorguBaglami = {
    calismaYetkisi: async () => (sayac.yetki++, o.yetki ?? "tamam"),
    kutuphanedeBul: async (anahtar) => (sayac.kutuphane++, (sayac.anahtar = anahtar), o.kutuphane ?? null),
    abonelikKapali: async () => (sayac.abonelik++, o.abonelik ?? false),
    hakDus: async () => (sayac.hak++, o.kota ?? { tur: "izin" }),
    crossref: async () => (sayac.crossref++, o.crossref ?? { tur: "tamam", metadata: META }),
  };
  return { b, sayac };
}

test("geçersiz DOI: hak YOK, dış istek YOK, yetki bile sorulmaz", async () => {
  for (const girdi of ["", "merhaba", "10.12/x", 42, null, undefined, { doi: "10.1000/x" }]) {
    const { b, sayac } = baglam();
    assert.deepEqual(await doiSorgula(girdi, b), { tur: "hata", hata: "gecersiz" }, String(girdi));
    assert.deepEqual([sayac.yetki, sayac.kutuphane, sayac.hak, sayac.crossref], [0, 0, 0, 0]);
  }
});

test("yetkisiz çalışma: hak YOK, kütüphane de yoklanmaz", async () => {
  const { b, sayac } = baglam({ yetki: "yetkisiz" });
  assert.deepEqual(await doiSorgula("10.1000/abc", b), { tur: "hata", hata: "yetkisiz" });
  assert.deepEqual([sayac.kutuphane, sayac.abonelik, sayac.hak, sayac.crossref], [0, 0, 0, 0]);
  const o = baglam({ yetki: "okunamadi" });
  assert.deepEqual(await doiSorgula("10.1000/abc", o.b), { tur: "hata", hata: "calisma_okunamadi" });
  assert.equal(o.sayac.hak + o.sayac.crossref, 0);
});

test("kütüphanede mevcut DOI: künye oradan, hak YOK, dış istek YOK, anahtar küçük harf", async () => {
  const kayit = { ...META, title: "Kütüphanedeki başlık" };
  const { b, sayac } = baglam({ kutuphane: kayit, abonelik: true, kota: { tur: "doldu" } });
  const s = await doiSorgula("https://doi.org/10.1000/ABC", b);
  assert.deepEqual(s, { tur: "tamam", metadata: kayit, kaynak: "kutuphane" });
  assert.equal(sayac.anahtar, "10.1000/abc");
  // Abonelik kapalı ve kota dolu olsa bile: dış maliyet yok, sorulmadı.
  assert.deepEqual([sayac.abonelik, sayac.hak, sayac.crossref], [0, 0, 0]);
});

test("aboneliği bitmiş kullanıcı: hak düşmeden durur (sunucuda)", async () => {
  const { b, sayac } = baglam({ abonelik: true });
  assert.deepEqual(await doiSorgula("10.1000/abc", b), { tur: "hata", hata: "abonelik" });
  assert.deepEqual([sayac.kutuphane, sayac.hak, sayac.crossref], [1, 0, 0]);
});

test("kota doldu / denetlenemedi: dış istek GÖNDERİLMEZ, mesajlar ayrı", async () => {
  const d = baglam({ kota: { tur: "doldu" } });
  assert.deepEqual(await doiSorgula("10.1000/abc", d.b), { tur: "hata", hata: "kota" });
  assert.deepEqual([d.sayac.hak, d.sayac.crossref], [1, 0]);
  const n = baglam({ kota: { tur: "denetlenemedi" } });
  assert.deepEqual(await doiSorgula("10.1000/abc", n.b), { tur: "hata", hata: "kota_denetlenemedi" });
  assert.equal(n.sayac.crossref, 0);
});

test("dış servis: başarısız istek de hakkı tüketmiştir; 404/429/500/zaman aşımı ayrı hata", async () => {
  const beklenen: [CrossrefSonucu, string][] = [
    [{ tur: "bulunamadi" }, "bulunamadi"],
    [{ tur: "yogun" }, "dis_servis_yogun"],
    [{ tur: "hata", durum: 500 }, "dis_servis_hatasi"],
    [{ tur: "zaman_asimi" }, "zaman_asimi"],
    [{ tur: "baglanti" }, "zaman_asimi"],
  ];
  for (const [crossref, hata] of beklenen) {
    const { b, sayac } = baglam({ crossref });
    assert.deepEqual(await doiSorgula("10.1000/abc", b), { tur: "hata", hata }, crossref.tur);
    assert.deepEqual([sayac.hak, sayac.crossref], [1, 1], `${crossref.tur}: hak istekten önce düştü`);
  }
  const { b } = baglam();
  assert.deepEqual(await doiSorgula("doi:10.1000/abc", b), { tur: "tamam", metadata: META, kaynak: "crossref" });
});

test("mesajlar birbirinden ayırt edilebilir (iki dilde)", () => {
  const tr = Object.values(DOI_SORGU_MESAJI).map((m) => m.tr);
  const en = Object.values(DOI_SORGU_MESAJI).map((m) => m.en);
  assert.equal(new Set(tr).size, tr.length);
  assert.equal(new Set(en).size, en.length);
  assert.match(DOI_SORGU_MESAJI.dis_servis_yogun.tr, /yoğun/);
  assert.match(DOI_SORGU_MESAJI.dis_servis_hatasi.tr, /Crossref hatası/);
});

/* ---------- crossrefKunyesi: HTTP sınıflandırması ---------- */

const yanit = (status: number, govde: unknown = {}) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => govde });

test("Crossref 404 → bulunamadi, 429 → yogun, 500/503 → hata", async () => {
  assert.deepEqual(await crossrefKunyesi("10.1000/abc", yanit(404)), { tur: "bulunamadi" });
  assert.deepEqual(await crossrefKunyesi("10.1000/abc", yanit(429)), { tur: "yogun" });
  assert.deepEqual(await crossrefKunyesi("10.1000/abc", yanit(500)), { tur: "hata", durum: 500 });
  assert.deepEqual(await crossrefKunyesi("10.1000/abc", yanit(503)), { tur: "hata", durum: 503 });
});

test("Crossref zaman aşımı ve bağlantı hatası ayrı sınıflanır", async () => {
  const atar = (ad: string) => async () => {
    const e = new Error(ad);
    e.name = ad;
    throw e;
  };
  assert.deepEqual(await crossrefKunyesi("10.1000/abc", atar("TimeoutError")), { tur: "zaman_asimi" });
  assert.deepEqual(await crossrefKunyesi("10.1000/abc", atar("AbortError")), { tur: "zaman_asimi" });
  assert.deepEqual(await crossrefKunyesi("10.1000/abc", atar("TypeError")), { tur: "baglanti" });
  // Gerçek zamanlayıcı: yanıt vermeyen sunucu sinyal ile kesilir.
  const asili = (_: string, s: RequestInit) => new Promise<never>((_r, red) => s.signal!.addEventListener("abort", () => red(s.signal!.reason)));
  // AbortSignal.timeout'un zamanlayıcısı olay döngüsünü tutmuyor: test bitmeden çıkılmasın diye ayrı bir zamanlayıcı.
  const tut = setTimeout(() => {}, 2000);
  assert.deepEqual(await crossrefKunyesi("10.1000/abc", asili, 20), { tur: "zaman_asimi" });
  clearTimeout(tut);
});

test("Crossref 200: künye ayrıştırılır; bozuk gövde hata, başlıksız kayıt bulunamadı", async () => {
  const tamam = await crossrefKunyesi("10.1000/abc", yanit(200, { message: { title: ["Başlık"], type: "journal-article", DOI: "10.1000/abc" } }));
  assert.equal(tamam.tur, "tamam");
  assert.equal(tamam.tur === "tamam" && tamam.metadata.title, "Başlık");
  assert.deepEqual(await crossrefKunyesi("10.1000/abc", yanit(200, { message: {} })), { tur: "bulunamadi" });
  const bozuk = async () => ({ status: 200, ok: true, json: async () => { throw new SyntaxError("json"); } });
  assert.deepEqual(await crossrefKunyesi("10.1000/abc", bozuk), { tur: "hata", durum: 200 });
});

test("Crossref isteği: sabit adres, User-Agent, önbelleksiz, sinyalli", async () => {
  let adres = "";
  let secenek: RequestInit = {};
  await crossrefKunyesi("10.1000/a b", async (a, s) => ((adres = a), (secenek = s), { status: 404, ok: false, json: async () => ({}) }));
  assert.match(adres, /^https:\/\/api\.crossref\.org\/works\//);
  assert.equal(secenek.cache, "no-store");
  assert.ok(secenek.signal);
  assert.ok((secenek.headers as Record<string, string>)["User-Agent"]);
});
