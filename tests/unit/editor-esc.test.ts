import assert from "node:assert/strict";
import { test } from "node:test";
import { escIsle, pdfCekmecesiGorunuyor, type EscDurumu } from "@/lib/editor-esc";

/*
  18.11.2026: odak modu ve PDF çekmecesi Esc'i hiç işlemiyordu. ProseMirror
  belgedeki Esc'i her zaman preventDefault eder; eski kural
  (defaultPrevented ise dokunma) bu yüzden belgede hiç çalışmıyordu.
*/
const temel: EscDurumu = { belgeden: false, yakalama: false, islenmis: false, acikPencere: false, atifKarti: false, oneri: false };

test("belgeden gelen Esc: ProseMirror işlenmiş saysa da yakalama aşamasında işlenir, kabarcıkta işlenmez", () => {
  assert.equal(escIsle({ ...temel, belgeden: true, yakalama: true }), true);
  assert.equal(escIsle({ ...temel, belgeden: true, yakalama: false, islenmis: true }), false);
  // Eski kural: belgede "işlenmiş" Esc hiçbir aşamada işlenmezdi.
  assert.equal(escIsle({ ...temel, belgeden: true, yakalama: true, islenmis: true }), true);
});

test("belgeden gelen Esc: öneri, açık atıf kartı ya da açık pencere varsa Esc onlarındır", () => {
  assert.equal(escIsle({ ...temel, belgeden: true, yakalama: true, oneri: true }), false);
  assert.equal(escIsle({ ...temel, belgeden: true, yakalama: true, atifKarti: true }), false);
  assert.equal(escIsle({ ...temel, belgeden: true, yakalama: true, acikPencere: true }), false);
});

test("belgenin dışından gelen Esc: yalnızca kabarcıkta ve kimse işlemediyse", () => {
  assert.equal(escIsle({ ...temel }), true);
  assert.equal(escIsle({ ...temel, yakalama: true }), false);
  assert.equal(escIsle({ ...temel, islenmis: true }), false);
  assert.equal(escIsle({ ...temel, acikPencere: true }), false);
  assert.equal(escIsle({ ...temel, atifKarti: true }), false);
});

/*
  19.11.2026 (canlı kabul C6): çekmece, yerleşim kararı gelmeden çiziliyor
  ama Esc dinleyicisi karar gelince ekleniyordu; canlıda ~2 saniye boyunca
  "Esc ile kapatın" yazan çekmece Esc'le kapanmadı. Karar artık görünen
  durumdan (nitelik + genişlik) verilir; kararın kendisine bakılmaz.
*/
test("PDF çekmecesi: nitelik ve genişlik yeter; telefonda çekmece yok", () => {
  assert.equal(pdfCekmecesiGorunuyor({ pdfAcik: true, cekmeceNiteligi: true, genislik: 1280 }), true);
  assert.equal(pdfCekmecesiGorunuyor({ pdfAcik: true, cekmeceNiteligi: false, genislik: 1472 }), false, "PDF sütundayken Esc çekmece kapatmaz");
  assert.equal(pdfCekmecesiGorunuyor({ pdfAcik: false, cekmeceNiteligi: true, genislik: 1280 }), false, "AI çekmecesi PDF değildir");
  assert.equal(pdfCekmecesiGorunuyor({ pdfAcik: true, cekmeceNiteligi: true, genislik: 760 }), false, "telefonda PDF tam ekran");
  assert.equal(pdfCekmecesiGorunuyor({ pdfAcik: true, cekmeceNiteligi: true, genislik: 761 }), true);
});
