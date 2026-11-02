import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { analizEtikUyarisi, etikTehlikesi, etikTeslimSatiri, etikUyarilari, veriOnaydanOnce, type EtikKaydi } from "@/lib/etik/durum";

const onayli: EtikKaydi = { durum: "onaylandi", onay_tarihi: "2026-10-01", karar_no: "2026/45", veri_toplama_baslangic: "2026-10-15" };

describe("tarih kilidi", () => {
  test("onaydan önce başlayan veri toplama tehlike", () => {
    const k = { ...onayli, veri_toplama_baslangic: "2026-09-20" };
    assert.equal(veriOnaydanOnce(k), true);
    assert.equal(etikUyarilari(k, "2026-11-02")[0].ton, "danger");
    assert.equal(etikTeslimSatiri(k, "… 2026/45 …")?.durum, "todo");
  });

  test("onay günü başlayan veri toplama geçerli", () => {
    assert.equal(veriOnaydanOnce({ onay_tarihi: "2026-10-01", veri_toplama_baslangic: "2026-10-01" }), false);
  });

  test("onay yokken veri toplama başladıysa tehlike, başlamadıysa değil", () => {
    const hazirlik: EtikKaydi = { durum: "basvuruldu", onay_tarihi: null, karar_no: null, veri_toplama_baslangic: "2026-11-01" };
    assert.ok(etikUyarilari(hazirlik, "2026-11-02").some((u) => u.ton === "danger"));
    assert.ok(!etikUyarilari(hazirlik, "2026-10-20").some((u) => u.ton === "danger"));
  });
});

describe("teslim kontrolü satırı", () => {
  test("karar sayısı metinde geçiyorsa tamam, geçmiyorsa bakılmalı", () => {
    assert.equal(etikTeslimSatiri(onayli, "Etik kurul onayı (karar no: 2026/45) alınmıştır.")?.durum, "ok");
    assert.equal(etikTeslimSatiri(onayli, "Etik kurul onayı alınmıştır.")?.durum, "warning");
  });

  test("belirlenmemişse satır yok; gerekmiyorsa gerekçeye bakılır; onaysız eksik", () => {
    assert.equal(etikTeslimSatiri(null, ""), null);
    assert.equal(etikTeslimSatiri({ durum: "belirsiz", onay_tarihi: null, karar_no: null, veri_toplama_baslangic: null }, ""), null);
    assert.equal(etikTeslimSatiri({ durum: "gerekmiyor", onay_tarihi: null, karar_no: null, veri_toplama_baslangic: null, gerekmeme_gerekcesi: "Yayımlanmış veri" }, "")?.durum, "ok");
    assert.equal(etikTeslimSatiri({ durum: "gerekmiyor", onay_tarihi: null, karar_no: null, veri_toplama_baslangic: null }, "")?.durum, "warning");
    assert.equal(etikTeslimSatiri({ durum: "hazirlaniyor", onay_tarihi: null, karar_no: null, veri_toplama_baslangic: null }, "")?.durum, "todo");
  });
});

describe("Analiz Merkezi uyarısı", () => {
  test("yalnızca onay bekleyen ya da tarihi ters olan çalışmada", () => {
    assert.equal(analizEtikUyarisi(null), null);
    assert.equal(analizEtikUyarisi(onayli), null);
    assert.equal(analizEtikUyarisi({ durum: "gerekmiyor", onay_tarihi: null, karar_no: null, veri_toplama_baslangic: null }), null);
    assert.equal(analizEtikUyarisi({ durum: "basvuruldu", onay_tarihi: null, karar_no: null, veri_toplama_baslangic: null })?.ton, "warning");
    assert.equal(analizEtikUyarisi({ ...onayli, veri_toplama_baslangic: "2026-09-01" })?.ton, "danger");
  });
});

describe("personel işareti", () => {
  test("yalnızca tehlike işaretlenir", () => {
    assert.equal(etikTehlikesi(null, "2026-11-02"), false);
    assert.equal(etikTehlikesi(onayli, "2026-11-02"), false);
    assert.equal(etikTehlikesi({ ...onayli, veri_toplama_baslangic: "2026-09-01" }, "2026-11-02"), true);
    assert.equal(etikTehlikesi({ durum: "hazirlaniyor", onay_tarihi: null, karar_no: null, veri_toplama_baslangic: null }, "2026-11-02"), false);
  });
});
