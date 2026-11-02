import assert from "node:assert/strict";
import test from "node:test";
import { otomatikAtifSistemi } from "@/lib/atif-sistemi";

/*
  Kılavuz sistem adı vermediğinde kutu boş kalmıyor (02.11.2026). Eskiden
  DEÜ SBE kılavuzunda (dipnot + metin içi serbest) kutu boş geliyordu ve
  "Kurallarımı uygula" hata veriyordu.
*/
const IKISI = { dipnot: true, metinIci: true };
const METIN_ICI = { dipnot: false, metinIci: true };
const DIPNOT = { dipnot: true, metinIci: false };
const HICBIRI = { dipnot: false, metinIci: false };

test("iki yöntem serbestse çalışmanın sistemi korunuyor", () => {
  assert.deepEqual(otomatikAtifSistemi(IKISI, "apa7"), { sistem: "apa7", neden: "calisma" });
  assert.deepEqual(otomatikAtifSistemi(IKISI, "dipnot"), { sistem: "dipnot", neden: "calisma" });
  assert.deepEqual(otomatikAtifSistemi(IKISI, "mla"), { sistem: "mla", neden: "calisma" });
});

test("çalışmanın sistemi yöntemle uyuşmuyorsa yaygın sistem öneriliyor", () => {
  // Numaralı sistem ne dipnot ne yazar-tarih.
  assert.deepEqual(otomatikAtifSistemi(IKISI, "ieee"), { sistem: "apa7", neden: "varsayilan" });
  assert.deepEqual(otomatikAtifSistemi(METIN_ICI, "dipnot"), { sistem: "apa7", neden: "varsayilan" });
  assert.deepEqual(otomatikAtifSistemi(METIN_ICI, "harvard"), { sistem: "harvard", neden: "calisma" });
});

test("yalnızca dipnot anlatılıyorsa sistem dipnot", () => {
  assert.deepEqual(otomatikAtifSistemi(DIPNOT, "apa7"), { sistem: "dipnot", neden: "yontem" });
});

test("kılavuz yöntemden söz etmiyorsa öğrencinin seçimi geçerli", () => {
  assert.deepEqual(otomatikAtifSistemi(HICBIRI, "vancouver"), { sistem: "vancouver", neden: "calisma" });
  assert.deepEqual(otomatikAtifSistemi(HICBIRI, null), { sistem: "apa7", neden: "varsayilan" });
  assert.deepEqual(otomatikAtifSistemi(HICBIRI, "bilinmeyen"), { sistem: "apa7", neden: "varsayilan" });
});
