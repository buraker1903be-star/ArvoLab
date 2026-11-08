#!/usr/bin/env node
/*
  TOKEN GÖÇ HARİTASI (V4.1). app/styles/tokens.css'teki her token'ı okur,
  uygulamadaki kullanım sayısını (var(--ad)) sayar ve v4 karşılığını
  kural tablosundan bulur. Uygulama dosyalarına YAZMAZ.
    node docs/tasarim/asama-4/signature-os-v4/araclar/goc-haritasi.mjs
*/
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const KOK = path.dirname(new URL(import.meta.url).pathname);
const DEPO = path.resolve(KOK, "../../../../..");
const tokens = fs.readFileSync(path.join(DEPO, "app/styles/tokens.css"), "utf8");
const adlar = [...new Set([...tokens.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]))];

// Kullanım sayısı: app/, lib/, components/ içindeki CSS ve TSX'te var(--ad) geçişi (tokens.css hariç).
const dosyalar = execSync(`git -C ${DEPO} ls-files app lib components | grep -E "\\.(css|tsx|ts)$" | grep -v "app/styles/tokens.css"`, { encoding: "utf8" }).trim().split("\n");
const metin = dosyalar.map((f) => fs.readFileSync(path.join(DEPO, f), "utf8")).join("\n");
const kullanim = (ad) => (metin.match(new RegExp(`var\\(${ad.replace(/[-]/g, "\\-")}[,)]`, "g")) ?? []).length;

