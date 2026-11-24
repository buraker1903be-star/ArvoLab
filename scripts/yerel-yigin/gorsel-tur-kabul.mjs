// GÖRSEL TUR KABULÜ (24.11.2026): kılavuz yükleme, hesap silme, hesap
// menüsü, pencere genişlikleri ve telefonda menüler.
//
// Ölçüm 1440 ve 390 px'te, açık ve koyu temada. Mobil klavye, görünümün
// yüksekliği klavyenin bıraktığı kadara indirilerek TAKLİT ediliyor
// (gerçek klavye tarayıcı otomasyonunda açılmıyor); ölçülen şey, kutu
// odaktayken eylem satırına erişilip erişilemediği.
//
// Kullanım: node scripts/yerel-yigin/gorsel-tur-kabul.mjs <uygulama> [görüntü-dizini]
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const KOK = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(`${KOK}/package.json`);
const { chromium } = require("playwright");
const UYG = process.argv[2] ?? "http://localhost:3141";
const GORSEL = process.argv[3] ?? null;
if (GORSEL) fs.mkdirSync(GORSEL, { recursive: true });
const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const govdeli = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "yerel", iat: 1763200000, exp: 2079000000, role: "service_role" })}`;
const SERVIS = `${govdeli}.${crypto.createHmac("sha256", SIR).update(govdeli).digest("base64url")}`;
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8",
  }).trim();
const q = (x) => `'${String(x).replace(/'/g, "''")}'`;
const auth = async (yol, gv, m = "POST") => {
  const r = await fetch(`${GECIT}/auth/v1${yol}`, {
    method: m, headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/json" },
    body: JSON.stringify(gv),
  });
  return { d: r.status, j: await r.json().catch(() => ({})) };
};

const BUILD_ID = fs.existsSync(`${KOK}/.next/BUILD_ID`) ? fs.readFileSync(`${KOK}/.next/BUILD_ID`, "utf8").trim() : null;
const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { cwd: KOK, encoding: "utf8" }).trim();
try {
  const html = await (await fetch(`${UYG}/`)).text();
  if (!BUILD_ID || !html.includes(BUILD_ID)) throw new Error(`BUILD_ID (${BUILD_ID ?? "yok"}) sunulan sayfada yok`);
  if ((await fetch(`${GECIT}/auth/v1/health`)).status !== 200) throw new Error("geçit yanıt vermiyor");
} catch (e) { console.error("Ön koşul yok:", e.message); process.exit(2); }

