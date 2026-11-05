import assert from "node:assert/strict";
import test from "node:test";
import { eylemYerlesimi, sirala, sonrakiSiralama } from "@/lib/os/sayfa-standardi";

/* Ortak sayfa standardı (Signature OS 4.1): eylem yerleşimi ve sıralama. */

test("eylemler: masaüstü ve tablette ikinciller satırda, taşma menüde", () => {
  for (const ekran of ["masaustu", "tablet"] as const) {
    assert.deepEqual(eylemYerlesimi(ekran, { ikincil: 3, tasma: 2 }), { ikincil: "satir", menuVar: true });
    assert.deepEqual(eylemYerlesimi(ekran, { ikincil: 2, tasma: 0 }), { ikincil: "satir", menuVar: false });
  }
});

test("eylemler: telefonda ikinciller taşma menüsüne girer", () => {
  assert.deepEqual(eylemYerlesimi("telefon", { ikincil: 2, tasma: 1 }), { ikincil: "menu", menuVar: true });
  assert.deepEqual(eylemYerlesimi("telefon", { ikincil: 2, tasma: 0 }), { ikincil: "menu", menuVar: true });
});

test("eylemler: telefonda tek eylem için menü açtırılmaz", () => {
  assert.deepEqual(eylemYerlesimi("telefon", { ikincil: 1, tasma: 0 }), { ikincil: "satir", menuVar: false });
  assert.deepEqual(eylemYerlesimi("telefon", { ikincil: 0, tasma: 0 }), { ikincil: "satir", menuVar: false });
  // Tek taşma eylemi yine menüde: seyrek kullanılan eylem görünür düğme olmamalı.
  assert.deepEqual(eylemYerlesimi("telefon", { ikincil: 0, tasma: 1 }), { ikincil: "satir", menuVar: true });
});

test("sıralama: sayılar sayı olarak, metinler Türkçe kurallarıyla", () => {
  assert.deepEqual(sirala([10, 9, 100], (x) => x, "artan", "tr-TR"), [9, 10, 100]);
  assert.deepEqual(sirala(["ırmak", "İzmir", "ılık", "Ankara"], (x) => x, "artan", "tr-TR"), ["Ankara", "ılık", "ırmak", "İzmir"]);
  // Metin içindeki sayılar da doğal sırada (yıl, bölüm 2 < bölüm 10).
  assert.deepEqual(sirala(["Bölüm 10", "Bölüm 2"], (x) => x, "artan", "tr-TR"), ["Bölüm 2", "Bölüm 10"]);
});

test("sıralama: boş değer iki yönde de sonda; eşitler girdi sırasını korur", () => {
  const satirlar = [{ a: "2019" }, { a: null }, { a: "2001" }, { a: "" }, { a: "2019" }];
  const artan = sirala(satirlar, (s) => s.a, "artan", "tr-TR");
  assert.deepEqual(artan.map((s) => s.a), ["2001", "2019", "2019", null, ""]);
  const azalan = sirala(satirlar, (s) => s.a, "azalan", "tr-TR");
  assert.deepEqual(azalan.map((s) => s.a), ["2019", "2019", "2001", null, ""]);
  assert.equal(azalan[0], satirlar[0]);
  assert.equal(azalan[1], satirlar[4]);
});

test("sıralama: girdi dizisi değişmez", () => {
  const girdi = [3, 1, 2];
  sirala(girdi, (x) => x, "artan", "tr-TR");
  assert.deepEqual(girdi, [3, 1, 2]);
});

test("başlıktaki sıralama düğmesi: yeni sütun artan, aynı sütun yön değiştirir", () => {
  assert.deepEqual(sonrakiSiralama(null, "yil"), { anahtar: "yil", yon: "artan" });
  assert.deepEqual(sonrakiSiralama({ anahtar: "yil", yon: "artan" }, "yil"), { anahtar: "yil", yon: "azalan" });
  assert.deepEqual(sonrakiSiralama({ anahtar: "yil", yon: "azalan" }, "yil"), { anahtar: "yil", yon: "artan" });
  assert.deepEqual(sonrakiSiralama({ anahtar: "yil", yon: "azalan" }, "baslik"), { anahtar: "baslik", yon: "artan" });
});
