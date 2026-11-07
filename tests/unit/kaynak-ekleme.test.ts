import assert from "node:assert/strict";
import test from "node:test";
import { doiTekrariMesaji, guvenliDoi, kaynakDoiAnahtari, tekrarBul, type MevcutKaynak } from "@/lib/kaynak-ekleme";

/*
  Kaynak ekleme kararı (A1, 07.11.2026): DOI tekrarı ENGEL, yalnızca
  başlık + yıl UYARI. Kapsamın kendisi (çalışma / genel kütüphane, kimin
  satırları) sorguda (lib/kaynak-kapsami.ts); burada verilen satırlarla
  karar sınanır.
*/
const k = (id: string, title: string, year: string | null, doi_or_url: string | null): MevcutKaynak => ({ id, title, year, doi_or_url });
const KAPSAM = [
  k("a", "Inflation and unemployment in emerging markets", "2019", "https://doi.org/10.1000/ABC.1"),
  k("b", "Türkiye'de Phillips eğrisinin istikrarı", "2009", null),
  k("c", "Adres kaydı", "2020", "https://ornek.com/makale"),
];

test("aynı DOI, yazımı ne olursa olsun tekrar (engel)", () => {
  for (const doi of ["10.1000/abc.1", "doi: 10.1000/ABC.1", "(https://dx.doi.org/10.1000/abc.1).", "https://doi.org/10.1000%2Fabc.1"]) {
    const s = tekrarBul({ title: "Başka bir başlık", year: "2021", doi_or_url: doi }, KAPSAM);
    assert.equal(s.tur, "doi", doi);
    assert.equal(s.tur === "doi" && s.mevcut.id, "a");
  }
});

test("DOI eşleşmesi başlık eşleşmesinden önce gelir", () => {
  const s = tekrarBul({ title: "Türkiye'de Phillips eğrisinin istikrarı", year: "2009", doi_or_url: "10.1000/abc.1" }, KAPSAM);
  assert.equal(s.tur, "doi");
});

test("yalnızca başlık + yıl: uyarı, engel değil", () => {
  const s = tekrarBul({ title: "TÜRKİYE'DE PHILLIPS EĞRİSİNİN İSTİKRARI", year: "2009", doi_or_url: null }, KAPSAM);
  assert.equal(s.tur, "baslik");
  // Farklı DOI'li aynı başlık da yalnızca uyarıdır (başka baskı / düzeltilmiş sürüm olabilir).
  assert.equal(tekrarBul({ title: "Inflation and unemployment in emerging markets", year: "2019", doi_or_url: "10.1000/baska" }, KAPSAM).tur, "baslik");
});

test("farklı DOI ve farklı başlık: tekrar yok", () => {
  assert.equal(tekrarBul({ title: "Yeni kaynak", year: "2024", doi_or_url: "10.1000/yeni" }, KAPSAM).tur, "yok");
  assert.equal(tekrarBul({ title: "Yeni kaynak", year: "2024", doi_or_url: null }, []).tur, "yok");
});

test("başlıksız kayıtlar birbirinin tekrarı sayılmaz", () => {
  assert.equal(tekrarBul({ title: "", year: "2020", doi_or_url: null }, [k("x", "", "2020", null)]).tur, "yok");
});

test("adres DOI değildir; adresli kayıtlar DOI ile çakışmaz", () => {
  assert.equal(kaynakDoiAnahtari("https://ornek.com/makale"), null);
  assert.equal(tekrarBul({ title: "Farklı", year: "2020", doi_or_url: "https://ornek.com/makale" }, KAPSAM).tur, "yok");
});

test("istemciden gelen DOI doğrulanır; geçersiz değer DOI sayılmaz", () => {
  assert.equal(guvenliDoi("10.1000/abc.1"), "10.1000/abc.1");
  assert.equal(guvenliDoi("https://doi.org/10.1000/abc.1"), "10.1000/abc.1");
  for (const kotu of ["", "   ", "javascript:alert(1)", "10.1/x", "abc", null, undefined, 42, { doi: "10.1000/x" }]) {
    assert.equal(guvenliDoi(kotu), null, String(kotu));
  }
});

test("tekrar mesajı kapsamı söyler ve uzun başlığı kısaltır", () => {
  assert.match(doiTekrariMesaji(true, "Kısa").tr, /bu çalışmada/);
  assert.match(doiTekrariMesaji(false, "Kısa").tr, /genel kütüphanenizde/);
  assert.match(doiTekrariMesaji(true, "Kısa").en, /already in this work/);
  const uzun = doiTekrariMesaji(true, "x".repeat(300)).tr;
  assert.ok(uzun.length < 220 && uzun.includes("…"));
});
