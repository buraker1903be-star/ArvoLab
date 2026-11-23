// KAYNAKLAR → KAYNAKÇA: DENETİM EKRANI — KABUL (23.11.2026).
//
// Kusur: üstte "2 açık sorun" yazarken kategori satırlarının hepsi "Yok"
// görünüyordu. Toplam biçim bulgularını da sayıyor; satır listesinde ise
// BİÇİM kategorileri hiç yoktu (lib/kaynakca-ozeti.ts ile
// app/dashboard/literature/page.tsx ayrışmıştı). Ölçülmemiş kategoriler
// de "Yok" yazıyordu: yapılmamış denetim temiz rapor gibi görünüyordu.
//
// Burada denetimler SENTETİK olarak veritabanına yazılıyor (ağ yok, AI
// yok): denetim yapılmamış çalışma, sorunsuz denetim, çok kategorili
// bulgu, eksik denetim verisi ve aynı gün iki denetim.
//
// Kullanım: node scripts/yerel-yigin/kaynakca-ozet-kabul.mjs http://localhost:3141 [görüntü-dizini]
// Çıkış: 0 hepsi PASS, 1 en az bir FAIL, 2 ön koşul yok.
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
  if (!BUILD_ID || !html.includes(BUILD_ID)) {
    console.error(`Ön koşul yok: sunucu .next/BUILD_ID (${BUILD_ID ?? "yok"}) derlemesini çalıştırmıyor`);
    process.exit(2);
  }
  if ((await fetch(`${GECIT}/auth/v1/health`)).status !== 200) throw new Error("geçit");
  psql("select id from public.citation_checks limit 0");
} catch (e) {
  console.error("Ön koşul yok:", e.message);
  process.exit(2);
}

const sonuclar = [];
const PASS = (ad, not = "") => { sonuclar.push({ ad, durum: "PASS", not }); console.log(`PASS  ${ad}${not ? ` — ${not}` : ""}`); };
const FAIL = (ad, not) => { sonuclar.push({ ad, durum: "FAIL", not }); console.log(`FAIL  ${ad} — ${not}`); };
const esit = async (ad, fn, beklenen) => {
  try {
    const v = await fn();
    if (typeof beklenen === "function" ? beklenen(v) : v === beklenen) PASS(ad, String(v).slice(0, 140));
    else FAIL(ad, `beklenen ${typeof beklenen === "function" ? "(koşul)" : beklenen}, bulunan ${String(v).slice(0, 200)}`);
  } catch (e) { FAIL(ad, e.message.slice(0, 200)); }
};

