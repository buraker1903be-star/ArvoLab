import assert from "node:assert/strict";
import test from "node:test";
import { topluDoiAyikla, topluDoiGetir, topluDoiNedenMesaji, type TopluDoiBaglami, type TopluDoiNeden } from "@/lib/toplu-doi";
import { doiSorgula, type CrossrefSonucu } from "@/lib/doi-sorgu";
import type { KotaKarari } from "@/lib/dizin-kotasi-kurali";
import type { DoiMetadata } from "@/lib/doi";

/*
  Toplu DOI (doiIleEkle) ve ortak kota (DOI kotası, 07.11.2026).

  Eşzamanlılık: gerçek sayaç rate_limit_hit tek bir atomik
  "insert … on conflict do update … returning" (veritabanında sınanır:
  tests/db/dizin-kotasi.test.mjs). Burada sayaç aynı sözleşmeyle
  taklit edilir — artırma ve karar tek adımda — ve üç akış (iki toplu
  ekleme + tekil lookupDoi'ler) aynı hakkı rastgele gecikmelerle
  paylaşır: toplam dış istek hiçbir sıralamada sınırı aşmamalı.
*/

const meta = (doi: string): DoiMetadata => ({
  doi,
  title: `Başlık ${doi}`,
  authors: null,
  year: "2020",
  sourceType: "article",
  containerTitle: null,
  volume: null,
  issue: null,
  pages: null,
  publisher: null,
  publicationPlace: null,
});

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** rate_limit_hit taklidi: sayım ve karar tek adımda (atomik). */
function sayac(sinir: number) {
  let sayim = 0;
  return {
    get sayim() {
      return sayim;
    },
    hakDus: async (): Promise<KotaKarari> => {
      await bekle(Math.random() * 3);
      sayim++;
      return sayim <= sinir ? { tur: "izin" } : { tur: "doldu" };
    },
  };
}

function baglam(o: { kutuphane?: string[]; hakDus?: () => Promise<KotaKarari>; crossref?: (doi: string) => CrossrefSonucu } = {}) {
  const sorulan: string[] = [];
  let hak = 0;
  const b: TopluDoiBaglami = {
    kutuphanede: (a) => (o.kutuphane ?? []).includes(a),
    hakDus: o.hakDus ?? (async () => (hak++, { tur: "izin" })),
    crossref: async (doi) => {
      sorulan.push(doi);
      await bekle(Math.random() * 3);
      return o.crossref ? o.crossref(doi) : { tur: "tamam", metadata: meta(doi) };
    },
  };
  return { b, sorulan, hak: () => hak };
}

test("aynı işlemde tekrar eden DOI'ler tekilleşir; geçersizler ayrı sayılır", () => {
  const r = topluDoiAyikla([
    "10.1000/A",
    "https://doi.org/10.1000/a",
    "doi: 10.1000/A.",
    "10.1000/b",
    "çöp",
    "",
    42,
    "10.1000/B",
  ]);
  assert.deepEqual(r.doilar, ["10.1000/A", "10.1000/b"]);
  assert.equal(r.tekrar, 3);
  assert.equal(r.gecersiz, 3);
  assert.deepEqual(topluDoiAyikla("10.1000/a"), { doilar: [], tekrar: 0, gecersiz: 0 });
});

test("tekrar eden DOI ikinci kez sorulmaz ve hak düşürmez", async () => {
  const { doilar } = topluDoiAyikla(["10.1000/x", "10.1000/X", "https://doi.org/10.1000/x"]);
  const { b, sorulan, hak } = baglam();
  const r = await topluDoiGetir(doilar, b);
  assert.deepEqual(sorulan, ["10.1000/x"]);
  assert.equal(hak(), 1);
  assert.equal(r.disSorgu, 1);
});

test("kütüphanede bulunan DOI dışarı sorulmaz, hak düşürmez, 'vardi' raporlanır", async () => {
  const { b, sorulan, hak } = baglam({ kutuphane: ["10.1000/var"] });
  const r = await topluDoiGetir(["10.1000/VAR", "10.1000/yeni"], b);
  assert.deepEqual(sorulan, ["10.1000/yeni"]);
  assert.equal(hak(), 1);
  assert.deepEqual(r.satirlar.map((s) => s.durum), ["vardi", "getirildi"]);
});

test("kota dolunca işlem durur; işlenen ve işlenmeyen AYRI, kütüphanedekiler 'vardi' kalır", async () => {
  const s = sayac(3);
  const doilar = Array.from({ length: 10 }, (_, i) => `10.1000/d${i}`);
  const { b, sorulan } = baglam({ kutuphane: ["10.1000/d9"], hakDus: s.hakDus });
  const r = await topluDoiGetir(doilar, b);
  assert.equal(sorulan.length, 3, "sınır kadar dış istek");
  assert.equal(r.disSorgu, 3);
  assert.equal(r.durdu, "kota");
  const durum = (d: string) => r.satirlar.filter((x) => x.durum === d).length;
  assert.equal(durum("getirildi"), 3);
  assert.equal(durum("vardi"), 1);
  assert.equal(durum("islenmedi"), 6);
  for (const x of r.satirlar) if (x.durum === "islenmedi") assert.equal(x.neden, "kota");
  // Sıra korunur.
  assert.deepEqual(r.satirlar.map((x) => x.doi), doilar);
  // Sorulmayan hiçbir DOI "getirildi" değil; sorulan hiçbiri "islenmedi" değil.
  for (const x of r.satirlar) assert.equal(sorulan.includes(x.doi), x.durum === "getirildi", x.doi);
});

