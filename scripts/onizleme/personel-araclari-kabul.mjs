/*
  PHASE 5.1d-3 TARAYICI KABULÜ: sade kenar çubuğu ve hesap menüsündeki
  "Personel Araçları".

  Kurum sahibinin kararı (14.11.2026): kenar çubuğunda yalnızca akademik
  uygulamalar; "Diğer" grubu ve bağımsız Ayarlar kalktı. Ayarlar,
  Kullanım Kılavuzu, Abonelik ve Destek hesap menüsünde; telefonda
  "Daha fazla"da da kalır. Personel araçları yalnızca rolüne açık olana,
  yalnızca hesap menüsünde.

  Menüde görünmemek bir ERİŞİM yasağı değildir; bu betik görünürlüğü
  sınar, yetkiyi değil (sayfalar kendi sunucu kapısını uygular).

  Rol sunucunun ONIZLEME_ROL'üyle belirlenir (scripts/onizleme/veri.ts);
  betiğe aynı rol verilir:
    node scripts/onizleme/personel-araclari-kabul.mjs [taban] [client|employee|system_admin]
  CI'da DEĞİL. Bir senaryo düşerse çıkış kodu 1.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const ROL = process.argv[3] ?? "client";
const PERSONEL = {
  client: [],
  employee: [["Doçentlik Puanı", "/dashboard/associate-professorship"]],
  system_admin: [["Doçentlik Puanı", "/dashboard/associate-professorship"], ["Asistan Kayıtları", "/dashboard/asistan"], ["Ekip Yönetimi", "/dashboard/team"]],
}[ROL];
if (!PERSONEL) throw new Error(`bilinmeyen rol: ${ROL}`);
const PERSONEL_ADRESLERI = ["/dashboard/associate-professorship", "/dashboard/asistan", "/dashboard/team"];
const HESAP = ["Ayarlar", "Kullanım Kılavuzu", "Abonelik ve Kredi", "Destek"];
const DAHA = ["Belge Kontrol", "Destek", "Ayarlar", "Kullanım Kılavuzu", "Abonelik ve Kredi"];

const sonuclar = [];
async function senaryo(ad, govde) {
  try {
    const not = await govde();
    sonuclar.push({ ad, tamam: true, not });
  } catch (hata) {
    sonuclar.push({ ad, tamam: false, neden: String(hata?.message ?? hata).split("\n")[0].slice(0, 600) });
  }
}
function bekle(kosul, mesaj) {
  if (!kosul) throw new Error(mesaj);
}
const tarayici = await chromium.launch();

async function sayfaAc({ w, h, dar, tema = "light", yol = "/dashboard" }) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: h }, colorScheme: tema });
  await ctx.addInitScript((dar) => {
    try {
      if (!sessionStorage.getItem("kabul-kuruldu")) {
        sessionStorage.setItem("kabul-kuruldu", "1");
        if (dar) localStorage.setItem("arvolab.gezinme.dar", "1"); else localStorage.removeItem("arvolab.gezinme.dar");
      }
    } catch {}
  }, dar);
  await ctx.addInitScript(() => {
    const gizle = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
    if (document.documentElement) gizle(); else document.addEventListener("DOMContentLoaded", gizle);
  });
  const sayfa = await ctx.newPage();
  const hatalar = [];
  sayfa.on("pageerror", (e) => hatalar.push(String(e).slice(0, 160)));
  sayfa.on("console", (m) => { if (m.type() === "error" && /hydrat/i.test(m.text())) hatalar.push(m.text().slice(0, 160)); });
  await sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 150000 });
  return { ctx, sayfa, hatalar };
}

/** Kenar çubuğunda / rayda / alt çubukta GÖRÜNEN gezinme bağlantıları (logo ve hesap menüsü hariç). */
const gezinmeAdresleri = (s) =>
  s.evaluate(() =>
    [...document.querySelectorAll("nav.os-gezinme a")]
      .filter((a) => !a.closest(".os-kullanici") && !a.classList.contains("os-gezinme-logo") && a.checkVisibility())
      .map((a) => a.getAttribute("href")),
  );
