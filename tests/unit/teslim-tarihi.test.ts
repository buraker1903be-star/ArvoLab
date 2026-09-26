import assert from "node:assert/strict";
import test from "node:test";
import { dueInfo } from "@/lib/due-date";
import { writingPace } from "@/lib/writing-pace";

/*
  Teslim tarihi ve yazım temposu. Gün sayısı Türkiye takvim gününe göre
  hesaplanıyor; sunucu UTC'de çalıştığı için bu ayrım bu ekosistemde
  tekrarlayan bir hata sınıfı (ArvoOS'ta aynı kayma tahsilatı önceki aya
  düşürmüştü). "Bugün teslim" ile "yarın teslim" arasındaki fark,
  kullanıcının o gün ne yapacağını belirliyor.
*/
const an = (iso: string) => new Date(iso);

test("teslim tarihi", async (t) => {
  await t.test("gece 00:30'da (Türkiye) gün ilerlemiş sayılır", () => {
    // 2026-03-01 00:30 +03 = 2026-02-28 21:30 UTC. UTC'ye bakan bir
    // hesap "yarın teslim" der, oysa teslim BUGÜN.
    assert.equal(dueInfo("2026-03-01", null, an("2026-02-28T21:30:00Z"))?.label, "Bugün teslim");
  });

  await t.test("akşam 23:59'da (Türkiye) gün henüz dönmemiştir", () => {
    // 2026-02-28 23:59 +03 = 20:59 UTC; teslim yarın.
    assert.equal(dueInfo("2026-03-01", null, an("2026-02-28T20:59:00Z"))?.label, "Yarın teslim");
  });

  await t.test("yaz saati uygulanmıyor: yıl boyu UTC+3", () => {
    assert.equal(dueInfo("2026-07-16", null, an("2026-07-15T21:30:00Z"))?.label, "Bugün teslim");
    assert.equal(dueInfo("2026-01-16", null, an("2026-01-15T21:30:00Z"))?.label, "Bugün teslim");
  });

  await t.test("geçmiş tarih gecikme olarak sayılıyor", () => {
    const bilgi = dueInfo("2026-03-01", null, an("2026-03-05T09:00:00Z"));
    assert.equal(bilgi?.days, -4);
    assert.equal(bilgi?.label, "4 gün gecikti");
    assert.equal(bilgi?.tone, "danger");
  });

  await t.test("ay ve yıl sınırı doğru geçiliyor", () => {
    assert.equal(dueInfo("2027-01-01", null, an("2026-12-31T21:30:00Z"))?.days, 0, "yılbaşı gecesi");
    assert.equal(dueInfo("2026-03-01", null, an("2026-02-27T09:00:00Z"))?.days, 2, "şubat 28 çekiyor");
  });

  await t.test("kapanmış iş ve tarihsiz kayıt hesaplanmıyor", () => {
    assert.equal(dueInfo("2026-03-01", "delivered", an("2026-02-01T09:00:00Z")), null);
    assert.equal(dueInfo("2026-03-01", "archived", an("2026-02-01T09:00:00Z")), null);
    assert.equal(dueInfo(null), null);
    assert.equal(dueInfo(""), null);
    assert.equal(dueInfo("yarın"), null, "biçimsiz tarih sessizce 0 gün olmamalı");
  });
});

test("yazım temposu", async (t) => {
  const girdi = { words: 0, minPages: 100, maxPages: null, dueDate: "2026-03-11", now: an("2026-03-01T09:00:00Z") };

  await t.test("sayfa hedefi yoksa tempo hesaplanmıyor", () => {
    // Kılavuz sayfa sınırı söylemiyorsa uydurma bir hedef gösterilmemeli.
    assert.equal(writingPace({ ...girdi, minPages: null, maxPages: null }), null);
    assert.equal(writingPace({ ...girdi, minPages: 0, maxPages: null }), null);
  });

  await t.test("hedefe ulaşıldığında günlük hedef verilmiyor", () => {
    const tempo = writingPace({ ...girdi, words: 999_999 });
    assert.equal(tempo?.remainingWords, 0);
    assert.equal(tempo?.perDay, null);
    assert.equal(tempo?.tone, "success");
  });

  await t.test("günlük hedef kalan güne bölünüyor", () => {
    const tempo = writingPace(girdi);
    assert.equal(tempo?.daysLeft, 10);
    assert.ok(tempo!.perDay! > 0);
    // 50'ye yukarı yuvarlanıyor: "günde 1483 kelime" sahte bir kesinlik olurdu.
    assert.equal(tempo!.perDay! % 50, 0);
    assert.ok(tempo!.perDay! * 10 >= tempo!.remainingWords, "yuvarlama hedefi eksiltmemeli");
  });

  await t.test("teslim bugünse kalanın tamamı bugüne düşüyor", () => {
    // Sıfıra bölme değil: kalan gün 0 iken günlük hedef kalanın kendisidir.
    const tempo = writingPace({ ...girdi, dueDate: "2026-03-01" });
    assert.equal(tempo?.daysLeft, 0);
    assert.ok(Number.isFinite(tempo!.perDay!));
    assert.ok(tempo!.perDay! >= tempo!.remainingWords);
  });

  await t.test("teslim geçmişse günlük hedef yerine gecikme yazılıyor", () => {
    const tempo = writingPace({ ...girdi, dueDate: "2026-02-20" });
    assert.equal(tempo?.perDay, null);
    assert.match(tempo!.detail, /gün önce geçti/);
    assert.equal(tempo?.tone, "danger");
  });

  await t.test("tarihsiz çalışmada yalnızca kalan kelime yazılıyor", () => {
    const tempo = writingPace({ ...girdi, dueDate: null });
    assert.equal(tempo?.daysLeft, null);
    assert.equal(tempo?.perDay, null);
    assert.equal(tempo?.tone, "neutral");
  });
});
