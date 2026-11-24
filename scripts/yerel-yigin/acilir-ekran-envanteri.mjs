// AÇILIR EKRANLARIN ENVANTERİ VE ÖLÇÜMÜ (24.11.2026) — tasarım incelemesi.
//
// Modal, onay penceresi, çekmece, açılır menü ve bilgi panelleri tek tek
// açılıp ÖLÇÜLÜYOR: başlık var mı, eylem sırası ne, taşma var mı, içeride
// kaydırma gerekiyor mu, Esc kapatıyor mu, odak açan düğmeye dönüyor mu.
// Ölçüm 1440 ve 390 genişlikte, açık ve koyu temada.
//
// Bu betik DEĞERLENDİRMEZ, yalnızca ölçer ve kaydeder: bulgular raporda.
//
// Kullanım: node scripts/yerel-yigin/acilir-ekran-envanteri.mjs http://localhost:3141 [görüntü-dizini]
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
const SUZGEC = process.env.SUZGEC ? new RegExp(process.env.SUZGEC, "i") : null;
const GECIT = "http://127.0.0.1:54401";
const SIR = "yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789";
const imzala = (y) => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const g = `${b({ alg: "HS256", typ: "JWT" })}.${b({ iss: "yerel", iat: 1763200000, exp: 2079000000, ...y })}`;
  return `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`;
};
const SERVIS = imzala({ role: "service_role" });
const psql = (sql) =>
  execFileSync("psql", ["-h", "127.0.0.1", "-p", "56432", "-U", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8",
  }).trim();
const q = (x) => `'${String(x).replace(/'/g, "''")}'`;
const auth = async (yol, govde, yontem = "POST") => {
  const r = await fetch(`${GECIT}/auth/v1${yol}`, {
    method: yontem, headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/json" },
    body: JSON.stringify(govde),
  });
  return { durum: r.status, json: await r.json().catch(() => ({})) };
};

const BUILD_ID = fs.existsSync(path.join(KOK, ".next/BUILD_ID")) ? fs.readFileSync(path.join(KOK, ".next/BUILD_ID"), "utf8").trim() : null;
const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { cwd: KOK, encoding: "utf8" }).trim();
try {
  const html = await (await fetch(`${UYG}/`)).text();
  if (!BUILD_ID || !html.includes(BUILD_ID)) { console.error(`Ön koşul yok: BUILD_ID (${BUILD_ID ?? "yok"}) eşleşmiyor`); process.exit(2); }
  if ((await fetch(`${GECIT}/auth/v1/health`)).status !== 200) throw new Error("geçit");
} catch (e) { console.error("Ön koşul yok:", e.message); process.exit(2); }

