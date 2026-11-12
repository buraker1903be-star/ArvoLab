import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  doiAnahtari,
  doiListesiniHazirla,
  kayitPlani,
  rezervasyonuBol,
  sirala,
  yenilenmeSaati,
  type CekilenKayit,
  type DoiSonucu,
} from "@/lib/doi-toplu";
import { kaynakAnahtarlari, type KaynakTaslagi } from "@/lib/kaynak-aktarim";

/*
  T3 (12.11.2026): toplu DOI içe aktarmanın karar katmanı. Bütçe yalnızca
  Crossref'e gidecek DOI'lerden düşer; kısmi bütçede sıra korunur; D1
  ("eklendi" kayıttan önce yazılıyordu, başlık+yıl tekrarı da "eklendi"
  görünüyordu) ve D2 (kayıt hatasında DOI başına sonuçlar kayboluyordu)
  burada sabitleniyor.
*/

const taslak = (title: string, year: string | null, doi: string): KaynakTaslagi => ({
  title,
  authors: null,
  year,
  sourceType: "article",
  doiOrUrl: doi,
  containerTitle: null,
  volume: null,
  issue: null,
  pages: null,
  publisher: null,
  publicationPlace: null,
});
const doiler = (n: number) => Array.from({ length: n }, (_, i) => `10.1234/test.${String(i + 1).padStart(2, "0")}`);

describe("DOI listesinin hazırlanması: bütçe yalnızca Crossref'e gidecekler için", () => {
  test("geçersiz ve listede tekrar eden DOI ağa gitmez, sayılır", () => {
    const h = doiListesiniHazirla(["10.1000/a", "çöp", "https://doi.org/10.1000/A", "10.1000/b", "", null, "10.1000/b."], new Set());
    assert.deepEqual(h.sira, ["10.1000/a", "10.1000/b"]);
    assert.deepEqual(h.aranacak, ["10.1000/a", "10.1000/b"]);
    assert.equal(h.gecersiz, 3);
    assert.equal(h.listedeTekrar, 2);
  });

  test("bu çalışmada zaten olan DOI 'vardi': ağa gitmez, hak harcamaz", () => {
    const mevcut = new Set(kaynakAnahtarlari({ title: "Eski", year: "2020", doiOrUrl: "https://doi.org/10.1000/A" }));
    const h = doiListesiniHazirla(["10.1000/a", "10.1000/b"], mevcut);
    assert.deepEqual(h.vardi, ["10.1000/a"]);
    assert.deepEqual(h.aranacak, ["10.1000/b"]);
  });

  test("doiAnahtari kaynakAnahtarlari ile aynı biçimde", () => {
    assert.equal(doiAnahtari("10.1000/AbC"), kaynakAnahtarlari({ title: "", year: null, doiOrUrl: "10.1000/abc" })[0]);
  });

  test("girdi dizi değilse boş liste", () => {
    assert.deepEqual(doiListesiniHazirla("10.1000/a" as unknown, new Set()).sira, []);
  });
});

describe("kısmi bütçe: sıra korunur, fazlası ertelenir", () => {
  test("50 DOI, kalan hak 12: ilk 12 sorgulanır, 38 ertelenir (kullanıcının sırasıyla)", () => {
    const liste = doiler(50);
    const { islenecek, ertelenen } = rezervasyonuBol(doiListesiniHazirla(liste, new Set()).aranacak, 12);
    assert.deepEqual(islenecek, liste.slice(0, 12));
    assert.deepEqual(ertelenen, liste.slice(12));
  });
  test("50 DOI, tam bütçe: hepsi sorgulanır", () => {
    const { islenecek, ertelenen } = rezervasyonuBol(doiler(50), 50);
    assert.equal(islenecek.length, 50);
    assert.equal(ertelenen.length, 0);
  });
  test("hak yok: hepsi ertelenir; tuhaf değerler sınırlanır", () => {
    assert.equal(rezervasyonuBol(doiler(5), 0).ertelenen.length, 5);
    assert.equal(rezervasyonuBol(doiler(5), -3).islenecek.length, 0);
    assert.equal(rezervasyonuBol(doiler(5), 99).islenecek.length, 5);
    assert.equal(rezervasyonuBol(doiler(5), 2.9).islenecek.length, 2);
  });
  test("'vardi' olanlar araya girse de sıra ve sayım doğru", () => {
    const mevcut = new Set([doiAnahtari("10.1234/test.02")]);
    const h = doiListesiniHazirla(doiler(4), mevcut);
    const { islenecek, ertelenen } = rezervasyonuBol(h.aranacak, 2);
    assert.deepEqual(islenecek, ["10.1234/test.01", "10.1234/test.03"]);
    assert.deepEqual(ertelenen, ["10.1234/test.04"]);
  });
});

