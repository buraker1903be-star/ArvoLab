import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as gezinmeModulu from "@/lib/os5/gezinme";
import { grupAcikMi } from "@/lib/os5/gezinme";
import { anaUygulamalar, aracUygulamalari, gorunenUygulamalar, hesapUygulamalari, labUygulamalari, personelAraclari, yardimUygulamalari } from "@/lib/os/uygulamalar";

/*
  Signature OS 5 / Phase 3: uygulama kabuğu ve gezinme. Kimin neyi
  göreceği DEĞİŞMEDİ (rol süzgeci layout'ta, lib/os/uygulamalar.ts);
  burada alt menü kararları ve kabuğun bu kurala dokunmadığı sınanıyor.
  Görsel ve klavye kabulü tarayıcıda: scripts/onizleme/kabul.mjs
  ("os5 kabuk: …" senaryoları).
*/

const oku = (yol: string) => readFileSync(yol, "utf8");
const yorumsuz = (metin: string) => metin.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("alt menü açık mı", () => {
  test("etkin sayfa grubun içindeyse açık", () => {
    assert.equal(grupAcikMi({ secim: null, etkinIcinde: true, varsayilan: false }), true);
  });
  test("bu oturumdaki seçim her şeyin önünde", () => {
    assert.equal(grupAcikMi({ secim: false, etkinIcinde: true, varsayilan: true }), false);
    assert.equal(grupAcikMi({ secim: true, etkinIcinde: false, varsayilan: false }), true);
  });
  test("seçim yoksa ve etkin sayfa dışarıdaysa varsayılan", () => {
    assert.equal(grupAcikMi({ secim: null, etkinIcinde: false, varsayilan: false }), false);
    assert.equal(grupAcikMi({ secim: null, etkinIcinde: false, varsayilan: true }), true);
  });
  test("eski 'Diğer' tercih yardımcıları kalktı (5.1d-4); dar/açık tercihi yerinde", () => {
    const disa = Object.keys(gezinmeModulu);
    for (const ad of ["DIGER_GRUBU_ANAHTARI", "kayitliTercih", "tercihDegeri"]) assert.ok(!disa.includes(ad), ad);
    for (const ad of ["GEZINME_DAR_ANAHTARI", "GEZINME_BETIGI", "darMi", "darDegeri", "grupAcikMi"]) assert.ok(disa.includes(ad), ad);
  });
});

