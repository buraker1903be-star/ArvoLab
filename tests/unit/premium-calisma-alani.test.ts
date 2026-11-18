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
  // İkinci tur: üç kontrol işlemi başlıkta tek "Kontroller" menüsünde; teslim durumu düğmede görünür.
  test("Kontroller menüsü: teslim kontrolü, kılavuz/kaynakça kontrolü, inceleme paneli", () => {
    const menu = editor.slice(editor.indexOf("tr: `Kontroller · ${checklist.done}/${checklist.total}`"), editor.indexOf("</AracMenusu>", editor.indexOf("tr: `Kontroller · ${checklist.done}/${checklist.total}`")));
    assert.match(menu, /setChecklistOpen\(true\)/);
    assert.match(menu, /onClick=\{handleCheck\}/);
    assert.match(menu, /tercihYaz\(INCELEME_TERCIHI, !incelemeAcik\)/);
  });
  test("araç çubuğunda ikinci bir panel düğmesi yok; kayıt durumu başlıkta", () => {
    assert.equal(editor.match(/tercihYaz\(INCELEME_TERCIHI, !incelemeAcik\)/g)?.length, 1);
    assert.match(editor, /className="save-status yazma-kayit"/);
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
  test("yazım ekranının başlığında birincil düğme yok", () => {
    const portal = editor.slice(editor.indexOf("createPortal("), editor.indexOf("eylemHedefi,", editor.indexOf("createPortal(")));
    assert.doesNotMatch(portal, /projects-primary-button/);
  });
  test("telefonda kılavuz satırı kısa yazımla; bağlantının erişilebilir adı tam", () => {
    assert.match(editor, /aria-label=\{t\(\{ tr: "Kılavuzumu yükle", en: "Upload my guideline" \}\)\}/);
    assert.match(calisma, /\.kilavuz-satiri \.kilavuz-kisa \{ display: inline; \}/);
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

describe("ikinci tur: yeni kullanıcı ve çalışma özeti", () => {
  const sayfa = oku("app/dashboard/page.tsx");
  test("yeni kullanıcı: tek açıklama, tek birincil, rehber isteğe bağlı", () => {
    const bas = sayfa.slice(sayfa.indexOf("{yeniKullanici ? ("), sayfa.indexOf(") : ogrenciGorunumu && resume ? ("));
    assert.match(bas, /<details className="pw-rehber">/);
    assert.match(bas, /tr: "İlk çalışmayı oluştur"/);
    assert.match(sayfa, /\{yeniKullanici \? null : <p>/);
  });
  test("çalışma özetinde tek birincil: Yazmaya devam et", () => {
    const kart = oku("app/dashboard/editor/calisma-durum-karti.tsx");
    const ana = kart.slice(kart.indexOf("return (\n    <article"));
    assert.equal(ana.match(/projects-primary-button/g)?.length, 1);
  });
});

describe("telefonda Kaynaklar üst alanı (18.11.2026)", () => {
  const gb = oku("app/styles/genel-bakis.css");
  const telefon = gb.slice(gb.indexOf("TELEFONDA KAYNAKLAR ÜST ALANI"));
  test("sayfa sınıfı başka bir yerde kullanılmıyor", () => {
    // İlk denemede "kaynak-sayfa" adı PDF panelindeki etiketle çakıştı ve
    // `.kaynak-sayfa input { max-width: 10em }` arama kutusunu 120 px'e kırptı.
    const sayfa = oku("app/dashboard/literature/page.tsx");
    assert.match(sayfa, /className="dashboard-page gb gb-tek-ekran kaynaklar-sayfasi"/);
    for (const dosya of ["app/styles/workspace.css", "app/styles/components.css", "app/styles/os-shell.css"]) {
      assert.doesNotMatch(oku(dosya), /\.kaynaklar-sayfasi\b/, dosya);
    }
  });
  test("özet tam satır, iki düğme yan yana, süzgeçler tek satır ve kayar", () => {
    assert.match(telefon, /@media \(max-width: 760px\)/);
    assert.match(telefon, /\.kaynaklar-sayfasi \.kaynak-tek-bas > div:first-child \{ flex: 1 1 100%; \}/);
    assert.match(telefon, /\.kaynaklar-sayfasi \.kaynak-tek-bas \.pencere-dugmeler \{ flex-wrap: nowrap; \}/);
    assert.match(telefon, /flex-wrap: nowrap; margin-inline: -16px;[^}]*overflow-x: auto;/);
    assert.match(telefon, /\.kaynaklar-sayfasi \.kaynak-suzgec \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  });
});

describe("erişilebilirlik bulguları (axe, 18.11.2026)", () => {
  test("araç menüsü açılır paneldir: role=menu yok, panel adlı bir grup", () => {
    // Eskiden role="menu" vardı ama öğelerin menuitem rolü ve ok tuşu gezinmesi yoktu.
    const menu = oku("app/dashboard/editor/[id]/write/arac-menusu.tsx");
    assert.doesNotMatch(menu, /\n\s+role="menu"/);
    assert.doesNotMatch(menu, /\n\s+aria-haspopup="menu"/);
    assert.match(menu, /role="group"\s+aria-label=\{etiket\}/);
    assert.match(menu, /aria-expanded=\{acik\}\s+aria-controls=\{kimlik\}/);
  });
  test("Çalışmalarım özet şeridi telefonda değeri kesmez, sarar", () => {
    const gb = oku("app/styles/genel-bakis.css");
    assert.match(gb, /@media \(max-width: 760px\) \{\s*\.calismalar-ozet dd \{ overflow: visible; white-space: normal; overflow-wrap: anywhere; \}/);
  });
  test("ölçü listesinde dl yalnızca dt/dd taşır (span ve form dd içinde)", () => {
    for (const dosya of ["app/dashboard/editor/calisma-durum-karti.tsx", "app/dashboard/editor/personel-calisma-karti.tsx", "app/dashboard/team/page.tsx"]) {
      const s = oku(dosya);
      const dl = s.slice(s.indexOf('<dl className="tez-olcumler calisma-olcumler">'), s.indexOf("</dl>", s.indexOf('<dl className="tez-olcumler')));
      // dd ve small içindeki span'lar dışında doğrudan span kalmamalı: hepsi tez-olcu-not oldu.
      assert.doesNotMatch(dl, /\n\s*<span/, dosya);
      assert.doesNotMatch(dl, /\n\s*<TeslimTarihiFormu/, dosya);
    }
    assert.match(oku("app/styles/genel-bakis.css"), /\.tez-olcumler \.tez-olcu > dd\.tez-olcu-not \{/);
  });
});
