// CSS token denetimi — derlemeden önce çalışır ("npm run build").
// ArvoOS'taki scripts/check-css-tokens.mjs kurallarının ArvoLab uyarlaması:
//   1) Ham renk (hex, rgb(), hsl()) yalnızca app/styles/tokens.css'te olabilir.
//   2) Palet değişkenleri (--brand-N, --accent-N, --n-N, --mavi-N, --gri-N, --yazi-N,
//      --gece-N, --gece-yazi-N) yalnızca tokens.css'te tanımlanır VE okunur;
//      bileşenler anlamsal katmanı (--surface, --ink, --primary…) okur.
//   3) Yedeksiz var(--x) kullanımı tanımlı bir değişkene işaret etmelidir.
//   4) En küçük yazı boyutu 11px (font-size ve font kısayolu).
//   7) Tema eşitliği: açık temada palet/ham renkten değer alan her anlamsal token
//      koyu temada da tanımlanır ya da TEMADAN_BAGIMSIZ listesinde gerekçesiyle durur.
//   6) Medya sorgusu genişliği yalnızca sistemin kırılımları (760/761, 1199/1200;
//      lib/os/kirilimlar.ts); başkaları KIRILIM_BORCU listesindekiler.
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
const KNOWN_EXTERNAL = new Set(["--font-inter", "--font-montserrat", "--font-newsreader"]);

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
    /* Signature OS v4 ham paleti (--p-*, V4.3-A1): aynı kural, ayrı ad biçimi (--p-lacivert-650, --p-secim-acik). */
    for (const match of text.matchAll(/(--p-[a-z0-9-]+)\s*:/gi)) {
      report(file, text, match.index, `v4 palet değişkeni ${match[1]} yalnızca tokens.css'te tanımlanabilir`);
    }
    for (const match of text.matchAll(/var\(\s*(--p-[a-z0-9-]+)\s*[,)]/gi)) {
      report(file, text, match.index, `v4 palet adımı ${match[1]} doğrudan okunuyor — anlamsal rolü (--yuzey-*, --metin-*, --vurgu…) kullanın`);
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

/*
  KIRILIM BORCU (Signature OS 2.0 Aşama 1, 08.11.2026). Sistemin üç ekran
  sınıfı var (telefon ≤760, tablet 761–1199, masaüstü ≥1200;
  lib/os/kirilimlar.ts), ama CSS'te 20'yi aşkın farklı genişlik vardı.
  Her birini sisteme çekmek o aralıktaki ekranlarda davranışı değiştirir
  (ör. max-width:1200px Dashboard ızgarasını TAM 1200'de, masaüstü
  kabuğunun içinde 2 sütuna indiriyor); bu yüzden hiçbiri bu aşamada
  taşınmadı, her biri ayrı onayla görsel doğrulamadan geçecek. Yeni
  kırılım eklenemez; biri sisteme taşınınca denetim "listeden çıkar" der.
*/
const SISTEM_KIRILIMLARI = new Set(["max-width:760px", "min-width:761px", "max-width:1199px", "min-width:1200px"]);
const KIRILIM_BORCU = {
  "app/styles/auth.css": { "max-width:1100px": 1, "max-width:420px": 1, "max-width:520px": 1, "max-width:640px": 1, "max-width:860px": 1 },
  "app/styles/components.css": { "max-width:1100px": 1, "max-width:380px": 1, "max-width:640px": 7, "max-width:900px": 2 },
  "app/styles/genel-bakis.css": { "max-width:1100px": 2, "max-width:1200px": 1, "max-width:420px": 1, "max-width:520px": 1, "max-width:560px": 6, "max-width:640px": 2, "max-width:700px": 2, "max-width:900px": 8, "min-width:1100px": 1, "min-width:561px": 1, "min-width:901px": 6 },
  "app/styles/overlays.css": { "max-width:560px": 1, "max-width:900px": 1 },
  "app/styles/sayfa-standardi.css": { "max-width:359px": 1, "max-width:520px": 2, "max-width:600px": 1, "max-width:640px": 1, "max-width:900px": 1, "min-width:1100px": 1, "min-width:900px": 1, "min-width:901px": 2 },
  "app/styles/shell.css": { "max-width:900px": 2 },
  "app/styles/workspace.css": { "max-width:1640px": 1, "max-width:400px": 2, "max-width:420px": 1, "max-width:640px": 5, "max-width:900px": 1, "min-width:1400px": 1, "min-width:1700px": 1 }
};
for (const { file, text } of files) {
  const goreli = path.relative(root, file);
  const sayac = {};
  for (const sorgu of text.matchAll(/@media[^{]*/g)) {
    for (const k of sorgu[0].matchAll(/((?:max|min)-width)\s*:\s*(\d+)px/g)) {
      const deger = `${k[1]}:${k[2]}px`;
      if (SISTEM_KIRILIMLARI.has(deger)) continue;
      sayac[deger] = (sayac[deger] ?? 0) + 1;
      if (sayac[deger] > (KIRILIM_BORCU[goreli]?.[deger] ?? 0)) report(file, text, sorgu.index, `sistem dışı kırılım "${deger}" — 760/761 (telefon), 1199/1200 (masaüstü) kullanın (lib/os/kirilimlar.ts)`);
    }
  }
  for (const [deger, izin] of Object.entries(KIRILIM_BORCU[goreli] ?? {})) {
    if ((sayac[deger] ?? 0) < izin) problems.push(`${goreli}  kırılım borcu "${deger}" azaldı (${sayac[deger] ?? 0}/${izin}) — KIRILIM_BORCU listesinden düşün`);
  }
}

/*
  TEMA EŞİTLİĞİ (Signature OS 2.0 Aşama 1, 08.11.2026). Açık temada
  paletten ya da ham renkten değer alan bir anlamsal token koyu temada
  yeniden tanımlanmazsa koyu temada AÇIK değeriyle kalır. Bu bazen doğru
  (beyaz yazı, kâğıt, koyu panel), bazen unutulmuştur; denetim ikisini
  ayırt edemez, bu yüzden bilerek temadan bağımsız olanlar burada
  gerekçesiyle yazılı. Başka bir anlamsal token'dan türeyenler (ör.
  --accent: var(--primary-ink)) kendiliğinden temayla döner, sayılmaz.
*/
const TEMADAN_BAGIMSIZ = {
  "--kagit": "kâğıdın açık değeri; koyu temanın loş kâğıdı ekranda .kagit kuralında (V4.3-A2-3)",
  "--sidebar-ink": "giriş sayfasının her temada koyu tanıtım paneli",
  "--sidebar-muted": "giriş sayfasının her temada koyu tanıtım paneli",
  "--sidebar-line": "giriş sayfasının her temada koyu tanıtım paneli",
  "--sidebar-hover": "giriş sayfasının her temada koyu tanıtım paneli",
  "--koyu-panel-zemin": "kredi sayacı ve işlem kapsülü her temada koyu",
  "--koyu-panel-cizgi": "kredi sayacı her temada koyu",
  "--golge-tonu": "gölge rengi koyu temada da lacivert-siyah",
  "--golge-tonu-derin": "gölge rengi koyu temada da lacivert-siyah",
  "--grafik-cubuk": "veri rengi, iki temada da okunur (ölçüldü: Signature OS)",
  "--grafik-cubuk-acik": "veri rengi, iki temada da okunur",
  "--logo-plaka": "lacivert yazılı ortak logoların koyu temadaki beyaz zemini",
  "--brand-navy": "eski ad (marka rengi), temadan bağımsız",
  "--brand-green": "eski ad (marka rengi), temadan bağımsız",
};
{
  const tokensMetni = files.find((f) => f.file === TOKENS_FILE)?.text ?? "";
  const tanimlar = (blok) => Object.fromEntries([...blok.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]));
  /*
    Açık tema: `:root, .kagit` bloğu VE Signature OS v4'ün `:root` blokları
    (V4.3-A1). Eskiden yalnızca ilk blok okunuyordu; v4 rolleri ayrı bloğa
    yazıldığında koyu karşılığı unutulsa denetim görmezdi.
  */
  const acik = tanimlar([...tokensMetni.matchAll(/^(?::root, \.kagit|:root) \{([\s\S]*?)\n\}/gm)].map((m) => m[1]).join("\n"));
  const koyu = tanimlar([...tokensMetni.matchAll(/html\[data-theme="dark"\] \{([\s\S]*?)\n\}/g)].map((m) => m[1]).join("\n"));
  const paletten = /var\(--(?:brand|accent|n|mavi|gri|yazi|gece|gece-yazi)-\d+\)|var\(--p-[a-z0-9-]+\)|#[0-9a-f]{3,8}\b|\brgba?\(/i;
  // Palet adımlarının kendisi ve renk taşımayan ölçü/süre/yazı token'ları sayılmaz.
  const renkDisi = /^--(?:brand|accent|n|mavi|gri|yazi|gece|gece-yazi)-\d+$|^--p-|^--(?:r-|s-|z-|fs-|fw-|lh-|ls-|tip-|sure|ease|font|print|kontrol-h|kontrol-dolgu|kontrol-r|menu-oge-h|menu-dolgu|menu-r|menu-oge-r|pencere-r|kart-dolgu|kart-r|karo-dolgu|karo-r|kart-araligi|gezinme|alt-cubuk|sidebar-width|topbar|dock|content|hap-|dugme-agirlik|glass-blur|radius|yan-panel-genis)/;
  for (const [ad, deger] of Object.entries(acik)) {
    if (renkDisi.test(ad) || ad in koyu || !paletten.test(deger)) continue;
    if (!TEMADAN_BAGIMSIZ[ad]) problems.push(`app/styles/tokens.css  ${ad} (${deger}) koyu temada tanımlı değil — html[data-theme="dark"] bloğuna ekleyin ya da bilerek temadan bağımsızsa TEMADAN_BAGIMSIZ listesine gerekçesiyle yazın`);
  }
  for (const ad of Object.keys(TEMADAN_BAGIMSIZ)) {
    if (!(ad in acik) || ad in koyu) problems.push(`app/styles/tokens.css  ${ad} TEMADAN_BAGIMSIZ listesinde ama artık öyle değil — listeden düşün`);
  }
}

/*
  8) Loş kâğıdın devralma listesi tam olmalı (V4.3-A2-3). Kâğıt (.kagit)
     açık rolleri `:root, .kagit` bloklarıyla kendi üzerinde yeniden kurar;
     koyu temada ekranda `html[data-theme="dark"][data-kagit="los"] .kagit` kuralı (D4: yalnızca loş kâğıt seçiliyken) bu
     blokların HER adını `inherit` ile geri alır. Listede olmayan bir ad
     loş kâğıtta açık temanın değeriyle kalır: koyu kâğıtta koyu yazı ya da
     beyaz yama, hata vermeden. Fazlası da bildirilir (silinmiş adın
     artığı listeyi okuyanı yanıltır).
*/
{
  const metin = (files.find((f) => f.file === TOKENS_FILE)?.text ?? "").replace(/\/\*[\s\S]*?\*\//g, "");
  const acikAdlar = new Set();
  for (const blok of metin.matchAll(/:root, \.kagit\s*\{([^}]*)\}/g)) for (const m of blok[1].matchAll(/(--[a-z0-9-]+)\s*:/g)) acikAdlar.add(m[1]);
  // D4 (10.11.2026): loş kâğıt artık kullanıcının seçimi (html[data-kagit="los"]); eskiden yalnızca koyu temaya bağlıydı.
  const kural = metin.match(/@media screen\s*\{\s*html\[data-theme="dark"\]\[data-kagit="los"\] \.kagit\s*\{([^}]*)\}/);
  if (!kural) problems.push("app/styles/tokens.css  loş kâğıt kuralı (@media screen { html[data-theme=\"dark\"][data-kagit=\"los\"] .kagit { … } }) bulunamadı");
  else {
    const devralan = new Set([...kural[1].matchAll(/(--[a-z0-9-]+)\s*:\s*inherit\s*;/g)].map((m) => m[1]));
    for (const ad of acikAdlar) if (!devralan.has(ad)) problems.push(`app/styles/tokens.css  ${ad} \`:root, .kagit\` bloğunda tanımlı ama loş kâğıt kuralında \`${ad}: inherit;\` yok — koyu temada kâğıtta açık temanın değeriyle kalır`);
    for (const ad of devralan) if (!acikAdlar.has(ad)) problems.push(`app/styles/tokens.css  ${ad} loş kâğıt kuralında devralınıyor ama hiçbir \`:root, .kagit\` bloğunda yok — listeden düşün`);
  }
}

if (problems.length) {
  console.error(`✗ CSS token denetimi: ${problems.length} sorun\n${problems.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`✓ CSS token denetimi: ${files.length} dosya, ${declared.size} değişken, sorun yok`);
