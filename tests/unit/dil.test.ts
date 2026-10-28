import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ceviriciKur, dilOku, tarayicidanDil } from "@/lib/dil";

describe("arayüz dili", () => {
  test("Türkçe tarayıcı Türkçe, geri kalan İngilizce", () => {
    assert.equal(tarayicidanDil("tr-TR,tr;q=0.9,en;q=0.8"), "tr");
    assert.equal(tarayicidanDil("en-US,en;q=0.9"), "en");
    // Almanca tarayıcıya Türkçe göstermek İngilizceden az anlaşılır.
    assert.equal(tarayicidanDil("de-DE,de;q=0.9"), "en");
  });

  test("öncelik q değerine göre", () => {
    assert.equal(tarayicidanDil("en;q=0.5,tr;q=0.9"), "tr");
    assert.equal(tarayicidanDil("tr;q=0,en"), "en");
  });

  test("başlık yoksa varsayılan", () => {
    assert.equal(tarayicidanDil(null), "tr");
    assert.equal(tarayicidanDil("*"), "tr");
  });

  test("bozuk çerez varsayılana düşer", () => {
    assert.equal(dilOku("fr"), "tr");
    assert.equal(dilOku("en"), "en");
  });

  test("çevirici seçili dili döndürür", () => {
    assert.equal(ceviriciKur("en")({ tr: "Belge yükle", en: "Upload document" }), "Upload document");
  });
});

describe("tarih biçimleri", () => {
  test("Türkçe Türkiye saatiyle, eski işlevlerle aynı", async () => {
    const { tarihBicimleri, trTarihSaat } = await import("@/lib/tr-time");
    const an = "2026-09-20T11:05:00Z";
    assert.equal(tarihBicimleri("tr", "America/New_York").tarihSaat(an), trTarihSaat(an));
  });

  test("İngilizce kullanıcının saat diliminde", async () => {
    const { tarihBicimleri } = await import("@/lib/tr-time");
    // 02:30 UTC: New York'ta bir önceki gün.
    assert.equal(tarihBicimleri("en", "America/New_York").tarih("2026-09-20T02:30:00Z"), "Sep 19, 2026");
  });

  test("bozuk saat dilimi reddedilir", async () => {
    const { saatDilimiMi } = await import("@/lib/dil");
    assert.equal(saatDilimiMi("Mars/Olympus"), false);
    assert.equal(saatDilimiMi("Europe/Berlin"), true);
  });
});
