/*
  DOI KOTASI KABULÜ (07.11.2026) — tarayıcıdan, önizleme verisiyle.

  Sınanan (kural lib/doi-sorgu.ts, lib/toplu-doi.ts, lib/dizin-kotasi*.ts):
    1. Kaynaklar, tek DOI kutusu: çalışmada zaten olan DOI (farklı yazımla)
       "zaten var" der, dış istek ve hak denemesi YOK.
    2. Aynı kutu, dışarı gidecek DOI: önizleme ağı kapalı; ayırt edilebilir
       "Crossref'e ulaşılamadı" mesajı ve "Yeniden dene" düğmesi.
    3. İçe aktar → DOI listesi: başlamadan önce olası hak tüketimi
       (dışarı gidecek sayı, kütüphanedeki sayı, ortak 60 hak); tekrar
       eden DOI tek sayılır; sonuçta "zaten listede" ve nedenli hata ayrı.
    4. Editör atıf penceresi: kütüphanedeki DOI ile "Getir" → künye
       KÜTÜPHANEDEN dolar (başlık "ARDL sınır testi yaklaşımı"); geçersiz
       DOI ayrı mesaj.
  Hak denemesi sunucu günlüğünden sayılır: önizlemede sayaç (servis
  anahtarı) yok ve üretim dışı olduğu için her deneme "[dizin-kotasi]
  üretim dışı ortam" uyarısı yazar (lib/dizin-kotasi.ts). Kütüphaneden
  karşılanan ve geçersiz sorgular bu sayıyı ARTIRMAMALI.

  Sınanmayan (önizlemede mümkün değil): gerçek sayaçla 60 sınırı, üretimde
  fail-closed ve aboneliği bitmiş kullanıcı — birim testlerinde
  (tests/unit/doi-sorgu.test.ts, toplu-doi.test.ts, dizin-kotasi.test.ts)
  ve veritabanında (tests/db/dizin-kotasi.test.mjs).

  ÖNKOŞUL: yazma kipi, TEMİZ veri, sunucu günlüğü bir dosyada:
    ONIZLEME_YAZ=1 npm run onizleme:ai > <gunluk> 2>&1
    NODE_PATH=$(npm root -g) node scripts/onizleme/doi-kotasi-kabul.mjs <gunluk> [taban-adres]
  Çıkış: 0 temiz, 1 bir denetim düştü.
*/
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const GUNLUK = process.argv[2];
const TABAN = process.argv[3] ?? "http://localhost:3123";
if (!GUNLUK) {
  console.error("Sunucu günlüğünün yolu gerekli (bkz. dosya başı).");
  process.exit(2);
}
const TEZ = "00000000-0000-4000-8000-0000000000b1"; // l3 kaynağının DOI'si 10.0000/ornek.2 (scripts/onizleme/veri.ts)
let hata = 0;
const bekle = (kosul, mesaj) => {
  if (!kosul) hata++;
  console.log(`${kosul ? "✓" : "✗"} ${mesaj}`);
};
const hakDenemesi = () => (fs.readFileSync(GUNLUK, "utf8").match(/\[dizin-kotasi\] üretim dışı ortam/g) ?? []).length;