/* ---------- Sentetik kullanıcı, çalışmalar ve denetimler ---------- */
const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");
const adres = `kaynakca-${ek}@yerel.test`, parola = `Kq7!${crypto.randomBytes(9).toString("base64url")}`;
const yeni = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: "Kaynakça Deneği" } });
if (yeni.durum >= 300) { console.error("kullanıcı kurulamadı", yeni); process.exit(2); }
const KULLANICI = yeni.json.id;
await auth(`/admin/users/${KULLANICI}`, { password: parola }, "PUT");
psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
      values (${q(KULLANICI)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
const proje = (ad) => psql(`insert into public.academic_projects (owner_id, project_type, title, citation_style)
  values (${q(KULLANICI)}, 'thesis', ${q(ad)}, 'apa7') returning id`).split("\n")[0];
const P_BICIM = proje("Biçim bulgulu kaynakça çalışması");
const P_TEMIZ = proje("Sorunsuz kaynakça çalışması");
const P_COK = proje("Çok kategorili kaynakça çalışması");
const P_YOK = proje("Denetimsiz kaynakça çalışması");
const P_ESKI = proje("Ayrıntısız eski kayıt çalışması");

const kunye = (i, severity) => ({
  raw: `Yılmaz, A. (20${10 + i}). Sentetik çalışma ${i}. Sentetik Dergi, ${i}(2), 1-10.`,
  authors: ["Yılmaz, A."], year: `20${10 + i}`, title: `Sentetik çalışma ${i}`,
  issues: severity ? [{ field: "authors", message: `Sentetik ${severity}`, severity }] : [],
});
const denetimEkle = (projeId, saat, { hata = 0, uyari = 0, temiz = 2, atifsiz = [], karsiliksiz = [], notFound = 0, unreachable = 0, dogrulanan = 0, citations = [], tyk = null }) => {
  const refs = [];
  for (let i = 0; i < hata; i += 1) refs.push(kunye(refs.length + 1, "error"));
  for (let i = 0; i < uyari; i += 1) refs.push(kunye(refs.length + 1, "warning"));
  for (let i = 0; i < temiz; i += 1) refs.push(kunye(refs.length + 1, null));
  const capraz = {
    citationsWithoutReference: karsiliksiz.map((r) => ({ raw: r })),
    referencesWithoutCitation: atifsiz.map((r) => ({ raw: r })),
    academicVerification: Array.from({ length: dogrulanan }, (_, i) => ({ reference: refs[i % refs.length].raw, status: "verified" })),
    verificationSummary: { verified: Math.max(dogrulanan - notFound, 0), possible: 0, notFound, insufficientData: 0, unreachable },
    ...(tyk ? { tyk } : {}),
  };
  return psql(`insert into public.citation_checks (project_id, project_title, raw_reference_list, body_text, parsed_references, in_text_citations, cross_check, compliance_score, created_by, created_at)
    values (${q(projeId)}, 'Sentetik', ${q(refs.map((r) => r.raw).join("\n"))}, 'sentetik gövde',
      ${q(JSON.stringify(refs))}::jsonb, ${q(JSON.stringify(citations.map((c) => ({ raw: c }))))}::jsonb, ${q(JSON.stringify(capraz))}::jsonb,
      100, ${q(KULLANICI)}, ${q(saat)}) returning id`).split("\n")[0];
};
const bugun = new Date();
const saatli = (saat, dk) => new Date(Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth(), bugun.getUTCDate(), saat, dk)).toISOString();
/* AYNI GÜN İKİ DENETİM; sonuncusu ekran görüntüsündeki durum. */
denetimEkle(P_BICIM, saatli(6, 15), { temiz: 3, atifsiz: ["Kaynak A"], notFound: 1, dogrulanan: 3, citations: ["(Yılmaz, 2020)"] });
denetimEkle(P_BICIM, saatli(7, 40), { hata: 0, uyari: 2, temiz: 1, dogrulanan: 0, citations: [] });
denetimEkle(P_TEMIZ, saatli(6, 0), { temiz: 4, dogrulanan: 4, citations: ["(Yılmaz, 2020)"], tyk: [] });
denetimEkle(P_COK, saatli(5, 5), { temiz: 5, dogrulanan: 5, citations: ["(Yılmaz, 2020)"] });
denetimEkle(P_COK, saatli(6, 30), {
  hata: 2, uyari: 1, temiz: 2, atifsiz: ["Kaynak B"], karsiliksiz: ["(Demir, 2019)", "(Kaya, 2021)"],
  notFound: 1, unreachable: 2, dogrulanan: 5, citations: ["(Yılmaz, 2020)"], tyk: [{ tur: "yilsiz", atif: "(Yılmaz)", aciklama: "Yıl yok" }],
});
/* ESKİ KAYIT: sayı var, ayrıntı yok (dizin listesi boş). */
denetimEkle(P_ESKI, saatli(5, 10), { temiz: 4, notFound: 2, dogrulanan: 0, citations: ["(Yılmaz, 2020)"] });
psql(`update public.citation_checks set cross_check = jsonb_set(cross_check, '{verificationSummary,notFound}', '2')
      where project_id = ${q(P_ESKI)}`);
psql(`update public.citation_checks set cross_check = jsonb_set(cross_check, '{academicVerification}', '[]')
      where project_id = ${q(P_ESKI)}`);

/* Kütüphanem sekmesi ve dışa aktarma için bir kaynak. */
psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, source_type, status)
      values (${q(KULLANICI)}, ${q(P_BICIM)}, 'Sentetik kaynak başlığı', 'Yılmaz, A.', 2020, 'article', 'used')`);

const tarayici = await chromium.launch({ args: ["--no-sandbox"] });
const oturum = async (g, y, dil, tema = "light", dokunma = false) => {
  psql(`update public.profiles set arayuz_dili = ${q(dil)} where id = ${q(KULLANICI)}`);
  const ctx = await tarayici.newContext({
    viewport: { width: g, height: y }, colorScheme: tema, locale: "tr-TR",
    ...(dokunma ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
  });
  await ctx.addCookies([{ name: "arvolab_dil", value: dil, url: UYG }]);
  const s = await ctx.newPage();
  await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
  await s.fill('input[name="email"]', adres);
  await s.fill('input[name="password"]', parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { ctx, s };
};
const kaynakcaya = async (s, projeId) => {
  await s.goto(`${UYG}/dashboard/literature?calisma=${projeId}&sekme=kaynakca`, { waitUntil: "domcontentloaded" });
  await s.waitForLoadState("networkidle").catch(() => {});
};
const kartOku = async (s) =>
  await s.evaluate(() => {
    const alan = document.querySelector(".kaynakca-alan");
    if (!alan) return null;
    const satir = (li) => ({
      ad: li.querySelector("b")?.innerText.trim() ?? "",
      not: [...li.querySelectorAll("small")].map((x) => x.innerText.trim()).join(" | "),
      rozet: li.querySelector(".status-pill")?.innerText.trim() ?? "",
      ton: li.querySelector(".kaynakca-nokta")?.getAttribute("data-tone") ?? "",
      etiket: li.querySelector("a")?.getAttribute("aria-label") ?? "",
      ok: Boolean(li.querySelector("svg")),
      baglanti: li.querySelector("a")?.getAttribute("href") ?? null,
    });
    const bulgular = [...alan.querySelectorAll(".kaynakca-bulgular > .kaynakca-liste li")].map(satir);
    const tum = alan.querySelector(".kaynakca-tum");
    const tumSatirlar = [...(tum?.querySelectorAll("li") ?? [])].map(satir);
    const gecmis = [...alan.querySelectorAll(".kaynakca-gecmis li a")].map((a) => ({ metin: a.innerText.trim(), href: a.getAttribute("href") }));
    /* Telefonda sıra: özet → bulgular → Tüm kontroller → geçmiş. */
    const sira = [".kaynakca-serit", ".kaynakca-bulgular", ".kaynakca-tum", ".kaynakca-gecmis-kart"]
      .map((q2) => alan.querySelector(q2))
      .filter(Boolean)
      .map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
    return {
      ana: alan.querySelector(".kaynakca-serit-ana")?.innerText.trim() ?? "",
      meta: alan.querySelector(".kaynakca-serit-meta")?.innerText.trim() ?? "",
      dagilim: alan.querySelector(".kaynakca-serit-dagilim")?.innerText.replace(/\n/g, " · ").trim() ?? "",
      eylem: alan.querySelector(".kaynakca-serit-eylem")?.innerText.trim() ?? "",
      eylemGenislik: Math.round(alan.querySelector(".kaynakca-serit-eylem")?.getBoundingClientRect().width ?? 0),
      seritGenislik: Math.round(alan.querySelector(".kaynakca-serit")?.getBoundingClientRect().width ?? 0),
      bulgular,
      bulguBos: alan.querySelector(".kaynakca-bos")?.innerText.trim() ?? "",
      tumBaslik: tum?.querySelector("summary")?.innerText.trim() ?? "",
      tumAcik: Boolean(tum?.open),
      tumSatirlar,
      gecmis,
      gecmisBos: alan.querySelector(".kaynakca-gecmis-kart .kaynakca-bos")?.innerText.trim() ?? "",
      bosMetin: alan.querySelector(".gb-bos")?.innerText.trim() ?? "",
      sira,
      /* İki sütun mu: bulgular ve geçmiş aynı satırda mı? */
      ikiSutun: (() => {
        const b = alan.querySelector(".kaynakca-bulgular")?.getBoundingClientRect();
        const g = alan.querySelector(".kaynakca-gecmis-kart")?.getBoundingClientRect();
        return Boolean(b && g && g.left > b.right - 1);
      })(),
      yatayTasma: document.documentElement.scrollWidth - window.innerWidth,
      tasanKapsayici: [...document.querySelectorAll("main *")]
        .filter((el) => el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && /auto|scroll/.test(getComputedStyle(el).overflowX))
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()}.${(typeof el.className === "string" ? el.className.split(" ").filter(Boolean)[0] : "")} c=${el.clientWidth} s=${el.scrollWidth}`),
    };
  });

