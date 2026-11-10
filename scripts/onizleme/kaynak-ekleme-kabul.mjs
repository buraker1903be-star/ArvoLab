/*
  KAYNAK EKLEME KABULÜ (A1, 07.11.2026) — ortak DOI ve tekrar kuralı uçtan uca.

  Sınanan (kural lib/kaynak-ekleme.ts, kapsam lib/kaynak-kapsami.ts):
    1. Elle ekleme: aynı DOI farklı yazımla ("doi: 10.0000/ORNEK.2")
       REDDEDİLİR, liste büyümez (eskiden uyarıyla ikinci kez ekleniyordu).
    2. Elle ekleme: yeni DOI eklenir.
    3. Elle ekleme: DOI'siz, yalnızca başlık + yıl eşleşmesi UYARIYLA eklenir.
    4. Editör atıf penceresi ("Yeni kaynak"): aynı DOI YENİ SATIR AÇMAZ,
       atıf mevcut kaynağa yapılır (eskiden her seferinde yeni kayıt açıyordu).
  Sınanmayan (önizleme ağı kapalı): DOI listesi ve arama sonucundan ekleme
  dış dizine gidiyor; onların kuralı birim testlerinde
  (tests/unit/kaynak-ekleme.test.ts, doi.test.ts). Yetki ve abonelik
  veritabanında: tests/db/kaynak-ekleme.test.mjs.

  ÖNKOŞUL: yazma kipi ve TEMİZ veri (betik veriyi değiştirir):
    ONIZLEME_YAZ=1 npm run onizleme      (ya da onizleme:ai)
    NODE_PATH=$(npm root -g) node scripts/onizleme/kaynak-ekleme-kabul.mjs [taban-adres]
  Çıkış: 0 temiz, 1 bir denetim düştü.
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("kaynak-ekleme-kabul", TABAN, "varsayilan");
const TEZ = "00000000-0000-4000-8000-0000000000b1"; // önizleme tezi; l3 kaynağının DOI'si 10.0000/ornek.2 (scripts/onizleme/veri.ts)
let hata = 0;
const bekle = (kosul, mesaj) => {
  if (!kosul) hata++;
  console.log(`${kosul ? "✓" : "✗"} ${mesaj}`);
};

const tarayici = await chromium.launch();
const sayfa = await tarayici.newPage({ viewport: { width: 1440, height: 900 } });
const kaynaklar = async () => {
  await sayfa.goto(`${TABAN}/dashboard/literature?calisma=${TEZ}`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.locator(".kaynak-satiri").first().waitFor({ timeout: 30000 });
  return sayfa.locator(".kaynak-satiri").count();
};

/* Elle ekleme formunu doldurur, gönderir; hata metnini ya da bildirimi döner. */
async function elleEkle(alanlar) {
  await sayfa.locator(".kaynak-bul-tetik").first().click();
  await sayfa.getByRole("button", { name: "Manuel kaynak ekle" }).click();
  // Sayfada aynı alanları taşıyan gizli düzenleme formları da var: yalnızca görünen form.
  const form = sayfa.locator("form:visible", { has: sayfa.locator('input[name="doiOrUrl"]') }).last();
  await form.waitFor({ state: "visible", timeout: 10000 });
  for (const [ad, deger] of Object.entries(alanlar)) await form.locator(`input[name="${ad}"]`).fill(deger);
  await form.locator('button[type="submit"]').click();
  const sonuc = await Promise.race([
    form.locator(".action-form-error").waitFor({ timeout: 15000 }).then(async () => ({ tur: "hata", metin: (await form.locator(".action-form-error").textContent()).trim() })),
    sayfa.locator(".toast").last().waitFor({ timeout: 15000 }).then(async () => ({ tur: "bildirim", sinif: await sayfa.locator(".toast").last().getAttribute("class"), metin: (await sayfa.locator(".toast").last().textContent()).trim() })),
  ]).catch(() => ({ tur: "yok" }));
  return sonuc;
}

