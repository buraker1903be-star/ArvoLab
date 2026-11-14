import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs";
import path from "node:path";

/*
  HESAP MENÜSÜ VE SADE KENAR ÇUBUĞU (Phase 5.1d-3, 14.11.2026). Bileşenler
  React'e bağlı; sözleşme kaynak metinden okunur (tests/unit kuralı).
  Rol bazlı görünürlüğün kendisi saf seçicilerde sınanıyor
  (gezinme-modeli.test.ts); davranış gerçek tarayıcıda:
  scripts/onizleme/personel-araclari-kabul.mjs.
*/
const oku = (yol: string) =>
  fs.readFileSync(path.join(process.cwd(), yol), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const menu = oku("app/dashboard/_components/kullanici-menusu.tsx");
const layout = oku("app/dashboard/layout.tsx");
const gezinme = oku("app/dashboard/_components/os-gezinme.tsx");
const kabuk = oku("app/styles/os-shell.css");

describe("hesap menüsü merkezi listeden", () => {
  test("layout, menüye gezinmeyle AYNI rolle süzülmüş listeden seçici sonuçlarını verir", () => {
    assert.match(layout, /hesapBaglantilari: hesapUygulamalari\(uygulamalar\)\.map\(menuBaglantisi\)/);
    assert.match(layout, /personelAraclari: personelAraclari\(uygulamalar\)\.map\(menuBaglantisi\)/);
    assert.match(layout, /<OsGezinme uygulamalar=\{uygulamalar\}/);
    // Menüye roller ve yollar gitmez, yalnızca bağlantı alanları.
    assert.match(layout, /const menuBaglantisi = \(\{ key, label, href, ikon \}: OsUygulama\) => \(\{ key, label, href, ikon \}\)/);
  });

  test("menü hesap bağlantılarını elle yazmaz; Destek kalır", () => {
    assert.match(menu, /hesapBaglantilari\.map\(/);
    for (const href of ["/dashboard/settings", "/dashboard/abonelik", "/dashboard/yardim"]) assert.ok(!menu.includes(`"${href}"`), href);
    assert.ok(menu.includes('href="/dashboard/expert-requests"'), "Destek bağlantısı");
  });

  test("Personel Araçları yalnızca liste doluysa çizilir; başlık iki dilli, nav'ın adı", () => {
    assert.match(menu, /\{personelAraclari\.length \? \(/);
    assert.match(menu, /aria-label=\{t\(\{ tr: "Personel Araçları", en: "Staff tools" \}\)\}/);
    assert.match(menu, /personelAraclari\.map\(/);
    // Menü iki yerleşimde çiziliyor: id ile bağlamak aynı id'yi iki kez üretirdi.
    assert.doesNotMatch(menu, /aria-labelledby/);
  });
});

describe("sade kenar çubuğu", () => {
  test("Diğer grubu ve bağımsız Ayarlar yok; ana liste anaUygulamalar'dan", () => {
    assert.doesNotMatch(gezinme, /os-gezinme-diger|os-gezinme-grup|digerAcik|DIGER_GRUBU_ANAHTARI/);
    assert.doesNotMatch(gezinme, /oge\(ayarlar\)|gezinmeGruplari/);
    assert.match(gezinme, /const ana = anaUygulamalar\(uygulamalar\);/);
  });

  test("Daha fazla ve kalıcı dar/açık tercihi yerinde", () => {
    assert.match(gezinme, /className="os-gezinme-daha-li"/);
    assert.match(gezinme, /const dahaUygulamalari = dahaFazlasi\(uygulamalar\);/);
    assert.match(gezinme, /useSyncExternalStore\(gezinmeAbone, gezinmeDarMi, \(\) => false\)/);
  });

  test("CSS: Diğer kuralları kalktı; açık masaüstünde boş alt liste gizli", () => {
    assert.doesNotMatch(kabuk, /os-gezinme-diger|os-gezinme-grup/);
    assert.match(kabuk, /\.os-gezinme-son \{\s*display: none;/);
  });
});