/* ---------- Sentetik kullanıcı ve veri ---------- */
const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");
const adres = `envanter-${ek}@yerel.test`, parola = `Ev7!${crypto.randomBytes(9).toString("base64url")}`;
const yeni = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: "Envanter Denegi" } });
if (yeni.durum >= 300) { console.error("kullanıcı kurulamadı", yeni); process.exit(2); }
const KULLANICI = yeni.json.id;
await auth(`/admin/users/${KULLANICI}`, { password: parola }, "PUT");
psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
      values (${q(KULLANICI)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
const PROJE = psql(`insert into public.academic_projects (owner_id, project_type, title, citation_style)
  values (${q(KULLANICI)}, 'thesis', 'Envanter calismasi', 'apa7') returning id`).split("\n")[0];
for (const [baslik, yazar, yil] of [["Ogrenme stilleri ve akademik basari", "Yilmaz, A.", 2020], ["Motivasyonun sinif ici rolu", "Demir, B.", 2019]]) {
  psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, container_title, volume, issue, pages, source_type, status)
    values (${q(KULLANICI)}, ${q(PROJE)}, ${q(baslik)}, ${q(yazar)}, ${yil}, 'Dergi', '8', '1', '10-25', 'article', 'used')`);
}
const KUNYELER = ["Yilmaz A 2020 Ogrenme stilleri ve akademik basari Dergi 8 1 10-25", "Demir B 2019 Motivasyonun sinif ici rolu Dergi 8 1 10-25"];
const GOVDE = "Ogrenme stilleri (Yilmaz, 2020) ve motivasyon (Demir, 2019) ele alinir.";
const ICERIK = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giris" }] },
    { type: "paragraph", content: [{ type: "text", text: GOVDE }] },
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Kaynakça" }] },
    ...KUNYELER.map((k) => ({ type: "paragraph", content: [{ type: "text", text: k }] })),
  ],
};
const DUZ = ["Giris", GOVDE, "", "Kaynakça", ...KUNYELER].join("\n");
psql(`insert into public.project_manuscripts (project_id, content, plain_text, word_count, updated_by)
      values (${q(PROJE)}, ${q(JSON.stringify(ICERIK))}::jsonb, ${q(DUZ)}, ${DUZ.split(/\s+/).length}, ${q(KULLANICI)})`);
psql(`insert into public.citation_checks (project_id, project_title, raw_reference_list, parsed_references, in_text_citations, cross_check, compliance_score, citation_style, created_by)
  values (${q(PROJE)}, 'Envanter', ${q(KUNYELER.join("\n"))},
    ${q(JSON.stringify(KUNYELER.map((raw) => ({ raw, authors: null, year: null, title: null, issues: [{ field: "year", message: "Yıl parantez içinde bulunamadı, örn: (2023).", severity: "error" }] }))))}::jsonb,
    '[]'::jsonb, '{}'::jsonb, 60, 'apa7', ${q(KULLANICI)})`);

/* ---------- Ölçüm ---------- */
const kayitlar = [];
const tarayici = await chromium.launch({ args: ["--no-sandbox"] });
const oturum = async (g, y, tema) => {
  const ctx = await tarayici.newContext({ viewport: { width: g, height: y }, colorScheme: tema, locale: "tr-TR", ...(g < 500 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
  const s = await ctx.newPage();
  await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
  await s.fill('input[name="email"]', adres);
  await s.fill('input[name="password"]', parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { ctx, s };
};

/** Açık pencereyi ölçer. */
const pencereOlc = async (s) =>
  s.evaluate(() => {
    const kok = [...document.querySelectorAll(".drawer-root.open")].pop();
    const d = kok?.querySelector("section.drawer");
    if (!d) return null;
    const govde = d.querySelector(".drawer-body");
    const eylemler = [...d.querySelectorAll(".project-form-actions button, .onay-eylemleri button, .drawer-body > .cluster button")]
      .map((b) => `${b.textContent.trim().slice(0, 28)}${b.className.includes("danger") ? " [tehlike]" : b.className.includes("primary") ? " [birincil]" : ""}`);
    const r = d.getBoundingClientRect();
    return {
      boy: kok.dataset.boy ?? (d.className.includes("drawer-compact") ? "compact(Dialog)" : "—"),
      genislik: Math.round(r.width),
      yukseklik: Math.round(r.height),
      baslik: d.querySelector(".drawer-header h2")?.textContent.trim().slice(0, 42) ?? null,
      aciklamaVar: Boolean(d.querySelector(".drawer-header p")),
      icKaydirma: govde ? govde.scrollHeight - govde.clientHeight > 2 : null,
      yatayTasma: d.scrollWidth - d.clientWidth > 2,
      ekraniAsiyor: r.height > window.innerHeight + 2 || r.width > window.innerWidth + 2,
      eylemler,
      kapatDugmesi: Boolean(d.querySelector(".drawer-close")),
    };
  });


/** Açık <details> menüsünü ölçer (drawer değil, akış içinde duran panel). */
const menuOlc = async (s, secici) =>
  s.evaluate((sec) => {
    const d = document.querySelector(sec);
    if (!d) return null;
    const panel = d.tagName === "DETAILS" ? (d.open ? [...d.children].find((c) => c.tagName !== "SUMMARY") : null) : d;
    if (!panel || panel.hidden) return null;
    const r = panel.getBoundingClientRect();
    const ogeler = [...panel.querySelectorAll("a, button")].map((b) => b.textContent.trim().slice(0, 30)).filter(Boolean);
    return {
      boy: "menu",
      genislik: Math.round(r.width),
      yukseklik: Math.round(r.height),
      baslik: panel.querySelector("h2, h3, strong, b")?.textContent.trim().slice(0, 42) ?? null,
      aciklamaVar: Boolean(panel.querySelector("p, small")),
      icKaydirma: panel.scrollHeight - panel.clientHeight > 2,
      yatayTasma: panel.scrollWidth - panel.clientWidth > 2,
      ekraniAsiyor: r.right > window.innerWidth + 2 || r.bottom > window.innerHeight + 2 || r.left < -2 || r.top < -2,
      eylemler: ogeler,
      kapatDugmesi: false,
      ogeSayisi: ogeler.length,
    };
  }, secici);

/** Bir pencereyi aç, ölç, Esc ve odak iadesini sına, kapat. */
const senaryo = async (s, ad, nerede, bilesen, ac, { tema, genislik, gorselAdi, menuSecici }) => {
  const olcum = { ad, nerede, bilesen, tema, ekran: genislik };
  try {
    await ac(s);
    if (menuSecici) {
      await s.waitForFunction((sec) => {
        const d = document.querySelector(sec);
        return d ? (d.tagName === "DETAILS" ? d.open === true : !d.hidden) : false;
      }, menuSecici, { timeout: 20000 });
      await s.waitForTimeout(300);
      Object.assign(olcum, await menuOlc(s, menuSecici));
    } else {
      const pencere = s.locator(".drawer-root.open section.drawer").last();
      await pencere.waitFor({ state: "visible", timeout: 20000 });
      await s.waitForTimeout(350);
      Object.assign(olcum, await pencereOlc(s));
    }
    if (GORSEL && gorselAdi) await s.screenshot({ path: `${GORSEL}/${gorselAdi}.png`, fullPage: false });
    /* Esc ve odak iadesi yalnızca masaüstü açık temada ölçülüyor (klavye yolu). */
    if (genislik >= 1000 && tema === "light") {
      const oncekiOdak = await s.evaluate(() => {
        const a = document.activeElement;
        return a ? `${a.tagName}:${(a.textContent ?? "").trim().slice(0, 20)}` : "yok";
      });
      await s.keyboard.press("Escape");
      await s.waitForTimeout(500);
      olcum.escKapatti = menuSecici
        ? await s.evaluate((sec) => {
            const d = document.querySelector(sec);
            return d ? (d.tagName === "DETAILS" ? d.open !== true : d.hidden === true) : true;
          }, menuSecici)
        : (await s.locator(".drawer-root.open").count()) === 0;
      olcum.odak = await s.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return "BODY (kayıp)";
        return `${a.tagName}${a.className ? "." + String(a.className).split(" ")[0] : ""}:${(a.textContent ?? "").trim().slice(0, 24)}`;
      });
      olcum.odakOncesi = oncekiOdak;
    }
  } catch (e) {
    olcum.hata = String(e.message).slice(0, 120);
  }
  kayitlar.push(olcum);
  console.log(`${genislik}/${tema}  ${ad.padEnd(34)} ${olcum.hata ? "HATA: " + olcum.hata : `${olcum.boy ?? "?"} ${olcum.genislik}×${olcum.yukseklik} iç:${olcum.icKaydirma} esc:${olcum.escKapatti ?? "-"} odak:${olcum.odak ?? "-"}`}`);
  await s.keyboard.press("Escape").catch(() => {});
  await s.waitForTimeout(250);
};

/** Editörün "Belge" araç menüsünü açıp içindeki düğmeye basar. */
const belgeMenusu = async (s, etiket) => {
  await s.locator('button[aria-label^="Bul, odak modu"]').first().click();
  await s.locator(`.arac-menu-pencere button[aria-label="${etiket}"]`).first().click();
};

const SENARYOLAR = [
  /* --- PanelDrawer --- */
  {
    ad: "Ayarlar · Hesabımı sil",
    nerede: "Ayarlar → Hesap",
    bilesen: "PanelDrawer (orta)",
    git: `/dashboard/settings`,
    ac: async (s) => s.locator('li.ayar-satir:has(b:text-is("Hesabımı sil"))').locator("button").first().click(),
  },
  {
    ad: "Ayarlar · Oturum kapatma onayı",
    nerede: "Ayarlar → Diğer cihazlar",
    bilesen: "ActionForm → PanelDrawer (onay, tetiksiz)",
    git: `/dashboard/settings`,
    ac: async (s) => s.locator('li.ayar-satir:has(b:text-is("Diğer cihazlar"))').locator("button").first().click(),
  },
  {
    ad: "Kaynaklar · Dışa aktarma",
    nerede: "Kaynaklar → Dışa aktar",
    bilesen: "PanelDrawer (genis)",
    git: `/dashboard/literature?calisma=${PROJE}`,
    ac: async (s) => s.locator("button", { hasText: /Dışa aktar/ }).first().click(),
  },
  {
    ad: "Kaynaklar · Kaynakça denetimi",
    nerede: "Kaynaklar → Kaynakça şeridi",
    bilesen: "PanelDrawer (tam)",
    git: `/dashboard/literature?calisma=${PROJE}&sekme=kaynakca`,
    ac: async (s) => s.locator(".kaynakca-serit-eylem").first().click(),
  },
  {
    ad: "Kılavuz penceresi",
    nerede: "Çalışma → Kılavuz",
    bilesen: "PanelDrawer (tam, tetiksiz)",
    git: `/dashboard/editor/${PROJE}?kilavuz=1`,
    ac: async () => {},
  },
  {
    ad: "Belge Kontrol · Belge yükle",
    nerede: "Belge Kontrol",
    bilesen: "PanelDrawer (orta)",
    git: `/dashboard/documents?calisma=${PROJE}`,
    ac: async (s) => s.locator("button", { hasText: /Belge yükle/ }).first().click(),
  },
  {
    ad: "Çalışmalarım · Yeni çalışma",
    nerede: "Çalışmalarım → Yeni çalışma",
    bilesen: "PanelDrawer",
    git: `/dashboard/editor`,
    ac: async (s) => s.locator("button", { hasText: /Yeni çalışma/ }).first().click(),
  },

  /* --- Dialog (sabit 520 px) --- */
  {
    ad: "Editör · Kısayollar",
    nerede: "Editör → sol araç paneli",
    bilesen: "Dialog (compact)",
    git: `/dashboard/editor/${PROJE}/write`,
    ac: async (s) => belgeMenusu(s, "Klavye kısayolları"),
  },
  {
    ad: "Editör · Sürüm geçmişi",
    nerede: "Editör → sol araç paneli",
    bilesen: "Dialog (compact)",
    git: `/dashboard/editor/${PROJE}/write`,
    ac: async (s) => belgeMenusu(s, "Sürüm geçmişi"),
  },
  {
    ad: "Editör · Danışmana paylaş",
    nerede: "Editör → sol araç paneli",
    bilesen: "Dialog (compact)",
    git: `/dashboard/editor/${PROJE}/write`,
    ac: async (s) => belgeMenusu(s, "Danışmana paylaş (salt okunur bağlantı)"),
  },
  {
    ad: "Editör · Belge araç menüsü",
    nerede: "Editör → araç çubuğu ⋯",
    bilesen: "AracMenusu (popover)",
    menu: ".arac-menu-pencere:not([hidden])",
    git: `/dashboard/editor/${PROJE}/write`,
    ac: async (s) => s.locator('button[aria-label^="Bul, odak modu"]').first().click(),
  },

  /* --- Açılır menüler (<details>) --- */
  {
    ad: "Hesap menüsü",
    nerede: "Üst şerit → hesap",
    bilesen: "<details.os-kullanici> + AcilirKapatici",
    menu: "details.os-kullanici[open]",
    git: `/dashboard/editor`,
    ac: async (s) => s.locator("details.os-kullanici summary").filter({ visible: true }).first().click(),
  },
  {
    ad: "Kaynak ekle menüsü",
    nerede: "Kaynaklar → Kaynak ekle",
    bilesen: "<details.kaynak-ekle> + AcilirKapatici",
    menu: "details.kaynak-ekle",
    git: `/dashboard/literature?calisma=${PROJE}`,
    ac: async (s) => s.locator("details.kaynak-ekle summary").first().click(),
  },
  {
    ad: "Kaynak satır menüsü",
    nerede: "Kaynaklar → kaynak satırı",
    bilesen: "<details.kaynak-arac-menu> + AcilirKapatici",
    menu: "details.kaynak-arac-menu",
    git: `/dashboard/literature?calisma=${PROJE}`,
    ac: async (s) => s.locator("details.kaynak-arac-menu summary").first().click(),
  },
  {
    ad: "Çalışma kartı menüsü",
    nerede: "Çalışmalarım → kart",
    bilesen: "<details.kart-menu> + AcilirKapatici",
    menu: "details.kart-menu",
    git: `/dashboard/editor`,
    ac: async (s) => s.locator("details.kart-menu summary").first().click(),
  },
];

for (const { genislik, yukseklik, tema } of [
  { genislik: 1440, yukseklik: 900, tema: "light" },
  { genislik: 1440, yukseklik: 900, tema: "dark" },
  { genislik: 390, yukseklik: 844, tema: "light" },
]) {
  const { ctx, s } = await oturum(genislik, yukseklik, tema);
  for (const sen of SENARYOLAR) {
    if (SUZGEC && !SUZGEC.test(sen.ad)) continue;
    await senaryo(
      s,
      sen.ad,
      sen.nerede,
      sen.bilesen,
      async (sayfa) => {
        await sayfa.goto(`${UYG}${sen.git}`, { waitUntil: "domcontentloaded" });
        await sayfa.waitForLoadState("networkidle").catch(() => {});
        await sen.ac(sayfa);
      },
      { tema, genislik, menuSecici: sen.menu ?? null, gorselAdi: GORSEL ? `env-${genislik}-${tema}-${sen.ad.replace(/[^\w]+/g, "-")}` : null },
    );
  }
  await ctx.close();
}

await tarayici.close();
const cikti = { head: HEAD, buildId: BUILD_ID, kayitlar };
if (GORSEL) fs.writeFileSync(`${GORSEL}/envanter.json`, JSON.stringify(cikti, null, 2));
console.log(`\n${kayitlar.length} ölçüm (HEAD ${HEAD.slice(0, 7)})`);
