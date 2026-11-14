import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DIGER_GRUBU_ANAHTARI, grupAcikMi, kayitliTercih, tercihDegeri } from "@/lib/os5/gezinme";
import { anaUygulamalar, gorunenUygulamalar, hesapUygulamalari, labUygulamalari, personelAraclari } from "@/lib/os/uygulamalar";

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
  test("etkin sayfa grubun içindeyse açık (kayıtlı tercih kapalı olsa bile)", () => {
    assert.equal(grupAcikMi({ secim: null, etkinIcinde: true, kayitli: false, varsayilan: false }), true);
  });
  test("bu oturumdaki seçim her şeyin önünde", () => {
    assert.equal(grupAcikMi({ secim: false, etkinIcinde: true, kayitli: true, varsayilan: true }), false);
    assert.equal(grupAcikMi({ secim: true, etkinIcinde: false, kayitli: false, varsayilan: false }), true);
  });
  test("seçim yoksa kayıtlı tercih, o da yoksa varsayılan", () => {
    assert.equal(grupAcikMi({ secim: null, etkinIcinde: false, kayitli: true, varsayilan: false }), true);
    assert.equal(grupAcikMi({ secim: null, etkinIcinde: false, kayitli: null, varsayilan: false }), false);
    assert.equal(grupAcikMi({ secim: null, etkinIcinde: false, kayitli: null, varsayilan: true }), true);
  });
  test("kayıtlı değer yalnızca '1' ya da '0'; başka her şey tercih yok", () => {
    assert.equal(kayitliTercih("1"), true);
    assert.equal(kayitliTercih("0"), false);
    for (const d of [null, undefined, "", "true", "acik"]) assert.equal(kayitliTercih(d), null);
    assert.equal(tercihDegeri(true), "1");
    assert.equal(tercihDegeri(false), "0");
    assert.match(DIGER_GRUBU_ANAHTARI, /^arvolab\./);
  });
});

describe("rol bazlı görünürlük değişmedi", () => {
  const gezinme = oku("app/dashboard/_components/os-gezinme.tsx");
  const layout = oku("app/dashboard/layout.tsx");
  test("gezinme listeyi kendisi kurmuyor: layout'ta rolle süzülmüş listeyi alıyor", () => {
    assert.doesNotMatch(yorumsuz(gezinme), /labUygulamalari\(|gorunenUygulamalar\(/);
    assert.match(layout, /const uygulamalar = gorunenUygulamalar\(labUygulamalari\(t\), gorunum\.onizleme \? undefined : profile\?\.role/);
    assert.match(layout, /<OsGezinme uygulamalar=\{uygulamalar\}/);
  });
  test("öğrenci personel aracı görmez; kurucu görür (Phase 5.1d-3: hesap menüsünde)", () => {
    const ogrenci = personelAraclari(gorunenUygulamalar(labUygulamalari(), "client")).map((u) => u.key);
    assert.deepEqual(ogrenci, []);
    const kurucu = personelAraclari(gorunenUygulamalar(labUygulamalari(), "founder")).map((u) => u.key);
    assert.ok(kurucu.includes("ekip") && kurucu.includes("asistan"));
  });
  test("hiçbir uygulama düşmüyor: her biri ana gezinmede ya da hesap menüsünde, tam bir yerde", () => {
    const hepsi = gorunenUygulamalar(labUygulamalari(), "founder");
    const yerler = [...anaUygulamalar(hepsi), ...hesapUygulamalari(hepsi), ...personelAraclari(hepsi)].map((u) => u.key);
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

describe("çalışma bağlamı aynı gezinmede", () => {
  const gezinme = oku("app/dashboard/_components/os-gezinme.tsx");
  test("bağlam 'Çalışmalarım'ın alt menüsü; ayrı bir gezinme bileşeni yok", () => {
    assert.match(gezinme, /u\.key === "tez" && baglamGorunur \? calismaOgesi\(u\) : oge\(u\)/);
    assert.equal(gezinme.match(/<nav /g)?.length, 1);
  });
  test("alt menü düğmeleri aria-expanded ve aria-controls taşıyor", () => {
    assert.match(gezinme, /aria-expanded=\{calismaAcik\}\s+aria-controls="os-gezinme-calisma"/);
    // "Diğer" grubu kalktı (Phase 5.1d-3): kenar çubuğunda tek alt menü çalışmanınki.
    assert.doesNotMatch(gezinme, /os-gezinme-diger|digerAcik/);
  });
  test("araç sayfasında tek etkin işaret: ana listedeki kopya işaretlenmez", () => {
    assert.match(gezinme, /const anaEtkinKey = baglamEtkin \? null : etkin\?\.key;/);
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
  test("kapalı alt menü gerçekten gizli ([hidden] display:flex'e yenilmiyor)", () => {
    assert.match(css, /\.os-gezinme-liste\[hidden\], \.os-gezinme-baglam\[hidden\] \{ display: none; \}/);
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