describe("D1: başlık+yıl çakışması ayrı durum, farklı DOI'ler birleştirilmez", () => {
  test("çalışmada DOI'siz girilmiş aynı başlık+yıl: yazılmaz, 'vardi_baslik'", () => {
    const mevcut = new Set(kaynakAnahtarlari({ title: "Örgütsel Bağlılık", year: "2020", doiOrUrl: null }));
    const cekilen: CekilenKayit[] = [{ doi: "10.1000/x", taslak: taslak("Örgütsel bağlılık", "2020", "10.1000/x") }];
    const p = kayitPlani(cekilen, mevcut);
    assert.equal(p.yazilacak.length, 0);
    assert.deepEqual(p.baslikCakisan.map((k) => k.doi), ["10.1000/x"]);
  });
  test("aynı listede başlığı ve yılı aynı iki ayrı DOI: ilki yazılır, ikincisi 'vardi_baslik'", () => {
    const cekilen: CekilenKayit[] = [
      { doi: "10.1000/x", taslak: taslak("Aynı Başlık", "2021", "10.1000/x") },
      { doi: "10.1000/y", taslak: taslak("Aynı başlık", "2021", "10.1000/y") },
    ];
    const p = kayitPlani(cekilen, new Set());
    assert.deepEqual(p.yazilacak.map((k) => k.doi), ["10.1000/x"]);
    assert.deepEqual(p.baslikCakisan.map((k) => k.doi), ["10.1000/y"]);
  });
  test("başlık aynı yıl farklı: ikisi de yazılır", () => {
    const p = kayitPlani([
      { doi: "10.1000/x", taslak: taslak("Aynı", "2021", "10.1000/x") },
      { doi: "10.1000/y", taslak: taslak("Aynı", "2022", "10.1000/y") },
    ], new Set());
    assert.equal(p.yazilacak.length, 2);
  });
  test("kayitPlani çağıranın kümesini değiştirmez", () => {
    const mevcut = new Set<string>();
    kayitPlani([{ doi: "10.1000/x", taslak: taslak("A", "2020", "10.1000/x") }], mevcut);
    assert.equal(mevcut.size, 0);
  });
});

describe("sonuçların sırası ve yenilenme saati", () => {
  test("sonuçlar kullanıcının yapıştırdığı sıraya göre", () => {
    const s: DoiSonucu[] = [
      { doi: "10.1000/c", durum: "ertelendi", neden: "hak" },
      { doi: "10.1000/a", durum: "vardi" },
      { doi: "10.1000/b", durum: "eklendi" },
    ];
    assert.deepEqual(sirala(s, ["10.1000/a", "10.1000/b", "10.1000/c"]).map((x) => x.doi), ["10.1000/a", "10.1000/b", "10.1000/c"]);
  });
  test("yenilenme saati okunamazsa null (uydurma saat yazılmaz)", () => {
    assert.equal(yenilenmeSaati(null, "tr-TR"), null);
    assert.equal(yenilenmeSaati("yarın", "tr-TR"), null);
    assert.match(yenilenmeSaati("2026-11-12T11:32:00Z", "tr-TR") ?? "", /^\d{2}:\d{2}$/);
  });
});

describe("doiIleEkle: ortak bütçe, D1 ve D2 (eylem kaynağı)", () => {
  const kaynak = readFileSync("app/actions/kaynak-aktarim.ts", "utf8");
  const govde = kaynak.slice(kaynak.indexOf("export async function doiIleEkle"));

  test("sıra: biçim/adet → oturum+abonelik+sahiplik (hazirlik) → TEK atomik rezervasyon → Crossref → kayıt", () => {
    const sira = [
      govde.indexOf("doiListesiniHazirla(doilar, new Set())"),
      govde.indexOf("await hazirlik(projectId)"),
      govde.indexOf('rpc("rate_limit_take"'),
      govde.indexOf("fetch(crossrefWorkUrl(doi)"),
      govde.indexOf('.from("literature_sources")'),
    ];
    assert.ok(sira.every((i) => i >= 0), `bulunamayan adım: ${sira}`);
    assert.deepEqual([...sira].sort((x, y) => x - y), sira, `sıra bozuk: ${sira}`);
    assert.match(govde, /p_requested: plan\.aranacak\.length,/);
    assert.equal(govde.match(/rpc\("rate_limit_take"/g)?.length, 1);
  });

  test("D1: 'eklendi' yalnızca başarılı yazımdan sonra", () => {
    const yazim = govde.indexOf('.from("literature_sources")');
    const eklendi = govde.indexOf('durum: "eklendi"');
    assert.ok(eklendi > yazim, "eklendi kayıttan önce yazılıyor");
    assert.match(govde, /\} else \{\s*for \(const k of yazilacak\) sonuclar\.push\(\{ doi: k\.doi, durum: "eklendi"/);
    assert.match(govde, /for \(const k of baslikCakisan\) sonuclar\.push\(\{ doi: k\.doi, durum: "vardi_baslik"/);
  });

  test("D2: kayıt hatasında DOI başına sonuçlar ve özet de döner", () => {
    assert.match(govde, /for \(const k of yazilacak\) sonuclar\.push\(\{ doi: k\.doi, durum: "kaydedilemedi"/);
    assert.match(govde, /return \{ \.\.\.\(kayitHatasi \? \{ error: kayitHatasi \} : \{\}\), sonuclar: sirala\(sonuclar, plan\.sira\), ozet \};/);
  });

  test("rezervasyon ile gerçek sorgu farkı özette; sayaç arızası günlükte ve özette", () => {
    assert.match(govde, /kullanilmayan: Math\.max\(0, hak\.verilen - sorgulanan\)/);
    assert.match(govde, /sayacsiz: hak\.tur === "sayacsiz"/);
    assert.match(govde, /console\.error\("\[kaynak-aktarim\] hız sınırı uygulanamadı:"/);
  });

  test("süre bütçesi sayfanın maxDuration'ı içinde", () => {
    const sure = Number(govde.match(/CROSSREF_SURE_BUTCESI_MS = ([\d_]+);/)?.[1].replace(/_/g, "") ?? kaynak.match(/CROSSREF_SURE_BUTCESI_MS = ([\d_]+);/)?.[1].replace(/_/g, ""));
    const sayfa = readFileSync("app/dashboard/literature/page.tsx", "utf8");
    const azami = Number(sayfa.match(/export const maxDuration = (\d+);/)?.[1]);
    assert.ok(sure > 0 && azami > 0, `${sure} / ${azami}`);
    // Bütçe + kimlik/kayıt payı (≥ 20 sn) sayfa sınırının altında kalmalı.
    assert.ok(sure / 1000 + 20 <= azami, `${sure / 1000} sn bütçe, ${azami} sn sınır`);
  });
});
