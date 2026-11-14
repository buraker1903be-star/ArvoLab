import assert from "node:assert/strict";
import { describe, test } from "node:test";
import fs from "node:fs";
import path from "node:path";

/*
  CTRL+K KENAR ÇUBUĞU KOMUTU VE GEZİNME TEMİZLİĞİ (Phase 5.1d-4, 14.11.2026).
  Palet React'e bağlı; sözleşme kaynak metinden okunur (tests/unit kuralı).
  Davranış gerçek tarayıcıda: scripts/onizleme/gezinme-temizlik-kabul.mjs.
*/
const kaynak = (yol: string) => fs.readFileSync(path.join(process.cwd(), yol), "utf8");
const yorumsuz = (metin: string) => metin.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const palet = yorumsuz(kaynak("app/dashboard/_components/os-komut-paleti.tsx"));
const yardimci = yorumsuz(kaynak("app/_components/gezinme.ts"));

describe("kenar çubuğu komutu", () => {
  test("yalnızca masaüstünde listelenir; adı güncel hâle göre", () => {
    assert.match(palet, /\.\.\.\(masaustu\s*\?\s*\[\{\s*id: "komut:kenar"/);
    assert.match(palet, /label: dar \? t\(\{ tr: "Kenar çubuğunu genişlet", en: "Expand sidebar" \}\) : t\(\{ tr: "Kenar çubuğunu daralt", en: "Collapse sidebar" \}\)/);
  });

  test("mevcut tercih altyapısını çağırır; palette yeni depolama yok", () => {
    assert.match(palet, /if \(oge\.tur === "kenar"\) \{\s*gezinmeTercihiniUygula\(!gezinmeDarMi\(\)\);/);
    assert.match(palet, /useSyncExternalStore\(gezinmeAbone, gezinmeDarMi, \(\) => false\)/);
    assert.doesNotMatch(palet, /localStorage|sessionStorage/);
  });

  test("masaüstü sınırı CSS'le aynı sabitten (1200)", () => {
    assert.match(yardimci, /import \{ MASAUSTU_EN_AZ \} from "@\/lib\/os\/kirilimlar"/);
    assert.match(yardimci, /`\(min-width: \$\{MASAUSTU_EN_AZ\}px\)`/);
  });

  test("kısayol yok: palet yalnızca Ctrl/⌘+K dinler (Ctrl+B editörde kalın)", () => {
    const tuslar = [...palet.matchAll(/olay\.key\.toLocaleLowerCase\("en"\) === "(\w)"/g)].map((m) => m[1]);
    assert.deepEqual(tuslar, ["k"]);
  });
});

describe("kullanılmayan gezinme kodu kalktı", () => {
  test("calisma-serit.tsx ve CSS'i yok", () => {
    assert.equal(fs.existsSync(path.join(process.cwd(), "app/dashboard/_components/calisma-serit.tsx")), false);
    for (const css of fs.readdirSync(path.join(process.cwd(), "app/styles"))) {
      assert.doesNotMatch(kaynak(`app/styles/${css}`), /calisma-serit/, css);
    }
  });

  test("write sayfası çalışmayı kenar çubuğuna bir kez bildirir (sekmeler bileşeni üzerinden)", () => {
    const sayfa = yorumsuz(kaynak("app/dashboard/editor/[id]/write/page.tsx"));
    assert.doesNotMatch(sayfa, /<CalismaBaglamiYayinla/);
    assert.match(sayfa, /<CalismaSekmeleri calisma=\{project\} aktif="yazim" \/>/);
    assert.match(kaynak("app/dashboard/editor/[id]/calisma-sekmeleri.tsx"), /<CalismaBaglamiYayinla /);
  });
});
