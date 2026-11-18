import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DOI_PENCERE, DOI_SAATLIK_HAK, doiRezervasyonu, doiSayacAnahtari } from "@/lib/doi-sorgu-siniri";

/*
  Phase 5.0b + T3 (12.11.2026): DOI sorgusunun abonelik kapısı ve ORTAK
  saatlik bütçesi (tekli + toplu, kullanıcı başına 120).

  Sunucu eylemleri Next ve Supabase'e bağlı olduğu için çalıştırılarak
  sınanamıyor (AGENTS.md, tests/unit). Karar saf modülde ve burada
  doğrudan sınanıyor; eylemlerdeki SIRA kaynak metninden okunuyor.
  Sayacın kendisi: tests/db/hiz-siniri.test.mjs ve
  scripts/eszamanli-hiz-siniri.sh (gerçek eşzamanlılık).
*/

const satir = (granted: unknown, remaining: unknown, resets_at: unknown = "2026-11-12T21:00:00+00:00") => [{ granted, remaining, resets_at }];

describe("DOI rezervasyonu (rate_limit_take cevabı)", () => {
  test("sayaç cevabı olduğu gibi okunur: verilen, kalan, yenilenme", () => {
    assert.deepEqual(doiRezervasyonu({ sayacVar: true, veri: satir(12, 0), istenen: 50 }), {
      tur: "sayacli",
      verilen: 12,
      kalan: 0,
      yenilenme: "2026-11-12T21:00:00+00:00",
    });
    // Supabase tek satırı nesne olarak da verebilir.
    assert.equal(doiRezervasyonu({ sayacVar: true, veri: { granted: 1, remaining: 119, resets_at: null }, istenen: 1 }).tur, "sayacli");
  });

  test("hak bittiğinde verilen 0 (tekli sorgu bunu 'sınır' sayar)", () => {
    const r = doiRezervasyonu({ sayacVar: true, veri: satir(0, 0), istenen: 1 });
    assert.equal(r.tur, "sayacli");
    assert.equal(r.verilen, 0);
  });

  test("istenenden fazla verilen hak geçersiz rezervasyondur", () => {
    assert.deepEqual(doiRezervasyonu({ sayacVar: true, veri: satir(99, 21), istenen: 5 }), { tur: "ariza", verilen: 0 });
  });

  test("sayaç arızasında kapalı kalır (fail-closed): kurulamadı, hata, tuhaf cevap", () => {
    assert.deepEqual(doiRezervasyonu({ sayacVar: false, istenen: 7 }), { tur: "ariza", verilen: 0 });
    assert.deepEqual(doiRezervasyonu({ sayacVar: true, hata: { message: "x" }, veri: satir(0, 0), istenen: 3 }), { tur: "ariza", verilen: 0 });
    for (const tuhaf of [null, undefined, [], [null], "x", satir("1", 0), satir(1, -1), satir(1.5, 0)]) {
      assert.equal(doiRezervasyonu({ sayacVar: true, veri: tuhaf, istenen: 2 }).tur, "ariza", JSON.stringify(tuhaf));
    }
  });

  test("D1 fail-closed: sayaç arızasında hak verilmez", () => {
    const durumlar = [
      { sayacVar: false, istenen: 7 },
      { sayacVar: true, hata: { message: "RPC error" }, istenen: 3 },
      { sayacVar: true, veri: null, istenen: 2 },
      { sayacVar: true, veri: [{ granted: "1", remaining: 119 }], istenen: 1 },
    ];

    for (const durum of durumlar) {
      const sonuc = doiRezervasyonu(durum);
      assert.equal(sonuc.tur, "ariza", JSON.stringify(durum));
      assert.equal(sonuc.verilen, 0, JSON.stringify(durum));
    }
  });

  test("okunamayan yenilenme zamanı null olur (uydurma saat yazılmaz)", () => {
    const r = doiRezervasyonu({ sayacVar: true, veri: satir(1, 10, "yarın"), istenen: 1 });
    assert.equal(r.tur === "sayacli" && r.yenilenme, null);
  });

  test("sınır ve pencere kurum sahibinin kararıyla aynı: saatte 120", () => {
    assert.equal(DOI_SAATLIK_HAK, 120);
    assert.equal(DOI_PENCERE, "1 hour");
  });

  test("sayaç anahtarı kullanıcıya özgü ve başka sayaçlarla çakışmıyor", () => {
    const a = doiSayacAnahtari("00000000-0000-4000-8000-00000000000a");
    assert.notEqual(a, doiSayacAnahtari("00000000-0000-4000-8000-00000000000b"));
    assert.match(a, /^doi-sorgu:/);
    assert.doesNotMatch(a, /^(literatur-arama|sifre|kayit):/);
  });
});

describe("lookupDoi kapıları", () => {
  const kaynak = readFileSync("app/actions/literature.ts", "utf8");
  const govde = kaynak.slice(kaynak.indexOf("export async function lookupDoi"), kaynak.indexOf("export interface CitationSourceInput"));

  test("sıra: oturum → abonelik → DOI biçimi → ortak bütçe (1 birim) → Crossref", () => {
    const sira = [
      govde.indexOf("getAuthContext()"),
      govde.indexOf("isSubscriptionBlocked()"),
      govde.indexOf("normalizeDoi(input)"),
      govde.indexOf('rpc("rate_limit_take"'),
      govde.indexOf("fetch(crossrefWorkUrl(doi)"),
    ];
    assert.ok(sira.every((i) => i >= 0), `bulunamayan adım: ${sira}`);
    assert.deepEqual([...sira].sort((x, y) => x - y), sira, `sıra bozuk: ${sira}`);
    assert.match(govde, /p_requested: 1,/);
    assert.doesNotMatch(govde, /rate_limit_hit/);
  });

  test("anahtar ve sınır saf modülden; istemciye dönen cevapta anahtar yok", () => {
    assert.match(govde, /p_key: doiSayacAnahtari\(ctx\.user\.id\)/);
    assert.match(govde, /p_limit: DOI_SAATLIK_HAK/);
    assert.match(govde, /p_window: DOI_PENCERE/);
    for (const m of govde.matchAll(/return \{\s*(\w+)/g)) assert.ok(["error", "metadata"].includes(m[1]), m[1]);
    assert.doesNotMatch(govde, /return[^;]*doi-sorgu/);
  });

  test("abonelik engeli ve hız sınırı farklı mesajlar", () => {
    assert.match(govde, /if \(await isSubscriptionBlocked\(\)\) return \{ error: await abonelikKapaliMesaji\(\) \};/);
    assert.match(govde, /if \(hak\.tur === "sayacli" && hak\.verilen === 0\)[\s\S]*?Saatlik DOI sorgu hakkınız doldu/);
  });

  test("sayaç arızası sessiz geçmiyor: günlüğe yazılıyor", () => {
    assert.match(govde, /if \(hak\.tur === "ariza"\)\s*\{[\s\S]*?console\.error\("\[doi\] hız sınırı uygulanamadı:"/);
    const ariza = govde.indexOf('if (hak.tur === "ariza")');
    const crossref = govde.indexOf("fetch(crossrefWorkUrl(doi)");
    assert.ok(ariza >= 0 && crossref > ariza);
    assert.match(govde.slice(ariza, crossref), /return\s*\{\s*error:/);
  });

  test("lib/access.ts kapı envanterinde lookupDoi ve literatür araması var", () => {
    const erisim = readFileSync("lib/access.ts", "utf8");
    for (const ad of ["lookupDoi", "literaturAramasiYap", "aramaKaydiniEkle"]) assert.ok(erisim.includes(ad), ad);
  });
});