async function dahaListesi(s) {
  await s.locator(".os-gezinme-daha").filter({ visible: true }).first().click();
  await s.waitForFunction(() => document.querySelector("dialog.os-daha")?.open);
  const liste = await s.evaluate(() => [...document.querySelectorAll("dialog.os-daha .os-daha-liste a")].map((a) => [a.textContent.trim(), a.getAttribute("href")]));
  await s.keyboard.press("Escape");
  return liste;
}
async function hesapMenusu(s) {
  await s.locator("details.os-kullanici > summary").filter({ visible: true }).first().click();
  return s.evaluate(() => {
    const m = document.querySelector("details.os-kullanici[open] .os-kullanici-menu");
    const navlar = [...m.querySelectorAll("nav.os-kullanici-baglantilar")];
    const linkler = (n) => [...n.querySelectorAll("a")].map((a) => [a.textContent.trim(), a.getAttribute("href")]);
    const hesap = navlar.find((n) => n.getAttribute("aria-label") === "Hesap");
    const personel = navlar.find((n) => n.getAttribute("aria-label") === "Personel Araçları");
    return {
      hesap: hesap ? linkler(hesap) : null,
      personel: personel ? linkler(personel) : null,
      baslik: personel?.querySelector(".os-kullanici-bolum")?.textContent.trim() ?? null,
    };
  });
}
const etiketler = (l) => l.map(([e]) => e);

await senaryo(`[${ROL}] 1366 açık: kenar çubuğunda yalnızca akademik uygulamalar; Diğer, Ayarlar, personel yok; boş ayraç yok`, async () => {
  const { ctx, sayfa, hatalar } = await sayfaAc({ w: 1366, h: 800 });
  const adresler = await gezinmeAdresleri(sayfa);
  const beklenen = ["/dashboard", "/dashboard/editor", "/dashboard/literature", "/dashboard/analysis", "/dashboard/documents", "/dashboard/expert-requests"];
  bekle(JSON.stringify(adresler) === JSON.stringify(beklenen), `kenar çubuğu: ${adresler.join(", ")}`);
  const durum = await sayfa.evaluate(() => ({
    diger: document.querySelectorAll(".os-gezinme-grup, #os-gezinme-diger").length,
    son: document.querySelector(".os-gezinme-son")?.checkVisibility() ?? false,
  }));
  bekle(!durum.diger && !durum.son, JSON.stringify(durum));
  bekle(!hatalar.length, hatalar.join(" | "));
  await ctx.close();
  return `${adresler.length} bağlantı`;
});

for (const d of [
  { ad: "1366 dar", w: 1366, h: 800, dar: true },
  { ad: "1024 tablet", w: 1024, h: 768 },
  { ad: "390 telefon", w: 390, h: 844 },
]) {
  await senaryo(`[${ROL}] ${d.ad}: Ayarlar ve personel araçları gezinmede yok; Daha fazla hesap sayfalarını korur, personeli göstermez`, async () => {
    const { ctx, sayfa, hatalar } = await sayfaAc(d);
    const adresler = await gezinmeAdresleri(sayfa);
    bekle(!adresler.includes("/dashboard/settings"), `gezinmede Ayarlar: ${adresler.join(", ")}`);
    bekle(!adresler.some((a) => PERSONEL_ADRESLERI.includes(a)), `gezinmede personel: ${adresler.join(", ")}`);
    const daha = await dahaListesi(sayfa);
    bekle(JSON.stringify(etiketler(daha)) === JSON.stringify(DAHA), `Daha fazla: ${etiketler(daha).join(", ")}`);
    bekle(!daha.some(([, h]) => PERSONEL_ADRESLERI.includes(h)), "Daha fazla'da personel");
    if (d.w === 390) {
      const cubuk = await sayfa.evaluate(() => [...document.querySelectorAll("nav.os-gezinme .os-gezinme-kisa")].filter((e) => e.checkVisibility()).map((e) => e.textContent.trim()));
      bekle(JSON.stringify(cubuk) === JSON.stringify(["Ana Sayfa", "Çalışmalar", "Kaynaklar", "Analiz", "Daha fazla"]), `alt çubuk: ${cubuk.join(", ")}`);
    }
    bekle(!hatalar.length, hatalar.join(" | "));
    await ctx.close();
    return `Daha fazla: ${daha.length} öğe`;
  });
}