const tarayici = await chromium.launch();
const sayfa = await tarayici.newPage({ viewport: { width: 1440, height: 900 } });
const kaynaklar = async () => {
  await sayfa.goto(`${TABAN}/dashboard/literature?calisma=${TEZ}`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.locator(".kaynak-satiri").first().waitFor({ timeout: 30000 });
};
const kutuDurumu = async (doi) => {
  const kutu = sayfa.locator("form.doi-kutusu");
  await kutu.locator("input").fill(doi);
  await kutu.locator('button[type="submit"]').first().click();
  const durum = kutu.locator("#doi-kutusu-durum p:not([data-tone='neutral'])");
  await durum.first().waitFor({ timeout: 30000 });
  return { metin: (await durum.first().textContent()).trim(), ton: await durum.first().getAttribute("data-tone"), kutu };
};

// 1) tek DOI kutusu, kütüphanedeki DOI
await kaynaklar();
let h0 = hakDenemesi();
let s = await kutuDurumu("doi: 10.0000/ORNEK.2");
bekle(/zaten var/.test(s.metin), `kütüphanedeki DOI "zaten var": ${s.metin}`);
bekle(hakDenemesi() === h0, `hak denemesi yok (${h0} → ${hakDenemesi()})`);

// 2) dışarı gidecek DOI: ağ kapalı → ayrı mesaj
h0 = hakDenemesi();
s = await kutuDurumu("10.9999/kabul.dis");
bekle(s.ton === "danger" && /Crossref'e ulaşılamadı|Crossref/.test(s.metin), `dış servis hatası ayrı mesajla: ${s.metin}`);
bekle(!/hakkınız doldu|Abonelik/i.test(s.metin), "kota ya da abonelik mesajıyla karışmıyor");
bekle((await s.kutu.getByRole("button", { name: "Yeniden dene" }).count()) === 1, "geçici hatada 'Yeniden dene' düğmesi var");
bekle(hakDenemesi() === h0 + 1, `bir hak denemesi (${h0} → ${hakDenemesi()})`);

// 3) toplu DOI: ön bilgi, tekilleştirme, sonuçlar
{
  await kaynaklar();
  await sayfa.getByRole("button", { name: "İçe aktar" }).first().click();
  const pencere = sayfa.locator(".drawer-root.open [role=dialog]").last();
  await pencere.waitFor({ state: "visible", timeout: 15000 });
  await pencere.getByLabel("DOI listesi").fill("10.0000/ornek.2\nhttps://doi.org/10.0000/ORNEK.2\n10.9999/kabul.a\n10.9999/KABUL.A\n10.9999/kabul.b");
  const onBilgi = (await pencere.locator("p.hint[role=status]").textContent()).trim();
  bekle(/^2 DOI Crossref'e sorulacak: en çok 2 dizin hakkı/.test(onBilgi), `ön bilgi: dışarı 2 (tekrarlar tek): ${onBilgi.slice(0, 70)}…`);
  bekle(/1 DOI bu çalışmada zaten var, hak harcamaz/.test(onBilgi), "ön bilgi: kütüphanedeki 1 DOI hak harcamaz");
  bekle(/Saatlik 60 hak .*ortaktır; hak biterse işlem durur/.test(onBilgi), "ön bilgi: ortak 60 hak ve durma kuralı");
  const dugme = pencere.getByRole("button", { name: /3 DOI'yi ekle/ });
  bekle((await dugme.count()) === 1, "düğme tekilleşmiş sayıyı gösteriyor (3)");
  h0 = hakDenemesi();
  await dugme.click();
  const satirlar = pencere.locator("ul.secim-listesi li small.tone-text");
  await satirlar.first().waitFor({ timeout: 60000 });
  const metinler = await satirlar.allTextContents();
  bekle(metinler.length === 3, `üç sonuç satırı (${metinler.length})`);
  bekle(/ornek\.2 · zaten listede/.test(metinler[0] ?? ""), `kütüphanedeki: ${metinler[0]}`);
  bekle(metinler.slice(1).every((m) => /Crossref'e ulaşılamadı \(zaman aşımı\)/.test(m)), `dışarı gidenler nedenli: ${metinler.slice(1).join(" | ")}`);
  bekle(hakDenemesi() === h0 + 2, `iki hak denemesi, kütüphanedeki ve tekrarlar hariç (${h0} → ${hakDenemesi()})`);
  await sayfa.keyboard.press("Escape");
}

// 4) editör atıf penceresi
{
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.locator(".ProseMirror").waitFor({ timeout: 30000 });
  await sayfa.locator('.manuscript-araclar [aria-label="Kaynaktan atıf ekle"], .manuscript-araclar [title="Kaynaktan atıf ekle"]').first().click();
  const pencere = sayfa.locator(".drawer-root.open [role=dialog]").last();
  await pencere.waitFor({ state: "visible", timeout: 15000 });
  await pencere.getByRole("tab", { name: "Yeni kaynak" }).click();
  const getir = async (doi) => {
    const sayi = await sayfa.locator(".toast").count();
    await pencere.getByLabel("DOI").fill(doi);
    await pencere.getByLabel("DOI").press("Enter");
    await sayfa.waitForFunction((n) => document.querySelectorAll(".toast").length > n, sayi, { timeout: 30000 });
    return (await sayfa.locator(".toast").last().textContent()).trim();
  };
  h0 = hakDenemesi();
  let t = await getir("https://doi.org/10.0000/ORNEK.2");
  bekle(/kütüphanenizde zaten var/.test(t), `kütüphaneden dolduruldu: ${t}`);
  bekle((await pencere.locator("input[required]").first().inputValue()) === "ARDL sınır testi yaklaşımı", "başlık kütüphanedeki kayıttan");
  bekle(hakDenemesi() === h0, `hak denemesi yok (${h0} → ${hakDenemesi()})`);
  t = await getir("bu bir doi değil");
  bekle(/Geçerli bir DOI girin/.test(t), `geçersiz DOI ayrı mesaj: ${t}`);
  bekle(hakDenemesi() === h0, "geçersiz DOI hak denemesi yapmadı");
}

await tarayici.close();
console.log(hata ? `\n${hata} denetim düştü` : "\nDOI kotası kabulü temiz");
process.exit(hata ? 1 : 0);
