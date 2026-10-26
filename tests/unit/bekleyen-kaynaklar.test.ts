import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { bekleyenKaynaklar } from "@/lib/bekleyen-kaynaklar";

const k = (id: string, authors: string | null, year: string | null, status = "to_review") => ({ id, authors, year, title: "Başlık", status });

describe("bekleyen kaynaklar", () => {
  test("soyad ve yıl gövdede birlikte geçiyorsa kullanılmış", () => {
    const kaynaklar = [k("a", "Öztürk, Ali", "2020"), k("b", "Yılmaz, B.", "2019"), k("c", "Kaya, C.", "2021")];
    const sonuc = bekleyenKaynaklar(kaynaklar, "… (ÖZTÜRK, 2020) ile Yılmaz (2018) …", false);
    assert.deepEqual(sonuc.map((s) => s.id), ["b", "c"]);
  });

  test("durum 'used' olsa da atıf metinde yoksa bekliyor; numaralı stilde duruma bakılır", () => {
    assert.equal(bekleyenKaynaklar([k("a", "Öztürk, Ali", "2020", "used")], "metin", false).length, 1);
    assert.equal(bekleyenKaynaklar([k("a", "Öztürk, Ali", "2020", "used")], "metin", true).length, 0);
    assert.equal(bekleyenKaynaklar([k("a", null, null)], "metin", false).length, 1);
  });
});