/* Birebir eşlemeler (anlamsal roller). */
const BIREBIR = {
  "--bg": "--yuzey-zemin", "--yuzey-kanvas": "--yuzey-zemin", "--background": "--yuzey-zemin",
  "--kenar-zemin": "--yuzey-kenar",
  "--surface": "--yuzey-1", "--yuzey-kart": "--yuzey-1", "--surface-raised": "--yuzey-ust", "--yuzey-ust": "--yuzey-ust",
  "--surface-2": "--yuzey-2", "--surface-sunken": "--yuzey-cokuk", "--surface-muted": "--yuzey-cokuk",
  "--kagit": "--kagit", "--belge-masa": "--masa",
  "--ink": "--metin-1", "--foreground": "--metin-1", "--ink-soft": "--metin-1", "--muted": "--metin-2", "--muted-foreground": "--metin-2", "--dim": "--metin-3",
  "--on-brand": "--metin-ters", "--on-primary": "--metin-ters", "--primary-foreground": "--metin-ters",
  "--line": "--cizgi", "--border": "--cizgi", "--yuzey-kart-cizgi": "--cizgi", "--line-soft": "--cizgi", "--yuzey-duzlem-ayrac": "--cizgi", "--belge-kenar": "--cizgi-guclu",
  "--primary": "--vurgu", "--primary-strong": "--vurgu", "--dugme-birincil": "--vurgu", "--accent-bright": "--vurgu",
  "--primary-hover": "--vurgu-uzerine", "--dugme-birincil-hover": "--vurgu-uzerine",
  "--primary-ink": "--vurgu-metin", "--accent": "--vurgu-metin", "--accent-strong": "--vurgu-metin", "--info": "--vurgu-metin",
  "--primary-soft": "--vurgu-yumusak", "--accent-soft": "--vurgu-yumusak", "--info-soft": "--vurgu-yumusak", "--giris-vurgu-zemin": "--yuzey-vurgu",
  "--focus": "--odak", "--primary-focus": "--odak (halka gölgesi bileşende)", "--odak-halkasi": "--odak (halka gölgesi bileşende)",
  "--success": "--basari", "--success-soft": "--basari-yumusak", "--warning": "--uyari", "--warning-soft": "--uyari-yumusak",
  "--danger": "--hata", "--danger-soft": "--hata-yumusak", "--neutral": "--metin-2", "--neutral-soft": "--notr-yumusak",
  "--overlay": "--ortu", "--ilerleme-parlak": "--ilerleme",
  "--shadow-sm": "--golge-1", "--yuzey-kart-golge": "--golge-1", "--kontrol-golge": "--golge-1",
  "--shadow-md": "--golge-2", "--yuzey-acilir-golge": "--golge-2", "--menu-golge": "--golge-2",
  "--shadow-lg": "--golge-3", "--yuzey-pencere-golge": "--golge-3", "--pencere-golge": "--golge-3",
  "--r-xs": "--r-1", "--r-sm": "--r-2", "--kontrol-r": "--r-2", "--menu-oge-r": "--r-2", "--r-md": "--r-3", "--menu-r": "--r-3", "--karo-r": "--r-3", "--r-lg": "--r-4", "--kart-r": "--r-4", "--r-xl": "--r-4", "--pencere-r": "--r-5",
  "--radius-sm": "--r-2", "--radius-md": "--r-3", "--radius-lg": "--r-4",
  "--kontrol-h": "--kontrol", "--kontrol-h-sik": "--kontrol-sik", "--kontrol-h-dokunma": "--dokunma",
  "--font-body": "--yazi-arayuz", "--font-display": "--yazi-arayuz (başlıklar --yazi-editoryal)", "--font-brand": "--yazi-arayuz", "--font-mono": "--yazi-kod",
  "--tip-arayuz": "--tip-govde", "--tip-meta": "--tip-meta", "--tip-mikro": "--tip-yardim", "--tip-h2": "--tip-bolum", "--tip-h1": "--tip-sayfa", "--tip-display": "--tip-gosterim", "--tip-okuma": "--tip-govde-tel (okuma)",
  "--gezinme-genislik": "--kenar-genis", "--gezinme-ray": "--ray (64 px; bugün 88 — K2: bu aşamada değişmez)", "--alt-cubuk-h": "--alt-cubuk", "--topbar-height": "--ust", "--content-max": "--icerik-max", "--sidebar-width": "--kenar-genis",
  "--yan-panel-genis": "--baglam-panel",
  "--sure-hizli": "--sure-1", "--sure-orta": "--sure-2", "--sure-yavas": "--sure-3", "--ease-spring": "--egri", "--ease-sheet": "--egri-sayfa",
  "--secondary": "--basari (ilerleme dışında kullanılmaz)", "--secondary-soft": "--basari-yumusak",
};
const KURALLAR = [
  [/^--(brand|accent|mavi|gri|yazi|gece|n)-\d+$/, "ham palet → --p-* (bileşen okumaz)", "palet"],
  [/^--print-/, "korunur (yazdırma/PDF çıktısı; tasarım dışı)", "korunur"],
  [/^--font-belge|^--belge-/, "korunur (belge biçimi kılavuzdan; UI token'larından ayrı)", "korunur"],
  [/^--s-(\d+)$/, (m) => `--b-${m[1]}`, "eşlenir"],
  [/^--z-/, "--z-* (ad korunur, ölçek yeniden numaralanır)", "eşlenir"],
  [/^--fs-|^--lh-|^--ls-|^--fw-/, "--tip-* bileşik token'ına katlanır", "birleşir"],
  [/^--glass-/, "kaldırılır (v4'te cam/blur yok)", "kaldırılır"],
  [/^--sidebar-|^--koyu-panel-|^--golge-tonu|^--grafik-|^--logo-plaka/, "bileşen içi token; --yuzey-* / --vurgu-* ile yeniden tanımlanır", "yeniden"],
  [/^--dugme-|^--menu-|^--hap-|^--kart-|^--karo-|^--kontrol-/, "bileşen token'ı; v4 bileşen kuralına göre yeniden tanımlanır", "yeniden"],
  [/^--dock-|^--yerlesim|^--kirilim/, "yerleşim token'ı; 02 §11 kırılım tablosuna göre", "yeniden"],
];
/* Elle karar gerekenler için önerilen çözüm. */
const NOT = {
  "--r-pill": "korunur yalnız anahtar (switch) ve ilerleme çubuğu için; rozetler v4'te --r-1 (hap biçimi terk ediliyor)",
  "--r-daire": "korunur (avatar, durum noktası)",
  "--secondary-strong": "--ilerleme (yeşil yalnız ilerleme/başarı)",
  "--secondary-bright": "--ilerleme",
  "--shadow-inset": "kaldırılır (v4'te iç gölge yok)",
  "--giris-vurgu-cizgi": "--cizgi (vurgu zeminli kutularda ayrı çizgi rengi yok)",
  "--kenarlik-hover": "--cizgi-guclu",
  "--tip-okuma-satir": "--tip-govde-tel satır aralığı (1,47) ve belge alanında kılavuz satır aralığı",
};
const satirlar = adlar.map((ad) => {
  const n = kullanim(ad);
  if (BIREBIR[ad]) return { ad, hedef: BIREBIR[ad], tur: "eşlenir", n };
  for (const [re, hedef, tur] of KURALLAR) { const m = ad.match(re); if (m) return { ad, hedef: typeof hedef === "function" ? hedef(m) : hedef, tur, n }; }
  return { ad, hedef: n ? "elle karar (aşağıda)" : "kullanılmıyor → kaldırılabilir", tur: n ? "karar" : "kaldırılır", n };
});
const sayac = satirlar.reduce((a, s) => ((a[s.tur] = (a[s.tur] ?? 0) + 1), a), {});
const toplamKullanim = satirlar.reduce((a, s) => a + s.n, 0);
let md = `# Token göç haritası — mevcut ${adlar.length} token → v4 önerisi

Not: V4.0 audit'teki "290 token" tanım SATIRI sayısıydı (${adlar.length} ayrı ad + koyu temada yeniden tanımlananlar). Doğru sayı ${adlar.length} ayrı token.

Üretildi: \`node docs/tasarim/asama-4/signature-os-v4/araclar/goc-haritasi.mjs\`
(app/styles/tokens.css salt okunur; uygulamaya YAZILMADI).
"Kullanım": app/, lib/, components/ içindeki CSS/TS/TSX'te \`var(--ad)\` sayısı
(tokens.css hariç). Toplam ${toplamKullanim} başvuru.

| Tür | Token sayısı | Anlamı |
|---|---|---|
${Object.entries(sayac).sort((a, b) => b[1] - a[1]).map(([t, n]) => `| ${t} | ${n} | ${{ "eşlenir": "v4 rolüne birebir", "palet": "ham palet; bileşen okumaz", "birleşir": "bileşik tipografi token'ına katlanır", "yeniden": "bileşen token'ı v4 kuralıyla yeniden tanımlanır", "korunur": "değişmez (belge/yazdırma)", "kaldırılır": "v4'te karşılığı yok / kullanılmıyor", "karar": "elle karar gerekir" }[t] ?? ""} |`).join("\n")}

## En çok kullanılan 25 token (değişiklik etkisi en geniş)

| Token | Kullanım | v4 karşılığı |
|---|---|---|
${[...satirlar].sort((a, b) => b.n - a.n).slice(0, 25).map((s) => `| \`${s.ad}\` | ${s.n} | ${s.hedef} |`).join("\n")}

## Elle karar gerekenler

| Token | Kullanım | Not |
|---|---|---|
${satirlar.filter((s) => s.tur === "karar").map((s) => `| \`${s.ad}\` | ${s.n} | ${NOT[s.ad] ?? ""} |`).join("\n") || "| — | | |"}

## Tam liste

| Token | Kullanım | Tür | v4 karşılığı |
|---|---|---|---|
${satirlar.map((s) => `| \`${s.ad}\` | ${s.n} | ${s.tur} | ${s.hedef} |`).join("\n")}
`;
fs.writeFileSync(path.join(KOK, "..", "03-token-goc-haritasi.md"), md);
console.log(adlar.length, "token;", JSON.stringify(sayac), "toplam kullanım", toplamKullanim);