try {
  /* ================= K1: iki biçim uyarılı denetim (canlı örnek) ================= */
  {
    const { ctx, s } = await oturum(1440, 900, "tr");
    await kaynakcaya(s, P_BICIM);

    await esit("K1a şerit: tek kategorili bulguda türün kendisi, kapsam ve ana eylem", async () => {
      const k = await kartOku(s);
      return [
        `ana:${k.ana}`,
        `meta:${/3 künye incelendi · son denetim \d{2}\.\d{2}\.\d{4} \d{2}:\d{2}/.test(k.meta)}`,
        `eylem:${k.eylem}`,
        `dagilimYok:${k.dagilim === ""}`,
      ].join(" ");
    }, "ana:2 biçim uyarısı meta:true eylem:Sonuçları aç dagilimYok:true");

    await esit("K1b bulgu satırı künyeyi ve GERÇEK uyarıyı birlikte gösteriyor", async () => {
      const k = await kartOku(s);
      const ilk = k.bulgular[0];
      return [
        `satir:${k.bulgular.length}`,
        `kunye:${/Yılmaz, A\. \(20\d\d\)/.test(ilk?.ad ?? "")}`,
        `uyari:${/Sentetik warning/.test(ilk?.not ?? "")}`,
        `ton:${ilk?.ton}`,
        `etiket:${/^Biçim uyarısı: /.test(ilk?.etiket ?? "")}`,
        `ok:${ilk?.ok}`,
      ].join(" ");
    }, (v) => /satir:2 kunye:true uyari:true ton:warning etiket:true ok:true/.test(v));

    await esit("K1c Tüm kontroller KAPALI başlıyor, sayısı denetimin kategori listesinden", async () => {
      const k = await kartOku(s);
      return `baslik:${k.tumBaslik} acik:${k.tumAcik}`;
    }, "baslik:Tüm kontroller (6) acik:false");

    await esit("K1d açılınca bütün kategoriler gerçek durumlarıyla görünüyor", async () => {
      await s.locator(".kaynakca-tum summary").click();
      await s.waitForTimeout(250);
      const k = await kartOku(s);
      const durum = (ad) => k.tumSatirlar.find((x) => x.ad.startsWith(ad))?.rozet;
      return [
        `satir:${k.tumSatirlar.length}`,
        `uyari:${durum("Biçim uyarısı")}`,
        `yok:${durum("Biçim hatası")}`,
        `denetlenmedi:${durum("Kaynakçada karşılığı")}`,
      ].join(" ");
    }, "satir:6 uyari:2 yok:Yok denetlenmedi:Denetlenmedi");

    await esit("K1e geçmiş ayrı kartta ve SON denetim orada tekrar edilmiyor", async () => {
      const k = await kartOku(s);
      const saatler = k.gecmis.map((g) => g.metin);
      return `ikiSutun:${k.ikiSutun} sayi:${saatler.length} saatli:${/\d{2}:\d{2}/.test(saatler[0] ?? "")} sonDenetimYok:${!saatler.some((x) => x.includes("12:40"))}`;
    }, (v) => /ikiSutun:true sayi:1 saatli:true sonDenetimYok:true/.test(v));

    await esit("K1f bulgu satırındaki ok GERÇEKTEN ayrıntıyı açıyor", async () => {
      const satir = s.locator(".kaynakca-bulgular .kaynakca-liste a").first();
      const hedef = await satir.getAttribute("href");
      await satir.click();
      await s.waitForTimeout(1500);
      const acik = s.locator(".drawer-root.open section.drawer");
      const metin = (await acik.count()) ? await acik.first().innerText() : "";
      return `denetimli:${(hedef ?? "").includes("denetim=")} pencere:${metin.length > 50} kunye:${/Sentetik çalışma/.test(metin)}`;
    }, "denetimli:true pencere:true kunye:true");

    await esit("K1g klavye: ana eylem, Tüm kontroller ve geçmiş satırı kullanılabilir", async () => {
      await kaynakcaya(s, P_BICIM);
      const odakla = async (sec) => {
        await s.locator(sec).first().focus();
        return await s.evaluate((q2) => document.activeElement === document.querySelector(q2), sec);
      };
      const eylem = await odakla(".kaynakca-serit-eylem");
      const tum = await odakla(".kaynakca-tum summary");
      await s.keyboard.press("Enter");
      await s.waitForTimeout(250);
      const acildi = await s.locator(".kaynakca-tum").evaluate((el) => el.open);
      const gecmisOdak = await odakla(".kaynakca-gecmis a");
      await s.keyboard.press("Enter");
      await s.waitForURL(/denetim=/, { timeout: 20000 });
      return `eylem:${eylem} tum:${tum} acildi:${acildi} gecmis:${gecmisOdak} adres:${s.url().includes("denetim=")}`;
    }, "eylem:true tum:true acildi:true gecmis:true adres:true");

    await esit("K1h yatay kaydırma yok; kaydırılabilir kapsayıcı da taşmıyor", async () => {
      await kaynakcaya(s, P_BICIM);
      const k = await kartOku(s);
      return `sayfa:${k.yatayTasma} kapsayici:${k.tasanKapsayici.join("|") || "yok"}`;
    }, (v) => /^sayfa:(-?\d+) kapsayici:yok/.test(v) && Number(v.match(/sayfa:(-?\d+)/)[1]) <= 0);

    await esit("K1i Kaynakça, Kütüphanem ile AYNI içerik sınırlarını kullanıyor", async () => {
      const olc = async (kaynakcaMi) => {
        await s.goto(`${UYG}/dashboard/literature?calisma=${P_BICIM}${kaynakcaMi ? "&sekme=kaynakca" : ""}`, { waitUntil: "domcontentloaded" });
        await s.waitForLoadState("networkidle").catch(() => {});
        return await s.evaluate(() => {
          const r = document.querySelector("section.kaynak-tek").getBoundingClientRect();
          return `${Math.round(r.left)}-${Math.round(r.right)}`;
        });
      };
      const kutuphane = await olc(false);
      const kaynakca = await olc(true);
      return `kutuphane:${kutuphane} kaynakca:${kaynakca} ayni:${kutuphane === kaynakca}`;
    }, (v) => /ayni:true/.test(v));

    if (GORSEL) await s.screenshot({ path: path.join(GORSEL, "yeni-iki-uyari-1440-tr.png"), fullPage: true });
    await ctx.close();
  }

  /* ================= K2: öteki denetim durumları ================= */
  {
    const { ctx, s } = await oturum(1440, 900, "tr");
    await esit("K2a denetim yapılmamış çalışmada boş durum korunuyor", async () => {
      await kaynakcaya(s, P_YOK);
      const k = await kartOku(s);
      return `ana:${k.ana} eylem:${k.eylem} bos:${k.bosMetin.length > 40} gecmisBos:${k.gecmisBos.length > 10}`;
    }, (v) => /ana:Henüz denetlenmedi eylem:Kaynakçamı denetle bos:true gecmisBos:true/.test(v));

    await esit("K2b sorunsuz denetimde 'Açık sorun yok' ve tüm kategoriler Yok", async () => {
      await kaynakcaya(s, P_TEMIZ);
      const k = await kartOku(s);
      await s.locator(".kaynakca-tum summary").click();
      await s.waitForTimeout(250);
      const k2 = await kartOku(s);
      const yok = k2.tumSatirlar.filter((x) => x.rozet === "Yok").length;
      return `ana:${k.ana} bulguYok:${/bulgu yok/.test(k.bulguBos)} yok:${yok}`;
    }, (v) => /ana:Açık sorun yok bulguYok:true yok:6/.test(v));

    await esit("K2c çok kategorili bulguda toplam ve dağılım tek yerde", async () => {
      await kaynakcaya(s, P_COK);
      const k = await kartOku(s);
      return [
        `ana:${k.ana}`,
        `dagilim:${k.dagilim.split(" · ").length}`,
        `ilkEtiket:${/^Biçim hatası: /.test(k.bulgular[0]?.etiket ?? "")}`,
        `ilkTon:${k.bulgular[0]?.ton}`,
        `satir:${k.bulgular.length > 0}`,
      ].join(" ");
    }, (v) => /ana:8 açık sorun dagilim:6 ilkEtiket:true ilkTon:danger satir:true/.test(v));

    await esit("K2d ayrıntısı olmayan eski kayıtta kategori ve adet gösteriliyor", async () => {
      await kaynakcaya(s, P_ESKI);
      const k = await kartOku(s);
      const satir = k.bulgular[0];
      return `ana:${k.ana} ad:${satir?.ad} rozet:${satir?.rozet} not:${/ayrıntı bu kayıtta yok/.test(satir?.not ?? "")} ok:${satir?.ok}`;
    }, (v) => /ana:2 bulunamayan kaynak ad:Dizinlerde bulunamayan kaynak rozet:2 not:true ok:true/.test(v));

    await esit("K2e çalışma değişince şerit, bulgular ve geçmiş birlikte güncelleniyor", async () => {
      await kaynakcaya(s, P_BICIM);
      const a = await kartOku(s);
      await s.locator(".kaynaklar-secici .secici-dugme").click();
      await s.waitForTimeout(250);
      await s.locator(".secici-secenek", { hasText: "Sorunsuz kaynakça çalışması" }).first().click();
      await s.waitForTimeout(1800);
      /* Çalışma değişince gezinme Kütüphanem'e dönüyor (mevcut
         davranış); kullanıcı Kaynakça sekmesine geçiyor. */
      await s.getByRole("link", { name: /^Kaynakça$/ }).click().catch(async () => {
        await s.locator("a", { hasText: "Kaynakça" }).first().click();
      });
      await s.waitForLoadState("networkidle").catch(() => {});
      await s.waitForTimeout(500);
      const b = await kartOku(s);
      return `once:${a.ana}/${a.bulgular.length}/${a.gecmis.length} sonra:${b.ana}/${b.bulgular.length}/${b.gecmis.length}`;
    }, "once:2 biçim uyarısı/2/1 sonra:Açık sorun yok/0/0");

    await esit("K2f Kütüphanem sekmesi ve kaynak listesi çalışıyor", async () => {
      await s.goto(`${UYG}/dashboard/literature?calisma=${P_BICIM}`, { waitUntil: "domcontentloaded" });
      await s.waitForLoadState("networkidle").catch(() => {});
      const metin = await s.locator("main").innerText();
      return `kaynak:${/Sentetik kaynak başlığı/.test(metin)}`;
    }, "kaynak:true");

    await esit("K2g kaynakça dışa aktarma akışı çalışıyor", async () => {
      await s.getByRole("button", { name: "Dışa aktar" }).click();
      await s.waitForTimeout(900);
      const metin = await s.locator("body").innerText();
      return `kaynakca:${/Sentetik kaynak başlığı/.test(metin)} kopyala:${(await s.getByRole("button", { name: /Kaynakçayı kopyala|Copy reference list/ }).count()) > 0}`;
    }, "kaynakca:true kopyala:true");
    await ctx.close();
  }

  /* ================= K3: diller, tema, telefon ================= */
  for (const [dil, tema, g, y, dokunma] of [
    ["tr", "dark", 1440, 900, false],
    ["en", "light", 1440, 900, false],
    ["en", "dark", 390, 844, true],
    ["tr", "light", 390, 844, true],
  ]) {
    const ad = `${dil}-${tema}-${g}`;
    const { ctx, s } = await oturum(g, y, dil, tema, dokunma);
    await kaynakcaya(s, P_COK);
    await esit(`K3a-${ad} şerit ve bulgular çeviride eksiksiz`, async () => {
      const k = await kartOku(s);
      const beklenenAna = dil === "tr" ? /^8 açık sorun$/ : /^8 open issues$/;
      const turkceKalinti = dil === "en" && /künye|Yok|Denetlenmedi|biçim/.test(`${k.ana} ${k.meta} ${k.dagilim} ${k.bulgular.map((b) => b.ad + b.rozet).join(" ")}`);
      return `ana:${beklenenAna.test(k.ana)} meta:${k.meta.length > 10} turkceKalinti:${turkceKalinti}`;
    }, "ana:true meta:true turkceKalinti:false");

    await esit(`K3b-${ad} yerleşim: ${g < 500 ? "tek sütun ve sıra" : "iki sütun"}`, async () => {
      const k = await kartOku(s);
      const artan = k.sira.every((v, i, dizi) => i === 0 || v >= dizi[i - 1]);
      return `ikiSutun:${k.ikiSutun} sira:${artan} adim:${k.sira.length}`;
    }, (v) => (g < 500 ? /ikiSutun:false sira:true adim:4/.test(v) : /ikiSutun:true/.test(v)));

    await esit(`K3c-${ad} yatay kaydırma yok, uzun ad sarıyor`, async () => {
      const k = await kartOku(s);
      const kirpik = await s.evaluate(() =>
        [...document.querySelectorAll(".kaynakca-satir-govde b")].some((b) => b.scrollHeight > b.clientHeight + 1),
      );
      return `sayfa:${k.yatayTasma} kapsayici:${k.tasanKapsayici.join("|") || "yok"} kirpikDegil:${!kirpik}`;
    }, (v) => /kapsayici:yok kirpikDegil:true/.test(v) && Number(v.match(/sayfa:(-?\d+)/)[1]) <= 0);

    if (g < 500) {
      await esit(`K3d-${ad} telefonda ana eylem kart genişliğini kullanıyor`, async () => {
        const k = await kartOku(s);
        return `oran:${Math.round((k.eylemGenislik / k.seritGenislik) * 100)}`;
      }, (v) => Number(v.split(":")[1]) >= 80);

      await esit(`K3e-${ad} geçmişin son kaydına dikey kaydırmayla ulaşılıyor`, async () => {
        const son = s.locator(".kaynakca-gecmis li a").last();
        const once = await son.boundingBox();
        for (let i = 0; i < 20; i += 1) {
          const b = await son.boundingBox();
          if (b && b.y >= 0 && b.y + b.height <= y) break;
          await s.mouse.wheel(0, 240);
          await s.waitForTimeout(70);
        }
        const sonra = await son.boundingBox();
        return `onceY:${Math.round(once?.y ?? -1)} gorunur:${Boolean(sonra && sonra.y >= 0 && sonra.y + sonra.height <= y)}`;
      }, (v) => /gorunur:true/.test(v));
    }

    await esit(`K3f-${ad} karşıtlık: şeritteki ifade okunur`, async () => {
      return await s.locator(".kaynakca-serit-ana").evaluate((el) => {
        const lum = (c) => {
          const [x, y2, w] = c.match(/\d+/g).slice(0, 3).map((n) => {
            const s2 = Number(n) / 255;
            return s2 <= 0.03928 ? s2 / 12.92 : ((s2 + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * x + 0.7152 * y2 + 0.0722 * w;
        };
        const a = lum(getComputedStyle(el).color);
        const b = lum(getComputedStyle(el.closest(".kaynakca-serit")).backgroundColor);
        return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10;
      });
    }, (v) => Number(v) >= 4.5);
    if (GORSEL) await s.screenshot({ path: path.join(GORSEL, `yeni-${ad}.png`), fullPage: g < 500 });
    await ctx.close();
  }
} catch (e) {
  FAIL("kabul koşusu", `${e.message}\n${e.stack?.split("\n").slice(1, 4).join("\n")}`);
} finally {
  await tarayici.close();
  psql(`delete from public.academic_projects where owner_id = ${q(KULLANICI)}`);
  await auth(`/admin/users/${KULLANICI}`, {}, "DELETE");
}

const gecen = sonuclar.filter((x) => x.durum === "PASS").length;
const dusen = sonuclar.length - gecen;
console.log(`\n${gecen} PASS · ${dusen} FAIL`);
for (const x of sonuclar.filter((y) => y.durum === "FAIL")) console.log(` - ${x.ad}: ${x.not}`);
fs.mkdirSync(path.join(KOK, "scripts/yerel-yigin/sonuclar"), { recursive: true });
fs.writeFileSync(
  path.join(KOK, "scripts/yerel-yigin/sonuclar/kaynakca-ozet-kabul.json"),
  `${JSON.stringify({ tarih: new Date().toISOString(), head: HEAD, buildId: BUILD_ID, uygulama: UYG, gecen, dusen, sonuclar }, null, 2)}\n`,
);
process.exit(dusen ? 1 : 0);