// 1) aynı DOI, farklı yazım → reddedilir
const n0 = await kaynaklar();
let s = await elleEkle({ title: "Aynı DOI'li ikinci kayıt", year: "2001", doiOrUrl: "doi: 10.0000/ORNEK.2" });
bekle(s.tur === "hata" && /zaten var/.test(s.metin), `aynı DOI (farklı yazım) reddedildi: ${s.metin ?? s.tur}`);
bekle((await kaynaklar()) === n0, `liste büyümedi (${n0})`);

// 2) yeni DOI → eklenir
s = await elleEkle({ title: "A1 yeni DOI'li kaynak", year: "2024", doiOrUrl: "https://doi.org/10.0000/a1.yeni" });
bekle(s.tur === "bildirim" && /is-success|success/.test(s.sinif ?? ""), `yeni DOI eklendi: ${s.metin ?? s.tur}`);
const n1 = await kaynaklar();
bekle(n1 === n0 + 1, `liste bir arttı (${n0} → ${n1})`);

// 3) yalnızca başlık + yıl → uyarıyla eklenir
s = await elleEkle({ title: "Türkiye'de Phillips eğrisinin istikrarı", year: "2009", doiOrUrl: "" });
bekle(s.tur === "bildirim" && /Olası tekrar|Possible duplicates/.test(s.metin), `başlık + yıl eşleşmesi uyarıyla eklendi: ${s.metin ?? s.tur}`);
const n2 = await kaynaklar();
bekle(n2 === n1 + 1, `liste bir arttı (${n1} → ${n2})`);

// 4) editör atıf penceresi: aynı DOI yeni satır açmaz, atıf mevcut kaynağa
{
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 150000 });
  const pm = sayfa.locator(".ProseMirror");
  await pm.waitFor({ timeout: 30000 });
  await pm.evaluate((e) => {
    const ps = e.querySelectorAll("p");
    const son = ps[ps.length - 1];
    const r = document.createRange();
    r.selectNodeContents(son);
    r.collapse(false);
    const se = getSelection();
    se.removeAllRanges();
    se.addRange(r);
    e.focus();
  });
  const once = await pm.evaluate((e) => e.innerHTML);
  const pesaranOnce = (once.match(/Pesaran/g) ?? []).length;
  await sayfa.locator('.manuscript-araclar [aria-label="Kaynaktan atıf ekle"], .manuscript-araclar [title="Kaynaktan atıf ekle"]').first().click();
  const pencere = sayfa.locator(".drawer-root.open [role=dialog]").last();
  await pencere.waitFor({ state: "visible", timeout: 15000 });
  await pencere.getByRole("tab", { name: "Yeni kaynak" }).click();
  await pencere.getByLabel("DOI").fill("https://doi.org/10.0000/ORNEK.2");
  await pencere.locator("input[required]").first().fill("Pencereden yazılan başka bir başlık");
  await pencere.getByRole("button", { name: "Kaydet ve atıf ekle" }).click();
  await sayfa.waitForTimeout(1500);
  const sonra = await pm.evaluate((e) => e.innerHTML);
  bekle(sonra !== once, "atıf belgeye eklendi");
  bekle((sonra.match(/Pesaran/g) ?? []).length > pesaranOnce, "atıf MEVCUT kaynağa yapıldı (Pesaran, 2001), pencereye yazılan başlığa değil");
  const n3 = await kaynaklar();
  bekle(n3 === n2, `editörden aynı DOI yeni kaynak açmadı (${n2} → ${n3})`);
  bekle((await sayfa.locator(".kaynak-ad", { hasText: "Pencereden yazılan" }).count()) === 0, "pencereye yazılan başlıkla kayıt yok");
}

await tarayici.close();
console.log(hata ? `\n${hata} denetim düştü` : "\nKaynak ekleme kabulü temiz");
process.exit(hata ? 1 : 0);