for (const d of [
  { ad: "1366 açık (kenar)", w: 1366, h: 800 },
  { ad: "1366 dar (üst)", w: 1366, h: 800, dar: true },
  { ad: "390 telefon (üst)", w: 390, h: 844 },
]) {
  await senaryo(`[${ROL}] ${d.ad}: hesap menüsü merkezi listeden; Personel Araçları yalnızca rolüne açık olanlar`, async () => {
    const { ctx, sayfa } = await sayfaAc(d);
    const m = await hesapMenusu(sayfa);
    bekle(m.hesap && JSON.stringify(etiketler(m.hesap)) === JSON.stringify(HESAP), `hesap: ${m.hesap && etiketler(m.hesap).join(", ")}`);
    if (PERSONEL.length) {
      bekle(m.baslik === "Personel Araçları", `başlık: ${m.baslik}`);
      bekle(JSON.stringify(m.personel) === JSON.stringify(PERSONEL), `personel: ${JSON.stringify(m.personel)}`);
    } else {
      bekle(m.personel === null && m.baslik === null, `öğrencide Personel Araçları görünmemeli: ${JSON.stringify(m)}`);
    }
    await ctx.close();
    return PERSONEL.length ? `personel: ${etiketler(m.personel).join(", ")}` : "Personel Araçları yok";
  });
}

if (PERSONEL.length) {
  await senaryo(`[${ROL}] Personel Araçları bağlantısı doğru sayfaya gider, menü kapanır`, async () => {
    const { ctx, sayfa } = await sayfaAc({ w: 1366, h: 800 });
    await sayfa.locator("details.os-kullanici > summary").filter({ visible: true }).first().click();
    const [ad, href] = PERSONEL.at(-1);
    await sayfa.locator("details.os-kullanici[open] nav[aria-label='Personel Araçları']").getByRole("link", { name: ad }).click();
    await sayfa.waitForURL((u) => u.pathname === href, { timeout: 60000 });
    const acik = await sayfa.evaluate(() => Boolean(document.querySelector("details.os-kullanici[open]")));
    bekle(!acik, "menü açık kaldı");
    await ctx.close();
    return `${ad} → ${href}`;
  });
}

await senaryo(`[${ROL}] koyu tema: hesap menüsü ve Personel Araçları başlığı okunur (sayfa hatası yok)`, async () => {
  const { ctx, sayfa, hatalar } = await sayfaAc({ w: 1366, h: 800, tema: "dark" });
  const m = await hesapMenusu(sayfa);
  const tema = await sayfa.evaluate(() => document.documentElement.dataset.theme);
  bekle(m.hesap?.length === HESAP.length, JSON.stringify(m));
  if (PERSONEL.length) {
    const renk = await sayfa.evaluate(() => {
      const b = document.querySelector("details.os-kullanici[open] .os-kullanici-bolum");
      return b ? [getComputedStyle(b).color, getComputedStyle(b).fontSize] : null;
    });
    bekle(renk && parseFloat(renk[1]) >= 11, `başlık: ${renk}`);
  }
  bekle(!hatalar.length, hatalar.join(" | "));
  await ctx.close();
  return `tema=${tema}`;
});

await tarayici.close();
let dusen = 0;
for (const s of sonuclar) {
  console.log(`${s.tamam ? "PASS" : "FAIL"}  ${s.ad}${s.tamam ? (s.not ? `  — ${s.not}` : "") : `\n      → ${s.neden}`}`);
  if (!s.tamam) dusen++;
}
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} PASS`);
process.exit(dusen ? 1 : 0);
