import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs";
import path from "node:path";

/*
  Masaüstü kenar çubuğu 240/64 px (Phase 5.1c, 13.11.2026). Bileşen ve CSS
  React'e/tarayıcıya bağlı; sözleşme kaynak metninden okunur (tests/unit
  kuralı). Davranışın kendisi gerçek tarayıcıda sınanıyor:
  scripts/onizleme/kenar-daraltma-kabul.mjs.
*/
const oku = (yol: string) => fs.readFileSync(path.join(process.cwd(), yol), "utf8");
const gezinme = oku("app/dashboard/_components/os-gezinme.tsx");
const yardimci = oku("app/_components/gezinme.ts");
const kabuk = oku("app/styles/os-shell.css");
const yazim = oku("app/dashboard/editor/[id]/write/page.tsx");
const calismaSekmeleri = oku("app/dashboard/editor/[id]/calisma-sekmeleri.tsx");

/** `@media (min-width: 1200px) { … }` bloklarının içi (iç içe parantezler dengeli). */
function masaustuBloklari(css: string): string {
  const temiz = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let cikti = "";
  const desen = /@media\s*\(\s*min-width:\s*1200px\s*\)\s*\{/g;
  for (let m = desen.exec(temiz); m; m = desen.exec(temiz)) {
    let derinlik = 1;
    let i = m.index + m[0].length;
    const bas = i;
    while (derinlik && i < temiz.length) {
      if (temiz[i] === "{") derinlik++;
      else if (temiz[i] === "}") derinlik--;
      i++;
    }
    cikti += temiz.slice(bas, i - 1) + "\n";
  }
  return cikti;
}
const masaustu = masaustuBloklari(kabuk);

describe("daraltma düğmesi", () => {
  test("gerçek düğme; aria-controls ana gezinmeye, aria-expanded açıkken true", () => {
    assert.match(gezinme, /<nav id="os-ana-gezinme" className="os-gezinme"/);
    assert.match(gezinme, /<button\s+type="button"\s+className="os-gezinme-daralt"\s+aria-controls="os-ana-gezinme"\s+aria-expanded=\{!dar\}/);
  });

  test("iki dilli ad; duruma göre değişir", () => {
    assert.match(gezinme, /aria-label=\{dar \? t\(\{ tr: "Kenar çubuğunu genişlet", en: "Expand sidebar" \}\) : t\(\{ tr: "Kenar çubuğunu daralt", en: "Collapse sidebar" \}\)\}/);
  });

  test("durum <html>'den okunur; sunucu çizimi 'açık' (hydration'da yerleşim değişmez)", () => {
    assert.match(gezinme, /useSyncExternalStore\(gezinmeAbone, gezinmeDarMi, \(\) => false\)/);
    assert.match(gezinme, /onClick=\{\(\) => gezinmeTercihiniUygula\(!dar\)\}/);
  });

  test("yardımcı karar katmanının sabitlerini kullanır, değer elle yazılmaz", () => {
    assert.match(yardimci, /from "@\/lib\/os5\/gezinme"/);
    assert.match(yardimci, /setItem\(GEZINME_DAR_ANAHTARI, darDegeri\(dar\)\)/);
    assert.doesNotMatch(yardimci, /"arvolab\.gezinme\.dar"|"data-gezinme"/);
    // Depolama hatası düğmeyi düşürmez.
    assert.match(yardimci, /try \{\s*window\.localStorage\.setItem[\s\S]*?\} catch \{/);
  });
});

describe("dar hâlin CSS sözleşmesi (yalnızca masaüstü bloklarında)", () => {
  const kural = (secici: string, govde: RegExp) => {
    const r = new RegExp(`html\\[data-gezinme="dar"\\][^{]*${secici}[^{]*\\{([^}]*)\\}`, "g");
    const bulunan = [...masaustu.matchAll(r)].map((m) => m[1]).join(" ");
    assert.ok(bulunan, `kural yok: ${secici}`);
    assert.match(bulunan, govde, secici);
  };

  test("ray 64 px, içerik 64 px'ten başlar", () => {
    kural("\\.os-gezinme(?=\\s*\\{)", /width: var\(--os5-kenar-ray\)/);
    kural("\\.dashboard-content-shell", /margin-left: var\(--os5-kenar-ray\)/);
  });

  test("ad etiketi kırpılmasın: liste kabı taşmayı kesmez", () => {
    kural("\\.os-gezinme-govde", /overflow: visible/);
  });

  test("logo ve hesap üst çubukta; Diğer ve çalışma alt menüsü gizli, Daha fazla görünür", () => {
    kural("\\.os-gezinme-logo", /display: none/);
    kural("\\.os-marka-logo", /display: flex/);
    kural("\\.os-kullanici--ust", /display: block/);
    kural("\\.os-gezinme-daha-li", /display: list-item/);
    assert.match(masaustu, /html\[data-gezinme="dar"\] \.os-gezinme-diger,/);
    assert.match(masaustu, /html\[data-gezinme="dar"\] \.os-gezinme-baglam,/);
  });

  test("çalışma sekmeleri dar hâlde görünür", () => {
    kural("\\.calisma-sekmeleri", /display: inline-flex/);
  });

  test("kâğıt geometrisi sabit: yazım düzeni açık kenar çubuğundaki genişliğinde kalır", () => {
    kural("\\.manuscript-layout", /max-width: calc\(100% - \(var\(--os5-kenar-genis\) - var\(--os5-kenar-ray\)\)\)/);
  });

  test("geçiş süresi token'dan; azaltılmış harekette kapalı", () => {
    assert.match(masaustu, /\.os-root \.os-gezinme \{ transition: width var\(--os5-sure-orta\)/);
    assert.match(kabuk, /@media \(prefers-reduced-motion: reduce\) \{\s*\.os-root \.os-gezinme, \.os-root \.dashboard-content-shell, \.os-gezinme-daralt \{ transition: none; \}/);
  });

  test("düğme yalnızca masaüstünde: taban kuralda gizli", () => {
    assert.match(kabuk, /\n\.os-gezinme-daralt \{ display: none; \}/);
    assert.match(masaustu, /\.os-gezinme-daralt \{\s*display: grid;/);
  });
});

describe("yazım sayfasında çalışma sekmeleri", () => {
  test("Yazım sekmesi etkin olarak çizilir", () => {
    assert.match(yazim, /<CalismaSekmeleri calisma=\{project\} aktif="yazim" \/>/);
  });

  test("tür kuralı tek yerde: Makale sekmesi yalnızca makale türünde", () => {
    assert.match(calismaSekmeleri, /calisma\.project_type === "article"/);
  });
});
