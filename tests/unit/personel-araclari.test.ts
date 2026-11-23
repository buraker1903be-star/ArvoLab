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
    assert.match(layout, /<OsGezinme uygulamalar=\{uygulamalar\}/);
    // Menüye roller ve yollar gitmez, yalnızca bağlantı alanları.
    assert.match(layout, /const menuBaglantisi = \(\{ key, label, href, ikon \}: OsUygulama\) => \(\{ key, label, href, ikon \}\)/);
  });

  test("menü hesap bağlantılarını elle yazmaz; Destek kalır", () => {
    assert.match(menu, /hesapBaglantilari\.map\(/);
    for (const href of ["/dashboard/settings", "/dashboard/abonelik", "/dashboard/yardim"]) assert.ok(!menu.includes(`"${href}"`), href);
    assert.ok(menu.includes('href="/dashboard/expert-requests"'), "Destek bağlantısı");
  });

  /*
    23.11.2026: "Teknik araçlar" (Asistan Kayıtları) ve menüdeki dil
    seçici kalktı. Hesap menüsü kişinin KENDİ hesabı için: kalan hak,
    Ayarlar, Abonelik ve Kredi, Destek, komut paleti, çıkış. Asistan
    Kayıtları başlatıcıda ve Ctrl+K'da duruyor.
  */
  test("menüde teknik araçlar bölümü ve ikinci dil seçici yok", () => {
    assert.doesNotMatch(menu, /personelAraclari/);
    assert.doesNotMatch(menu, /Teknik araçlar/);
    assert.doesNotMatch(menu, /<DilSecici/);
    assert.doesNotMatch(menu, /kurumSec|KurumSeridi|"Yönetim"/);
    assert.doesNotMatch(menu, /gorunumSec|GORUNUMLER/);
    // Menü iki yerleşimde çiziliyor: id ile bağlamak aynı id'yi iki kez üretirdi.
    assert.doesNotMatch(menu, /aria-labelledby/);
  });
});

describe("sade kenar çubuğu", () => {
  /*
    17.11.2026'da Ayarlar kenar çubuğunun altına gelmişti; 23.11.2026'da
    oradan KALKTI: hesap ayarları hesap menüsünde (ve başlatıcıda).
    Eski "Diğer" grubu (her şeyin karıştığı tek kutu) hâlâ dönmüyor.
  */
  test("eski Diğer grubu yok; ana liste anaUygulamalar'dan; Ayarlar gezinmede değil", () => {
    assert.doesNotMatch(gezinme, /os-gezinme-diger|digerAcik|DIGER_GRUBU_ANAHTARI|gezinmeGruplari/);
    assert.match(gezinme, /const ana = anaUygulamalar\(uygulamalar\);/);
    assert.doesNotMatch(gezinme, /oge\(ayarlar\)/);
  });

  test("Daha fazla ve kalıcı dar/açık tercihi yerinde", () => {
    assert.match(gezinme, /className="os-gezinme-daha-li"/);
    assert.match(gezinme, /const dahaUygulamalari = dahaFazlasi\(uygulamalar\);/);
    assert.match(gezinme, /useSyncExternalStore\(gezinmeAbone, gezinmeDarMi, \(\) => false\)/);
  });

  test("CSS: Diğer kuralları kalktı; açık masaüstünde boş alt liste gizli", () => {
    assert.doesNotMatch(kabuk, /os-gezinme-diger/);
    assert.match(kabuk, /\.os-gezinme-son \{\s*display: none;/);
  });
});
