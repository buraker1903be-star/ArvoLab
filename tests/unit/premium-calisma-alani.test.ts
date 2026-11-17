import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  PREMIUM ÇALIŞMA ALANI (17.11.2026, onaylı tasarım). Bileşenler sunucu/
  istemci bileşeni ve tarayıcıya bağlı; burada kaynak metni üzerinden
  kurum sahibinin kuralları sabitleniyor. Tarayıcıdaki ölçümler (araç
  çubuğu taşması, telefonda metnin ilk ekranda görünmesi) PR açıklamasında.
*/
const oku = (yol: string) => readFileSync(yol, "utf8");
const editor = oku("app/dashboard/editor/[id]/write/manuscript-editor.tsx");
const calisma = oku("app/styles/workspace.css");

describe("Yazım Stüdyosu: belge odakta, kontroller istenince", () => {
  test("inceleme paneli varsayılan kapalı (sunucu ve istemci aynı)", () => {
    assert.match(editor, /tercihOku\(INCELEME_TERCIHI, false\), \(\) => false\)/);
  });
  test("panel düğmesinin adı görünür: Kontroller", () => {
    assert.match(editor, /metin=\{t\(\{ tr: "Kontroller", en: "Checks" \}\)\}/);
  });
  test("kılavuz yoksa tek satırlık bilgi; iki yol da duruyor", () => {
    const blok = editor.slice(editor.indexOf('className="kilavuz-satiri"'), editor.indexOf('className="kilavuz-satiri"') + 1200);
    assert.match(blok, /role="status"/);
    assert.match(blok, /calismaAdresi\(projectId, \{ kilavuz: true \}\)/);
    assert.match(blok, /href=\{editHref\}/);
    assert.doesNotMatch(editor, /data-tone="muted" role="status">\s*<div>\s*<strong>\{t\(\{ tr: "Bu çalışmaya bağlı kılavuz yok"/);
  });
  test("Bul ve Odak modu kaldırılmadı: Belge menüsünde", () => {
    const menu = editor.slice(editor.indexOf('etiket={t({ tr: "Belge", en: "Document" })}'), editor.indexOf("</AracMenusu>", editor.indexOf('etiket={t({ tr: "Belge", en: "Document" })}')));
    assert.match(menu, /setFindOpen\(\(open\) => !open\)/);
    assert.match(menu, /setOdak\(\(o\) => !o\)/);
  });
  test("yazım ekranında birincil düğme yok; kontrol düğmesi ikincil", () => {
    assert.match(editor, /className="projects-filter-button"\s+onClick=\{handleCheck\}/);
  });
  test("telefonda sekmeler yalnızca yazım ekranında gizli; araç çubuğu dar ekranda sarar", () => {
    assert.match(calisma, /\.dashboard-page:has\(\.manuscript-layout\) > \.calisma-sekmeleri \{ display: none; \}/);
    assert.match(calisma, /@media \(min-width: 761px\) and \(max-width: 1439px\) \{\s*\.manuscript-araclar \{ flex-wrap: wrap;/);
  });
});

describe("Kaynaklar: tek liste, tek giriş, kaynakça ayrı sekmede", () => {
  const sayfa = oku("app/dashboard/literature/page.tsx");
  test("tek birincil giriş: Kaynak ekle; üç yol menüde", () => {
    const menu = sayfa.slice(sayfa.indexOf('<details className="kaynak-ekle"'), sayfa.indexOf("</details>", sayfa.indexOf('<details className="kaynak-ekle"')));
    assert.match(menu, /tr: "Kaynak ekle"/);
    assert.match(menu, /tr: "DOI ile ekle"/);
    assert.match(menu, /<IceAktarma /);
    assert.match(menu, /<LiteraturPenceresi/);
  });
  test("kaynaklar sekmesinde tek birincil düğme (Kaynak ekle)", () => {
    const liste = sayfa.slice(sayfa.indexOf(') : (\n          <section className="kaynak-tek"'), sayfa.indexOf("</main>"));
    assert.equal(liste.match(/projects-primary-button/g)?.length, 1);
  });
  test("kaynakça ayrı sekmede ve denetim penceresi yerinde", () => {
    assert.match(sayfa, /const kaynakcaSekmesi = sekme === "kaynakca";/);
    assert.match(sayfa, /<KaynakcaPenceresi/);
  });
  test("DOI kutusu kaybolmadı: menüden ya da adresteki DOI ile açılıyor", () => {
    assert.match(sayfa, /const ekleMenusuAcik = ekle === "1" \|\| typeof gelenDoi === "string";/);
    assert.match(sayfa, /\{ekleMenusuAcik \? \(\s*<DoiEkleKutusu/);
  });
  test("menü dışarı tıklayınca kapanır (AcilirKapatici)", () => {
    assert.match(oku("app/dashboard/_components/acilir-kapatici.tsx"), /details\.kaynak-ekle\[open\]/);
  });
});

describe("düz yüzey: birincil düğmede gradyan ve gölge yok", () => {
  const css = oku("app/styles/components.css");
  test(".projects-primary-button düz lacivert", () => {
    const blok = css.slice(css.indexOf(".projects-primary-button {"), css.indexOf("}", css.indexOf(".projects-primary-button {")));
    assert.doesNotMatch(blok, /gradient/);
    assert.match(blok, /box-shadow: none;/);
  });
});
