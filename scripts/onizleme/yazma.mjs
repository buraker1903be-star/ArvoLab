// YAZMA AKIŞLARI — uçtan uca (Signature OS 4.2, 05.11.2026).
//
// Önizleme sunucusu ONIZLEME_YAZ=1 ile çalışırken (sahte istemci yazmaları
// BELLEKTE uygular, gerçek veritabanına dokunmaz) ekrandaki bir düzenlemenin
// sunucu işleminden geçip sayfaya geri döndüğünü sınar. Kabul senaryolarından
// ayrı: onlar sabit veriye göre yazılmış, bu betik veriyi değiştiriyor.
// Yetki ve kısıtlar burada değil, tests/db/kaynak-duzenleme.test.mjs'te.
//
//   ONIZLEME_YAZ=1 ile sunucuyu başlatın (temiz veriyle: betik veriyi
//   değiştirir, ikinci koşu için sunucuyu yeniden başlatın), sonra:
//   NODE_PATH=$(npm root -g) node scripts/onizleme/yazma.mjs [taban-adres]
//
// Sayfa ÇALIŞMA KİMLİĞİYLE açılır (R0, 07.11.2026). Eskiden adres
// `?calisma=` olmadan açılıyordu; önizlemede iki çalışma olduğu için
// Kaynaklar listeyi değil çalışma seçiciyi çiziyor (lib/calisma-secimi.ts,
// "secim-gerekli") ve betik "Inflation" kaynağını hiç bulamayıp 10 sn'de
// zaman aşımına düşüyordu. Ürün doğru davranıyordu; o davranışın kendisi
// artık kabul.mjs'de ayrı bir senaryoyla sınanıyor.
import { createRequire } from "node:module";

// playwright projenin bağımlılığı değil; genel kurulumdan NODE_PATH ile gelir (kabul.mjs ile aynı).
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1"; // önizleme tezi (scripts/onizleme/veri.ts)
const tarayici = await chromium.launch();
const sayfa = await tarayici.newPage({ viewport: { width: 1440, height: 900 } });
let hata = 0;
const bekle = (kosul, mesaj) => {
  if (!kosul) {
    hata++;
    console.log(`✗ ${mesaj}`);
  } else console.log(`✓ ${mesaj}`);
};

await sayfa.goto(`${TABAN}/dashboard/literature?calisma=${TEZ}`, { waitUntil: "networkidle", timeout: 150000 });
bekle(new URL(sayfa.url()).searchParams.get("calisma") === TEZ && (await sayfa.locator("ul.calisma-secim-listesi").count()) === 0, "sayfa çalışmanın listesiyle açıldı (seçici değil)");
const panel = () => sayfa.locator(".drawer-root.open[data-boy='yan']");
const ac = async (baslik) => {
  await sayfa.locator(".kaynak-ad", { hasText: baslik }).click();
  await panel().waitFor({ state: "visible", timeout: 10000 });
};

// 1) Künye ve not düzenleme → kaydet → panel ve liste yeni değeri gösterir
await ac("Inflation");
await panel().getByRole("button", { name: "Düzenle" }).click();
await panel().locator("input[name=year]").fill("2018");
await panel().locator("input[name=containerTitle]").fill("Journal of Macroeconomics");
await panel().locator("input[name=volume]").fill("41");
await panel().locator("textarea[name=notes]").fill("Gelişmekte olan ülkeler karşılaştırması; tartışma bölümü.");
await panel().locator("button[type=submit]", { hasText: "Kaydet" }).click();
await sayfa.locator(".toast.is-success").waitFor({ state: "visible", timeout: 15000 });
await sayfa.waitForTimeout(1500);
bekle((await panel().locator("[name=year]").count()) === 0, "kaydedince form kapanır");
const kunye = (await panel().locator("section[aria-labelledby$='-kunye']").textContent()).replace(/\s+/g, " ");
bekle(/Yıl\s*2018/.test(kunye), `panelde yeni yıl: ${kunye.slice(0, 160)}`);
bekle(/Journal of Macroeconomics/.test(kunye) && /Cilt 41/.test(kunye), "panelde dergi ve cilt");
const not = await panel().locator("section[aria-labelledby$='-not']").textContent();
bekle(/Gelişmekte olan ülkeler/.test(not), "panelde not");
await sayfa.keyboard.press("Escape");
const satir = (await sayfa.locator(".kaynak-satiri", { hasText: "Inflation" }).textContent()).replace(/\s+/g, " ");
bekle(/2018/.test(satir) && /Journal of Macroeconomics/.test(satir), "listedeki satır da güncel");

// 2) Sayfa yeniden yüklenince değer kalır (sunucudan okunur, istemci önbelleği değil)
await sayfa.reload({ waitUntil: "networkidle" });
bekle(new URL(sayfa.url()).searchParams.get("calisma") === TEZ, "yeniden yüklemede çalışma adreste kaldı");
await ac("Inflation");
const yeniden = (await panel().locator("section[aria-labelledby$='-kunye']").textContent()).replace(/\s+/g, " ");
bekle(/Yıl\s*2018/.test(yeniden), "yeniden yüklemede değer kalıcı");

// 3) Başlıksız kayıt reddedilir, kayıt değişmez
await panel().getByRole("button", { name: "Düzenle" }).click();
await panel().locator("input[name=title]").fill(" ");
await panel().locator("button[type=submit]", { hasText: "Kaydet" }).click();
await sayfa.waitForTimeout(1500);
bekle((await panel().locator("[name=title]").count()) === 1, "başlıksız kayıtta form açık kalır (tarayıcı doğrulaması ya da sunucu hatası)");
await panel().getByRole("button", { name: "Vazgeç" }).click();

console.log(hata ? `\n${hata} denetim düştü` : "\nYazma akışları temiz");
await tarayici.close();
process.exit(hata ? 1 : 0);
