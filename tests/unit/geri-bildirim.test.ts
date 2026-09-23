import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ERTELEME_GUN, YETERLI_KELIME, soruSorulsunMu, bolumEtiketi } from "@/lib/geri-bildirim";

const GUN = 24 * 60 * 60 * 1000;
const SIMDI = Date.UTC(2026, 8, 23, 9, 0, 0);
const hicKullanmadi = { enUzunMetin: 0, atifKontrolu: 0, belgeKontrolu: 0 };

describe("kullanım geri bildirimi: kime sorulur", () => {
  test("hiç kullanmamış kişiye sorulmaz", () => {
    assert.equal(soruSorulsunMu(null, hicKullanmadi, SIMDI).sorulsun, false);
  });

  test("birkaç satır yazmış kişiye de sorulmaz; eşik kelime sayısı", () => {
    assert.equal(soruSorulsunMu(null, { ...hicKullanmadi, enUzunMetin: YETERLI_KELIME - 1 }, SIMDI).sorulsun, false);
    assert.equal(soruSorulsunMu(null, { ...hicKullanmadi, enUzunMetin: YETERLI_KELIME }, SIMDI).sorulsun, true);
  });

  test("soru hangi kullanımdan sonra sorulduğunu söyler; en taze iş kazanır", () => {
    assert.equal(soruSorulsunMu(null, { enUzunMetin: 5000, atifKontrolu: 0, belgeKontrolu: 0 }, SIMDI).baglam, "yazma");
    assert.equal(soruSorulsunMu(null, { enUzunMetin: 5000, atifKontrolu: 2, belgeKontrolu: 0 }, SIMDI).baglam, "atif");
    assert.equal(soruSorulsunMu(null, { enUzunMetin: 5000, atifKontrolu: 2, belgeKontrolu: 1 }, SIMDI).baglam, "belge");
  });

  test("cevap verildiyse ya da 'bir daha sorma' dendiyse bir daha sorulmaz", () => {
    const kullanim = { ...hicKullanmadi, belgeKontrolu: 3 };
    const dun = new Date(SIMDI - GUN).toISOString();
    assert.equal(soruSorulsunMu({ status: "answered", updatedAt: dun }, kullanim, SIMDI).sorulsun, false);
    assert.equal(soruSorulsunMu({ status: "declined", updatedAt: dun }, kullanim, SIMDI).sorulsun, false);
  });

  test("'sonra' diyene erteleme dolmadan sorulmaz, dolunca sorulur", () => {
    const kullanim = { ...hicKullanmadi, belgeKontrolu: 1 };
    const erken = new Date(SIMDI - (ERTELEME_GUN - 1) * GUN).toISOString();
    const gecti = new Date(SIMDI - (ERTELEME_GUN + 1) * GUN).toISOString();
    assert.equal(soruSorulsunMu({ status: "postponed", updatedAt: erken }, kullanim, SIMDI).sorulsun, false);
    assert.equal(soruSorulsunMu({ status: "postponed", updatedAt: gecti }, kullanim, SIMDI).sorulsun, true);
  });

  test("bozuk tarih soruyu açmaz: yanlış zamanda sormaktansa sormamak", () => {
    const kullanim = { ...hicKullanmadi, belgeKontrolu: 1 };
    assert.equal(soruSorulsunMu({ status: "postponed", updatedAt: "bilinmiyor" }, kullanim, SIMDI).sorulsun, false);
  });
});

describe("cevabın okunması", () => {
  test("bilinmeyen ya da boş bölüm değeri kırılmaz", () => {
    assert.equal(bolumEtiketi("editor"), "Belge Editörü (panelde yazma)");
    assert.equal(bolumEtiketi(null), "Belirtilmedi");
    assert.equal(bolumEtiketi("olmayan-bolum"), "Belirtilmedi");
  });
});
