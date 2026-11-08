// CSS token denetimi — derlemeden önce çalışır ("npm run build").
// ArvoOS'taki scripts/check-css-tokens.mjs kurallarının ArvoLab uyarlaması:
//   1) Ham renk (hex, rgb(), hsl()) yalnızca app/styles/tokens.css'te olabilir.
//   2) Palet değişkenleri (--brand-N, --accent-N, --n-N, --mavi-N, --gri-N, --yazi-N,
//      --gece-N, --gece-yazi-N) yalnızca tokens.css'te tanımlanır VE okunur;
//      bileşenler anlamsal katmanı (--surface, --ink, --primary…) okur.
//   3) Yedeksiz var(--x) kullanımı tanımlı bir değişkene işaret etmelidir.
//   4) En küçük yazı boyutu 11px (font-size ve font kısayolu).
//   5) Köşe yarıçapı token'dan (--r-*, --kart-r, --menu-r…); ham px/rem yalnızca
//      HAM_YARICAP_BORCU listesindekiler (borç, muafiyet değil).
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
    for (const match of text.matchAll(/(--(?:brand|accent|n|mavi|gri|yazi|gece|gece-yazi)-\d+)\s*:/gi)) {
      report(file, text, match.index, `palet değişkeni ${match[1]} yalnızca tokens.css'te tanımlanabilir`);
    }
    /*
      Palet OKUMA da yalnızca tokens.css'te (Signature OS 2.0, 08.11.2026).
      Eskiden sekiz yerde bileşen CSS'i --brand-900, --accent-300, --n-0
      gibi adımları doğrudan okuyordu: hangi rolde oldukları okunmuyor,
      koyu temada karşılıkları düşünülmüyordu. Hepsi anlamsal bir ada
      taşındı (--koyu-panel-zemin, --ilerleme-parlak, --logo-plaka…).
    */
    for (const match of text.matchAll(/var\(\s*(--(?:brand|accent|n|mavi|gri|yazi|gece|gece-yazi)-\d+)\s*[,)]/gi)) {
      report(file, text, match.index, `palet adımı ${match[1]} doğrudan okunuyor — tokens.css'te anlamsal bir değişken tanımlayıp onu kullanın`);
    }
    /*
      Eski --accent* adları (Phase 4.2). Eskiden yeşildi ve hem "seçili"
      hem "başarılı" anlamında kullanılıyordu; 301 kullanım işlevine göre
      --primary-* (etkileşim, lacivert) ya da --secondary-* (başarı, yeşil)
      tokenına taşındı. Ad artık birincile eşli bir uyumluluk kalıntısı:
      yeni kodda yazılırsa hangi rolde olduğu yine okunamaz hâle gelir.
      Palet basamakları (--accent-300 gibi) bu kuralın dışında.
    */
    for (const match of text.matchAll(/var\(\s*(--accent(?:-strong|-bright|-soft)?)\s*[,)]/gi)) {
      report(file, text, match.index, `${match[1]} eski bir ad — etkileşim için --primary-*, başarı/tamamlanma için --secondary-* kullanın`);
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

/*
  HAM YARIÇAP BORCU (Signature OS 2.0 Aşama 1, 08.11.2026). 73 ham
  border-radius vardı; token'a birebir eşit olan 45'i taşındı (kalan 16'nın dördü
  token içinde ham px: calc(…+4px) gibi) (görsel fark
  144/144 aynı). Aşağıdakiler hiçbir token'a eşit DEĞİL: taşımak görünümü
  değiştirir, ayrı onay bekliyor. Yenisi eklenemez; biri token'a geçince
  denetim "listeden çıkar" der. 0 (sıfırlama) ham sayılmaz.
*/
const HAM_YARICAP_BORCU = {
  "app/styles/auth.css": { "4px": 1, "13px": 1, "calc(var(--r-xl) + 4px)": 1 },
  "app/styles/components.css": { "18px": 1, "0 0 2px 2px": 1 },
  "app/styles/genel-bakis.css": { "8px 8px 5px 5px": 1, "20px": 1, "2px": 1 },
  "app/styles/overlays.css": { "22px 22px 0 0": 1 },
  "app/styles/workspace.css": { "4px": 1, "2px": 4, "var(--r-md) var(--r-md) 4px var(--r-md)": 1, "calc(var(--r-md) - 3px)": 1 },
};
for (const { file, text } of files) {
  if (file === TOKENS_FILE) continue;
  const goreli = path.relative(root, file);
  const sayac = {};
  for (const match of text.matchAll(/border-radius\s*:\s*([^;{}]+?)\s*(?:!important\s*)?(?=[;}])/gi)) {
    const deger = match[1].trim();
    if (!/\d(?:px|rem|em)\b/.test(deger)) continue;
    sayac[deger] = (sayac[deger] ?? 0) + 1;
    const izin = HAM_YARICAP_BORCU[goreli]?.[deger] ?? 0;
    if (sayac[deger] > izin) report(file, text, match.index, `ham köşe yarıçapı "${deger}" — --r-xs/sm/md/lg/xl/pill, --r-daire ya da bileşen token'ı (--kart-r, --menu-r…) kullanın`);
  }
  for (const [deger, izin] of Object.entries(HAM_YARICAP_BORCU[goreli] ?? {})) {
    if ((sayac[deger] ?? 0) < izin) problems.push(`${goreli}  ham yarıçap borcu "${deger}" azaldı (${sayac[deger] ?? 0}/${izin}) — HAM_YARICAP_BORCU listesinden düşün`);
  }
}

if (problems.length) {
  console.error(`✗ CSS token denetimi: ${problems.length} sorun\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`✓ CSS token denetimi: ${files.length} dosya, ${declared.size} değişken, sorun yok`);