test("sayaç denetlenemedi (üretimde sayaç yok/hata): hiçbir dış istek gitmez", async () => {
  const { b, sorulan } = baglam({ kutuphane: ["10.1000/a"], hakDus: async () => ({ tur: "denetlenemedi" }) });
  const r = await topluDoiGetir(["10.1000/a", "10.1000/b", "10.1000/c"], b);
  assert.deepEqual(sorulan, []);
  assert.equal(r.durdu, "kota_denetlenemedi");
  assert.deepEqual(r.satirlar.map((s) => s.durum), ["vardi", "islenmedi", "islenmedi"]);
  assert.ok(r.satirlar.slice(1).every((s) => s.durum === "islenmedi" && s.neden === "kota_denetlenemedi"));
});

test("dış servis 404, 429, 500, zaman aşımı: her biri hak tüketir ve ayrı nedenle raporlanır", async () => {
  const cevap: Record<string, CrossrefSonucu> = {
    "10.1000/yok": { tur: "bulunamadi" },
    "10.1000/yogun": { tur: "yogun" },
    "10.1000/bozuk": { tur: "hata", durum: 500 },
    "10.1000/yavas": { tur: "zaman_asimi" },
    "10.1000/kopuk": { tur: "baglanti" },
  };
  const { b, hak } = baglam({ crossref: (d) => cevap[d] });
  const r = await topluDoiGetir(Object.keys(cevap), b);
  assert.equal(hak(), 5);
  assert.deepEqual(
    r.satirlar.map((s) => [s.durum, "neden" in s ? s.neden : null]),
    [
      ["bulunamadi", null],
      ["hata", "dis_servis_yogun"],
      ["hata", "dis_servis_hatasi"],
      ["hata", "zaman_asimi"],
      ["hata", "zaman_asimi"],
    ],
  );
});

test("en çok 5 eşzamanlı dış istek", async () => {
  let anlik = 0;
  let enCok = 0;
  const b: TopluDoiBaglami = {
    kutuphanede: () => false,
    hakDus: async () => ({ tur: "izin" }),
    crossref: async (doi) => {
      enCok = Math.max(enCok, ++anlik);
      await bekle(5);
      anlik--;
      return { tur: "tamam", metadata: meta(doi) };
    },
  };
  await topluDoiGetir(Array.from({ length: 23 }, (_, i) => `10.1000/e${i}`), b);
  assert.equal(enCok, 5);
});

test("EŞZAMANLI kota: iki toplu ekleme + tekil lookupDoi'ler aynı 60 hakkı paylaşır, toplam dış istek 60'ı aşmaz", async () => {
  for (let tur = 0; tur < 20; tur++) {
    const s = sayac(60);
    let disIstek = 0;
    const crossref = async (doi: string): Promise<CrossrefSonucu> => {
      disIstek++;
      await bekle(Math.random() * 2);
      return { tur: "tamam", metadata: meta(doi) };
    };
    const toplu = (on: string) =>
      topluDoiGetir(Array.from({ length: 40 }, (_, i) => `10.1000/${on}${i}`), { kutuphanede: () => false, hakDus: s.hakDus, crossref });
    const tekil = Array.from({ length: 15 }, (_, i) =>
      doiSorgula(`10.1000/t${i}`, {
        calismaYetkisi: async () => "tamam",
        kutuphanedeBul: async () => null,
        abonelikKapali: async () => false,
        hakDus: s.hakDus,
        crossref,
      }),
    );
    const [a, c, ...t] = await Promise.all([toplu("a"), toplu("c"), ...tekil]);
    assert.equal(disIstek, 60, `tur ${tur}: dış istek tam sınır kadar`);
    const basarili = a.disSorgu + c.disSorgu + t.filter((x) => x.tur === "tamam").length;
    assert.equal(basarili, 60);
    const reddedilenTekil = t.filter((x) => x.tur === "hata").length;
    assert.ok(t.every((x) => x.tur === "tamam" || x.hata === "kota"));
    const islenmedi = [...a.satirlar, ...c.satirlar].filter((x) => x.durum === "islenmedi").length;
    // Her DOI ya sorulmuş ya da "islenmedi"/kota hatası: kaybolan yok.
    assert.equal(basarili + reddedilenTekil + islenmedi, 95);
  }
});

test("tek DOI kutusu: her neden ayrı mesaj (kota, denetlenemedi, 429, Crossref hatası, zaman aşımı)", () => {
  const nedenler: TopluDoiNeden[] = ["kota", "kota_denetlenemedi", "dis_servis_yogun", "dis_servis_hatasi", "zaman_asimi"];
  const tr = nedenler.map((n) => topluDoiNedenMesaji(n).tr);
  assert.equal(new Set(tr).size, nedenler.length);
  assert.match(tr[0], /hakkınız doldu/);
  assert.match(tr[1], /denetlenemediği/);
});
