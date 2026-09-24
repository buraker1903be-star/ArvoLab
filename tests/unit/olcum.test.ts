import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  aktivasyonHesapla,
  erisimiAcik,
  huniHesapla,
  kayipHesapla,
  odemeYapmis,
  ortalamaPuan,
  type OlcumAbonelik,
} from "@/lib/olcum";

const SIMDI = new Date("2026-09-24T12:00:00Z");
const gun = (n: number) => new Date(SIMDI.getTime() + n * 86_400_000).toISOString();

const abonelik = (parca: Partial<OlcumAbonelik> & { user_id: string }): OlcumAbonelik => ({
  status: "trialing",
  trial_ends_at: null,
  current_period_end: null,
  ...parca,
});

describe("ölçüm: ödeme yapmış mı", () => {
  test("dönem sonu deneme bitişinden ileriyse ödeme yapılmıştır", () => {
    assert.equal(
      odemeYapmis(abonelik({ user_id: "a", trial_ends_at: gun(-20), current_period_end: gun(10) })),
      true,
    );
  });

  test("dönem sonu deneme bitişiyle aynıysa ödeme yoktur", () => {
    // ArvoOS denemeyi başlatırken iki alanı da aynı tarihe yazıyor; burada
    // "active" durumuna bakılsaydı ödemesiz abone ödemiş sayılırdı.
    const t = gun(5);
    assert.equal(odemeYapmis(abonelik({ user_id: "a", status: "active", trial_ends_at: t, current_period_end: t })), false);
  });

  test("hiç dönem sonu yoksa ödeme yoktur", () => {
    assert.equal(odemeYapmis(abonelik({ user_id: "a", trial_ends_at: gun(5) })), false);
  });

  test("deneme hiç başlamamış ama dönem sonu varsa ödeme sayılır", () => {
    assert.equal(odemeYapmis(abonelik({ user_id: "a", current_period_end: gun(30) })), true);
  });
});

describe("ölçüm: erişim açık mı", () => {
  test("dönem sonu geçmişte ise kapalı, gelecekte ise açık", () => {
    assert.equal(erisimiAcik(abonelik({ user_id: "a", current_period_end: gun(-1) }), SIMDI), false);
    assert.equal(erisimiAcik(abonelik({ user_id: "a", current_period_end: gun(1) }), SIMDI), true);
  });

  test("dönem sonu yoksa deneme bitişine bakılır", () => {
    assert.equal(erisimiAcik(abonelik({ user_id: "a", trial_ends_at: gun(3) }), SIMDI), true);
  });

  test("iki tarih de yoksa kapalı", () => {
    assert.equal(erisimiAcik(abonelik({ user_id: "a" }), SIMDI), false);
  });
});

describe("ölçüm: huni", () => {
  const kullanicilar = ["a", "b", "c", "d"].map((id) => ({ id, created_at: gun(-40) }));

  test("dönüşüm yalnızca denemeyi başlatanlar üzerinden hesaplanır", () => {
    // Paydaya kayıt sayısı konsaydı (4) oran %25 çıkardı; denemeyi hiç
    // başlatmamış kişi dönüşüm hunisinin o adımında yoktur.
    const huni = huniHesapla(
      kullanicilar,
      [
        abonelik({ user_id: "a", trial_ends_at: gun(-20), current_period_end: gun(10) }),
        abonelik({ user_id: "b", trial_ends_at: gun(-20), current_period_end: gun(-20) }),
      ],
      SIMDI,
    );
    assert.equal(huni.kayit, 4);
    assert.equal(huni.denemeBaslatan, 2);
    assert.equal(huni.odemeyeGecen, 1);
    assert.equal(huni.suAnErisimi, 1);
    assert.equal(huni.donusumYuzdesi, 50);
  });

  test("hiç deneme yoksa oran %0 değil, yok", () => {
    // "%0 dönüşüm" ile "ölçülecek kimse yok" aynı şey değil.
    assert.equal(huniHesapla(kullanicilar, [], SIMDI).donusumYuzdesi, null);
  });
});

describe("ölçüm: aktivasyon", () => {
  const kullanicilar = ["a", "b", "c", "d"].map((id) => ({ id, created_at: gun(-10) }));

  test("payda her kayıtlı kullanıcı; kurum üyesi sayıma girmez", () => {
    const adimlar = aktivasyonHesapla(kullanicilar, [
      // "z" bireysel listede yok (kurum üyesi): kesişim onu eliyor.
      { etiket: "Çalışma açtı", kimlikler: ["a", "b", "z"] },
      { etiket: "Asistanı kullandı", kimlikler: ["a"] },
    ]);
    assert.deepEqual(adimlar[0], { etiket: "Çalışma açtı", kisi: 2, yuzde: 50 });
    assert.deepEqual(adimlar[1], { etiket: "Asistanı kullandı", kisi: 1, yuzde: 25 });
  });

  test("aynı kullanıcının birden çok satırı kişiyi bir kez sayar", () => {
    // Kaynak tablolar satır bazlı: bir kullanıcının üç çalışması varsa
    // ham liste üç kez onu içerir. Tekilleştirme olmasaydı yüzde 100'ü aşardı.
    const adimlar = aktivasyonHesapla(kullanicilar, [
      { etiket: "Çalışma açtı", kimlikler: ["a", "a", "a", "b"] },
    ]);
    assert.deepEqual(adimlar[0], { etiket: "Çalışma açtı", kisi: 2, yuzde: 50 });
  });

  test("hiç kayıt yoksa yüzde yok", () => {
    assert.equal(aktivasyonHesapla([], [{ etiket: "Çalışma açtı", kimlikler: ["a"] }])[0].yuzde, null);
  });
});

describe("ölçüm: kayıp", () => {
  test("denemede bırakan ile yenilemeyen ayrı sayılır", () => {
    const ozet = kayipHesapla(
      [
        // Erişimi açık: hiçbir kayıp kovasına girmez.
        abonelik({ user_id: "a", trial_ends_at: gun(-2), current_period_end: gun(20) }),
        // Ödemiş, dönemi bitmiş: yenilemeyen.
        abonelik({ user_id: "b", trial_ends_at: gun(-60), current_period_end: gun(-5) }),
        // Denemesi bitmiş, hiç ödememiş.
        abonelik({ user_id: "c", trial_ends_at: gun(-3) }),
        // Deneme hiç başlamamış: ölçülecek bir bırakma yok.
        abonelik({ user_id: "d" }),
      ],
      SIMDI,
    );
    assert.deepEqual(ozet, { denemedeBirakan: 1, yenilemeyen: 1 });
  });
});

describe("ölçüm: ortalama puan", () => {
  test("puansız cevaplar paydaya girmez", () => {
    assert.equal(ortalamaPuan([5, 4, null, 3]), 4);
  });

  test("hiç puan yoksa ortalama yok", () => {
    assert.equal(ortalamaPuan([null, null]), null);
  });
});
