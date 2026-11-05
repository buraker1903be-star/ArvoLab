import assert from "node:assert/strict";
import test from "node:test";
import { kunyeDogrula, type Getir } from "@/lib/kanit/dizin";

/*
  Kaynaklar ayrıntı panelinin "Dizinlerde karşılaştır"ı (Signature OS 4.2,
  kaynakKunyesiniKarsilastir → kunyeDogrula) için BAŞARILI yol, AĞSIZ.
  Yanıt Crossref'in /works/{doi} biçimindeki alan adlarıyla kurulu
  (container-title, volume, issue, page, issued). Bu bir canlı test DEĞİL:
  canlı dizinle karşılaştırma ağ erişimi olan ortamda elle sınanmalı.
*/

const KAYIT = {
  title: "Bounds testing approaches to the analysis of level relationships",
  authors: "Pesaran, M. H., Shin, Y., & Smith, R. J.",
  year: "2001",
  container_title: "Journal of Applied Econometrics",
  volume: "16",
  issue: "3",
  pages: "289–326",
  doi_or_url: "https://doi.org/10.1002/jae.616",
};

const crossref = (degisik: Record<string, unknown> = {}) => ({
  status: "ok",
  message: {
    DOI: "10.1002/jae.616",
    title: ["Bounds testing approaches to the analysis of level relationships"],
    author: [{ family: "Pesaran", given: "M. Hashem" }, { family: "Shin", given: "Yongcheol" }, { family: "Smith", given: "Richard J." }],
    "container-title": ["Journal of Applied Econometrics"],
    volume: "16",
    issue: "3",
    page: "289-326",
    issued: { "date-parts": [[2001, 5]] },
    URL: "https://doi.org/10.1002/jae.616",
    ...degisik,
  },
});

const getir = (veri: unknown): Getir => async (adres) =>
  adres.includes("api.crossref.org/works/10.1002") ? { durum: 200, veri } : { durum: 404, veri: null };

test("tam künye Crossref kaydıyla bütün alanlarda eşleşir → dogrulandi", async () => {
  const sonuc = await kunyeDogrula(KAYIT, getir(crossref()));
  assert.equal(sonuc.tur, "bulundu");
  if (sonuc.tur !== "bulundu") return;
  assert.equal(sonuc.karsilastirma.dizin, "crossref");
  assert.equal(sonuc.karsilastirma.durum, "dogrulandi");
  for (const a of sonuc.karsilastirma.alanlar) assert.equal(a.sonuc, "eslesti", `${a.alan}: ${a.bizde} ↔ ${a.kayitta}`);
});

test("tek alan farklıysa (cilt) kısmen; hangi alan olduğu söylenir", async () => {
  const sonuc = await kunyeDogrula({ ...KAYIT, volume: "61" }, getir(crossref()));
  assert.equal(sonuc.tur, "bulundu");
  if (sonuc.tur !== "bulundu") return;
  assert.equal(sonuc.karsilastirma.durum, "kismen");
  assert.equal(sonuc.karsilastirma.alanlar.find((a) => a.alan === "cilt")?.sonuc, "farkli");
});

test("kayıtta eksik alanlar 'kaydınızda yok' olur, uydurulmaz", async () => {
  const sonuc = await kunyeDogrula({ title: KAYIT.title, authors: KAYIT.authors, year: "2001", doi_or_url: KAYIT.doi_or_url }, getir(crossref()));
  assert.equal(sonuc.tur, "bulundu");
  if (sonuc.tur !== "bulundu") return;
  assert.equal(sonuc.karsilastirma.alanlar.find((a) => a.alan === "cilt")?.sonuc, "bizde_yok");
  assert.equal(sonuc.karsilastirma.alanlar.find((a) => a.alan === "cilt")?.kayitta, "16");
});
