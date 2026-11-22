import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  KAYNAKLAR — ARAŞTIRMA ALANI (22.11.2026, onaylı mockup).

  Sayfa sunucu bileşeni ve Supabase'e bağlı; burada kaynak metni üzerinden
  kurum sahibinin kuralları sabitleniyor. Tarayıcı kabulü (liste/panel
  yerleşimi, PDF'in gerçekten çizilmesi, hızlı geçiş, ölçüler, temalar)
  PR açıklamasındaki ölçümlerde.
*/
const oku = (yol: string) => readFileSync(yol, "utf8");
const yorumsuz = (m: string) =>
  m.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const sayfa = oku("app/dashboard/literature/page.tsx");
const alan = oku("app/dashboard/literature/kaynak-alani.tsx");
const panel = oku("app/dashboard/literature/kaynak-paneli.tsx");
const notlar = oku("app/dashboard/literature/kaynak-notlari.tsx");

describe("sayfa üst alanı", () => {
  test("üst başlık, başlık, açıklama ve tek birincil eylem", () => {
    assert.match(sayfa, /tr: "Araştırma alanınız", en: "Your research space"/);
    assert.match(sayfa, /tr: "Kaynaklar", en: "Sources"/);
    assert.match(sayfa, /tr: "Okuyun, inceleyin, çalışmanızla ilişkilendirin\."/);
    /*
      Kütüphanem görünümünün TEK birincil düğmesi "Kaynak ekle". Kaynakça
      SEKMESİNDEKİ "Kaynakçamı denetle" o sekmenin kendi ana eylemi ve
      aynı anda ekranda olmuyor; bu yüzden sayım kütüphane bölümünde.
    */
    const kutuphane = yorumsuz(sayfa).slice(yorumsuz(sayfa).indexOf("const kaynakEkle"));
    const kaynakcaBas = kutuphane.indexOf("kaynakcaSekmesi ? (");
    const kutuphaneGorunumu = kutuphane.slice(0, kaynakcaBas) + kutuphane.slice(kutuphane.indexOf("kaynak-arastirma"));
    assert.equal(kutuphaneGorunumu.match(/projects-primary-button/g)?.length, 1);
    assert.match(sayfa, /<summary className="projects-primary-button">[\s\S]*?tr: "Kaynak ekle"/);
  });

  test("aktif çalışma seçimi tek çalışmada da görünür", () => {
    assert.match(sayfa, /<CalismaSecici[\s\S]*?hepGoster \/>/);
    const secici = oku("app/dashboard/_components/calisma-secici.tsx");
    /* Öteki sayfaların davranışı değişmedi: hepGoster verilmezse eski kural. */
    assert.match(secici, /if \(calismalar\.length < 2 && !hepGoster\) return null;/);
  });

  test("kaynak ekleme yollarının üçü de duruyor; sekmeler ve ikincil eylemler korunuyor", () => {
    for (const yol of ["DOI ile ekle", "Dosyadan içe aktar", "Dizinlerde ara"]) assert.ok(sayfa.includes(yol), yol);
    assert.match(sayfa, /tr: "Kütüphanem", en: "My library"/);
    assert.match(sayfa, /tr: "Kaynakça", en: "Reference list"/);
    /* Tarama asistanı ve dışa aktarma İKİNCİL (link-button), birincil değil. */
    assert.match(sayfa, /triggerLabel=\{t\(\{ tr: "Tarama asistanı"[\s\S]{0,200}?triggerClassName="link-button"/);
    assert.match(sayfa, /triggerLabel=\{t\(\{ tr: "Dışa aktar"[\s\S]{0,200}?triggerClassName="link-button"/);
  });

  test("çalışmaya bağlı olmayan kaynaklara açılacak bir yol var", () => {
    assert.match(sayfa, /const kapsamBagsiz = kapsam === "bagsiz";/);
    assert.match(sayfa, /kapsamAdresi\(!kapsamBagsiz\)/);
    assert.match(alan, /tr: `Çalışmaya bağlı olmayanlar · \$\{bagsizSayisi\}`/);
  });

  test("veri okunamadığında BOŞ KÜTÜPHANE mesajı gösterilmiyor", () => {
    /* Hata zaten üstteki uyarıda; liste "kaynak yok" diye çizilmez. */
    assert.match(sayfa, /\{kaynakOkunamadi \? \([\s\S]{0,600}?null\s*\) : kaynaklar\.length \? \(/);
  });
});

describe("liste", () => {
  test("satır: başlık, yazar/yıl, dergi, PDF durumu ve okuma durumu", () => {
    assert.match(alan, /className="kaynak-satir-dergi"/);
    assert.match(alan, /kaynakDurumlari\(\{ kunye: null, pdf: eslesme \}\)\[1\]/);
    assert.match(alan, /className="status-pill" data-tone=\{ETIKET\[durum\]\.ton\}/);
  });

  test("okuma durumlarının anlamı değişmedi", () => {
    assert.match(alan, /to_review: \{ ad: \{ tr: "Okunacak", en: "To read" \}/);
    assert.match(alan, /read: \{ ad: \{ tr: "Okundu", en: "Read" \}/);
    assert.match(alan, /used: \{ ad: \{ tr: "Metinde", en: "Cited" \}/);
    assert.match(alan, /to_review: \{ durum: "read"/);
    assert.match(alan, /read: \{ durum: "used"/);
  });

  test("uzun başlık iki satır ve tam başlığa erişim var", () => {
    assert.match(alan, /<b title=\{baslik\}>\{baslik\}<\/b>/);
    const css = oku("app/styles/kaynak-alani.css");
    assert.match(css, /\.kaynak-satir-govde > b \{[^}]*-webkit-line-clamp: 2;/);
  });

  test("diğer işlemler satırın ⋯ menüsünde; eksik künye uyarısı satır içi", () => {
    assert.match(alan, /className="kart-menu kaynak-satir-menu"/);
    assert.match(alan, /className="kaynak-satir-uyari"/);
    /* Düzeltme akışı aynı panelde (künye sekmesi), ayrı bir ekran değil. */
    assert.match(alan, /sec\(k,[\s\S]{0,120}?"kunye"\)/);
  });
});

describe("kaynak paneli", () => {
  test("PDF: editörün GERÇEK görüntüleyicisi; sahte önizleme ya da eklenti yok", () => {
    assert.match(panel, /dynamic\(\(\) => import\("\.\.\/editor\/\[id\]\/write\/pdf-goruntuleyici"\), \{ ssr: false \}\)/);
    const kod = yorumsuz(panel);
    for (const yok of ["<iframe", "<embed", "<object"]) assert.ok(!kod.includes(yok), yok);
  });

  test("kaynak değişince PDF, künye ve not aynı kaynağa ait olur", () => {
    /* Panelin tamamı kaynağın kimliğiyle yeniden kuruluyor. */
    assert.match(alan, /<KaynakPaneli\s*\n\s*key=\{secili\.id\}/);
    /* Görüntüleyici de PDF kimliğiyle; aynı panelde PDF değişirse de sıfırlanır. */
    assert.match(panel, /<PdfGoruntuleyici key=\{pdf\.id\} pdfId=\{pdf\.id\}/);
  });

  test("yalnızca seçilen kaynağın PDF'i yüklenir; liste peşinen indirilmez", () => {
    /* Görüntüleyici yalnızca seçili kaynak için ve yalnızca PDF sekmesinde çiziliyor. */
    assert.match(panel, /sekme === "pdf" \? \(\s*\n\s*pdf \? \(/);
    assert.ok(!yorumsuz(alan).includes("PdfGoruntuleyici"), "liste görüntüleyici kurmuyor");
  });

  test("PDF durumları ayrı ayrı: yok, belirsiz, bozuk/yükleniyor", () => {
    assert.match(panel, /eslesme\?\.tur === "belirsiz"/);
    assert.match(panel, /tr: "PDF yükle", en: "Upload a PDF"/);
    const goruntuleyici = oku("app/dashboard/editor/[id]/write/pdf-goruntuleyici.tsx");
    assert.match(goruntuleyici, /durum === "yukleniyor"/);
    assert.match(goruntuleyici, /durum === "hata"/);
  });

  test("PDF açmak okuma durumunu DEĞİŞTİRMİYOR", () => {
    for (const dosya of [panel, alan]) {
      const kod = yorumsuz(dosya);
      /* Durum yalnızca kullanıcının menüden seçtiği eylemle değişir. */
      const cagrilar = kod.match(/updateLiteratureStatus\(/g)?.length ?? 0;
      assert.ok(cagrilar <= 1, "durum güncellemesi tek yerde");
    }
    assert.ok(!yorumsuz(panel).includes("updateLiteratureStatus"), "panel durum yazmıyor");
  });

  test("künye: bilinmeyen alan uydurulmaz, dizin önerisi onayla uygulanır", () => {
    assert.match(panel, /\{yazi \|\| "—"\}/);
    assert.match(panel, /<KaynakDuzeltme kaynakId=\{kaynak\.id\}/);
    const duzeltme = oku("app/dashboard/literature/kaynak-duzeltme.tsx");
    /* Hiçbir alan kendiliğinden uygulanmaz: seçilenler gönderilir. */
    assert.match(duzeltme, /kaynakDuzeltmeUygula\(kaynakId, \[\.\.\.secilen\]\)/);
    assert.match(duzeltme, /disabled=\{!secilen\.size \|\| durum === "uygulaniyor"\}/);
  });
});

describe("notlar: gerçek kayıt, yeni tablo yok", () => {
  test("not literature_sources.notes sütununda; yeni tablo ya da migration eklenmedi", () => {
    const eylemler = oku("app/actions/literature.ts");
    assert.match(eylemler, /export async function updateLiteratureNotes\(sourceId: string, notes: string\)/);
    assert.match(eylemler, /\.from\("literature_sources"\)\s*\n\s*\.update\(\{ notes: deger \}\)/);
    /* Sahiplik sunucuda da süzülüyor; RLS zaten aynı kuralı uyguluyor. */
    assert.match(eylemler, /\.update\(\{ notes: deger \}\)[\s\S]{0,200}?\.eq\("owner_id", ctx\.user\.id\)/);
    assert.match(notlar, /updateLiteratureNotes\(kaynakId, gonderilen\)/);
  });

  test("not formu künye alanlarını EZMİYOR", () => {
    /* Künye formu notu olduğu gibi taşır; not sekmesi yalnızca notu yazar. */
    assert.match(panel, /<input type="hidden" name="notes" value=\{kaynak\.notes \?\? ""\} \/>/);
  });
});

describe("ortak bileşenler ve kapsam", () => {
  test("ayırıcı ortak; editörün sarmalayıcısı sınırları veriyor", () => {
    const ortak = oku("app/dashboard/_components/yatay-ayirici.tsx");
    assert.match(ortak, /role="separator"/);
    assert.match(ortak, /aria-valuemin=\{enAz\}/);
    assert.match(ortak, /ArrowLeft: 24, ArrowRight: -24/);
    const editor = oku("app/dashboard/editor/[id]/write/sag-panel-ayirici.tsx");
    assert.match(editor, /<YatayAyirici/);
    assert.match(editor, /SAG_PANEL_SINIRI\[panel\]/);
    /* Editörün sınıfı değişmedi: yerleşim kuralları ona bağlı. */
    assert.match(ortak, /className = "pdf-panel-ayirici"/);
    assert.match(alan, /className="kaynak-ayirici"/);
  });

  test("liste ve panel için kullanılabilir en az genişlikler tanımlı", () => {
    assert.match(alan, /export const LISTE_EN_AZ = 360;/);
    assert.match(alan, /export const PANEL_EN_AZ = 420;/);
  });

  test("stil yalnızca Kaynaklar sayfasının sınıflarına dokunuyor", () => {
    const css = oku("app/styles/kaynak-alani.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const seciciler = [...css.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].map((m) => m[2].trim()).filter(Boolean);
    assert.ok(seciciler.length > 30);
    for (const s of seciciler) {
      for (const p of s.split(",")) {
        assert.match(p, /\.kaynak|\.kaynaklar-|\.pdf-sayfa-alani|\.pdf-goruntuleyici/, `kapsam dışı seçici: ${p.trim()}`);
      }
    }
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
    for (const m of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 12);
  });
});