describe("rol bazlı görünürlük değişmedi", () => {
  const gezinme = oku("app/dashboard/_components/os-gezinme.tsx");
  const layout = oku("app/dashboard/layout.tsx");
  test("gezinme listeyi kendisi kurmuyor: layout'ta rolle süzülmüş listeyi alıyor", () => {
    assert.doesNotMatch(yorumsuz(gezinme), /labUygulamalari\(|gorunenUygulamalar\(/);
    // Önizleme 20.11.2026'da kalktı (lib/kisisel-calismalar.ts): liste her zaman gerçek rolle süzülür.
    assert.match(layout, /const uygulamalar = gorunenUygulamalar\(labUygulamalari\(t\), profile\?\.role/);
    assert.match(layout, /<OsGezinme uygulamalar=\{uygulamalar\}/);
  });
  test("öğrenci personel aracı görmez; kurucu görür (Phase 5.1d-3: hesap menüsünde)", () => {
    const ogrenci = personelAraclari(gorunenUygulamalar(labUygulamalari(), "client")).map((u) => u.key);
    assert.deepEqual(ogrenci, []);
    const kurucu = personelAraclari(gorunenUygulamalar(labUygulamalari(), "founder")).map((u) => u.key);
    assert.ok(kurucu.includes("asistan") && !kurucu.includes("ekip"));
  });
  test("hiçbir uygulama düşmüyor: her biri ana gezinmede, bir grupta ya da hesap menüsünde, tam bir yerde", () => {
    const hepsi = gorunenUygulamalar(labUygulamalari(), "founder");
    const yerler = [...anaUygulamalar(hepsi), ...aracUygulamalari(hepsi), ...yardimUygulamalari(hepsi), ...hesapUygulamalari(hepsi), ...personelAraclari(hepsi)].map((u) => u.key);
    assert.deepEqual([...yerler].sort(), hepsi.map((u) => u.key).sort());
    assert.equal(new Set(yerler).size, yerler.length);
  });
});

describe("hesap menüsü iki yerleşimde aynı", () => {
  const layout = oku("app/dashboard/layout.tsx");
  test("üst çubuk ve kenar çubuğu aynı değer nesnesini alıyor", () => {
    assert.match(layout, /<KullaniciMenusu \{\.\.\.hesapMenusu\} yerlesim="ust" \/>/);
    assert.match(layout, /hesap=\{<KullaniciMenusu \{\.\.\.hesapMenusu\} yerlesim="kenar" \/>\}/);
    assert.equal(layout.match(/<KullaniciMenusu /g)?.length, 2);
  });
  test("çıkış, görünüm ve kurum seçimi bileşende yerleşimden bağımsız", () => {
    const k = oku("app/dashboard/_components/kullanici-menusu.tsx");
    assert.match(k, /<form action=\{cikis\}/);
    // Yerleşim yalnızca summary'yi değiştiriyor: menü gövdesi tek.
    assert.equal(k.match(/className="os-kullanici-menu"/g)?.length, 1);
  });
});

/*
  İKİ DÜZEYLİ GEZİNME (19.11.2026, bağlamlı çalışma alanı; onaylı tasarım).
  17.11.2026–19.11.2026 arasında kural "editör açılınca gezinme değişmez"
  idi ve bu blok gezinmenin çalışma bağlamını HİÇ okumadığını sabitliyordu.
  Kurum sahibi 2. tur tasarımı onaylayınca kural değişti: çalışmanın
  içinde aynı yuva çalışma gezinmesini gösterir. Karar ADRESTEN verilir
  (adrestekiCalisma); yayınlanan bağlama bakmak ilk boyamada menüyü
  zıplatırdı.

  22.11.2026: çalışma düzeyi YALNIZCA çalışmanın kendi sayfalarında
  (/dashboard/editor/<id>/…). ?calisma= ile süzülmüş modül sayfaları
  (Kaynaklar, Kaynakça, Analiz Merkezi, Belge Kontrol) genel düzeyde
  kalıyor: aynı sayfa, hangi yoldan gelindiğine göre iki ayrı gezinme
  gösteriyordu.
*/
describe("iki düzeyli gezinme; gruplar erişilebilir", () => {
  const gezinme = yorumsuz(oku("app/dashboard/_components/os-gezinme.tsx"));
  test("çalışma düzeyi adresten; tek <nav>; sol araç yuvası", () => {
    assert.match(gezinme, /adrestekiCalisma\(yol\)/);
    assert.match(gezinme, /calismaBaglantilari\(calisma, t\)/);
    assert.match(gezinme, /id="sol-alan-yuva"/);
    assert.equal(gezinme.match(/<nav /g)?.length, 1);
  });
  test("grup düğmeleri aria-expanded ve aria-controls taşıyor; adı görünür", () => {
    assert.match(gezinme, /aria-expanded=\{acik\}\s+aria-controls=\{kimlik\}/);
    assert.match(gezinme, /grup\("araclar", t\(\{ tr: "Araçlar", en: "Tools" \}\)/);
    assert.match(gezinme, /grup\("yardim", t\(\{ tr: "Yardım", en: "Help" \}\)/);
    assert.doesNotMatch(gezinme, /os-gezinme-diger|digerAcik/);
  });
  test("grupların seçimi grup başına: birini açmak ötekini kapatmaz", () => {
    // Eskiden tek {grup, acik} tutuluyordu; Yardım'ı açmak Araçlar'ı kapatıyordu.
    assert.match(gezinme, /gruplar: Record<string, boolean>/);
    assert.match(gezinme, /\.\.\.\(onceki\?\.yol === yol \? onceki\.gruplar : \{\}\)/);
  });
    test("tek etkin işaret: etkin uygulama adresten", () => {
    assert.match(gezinme, /const acik = etkin\?\.key === u\.key;/);
  });
});

describe("kabuk stilleri", () => {
  const css = yorumsuz(oku("app/styles/os-shell.css"));
  test("kenar çubuğu ve ray os5 token'larından; ham renk yok", () => {
    assert.match(css, /width: var\(--os5-kenar-genis\)/);
    assert.match(css, /width: var\(--os5-kenar-ray\)/);
    assert.match(css, /background: var\(--os5-kenar-zemin\)/);
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
  });
  test("tablette ad görünmez ama erişilebilirlik ağacında (display:none değil)", () => {
    const tablet = css.slice(css.indexOf("@media (min-width: 761px) and (max-width: 1199px)"), css.indexOf("@media (max-width: 760px)"));
    assert.match(tablet, /\.os-gezinme \.os-gezinme-ad \{[^}]*opacity: 0/);
    assert.doesNotMatch(tablet, /\.os-gezinme-ad \{[^}]*display: none/);
  });
  test("kapalı grup açık kenar çubuğunda gizli; rayda (tablet, dar) gruplar yok, Daha fazla var", () => {
    assert.match(css, /\.os-gezinme-takim-liste\[data-kapali\] \{ display: none; \}/);
    const tablet = css.slice(css.indexOf("@media (min-width: 761px) and (max-width: 1199px)"), css.indexOf("@media (max-width: 760px)"));
    // Tablette grupları açan bir kural yok; temel kural (display:none) geçerli kalır.
    assert.doesNotMatch(tablet, /\.os-gezinme-takim[^{]*\{[^}]*display: flex/);
    assert.doesNotMatch(tablet, /\.os-gezinme-son \{[^}]*display: none/);
  });
  test("telefonda adı gizleyen kural alt çubuğa bağlı; Daha fazla penceresi adsız kalmaz", () => {
    const telefon = css.slice(css.indexOf("@media (max-width: 760px)"));
    // Eskiden çıplak `.os-gezinme-ad { display: none; }` pencereye de uyuyordu (erişilebilir adı yoktu).
    assert.doesNotMatch(telefon, /^\s*\.os-gezinme-ad \{ display: none; \}/m);
    assert.match(telefon, /\.os-gezinme \.os-gezinme-ad \{ display: none; \}/);
  });
    test("azaltılmış hareket karşılığı var", () => {
    assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.os-gezinme, \.os-gezinme-oge/);
  });
  test("üst çubukta kodla çizilmiş logo yok; resmî logo bileşeni kullanılıyor", () => {
    const baslik = oku("app/dashboard/_components/header-title.tsx");
    assert.match(baslik, /<ArvoLabLogosu alt="" \/>/);
    assert.doesNotMatch(baslik, /<svg/);
  });
});
