import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DOI_PENCERE, DOI_SAATLIK_HAK, doiHakKarari, doiSayacAnahtari } from "@/lib/doi-sorgu-siniri";

/*
  Phase 5.0b (12.11.2026): lookupDoi'nin abonelik kapısı ve saatlik hakkı.
  Eskiden yalnızca oturuma bakılıyordu; oturumu olan herkes sunucuyu
  sınırsız bir Crossref aracına çevirebiliyordu.

  Sunucu eylemi Next ve Supabase'e bağlı olduğu için çalıştırılarak
  sınanamıyor (AGENTS.md, tests/unit). Karar saf modülde ve burada
  doğrudan sınanıyor; eylemdeki SIRA kaynak metninden okunuyor.
  Sayacın kendisi: tests/db/hiz-siniri.test.mjs ve
  scripts/eszamanli-hiz-siniri.sh (gerçek eşzamanlılık).
*/

describe("DOI hak kararı", () => {
  test("yalnızca net bir 'false' sınırı kapatır", () => {
    assert.equal(doiHakKarari({ sayacVar: true, izin: false }), "sinir");
    assert.equal(doiHakKarari({ sayacVar: true, izin: true }), "izin");
  });

  test("sayaç arızasında açık kalır (fail-open): kurulamadı, hata döndü ya da cevap tuhaf", () => {
    assert.equal(doiHakKarari({ sayacVar: false }), "sayacsiz");
    assert.equal(doiHakKarari({ sayacVar: true, hata: { message: "bağlantı yok" } }), "sayacsiz");
    // Hata varken gelen "false" da sınır sayılmaz: okunamayan cevap hüküm değil.
    assert.equal(doiHakKarari({ sayacVar: true, hata: { message: "x" }, izin: false }), "sayacsiz");
    for (const tuhaf of [null, undefined, "false", 0, {}]) {
      assert.equal(doiHakKarari({ sayacVar: true, izin: tuhaf }), "sayacsiz");
    }
  });

  test("sınır ve pencere kurum sahibinin kararıyla aynı: saatte 120", () => {
    assert.equal(DOI_SAATLIK_HAK, 120);
    assert.equal(DOI_PENCERE, "1 hour");
  });

  test("sayaç anahtarı kullanıcıya özgü ve başka sayaçlarla çakışmıyor", () => {
    const a = doiSayacAnahtari("00000000-0000-4000-8000-00000000000a");
    const b = doiSayacAnahtari("00000000-0000-4000-8000-00000000000b");
    assert.notEqual(a, b);
    assert.match(a, /^doi-sorgu:/);
    // Literatür araması ve şifre sıfırlama kendi öneklerini kullanıyor; aynı hakkı paylaşmamalı.
    assert.doesNotMatch(a, /^(literatur-arama|sifre|kayit):/);
  });
});

describe("lookupDoi kapıları", () => {
  const kaynak = readFileSync("app/actions/literature.ts", "utf8");
  const govde = kaynak.slice(kaynak.indexOf("export async function lookupDoi"), kaynak.indexOf("export interface CitationSourceInput"));

  test("sıra: oturum → abonelik → DOI biçimi → saatlik hak → Crossref", () => {
    const sira = [
      govde.indexOf("getAuthContext()"),
      govde.indexOf("isSubscriptionBlocked()"),
      govde.indexOf("normalizeDoi(input)"),
      govde.indexOf('rpc("rate_limit_hit"'),
      govde.indexOf("fetch(crossrefWorkUrl(doi)"),
    ];
    assert.ok(sira.every((i) => i >= 0), `bulunamayan adım: ${sira}`);
    assert.deepEqual([...sira].sort((x, y) => x - y), sira, `sıra bozuk: ${sira}`);
  });

  test("sayaç anahtarı ve sınır saf modülden; istemciye dönen cevapta anahtar yok", () => {
    assert.match(govde, /p_key: doiSayacAnahtari\(ctx\.user\.id\)/);
    assert.match(govde, /p_limit: DOI_SAATLIK_HAK/);
    assert.match(govde, /p_window: DOI_PENCERE/);
    // Dönen nesnelerde yalnızca error ve metadata var.
    for (const m of govde.matchAll(/return \{\s*(\w+)/g)) assert.ok(["error", "metadata"].includes(m[1]), m[1]);
    assert.doesNotMatch(govde, /return[^;]*doi-sorgu/);
  });

  test("abonelik engeli ve hız sınırı farklı mesajlar", () => {
    assert.match(govde, /if \(await isSubscriptionBlocked\(\)\) return \{ error: await abonelikKapaliMesaji\(\) \};/);
    assert.match(govde, /if \(karar === "sinir"\)[\s\S]*?Saatlik DOI sorgu hakkınız doldu/);
    assert.match(govde, /You've used up your hourly DOI lookups/);
  });

  test("sayaç arızası sessiz geçmiyor: günlüğe yazılıyor", () => {
    assert.match(govde, /if \(karar === "sayacsiz"\)\s*\{[\s\S]*?console\.error\("\[doi\] hız sınırı uygulanamadı:"/);
  });

  test("lib/access.ts kapı envanterinde lookupDoi ve literatür araması var", () => {
    const erisim = readFileSync("lib/access.ts", "utf8");
    for (const ad of ["lookupDoi", "literaturAramasiYap", "aramaKaydiniEkle"]) assert.ok(erisim.includes(ad), ad);
  });
});
