import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { calismaAdresi } from "@/lib/calisma-karti";
import { calismaBaglantilari, etkinBaglanti } from "@/lib/os/uygulamalar";
import { ceviriciKur } from "@/lib/dil";

/*
  ÇALIŞMA SEKMELERİ TEK KAYNAKTAN (Phase 5.1d-4, 14.11.2026). Aynı bölüm
  listesi iki yerde yazılıydı: kenar çubuğunun alt menüsü
  (calismaBaglantilari, lib/os/uygulamalar.ts) ve sayfadaki sekmeler
  (app/dashboard/editor/[id]/calisma-sekmeleri.tsx). İçerikleri o gün
  aynıydı; bu test önce o ORTAK davranışı sabitledi (ad, sıra, adres,
  etkinlik), sonra sekmeler listeyi lib'den okumaya başladı.
*/
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const t = ceviriciKur("tr");
const bolumler = (tur: string) => calismaBaglantilari({ id: TEZ, baslik: "x", tur }, t).filter((b) => b.grup === "calisma");

describe("çalışma bölümleri: ad, sıra, adres (5.1d-4 öncesi sekmelerle birebir)", () => {
  test("tez: Özet, Yazım, Kanıt matrisi, Etik kurul — Makale yok", () => {
    assert.deepEqual(
      bolumler("thesis").map((b) => [b.key, b.label, b.href]),
      [
        ["merkez", "Özet", calismaAdresi(TEZ)],
        ["yazim", "Yazım", `/dashboard/editor/${TEZ}/write`],
        ["kanit", "Kanıt matrisi", `/dashboard/editor/${TEZ}/kanit`],
        ["etik", "Etik kurul", `/dashboard/editor/${TEZ}/etik`],
      ],
    );
  });

  test("makale türünde sonda Makale", () => {
    assert.deepEqual(bolumler("article").map((b) => b.key), ["merkez", "yazim", "kanit", "etik", "makale"]);
    assert.equal(bolumler("article").at(-1)?.href, `/dashboard/editor/${TEZ}/makale`);
  });

  test("İngilizce adlar", () => {
    const en = calismaBaglantilari({ id: TEZ, baslik: "x", tur: "article" }, ceviriciKur("en")).filter((b) => b.grup === "calisma");
    assert.deepEqual(en.map((b) => b.label), ["Overview", "Writing", "Evidence matrix", "Ethics", "Article"]);
  });

  test("etkinlik: her bölümün kendi adresi o bölümü etkin yapar", () => {
    const hepsi = calismaBaglantilari({ id: TEZ, baslik: "x", tur: "article" }, t);
    for (const [yol, beklenen] of [
      [`/dashboard/editor/${TEZ}/write`, "yazim"],
      [`/dashboard/editor/${TEZ}/kanit`, "kanit"],
      [`/dashboard/editor/${TEZ}/etik`, "etik"],
      [`/dashboard/editor/${TEZ}/makale`, "makale"],
      ["/dashboard/editor", "merkez"],
    ]) {
      assert.equal(etkinBaglanti(hepsi, yol)?.key, beklenen, yol);
    }
  });
});

describe("sayfaların bildirdiği etkin sekme, adresin etkinlik kuralıyla aynı", () => {
  // Sunucu bileşeni adresi okumuyor; sayfa "aktif"i kendisi bildiriyor. O bildirim
  // kenar çubuğunun adresten hesapladığıyla aynı olmalı, yoksa iki işaret ayrışır.
  const hepsi = calismaBaglantilari({ id: TEZ, baslik: "x", tur: "article" }, t);
  for (const [dosya, alt] of [["write", "write"], ["kanit", "kanit"], ["etik", "etik"], ["makale", "makale"]]) {
    test(`${dosya}/page.tsx`, () => {
      const kaynak = fs.readFileSync(path.join(process.cwd(), `app/dashboard/editor/[id]/${dosya}/page.tsx`), "utf8");
      const m = kaynak.match(/<CalismaSekmeleri calisma=\{\w+\} aktif="(\w+)" \/>/);
      assert.ok(m, "CalismaSekmeleri çağrısı bulunamadı");
      assert.equal(m[1], etkinBaglanti(hepsi, `/dashboard/editor/${TEZ}/${alt}`)?.key);
    });
  }
});
