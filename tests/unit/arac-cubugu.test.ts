import assert from "node:assert/strict";
import test from "node:test";
import { ARAC_GRUPLARI, gizlenecekGruplar } from "@/lib/arac-cubugu";

/*
  Yazım araç çubuğunun daralması (UX S3+S4). Genişlikler 40 piksellik
  düğmelerle yaklaşık değerler; karar yalnızca öncelik ve toplamdan.
*/
const G: Record<string, number> = { geriAl: 48, yinele: 48, yazi: 54, bicim: 136, ust: 54, stil: 142, liste: 136, paragraf: 54, ekle: 54, atif: 84, odak: 54 };
const gruplar = ARAC_GRUPLARI.map((g) => ({ ...g, genislik: G[g.anahtar] }));
const SABIT = 54;
const toplam = SABIT + gruplar.reduce((t, g) => t + g.genislik, 0);

test("sığıyorsa hiçbir grup çıkmaz", () => {
  assert.deepEqual(gizlenecekGruplar(gruplar, toplam, SABIT), []);
  assert.deepEqual(gizlenecekGruplar(gruplar, 5000, SABIT), []);
});

test("bir piksel eksikse en düşük öncelikli çıkar: yazı", () => {
  assert.deepEqual(gizlenecekGruplar(gruplar, toplam - 1, SABIT), ["yazi"]);
});

test("eşit öncelikte SAĞDAKİ önce çıkar (odak, üst simgeden önce)", () => {
  const sonuc = gizlenecekGruplar(gruplar, toplam - G.yazi - 1, SABIT);
  assert.deepEqual(sonuc, ["yazi", "odak"]);
});

test("daraldıkça sıra: yazı, odak, üst simge, yinele, paragraf, ekle, liste, stil, biçim, geri al; atıf en son", () => {
  const sira: string[] = [];
  for (let w = toplam; w >= 0; w -= 2) {
    for (const g of gizlenecekGruplar(gruplar, w, SABIT)) if (!sira.includes(g)) sira.push(g);
  }
  assert.deepEqual(sira, ["yazi", "odak", "ust", "yinele", "paragraf", "ekle", "liste", "stil", "bicim", "geriAl", "atif"]);
});

test("dar çubuk (374 px, örnek genişliklerle): geri al, B/İ/A ve atıf kalır; yinele çıkar", () => {
  const sonuc = gizlenecekGruplar(gruplar, 374, SABIT);
  for (const k of ["geriAl", "bicim", "atif"]) assert.ok(!sonuc.includes(k as never), k);
  assert.ok(SABIT + G.geriAl + G.bicim + G.atif <= 374);
});

test("dönen liste çubuk sırasında ve yalnız gerekli kadar", () => {
  const sonuc = gizlenecekGruplar(gruplar, 600, SABIT);
  const sira = ARAC_GRUPLARI.map((g) => g.anahtar).filter((k) => sonuc.includes(k));
  assert.deepEqual(sonuc, sira);
  const kalan = SABIT + gruplar.filter((g) => !sonuc.includes(g.anahtar)).reduce((t, g) => t + g.genislik, 0);
  assert.ok(kalan <= 600);
  // Bir grup eksik çıkarılsaydı sığmazdı (gereğinden fazla gizlemiyor).
  const sonGizlenen = [...gruplar].filter((g) => sonuc.includes(g.anahtar)).sort((a, b) => b.oncelik - a.oncelik)[0];
  assert.ok(kalan + sonGizlenen.genislik > 600);
});

test("ölçülmemiş grup listede yoksa karar yalnızca bilinenlerle verilir", () => {
  const az = gruplar.filter((g) => g.anahtar !== "ekle");
  assert.ok(!gizlenecekGruplar(az, 300, SABIT).includes("ekle"));
});

test("geri al biçimden sonra, atıftan önce çıkar; yinele ondan çok önce", () => {
  const o = (k: string) => ARAC_GRUPLARI.find((g) => g.anahtar === k)!.oncelik;
  assert.ok(o("geriAl") > o("bicim") && o("geriAl") < o("atif"));
  assert.ok(o("yinele") < o("liste"));
});
