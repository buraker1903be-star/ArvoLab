import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { gunFarki, kalanMetni, siradakiTas, takvimOzeti, taslakTakvim, tasDurumu, tasGirdisi } from "@/lib/tez-takvimi";

const T = (id: string, hedef_tarih: string, tamamlandi: string | null = null) => ({ id, baslik: id, hedef_tarih, tamamlandi });

describe("tez takvimi", () => {
  test("durum Türkiye günüyle: geçmiş gecikti, 7 gün içi yaklaşıyor, tamamlanan tamam", () => {
    assert.deepEqual(tasDurumu(T("a", "2026-10-27"), "2026-10-28"), { durum: "gecikti", kalanGun: -1 });
    assert.deepEqual(tasDurumu(T("a", "2026-10-28"), "2026-10-28"), { durum: "yaklasiyor", kalanGun: 0 });
    assert.deepEqual(tasDurumu(T("a", "2026-11-04"), "2026-10-28"), { durum: "yaklasiyor", kalanGun: 7 });
    assert.deepEqual(tasDurumu(T("a", "2026-11-05"), "2026-10-28"), { durum: "ileride", kalanGun: 8 });
    assert.equal(tasDurumu(T("a", "2026-10-01", "2026-10-02T10:00:00Z"), "2026-10-28").durum, "tamam");
    assert.equal(gunFarki("2026-03-28", "2026-03-30"), 2, "yaz saati geçişi farkı bozmaz");
  });

  test("sıradaki taş: tamamlanmamışların en erkeni (geciken dahil); özet", () => {
    const taslar = [T("c", "2026-12-01"), T("a", "2026-10-01", "2026-10-01T00:00:00Z"), T("b", "2026-10-20")];
    const s = siradakiTas(taslar, "2026-10-28")!;
    assert.deepEqual([s.tas.id, s.durum, s.kalanGun], ["b", "gecikti", -8]);
    assert.deepEqual(takvimOzeti(taslar, "2026-10-28"), { toplam: 3, tamam: 1, geciken: 1 });
    assert.equal(siradakiTas([T("a", "2026-10-01", "x")], "2026-10-28"), null);
  });

  test("taslak takvim: tez altı adım, sıralı, son adım teslimden iki gün önce", () => {
    const t = taslakTakvim("thesis", "2026-10-28", "2027-06-30");
    assert.equal(t.length, 6);
    assert.equal(t[5].hedef_tarih, "2027-06-28");
    for (let i = 1; i < t.length; i += 1) assert.ok(t[i].hedef_tarih > t[i - 1].hedef_tarih);
    assert.ok(t[0].hedef_tarih > "2026-10-28");
    assert.equal(taslakTakvim("article", "2026-10-28", "2027-01-30").length, 5);
    assert.equal(taslakTakvim("bilinmeyen", "2026-10-28", "2027-01-30").length, 4);
  });

  test("taslak yok: teslim yok ya da 14 günden yakın", () => {
    assert.deepEqual(taslakTakvim("thesis", "2026-10-28", null), []);
    assert.deepEqual(taslakTakvim("thesis", "2026-10-28", "2026-11-10"), []);
    assert.equal(taslakTakvim("thesis", "2026-10-28", "2026-11-11").length, 6);
  });

  test("girdi doğrulama ve kalan metni", () => {
    assert.deepEqual(tasGirdisi("  Yöntem   bölümü ", "2026-11-15"), { baslik: "Yöntem bölümü", hedef_tarih: "2026-11-15" });
    assert.ok("hata" in tasGirdisi("", "2026-11-15"));
    assert.ok("hata" in tasGirdisi("x", "15.11.2026"));
    assert.ok("hata" in tasGirdisi("x".repeat(121), "2026-11-15"));
    assert.equal(kalanMetni("ileride", 12), "12 gün kaldı");
    assert.equal(kalanMetni("gecikti", -3), "3 gün gecikti");
    assert.equal(kalanMetni("yaklasiyor", 0), "bugün");
  });
});

describe("İngilizce", () => {
  test("taslak takvim adımları ve kalan metni İngilizce", () => {
    const tr = taslakTakvim("thesis", "2026-10-01", "2027-04-01");
    const en = taslakTakvim("thesis", "2026-10-01", "2027-04-01", "en");
    assert.equal(en[0].baslik, "Literature review and theoretical framework");
    // Tarihler dilden bağımsız.
    assert.deepEqual(en.map((t) => t.hedef_tarih), tr.map((t) => t.hedef_tarih));
    assert.equal(kalanMetni("ileride", 1, "en"), "1 day left");
    assert.equal(kalanMetni("gecikti", -2, "en"), "2 days overdue");
    assert.equal(kalanMetni("tamam", 0, "en"), "completed");
    assert.deepEqual(tasGirdisi("", "2026-10-01", "en"), { hata: "Enter a name for the milestone." });
  });
});
