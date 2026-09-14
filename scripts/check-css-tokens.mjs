// CSS token denetimi — derlemeden önce çalışır ("npm run build").
// ArvoOS'taki scripts/check-css-tokens.mjs kurallarının ArvoLab uyarlaması:
//   1) Ham renk (hex, rgb(), hsl()) yalnızca app/styles/tokens.css'te olabilir.
//   2) Palet değişkenleri (--brand-N, --accent-N, --n-N) yalnızca tokens.css'te tanımlanır.
//   3) Yedeksiz var(--x) kullanımı tanımlı bir değişkene işaret etmelidir.
//   4) En küçük yazı boyutu 11px (font-size ve font kısayolu).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = path.join(root, "app");
const TOKENS_FILE = path.join(APP_DIR, "styles", "tokens.css");
const MIN_FONT_PX = 11;
// next/font ile gövdeye eklenen değişkenler
const KNOWN_EXTERNAL = new Set(["--font-inter", "--font-montserrat"]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(full);
    // iCloud/Finder çakışma kopyaları ("dosya 2.css") denetlenmez
    return entry.name.endsWith(".css") && !/ \d+\.css$/.test(entry.name) ? [full] : [];
  });
}

// Yorumları, satır numaraları bozulmasın diye boşlukla değiştir
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, " "));
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

const files = walk(APP_DIR).map((file) => ({ file, text: stripComments(fs.readFileSync(file, "utf8")) }));
const problems = [];
const report = (file, text, index, message) =>
  problems.push(`${path.relative(root, file)}:${lineOf(text, index)}  ${message}`);

const declared = new Set(KNOWN_EXTERNAL);
for (const { text } of files) {
  for (const match of text.matchAll(/(--[a-z0-9-]+)\s*:/gi)) declared.add(match[1]);
}

for (const { file, text } of files) {
  const isTokens = file === TOKENS_FILE;

  if (!isTokens) {
    for (const match of text.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi)) {
      report(file, text, match.index, `ham renk "${match[0]}" — tokens.css'te bir değişken tanımlayıp onu kullanın`);
    }
    for (const match of text.matchAll(/(--(?:brand|accent|n)-\d+)\s*:/gi)) {
      report(file, text, match.index, `palet değişkeni ${match[1]} yalnızca tokens.css'te tanımlanabilir`);
    }
  }

  for (const match of text.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,)?/gi)) {
    if (!match[2] && !declared.has(match[1])) {
      report(file, text, match.index, `tanımsız değişken ${match[1]}`);
    }
  }

  for (const match of text.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)) {
    if (Number(match[1]) < MIN_FONT_PX) report(file, text, match.index, `yazı boyutu ${match[1]}px < ${MIN_FONT_PX}px`);
  }
  for (const match of text.matchAll(/\bfont\s*:[^;{}]*?(\d+(?:\.\d+)?)px/gi)) {
    if (Number(match[1]) < MIN_FONT_PX) report(file, text, match.index, `yazı boyutu ${match[1]}px < ${MIN_FONT_PX}px`);
  }
}

if (problems.length) {
  console.error(`✗ CSS token denetimi: ${problems.length} sorun\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`✓ CSS token denetimi: ${files.length} dosya, ${declared.size} değişken, sorun yok`);
