import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs";
import path from "node:path";

/*
  KISA EKRAN (Phase 5.1d-1, 14.11.2026). Hesap menüsünde yükseklik sınırı
  yoktu: 1366×600/500'de kenar çubuğundaki menünün üstü, üst çubuktakinin
  "Çıkış yap"ı ekranın dışında kalıyordu. "Daha fazla" taşanı kesiyordu
  (overflow:hidden) ve liste kaymıyordu. Davranış gerçek tarayıcıda
  sınanıyor (scripts/onizleme/kisa-ekran-kabul.mjs); burada CSS
  sözleşmesi kaynak metinden okunur (tests/unit kuralı).
*/
const oku = (yol: string) => fs.readFileSync(path.join(process.cwd(), yol), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const kabuk = oku("app/styles/shell.css");
const gezinme = oku("app/styles/os-shell.css");

/** Seçicinin (tam eşleşme) gövdeleri, birleştirilmiş. */
function govde(css: string, secici: string): string {
  const kacis = secici.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|[}\\n])\\s*${kacis}\\s*\\{([^}]*)\\}`, "g"))].map((m) => m[1]).join(" ");
}

describe("hesap menüsü kısa ekranda", () => {
  test("yüksekliği ekrana göre sınırlı ve içi kayar (üst çubuk: aşağı açılır)", () => {
    const g = govde(kabuk, ".os-kullanici-menu");
    assert.match(g, /max-height: calc\(100dvh - var\(--topbar-height\) - 16px\)/);
    assert.match(g, /overflow-y: auto/);
    assert.match(g, /overscroll-behavior: contain/);
  });

  test("kenar çubuğunda yukarı açılır ve kendi sınırı var", () => {
    const g = govde(kabuk, ".os-kullanici--kenar .os-kullanici-menu");
    assert.match(g, /bottom: calc\(100% \+ 8px\)/);
    assert.match(g, /max-height: calc\(100dvh - 96px\)/);
  });
});

describe("'Daha fazla' kısa ekranda", () => {
  test("liste kayar; başlık ve ipucu sabit", () => {
    const liste = govde(gezinme, ".os-daha-liste");
    assert.match(liste, /overflow-y: auto/);
    assert.match(liste, /min-height: 0/);
    assert.match(govde(gezinme, ".os-daha-bas"), /flex: none/);
    assert.match(govde(gezinme, ".os-daha-ipucu"), /flex: none/);
  });

  test("esnek düzen yalnızca açıkken: kapalı <dialog>'un display:none'ı ezilmez", () => {
    assert.match(govde(gezinme, ".os-daha[open]"), /display: flex; flex-direction: column/);
    assert.doesNotMatch(govde(gezinme, ".os-daha"), /display:/);
  });
});