const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");
const adres = `gorsel-${ek}@yerel.test`, parola = `Gr7!${crypto.randomBytes(9).toString("base64url")}`;
const yeni = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: "Gorsel Denegi" } });
if (yeni.d >= 300) { console.error("kullanıcı kurulamadı", yeni); process.exit(2); }
const KULLANICI = yeni.j.id;
await auth(`/admin/users/${KULLANICI}`, { password: parola }, "PUT");
psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
      values (${q(KULLANICI)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
const PROJE = psql(`insert into public.academic_projects (owner_id, project_type, title, citation_style)
  values (${q(KULLANICI)}, 'thesis', 'Gorsel calismasi', 'apa7') returning id`).split("\n")[0];
psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, container_title, volume, issue, pages, source_type, status)
  values (${q(KULLANICI)}, ${q(PROJE)}, 'Ogrenme stilleri', 'Yilmaz, A.', 2020, 'Dergi', '8', '1', '10-25', 'article', 'used')`);
const ICERIK = { type: "doc", content: [
  { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giris" }] },
  { type: "paragraph", content: [{ type: "text", text: "Ogrenme stilleri (Yilmaz, 2020) ele alinir." }] },
] };
psql(`insert into public.project_manuscripts (project_id, content, plain_text, word_count, updated_by)
      values (${q(PROJE)}, ${q(JSON.stringify(ICERIK))}::jsonb, 'Giris', 1, ${q(KULLANICI)})`);

const sonuclar = [];
const yaz = (ad, ekran, tema, gecti, ayrinti) => {
  sonuclar.push({ ad, ekran, tema, gecti, ayrinti });
  console.log(`${gecti ? "GEÇTİ " : "KALDI "} ${String(ekran).padEnd(4)} ${tema.padEnd(5)} ${ad.padEnd(46)} ${ayrinti}`);
};
const tarayici = await chromium.launch({ args: ["--no-sandbox"] });
const pencereOlc = (s) => s.evaluate(() => {
  const kok = [...document.querySelectorAll(".drawer-root.open")].pop();
  const d = kok?.querySelector("section.drawer");
  if (!d) return null;
  const gv = d.querySelector(".drawer-body");
  const r = d.getBoundingClientRect();
  return {
    boy: kok.dataset.boy ?? "-", w: Math.round(r.width), h: Math.round(r.height),
    basliklar: [...d.querySelectorAll("h2, h3")].map((x) => x.textContent.trim()),
    icKaydirma: gv ? gv.scrollHeight - gv.clientHeight > 2 : null,
    ekraniAsiyor: r.width > window.innerWidth + 2,
  };
});

for (const [EKRAN, YUK, TEMA] of [[1440, 900, "light"], [1440, 900, "dark"], [390, 844, "light"], [390, 844, "dark"]]) {
  const ctx = await tarayici.newContext({ viewport: { width: EKRAN, height: YUK }, colorScheme: TEMA, locale: "tr-TR",
    ...(EKRAN < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
  const s = await ctx.newPage();
  await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
  await s.fill('input[name="email"]', adres);
  await s.fill('input[name="password"]', parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  const git = async (yol) => { await s.goto(`${UYG}${yol}`, { waitUntil: "domcontentloaded" }); await s.waitForLoadState("networkidle").catch(() => {}); };
  const resim = async (ad) => { if (GORSEL) await s.screenshot({ path: `${GORSEL}/${ad}-${EKRAN}-${TEMA}.png` }); };

  /* ---- K · Kılavuz yükleme ---- */
  await git(`/dashboard/editor/${PROJE}?kilavuz=1`);
  try {
    await s.waitForSelector(".drawer-root.open section.drawer", { timeout: 20000 });
    await s.waitForTimeout(400);
    const o = await pencereOlc(s);
    await resim("K1-kilavuz-secim");
    const tekBaslik = o.basliklar.filter((x) => /Kılavuzunuzu yükleyin/i.test(x)).length === 1;
    yaz("K1 · Kılavuz: tek başlık", EKRAN, TEMA, tekBaslik, `başlıklar=${JSON.stringify(o.basliklar)}`);
    yaz("K2 · Kılavuz: boy işe göre", EKRAN, TEMA, o.boy === "orta" && !o.ekraniAsiyor, `boy=${o.boy} ${o.w}×${o.h}`);
    const dugme = await s.locator(".drawer-root.open .dropzone .dropzone-dugme").count();
    const hamGirdiGorunur = await s.evaluate(() => {
      const g = document.querySelector(".drawer-root.open .dropzone input[type=file]");
      return g ? g.getClientRects().length > 0 && !g.classList.contains("sr-only") : null;
    });
    yaz("K3 · Birincil 'Dosya seç', ham girdi gizli", EKRAN, TEMA, dugme === 1 && hamGirdiGorunur === false, `düğme=${dugme} hamGörünür=${hamGirdiGorunur}`);
    /* Örnek atıf da bir .form-details: adres bölümü adıyla seçiliyor. */
    const adresVar = await s.locator(".drawer-root.open details.form-details summary", { hasText: /adres vereyim/i }).count();
    const devamVar = await s.locator(".drawer-root.open .kilavuz-atla a").count();
    yaz("K4 · Adres ve kılavuzsuz devam görünür", EKRAN, TEMA, adresVar === 1 && devamVar === 1, `adres=${adresVar} devam=${devamVar}`);
    const onayMetni = await s.locator(".drawer-root.open .kilavuz-ozet").innerText().catch(() => "");
    yaz("K5 · Metin onaydan sonra uygulandığını söyler", EKRAN, TEMA, /onay/i.test(onayMetni), `"${onayMetni.replace(/\s+/g, " ").slice(0, 64)}…"`);
  } catch (e) {
    for (const n of ["K1 · Kılavuz: tek başlık", "K2 · Kılavuz: boy işe göre", "K3 · Birincil 'Dosya seç', ham girdi gizli", "K4 · Adres ve kılavuzsuz devam görünür", "K5 · Metin onaydan sonra uygulandığını söyler"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 60)}`);
  }

  /* ---- H · Hesap silme ---- */
  await git("/dashboard/settings");
  try {
    await s.locator('li.ayar-satir:has(b:text-is("Hesabımı sil"))').locator("button").first().click();
    await s.waitForSelector(".drawer-root.open section.drawer", { timeout: 20000 });
    await s.waitForTimeout(400);
    const o = await pencereOlc(s);
    await resim("H1-hesap-silme");
    const sil = s.locator('.drawer-root.open button[type="submit"]');
    const silMetni = (await sil.innerText()).trim();
    const pasif = await sil.isDisabled();
    const vazgec = await s.locator(".drawer-root.open .project-form-actions button", { hasText: /Vazgeç/ }).count();
    const indir = await s.locator('.drawer-root.open a[href="/api/hesabim/verilerim"]').count();
    const govde = await s.locator(".drawer-root.open .drawer-body").innerText();
    yaz("H1 · Tek kompakt onay penceresi", EKRAN, TEMA, o.boy === "onay", `boy=${o.boy} ${o.w}×${o.h}`);
    yaz("H2 · Düğme 'Silme talebi oluştur' ve pasif", EKRAN, TEMA, /Silme talebi oluştur/.test(silMetni) && pasif, `"${silMetni}" pasif=${pasif}`);
    yaz("H3 · Vazgeç ve Verilerimi indir görünür", EKRAN, TEMA, vazgec === 1 && indir === 1, `vazgeç=${vazgec} indir=${indir}`);
    yaz("H4 · Kalıcı silmenin ne zaman olduğu yazıyor", EKRAN, TEMA, /30 gün dolunca/.test(govde) && !/Geri alınamaz/.test(govde), `30gün=${/30 gün dolunca/.test(govde)}`);
    /* E-posta eşleşince düğme açılıyor mu? */
    await s.locator('.drawer-root.open input[name="onay"]').fill(adres);
    await s.waitForTimeout(250);
    yaz("H5 · E-posta eşleşince düğme açılır", EKRAN, TEMA, !(await sil.isDisabled()), `pasif=${await sil.isDisabled()}`);
    /* Mobil klavye TAKLİDİ: görünüm yüksekliği klavyenin bıraktığı kadara iniyor. */
    if (EKRAN === 390) {
      await s.setViewportSize({ width: 390, height: 420 });
      await s.locator('.drawer-root.open input[name="onay"]').focus();
      await s.waitForTimeout(400);
      const erisilir = await s.evaluate(() => {
        const d = document.querySelector(".drawer-root.open .project-form-actions button[type=submit]");
        if (!d) return false;
        d.scrollIntoView({ block: "nearest" });
        const r = d.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.height >= 40;
      });
      await resim("H6-mobil-klavye");
      yaz("H6 · Klavye açıkken eylem erişilebilir (taklit)", EKRAN, TEMA, erisilir, `görünür=${erisilir} görünüm=390×420`);
      await s.setViewportSize({ width: 390, height: 844 });
    }
    await s.keyboard.press("Escape");
  } catch (e) {
    for (const n of ["H1 · Tek kompakt onay penceresi", "H2 · Düğme 'Silme talebi oluştur' ve pasif", "H3 · Vazgeç ve Verilerimi indir görünür", "H4 · Kalıcı silmenin ne zaman olduğu yazıyor", "H5 · E-posta eşleşince düğme açılır"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 60)}`);
  }

  /* ---- M · Hesap menüsü ---- */
  await git("/dashboard/editor");
  try {
    await s.locator("details.os-kullanici summary").filter({ visible: true }).first().click();
    await s.waitForTimeout(400);
    await resim("M1-hesap-menusu");
    const bilgi = await s.evaluate(() => {
      const d = [...document.querySelectorAll("details.os-kullanici")].find((x) => x.open);
      const menu = d?.querySelector(".os-kullanici-menu");
      const ozet = d?.querySelector(":scope > summary");
      const cikis = menu?.querySelector(".os-kullanici-cikis button");
      const kullanim = menu?.querySelector(".os-kullanici-kullanim");
      const r = menu.getBoundingClientRect();
      return {
        yerlesim: d.className.includes("--kenar") ? "kenar" : "ust",
        tetikteAdVar: Boolean(ozet?.querySelector(".os-kullanici-kimlik")),
        menudeKimlikVar: Boolean(menu?.querySelector(".os-kullanici-bas")),
        okVar: Boolean(menu?.querySelector(".os-kullanici-kullanim-ok")),
        kullanimAcik: kullanim?.open ?? null,
        ozetSatirda: (menu?.querySelector(".os-kullanici-kullanim-ozet")?.textContent ?? "").trim(),
        cikisRengi: cikis ? getComputedStyle(cikis).color : null,
        tehlikeRengi: getComputedStyle(document.documentElement).getPropertyValue("--danger").trim(),
        murekkep: getComputedStyle(document.documentElement).getPropertyValue("--ink").trim(),
        genislik: Math.round(r.width), sol: Math.round(r.left), sag: Math.round(window.innerWidth - r.right),
      };
    });
    const tekrarYok = bilgi.yerlesim === "kenar" ? !bilgi.menudeKimlikVar : bilgi.menudeKimlikVar;
    yaz("M1 · Kimlik tetikte varsa menüde tekrar yok", EKRAN, TEMA, tekrarYok,
        `yerleşim=${bilgi.yerlesim} tetikteAd=${bilgi.tetikteAdVar} menüdeKimlik=${bilgi.menudeKimlikVar}`);
    yaz("M2 · Kullanım satırı kapalı ve oklu", EKRAN, TEMA, bilgi.okVar && bilgi.kullanimAcik === false, `ok=${bilgi.okVar} açık=${bilgi.kullanimAcik}`);
    yaz("M3 · Kalan hak özeti satırda", EKRAN, TEMA, bilgi.ozetSatirda.length > 0, `"${bilgi.ozetSatirda}"`);
    const kirmiziDegil = bilgi.cikisRengi !== null && bilgi.tehlikeRengi.length > 0 && !bilgi.cikisRengi.includes("184, 60, 60");
    yaz("M4 · Çıkış nötr renkte", EKRAN, TEMA, kirmiziDegil, `renk=${bilgi.cikisRengi}`);
    yaz("M5 · Menü ekranı aşmıyor", EKRAN, TEMA, bilgi.sol >= 8 && bilgi.sag >= 8, `genişlik=${bilgi.genislik} sol=${bilgi.sol} sağ=${bilgi.sag}`);
    /* Ayrıntı açılınca hak adları görünüyor mu? */
  } catch (e) {
    for (const n of ["M1 · Kimlik tetikte varsa menüde tekrar yok", "M2 · Kullanım satırı kapalı ve oklu", "M3 · Kalan hak özeti satırda", "M4 · Çıkış nötr renkte", "M5 · Menü ekranı aşmıyor"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 60)}`);
  }
  try {
    await s.locator(".os-kullanici-kullanim > summary").filter({ visible: true }).first().click();
    await s.waitForTimeout(300);
    const hak = await s.locator(".os-kullanici-hak li").filter({ visible: true }).count();
    yaz("M6 · Ayrıntı açılınca haklar görünür", EKRAN, TEMA, hak > 0, `satır=${hak}`);
  } catch (e) { yaz("M6 · Ayrıntı açılınca haklar görünür", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 60)}`); }

  /* ---- P · Pencere genişlikleri: Kısayollar ---- */
  await git(`/dashboard/editor/${PROJE}/write`);
  try {
    await s.locator('button[aria-label^="Bul, odak modu"]').first().click();
    await s.locator('.arac-menu-pencere button[aria-label="Klavye kısayolları"]').click();
    await s.waitForSelector(".drawer-root.open section.drawer", { timeout: 20000 });
    await s.waitForTimeout(400);
    const o = await pencereOlc(s);
    await resim("P1-kisayollar");
    const beklenen = EKRAN === 1440 ? o.w > 900 : o.w <= EKRAN;
    yaz("P1 · Kısayollar içeriğine göre geniş", EKRAN, TEMA, beklenen && !o.ekraniAsiyor, `boy=${o.boy} ${o.w}×${o.h} iç=${o.icKaydirma}`);
    await s.keyboard.press("Escape");
  } catch (e) { yaz("P1 · Kısayollar içeriğine göre geniş", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 60)}`); }

  await ctx.close();
}
await tarayici.close();
const kaldi = sonuclar.filter((r) => !r.gecti);
if (GORSEL) fs.writeFileSync(`${GORSEL}/gorsel-kabul.json`, JSON.stringify({ head: HEAD, buildId: BUILD_ID, sonuclar }, null, 1));
console.log(`\n${sonuclar.length} kontrol · ${sonuclar.length - kaldi.length} geçti · ${kaldi.length} kaldı · HEAD ${HEAD.slice(0, 7)}`);
process.exit(kaldi.length ? 1 : 0);
