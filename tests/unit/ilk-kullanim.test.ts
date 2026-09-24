import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ilkKullanim } from "../../lib/ilk-kullanim";

const durum = (parca: Partial<Parameters<typeof ilkKullanim>[0]> = {}) =>
  ilkKullanim({ calismaSayisi: 0, okunamadi: false, personel: false, ...parca });

describe("ilk kullanım kararı", () => {
  test("hiç çalışması olmayan öğrenci karşılama ekranını görür", () => {
    assert.equal(durum(), true);
  });

  test("çalışması olan kullanıcı normal panoyu görür", () => {
    assert.equal(durum({ calismaSayisi: 1 }), false);
  });

  /*
    En kritik durum: liste okunamadığında kullanıcı SIFIR çalışmayla gelir.
    Karşılama ekranı çizilseydi, çalışmaları yerinde duran birine
    "ilk çalışmanızı oluşturun" denirdi.
  */
  test("liste okunamadıysa karşılama ekranı çizilmez", () => {
    assert.equal(durum({ okunamadi: true }), false);
  });

  test("personel için sıfır sayaç gerçek bilgidir, eksik kurulum değil", () => {
    assert.equal(durum({ personel: true }), false);
  });

  test("okunamadı, çalışması olsa da karşılamayı açmaz", () => {
    assert.equal(durum({ calismaSayisi: 3, okunamadi: true }), false);
  });
});
