// KAYNAKLAR — SATIR MENÜSÜ KABULÜ (23.11.2026, claude/kaynak-satir-menu dalı).
//
// Satırın "⋯" menüsü <details> iken ortak .kart-menu-liste kuralından
// YUKARI açılma davranışını alıyordu; kaydırılabilir liste kabı
// (.kaynak-liste-kap, overflow-y: auto) onu kırpıyordu. İlk satırda
// menünün tamamı, uzun listenin son satırında alt kenarı — yani
// "Kaynağı sil" — görünmüyordu. Burada ÖLÇÜLEN:
//   K1 uzun listenin İLK satırı: menü düğmenin ALTINDA, ekranın içinde
//   K2 uzun listenin SON satırı: altta yer yoksa ÜSTE geçiyor
//   K3 çalışmaya bağlı olmayan TEK kaynak: menü yine açılıyor
//   K4 "Kaynağı sil" gerçekten tıklanabilir (elementFromPoint), onay
//      akışı duruyor: vazgeçince kaynak kalıyor, onaylayınca siliniyor
// Her senaryo 1440x900 (masaüstü) ve 390x844 (telefon) ölçüsünde koşuyor.
// Yalnızca sentetik kullanıcı ve sentetik kaynaklar; AI çağrısı yok.
//
// Kullanım: node scripts/yerel-yigin/kaynak-menu-kabul.mjs http://localhost:3135 [görüntü-dizini]
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
const UYG = process.argv[2] ?? "http://localhost:3135";
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
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

/* Sınanan derleme kayda geçer: sunucu bu dizinin derlemesini çalıştırmıyorsa koşu başlamaz. */
const BUILD_ID = fs.existsSync(path.join(KOK, ".next/BUILD_ID")) ? fs.readFileSync(path.join(KOK, ".next/BUILD_ID"), "utf8").trim() : null;
const HEAD = execFileSync("git", ["rev-parse", "HEAD"], { cwd: KOK, encoding: "utf8" }).trim();
try {
  const html = await (await fetch(`${UYG}/`)).text();
  if (!BUILD_ID || !html.includes(BUILD_ID)) {
    console.error(`Ön koşul yok: sunucu .next/BUILD_ID (${BUILD_ID ?? "yok"}) derlemesini çalıştırmıyor`);
    process.exit(2);
  }
  if ((await fetch(`${GECIT}/auth/v1/health`)).status !== 200) throw new Error("geçit");
  psql("select id from public.literature_sources limit 0");
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

const auth = async (yol, govde, yontem = "POST") => {
  const r = await fetch(`${GECIT}/auth/v1${yol}`, {
    method: yontem, headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/json" },
    body: JSON.stringify(govde),
  });
  return { durum: r.status, json: await r.json().catch(() => ({})) };
};
const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");

/* ---------- Sentetik kullanıcı, çalışma ve kaynaklar ---------- */
const adres = `kaynakmenu-${ek}@yerel.test`, parola = `Kq7!${crypto.randomBytes(9).toString("base64url")}`;
const yeni = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: "Kaynak Deneği" } });
if (yeni.durum >= 300) { console.error("kullanıcı kurulamadı", yeni); process.exit(2); }
const KULLANICI = yeni.json.id;
/* Parola ayrı istekte: /admin/users gövdesindeki password GoTrue'da uygulanmıyor. */
await auth(`/admin/users/${KULLANICI}`, { password: parola }, "PUT");
psql(`update public.profiles set full_name = 'Kaynak Deneği' where id = ${q(KULLANICI)}`);
psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
      values (${q(KULLANICI)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
const PROJE = psql(`insert into public.academic_projects (owner_id, project_type, title)
  values (${q(KULLANICI)}, 'thesis', 'Kaynak menü kabulü') returning id`).split("\n")[0];

/* Uzun liste: 30 kaynak. Kaydırma olmadan ilk/son satır sınanamaz. */
{
  const satirlar = [];
  for (let i = 1; i <= 30; i += 1) {
    const n = String(i).padStart(2, "0");
    satirlar.push(`(${q(KULLANICI)}, ${q(PROJE)}, ${q(`Kaynak ${n} — sentetik kayıt`)}, ${q(`Yazar ${n}`)}, ${q(String(2000 + i))}, 'article', 'to_review')`);
  }
  psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, source_type, status)
        values ${satirlar.join(",")}`);
}
/* Çalışmaya bağlı OLMAYAN tek kaynak (?kapsam=bagsiz). */
psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, source_type, status)
      values (${q(KULLANICI)}, null, ${q("Tek bağsız kaynak")}, ${q("Bağsız Yazar")}, '2019', 'article', 'to_review')`);
/* Silme senaryosunun kendi kaynağı: başka satırları etkilemesin. */
const SILINECEK = "Silinecek sentetik kaynak";
psql(`insert into public.literature_sources (owner_id, project_id, title, authors, year, source_type, status)
      values (${q(KULLANICI)}, ${q(PROJE)}, ${q(SILINECEK)}, ${q("Silme Denegi")}, '2026', 'article', 'to_review')`);

const kaynakSayisi = () => Number(psql(`select count(*) from public.literature_sources where owner_id = ${q(KULLANICI)}`));
const silinecekVar = () => Number(psql(`select count(*) from public.literature_sources where owner_id = ${q(KULLANICI)} and title = ${q(SILINECEK)}`)) > 0;

const tarayici = await chromium.launch({ args: ["--no-sandbox"] });
const LISTE = `/dashboard/literature?calisma=${PROJE}`;
const BAGSIZ = `${LISTE}&kapsam=bagsiz`;

async function oturum(genislik, yukseklik) {
  const ctx = await tarayici.newContext({ viewport: { width: genislik, height: yukseklik }, locale: "tr-TR" });
  const sayfa = await ctx.newPage();
  await sayfa.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
  await sayfa.fill('input[name="email"]', adres);
  await sayfa.fill('input[name="password"]', parola);
  await Promise.all([sayfa.waitForURL(/dashboard/, { timeout: 60000 }), sayfa.press('input[name="password"]', "Enter")]);
  return { ctx, sayfa };
}

const git = async (sayfa, yol) => {
  await sayfa.goto(`${UYG}${yol}`, { waitUntil: "domcontentloaded" });
  await sayfa.waitForLoadState("networkidle").catch(() => {});
  await sayfa.waitForSelector(".kaynak-satiri", { timeout: 25000 });
};
const cek = async (sayfa, ad) => { if (GORSEL) await sayfa.screenshot({ path: path.join(GORSEL, `${ad}.png`) }); };

/*
  Menünün ÖLÇÜSÜ. Kırpılma "görünür mü" ile değil, "sil düğmesinin
  ortasındaki nokta gerçekten o düğmeyi mi veriyor" ile sınanıyor:
  kırpılmış ya da bir şeyin altında kalmış öğe tıklanamaz.
*/
const menuOlcusu = async (sayfa) =>
  await sayfa.evaluate(() => {
    /* Son seçici DÜZELTMEDEN ÖNCEKİ yapı: <details class="kaynak-satir-menu">
       içindeki ortak liste. Betik böylece eski derlemede de koşuyor ve
       kusuru ölçüyor (kur.sh'ın migration atlama kipiyle aynı gerekçe). */
    const m = document.querySelector(".kaynak-satir-menu-liste:popover-open")
      ?? document.querySelector(".kaynak-satir-menu-liste:not([hidden])")
      ?? document.querySelector(".kaynak-satir-menu[open] .kart-menu-liste");
    if (!m) return { acik: false };
    const r = m.getBoundingClientRect();
    const dugmeEl = document.querySelector(".kaynak-satir-menu[data-acik]")
      ?? document.querySelector(".kaynak-satir-menu[open] > summary");
    const d = dugmeEl?.getBoundingClientRect();
    const sil = [...m.querySelectorAll("button")].find((b) => /Kaynağı sil/.test(b.textContent || ""));
    const sr = sil?.getBoundingClientRect();
    const nokta = sr && sr.width > 0 ? document.elementFromPoint(sr.left + sr.width / 2, sr.top + sr.height / 2) : null;
    return {
      acik: true,
      ustKatman: m.matches(":popover-open"),
      yukseklik: Math.round(r.height),
      ekranIci: r.top >= -0.5 && r.left >= -0.5 && r.bottom <= window.innerHeight + 0.5 && r.right <= window.innerWidth + 0.5,
      altta: Boolean(d && r.top >= d.bottom - 0.5),
      ustte: Boolean(d && r.bottom <= d.top + 0.5),
      altBosluk: d ? Math.round(window.innerHeight - d.bottom) : -1,
      silGorunur: Boolean(sr && sr.height > 0 && sr.top >= -0.5 && sr.bottom <= window.innerHeight + 0.5),
      silTiklanabilir: Boolean(sil && nokta && (nokta === sil || sil.contains(nokta))),
      /* Eski davranışın izi: pencere liste kabının kırpma alanının dışına çıkabiliyor mu. */
      kabiAsiyor: (() => {
        const kap = document.querySelector(".kaynak-liste-kap")?.getBoundingClientRect();
        return Boolean(kap && (r.top < kap.top - 0.5 || r.bottom > kap.bottom + 0.5));
      })(),
    };
  });

/* Konum kuralı: altta yer varsa ALTTA; yoksa üstte ya da (ikisi de
   sığmıyorsa) ekranın içine sıkıştırılmış. */
const konumDogru = (o) => (o.altBosluk >= o.yukseklik + 14 ? o.altta : o.ustte || o.ekranIci);
const menuAc = async (sayfa, sira) => {
  /* "button.kaynak-satir-menu" bugünkü yapı; "> summary" eski <details>. */
  const dugmeler = sayfa.locator("button.kaynak-satir-menu, .kaynak-satir-menu > summary");
  const n = await dugmeler.count();
  const i = sira === "ilk" ? 0 : n - 1;
  const d = dugmeler.nth(i);
  await d.scrollIntoViewIfNeeded();
  await d.click();
  await sayfa.waitForTimeout(250);
  return n;
};
const menuKapat = async (sayfa) => { await sayfa.keyboard.press("Escape"); await sayfa.waitForTimeout(150); };

let kod = 0;
try {
  for (const [ad, genislik, yukseklik] of [["masaüstü", 1440, 900], ["telefon", 390, 844]]) {
    const { ctx, sayfa } = await oturum(genislik, yukseklik);

    /* ---------- K1: uzun listenin İLK satırı ---------- */
    await git(sayfa, LISTE);
    await esit(`K1-${ad} uzun listenin ilk satırında menü açılıyor ve kırpılmıyor`, async () => {
      await sayfa.locator(".kaynak-liste-kap").evaluate((el) => { el.scrollTop = 0; });
      await menuAc(sayfa, "ilk");
      const o = await menuOlcusu(sayfa);
      if (!o.acik) return "menü açılmadı";
      return `ustKatman:${o.ustKatman} ekranIci:${o.ekranIci} konum:${konumDogru(o)} sil:${o.silGorunur}/${o.silTiklanabilir}`;
    }, "ustKatman:true ekranIci:true konum:true sil:true/true");
    await esit(`K1b-${ad} ilk satırda menü düğmenin ALTINDA açılıyor`, async () => {
      const o = await menuOlcusu(sayfa);
      return o.altBosluk >= o.yukseklik + 14 ? `altta:${o.altta}` : `yer yok (${o.altBosluk}<${o.yukseklik}) ustte:${o.ustte} ekranIci:${o.ekranIci}`;
    }, (v) => v === "altta:true" || /ustte:true|ekranIci:true/.test(v));
    await cek(sayfa, `k1-ilk-satir-${genislik}`);
    await menuKapat(sayfa);

    /* ---------- K2: uzun listenin SON satırı ---------- */
    await esit(`K2-${ad} son satırda menü ekranın içinde ve sil tıklanabilir`, async () => {
      await sayfa.locator(".kaynak-liste-kap").evaluate((el) => { el.scrollTop = el.scrollHeight; });
      await sayfa.waitForTimeout(200);
      await menuAc(sayfa, "son");
      const o = await menuOlcusu(sayfa);
      if (!o.acik) return "menü açılmadı";
      return `ekranIci:${o.ekranIci} konum:${konumDogru(o)} sil:${o.silGorunur}/${o.silTiklanabilir}`;
    }, "ekranIci:true konum:true sil:true/true");
    await esit(`K2b-${ad} son satırda altta yer yoksa ÜSTE geçiyor`, async () => {
      const o = await menuOlcusu(sayfa);
      return o.altBosluk >= o.yukseklik + 14 ? `altta yer var, altta:${o.altta}` : `ustte:${o.ustte || o.ekranIci}`;
    }, (v) => v === "ustte:true" || v === "altta yer var, altta:true");
    await cek(sayfa, `k2-son-satir-${genislik}`);
    await menuKapat(sayfa);

    /*
      K2c: YUKARI TAŞMA DALI. Normal ölçülerde son satırın altında da yer
      kalıyor ve menü aşağı açılıyor; bu doğru ama "yer yoksa üste geç"
      kuralını SINAMIYOR. Burada ekran, düğmenin altında menü sığmayacak
      kadar kısaltılıyor: ölçü veriden değil, o anda ölçülen düğme ve
      menü boyundan hesaplanıyor.
    */
    await esit(`K2c-${ad} altta yer kalmayınca menü ÜSTE geçiyor`, async () => {
      let o = null;
      /* Ekran kısaldıkça düzen yeniden akıyor ve son satır da yukarı
         kayıyor; tek adımda hesaplanan yükseklik yetmeyebiliyor. */
      for (let deneme = 0; deneme < 6; deneme += 1) {
        await sayfa.locator(".kaynak-liste-kap").evaluate((el) => { el.scrollTop = el.scrollHeight; });
        await sayfa.waitForTimeout(150);
        await menuAc(sayfa, "son");
        o = await menuOlcusu(sayfa);
        if (!o.acik) return "menü açılmadı";
        if (o.altBosluk < o.yukseklik + 14) break;
        const dugmeAlti = await sayfa.evaluate(() => Math.round((document.querySelector(".kaynak-satir-menu[data-acik]") ?? document.querySelector(".kaynak-satir-menu[open] > summary")).getBoundingClientRect().bottom));
        await menuKapat(sayfa);
        const simdiki = sayfa.viewportSize().height;
        const hedef = Math.max(380, Math.min(Math.round(dugmeAlti + o.yukseklik / 2), simdiki - 100));
        if (hedef >= simdiki) break;
        await sayfa.setViewportSize({ width: genislik, height: hedef });
        await sayfa.waitForTimeout(400);
      }
      await cek(sayfa, `k2c-yukari-${genislik}`);
      await menuKapat(sayfa);
      await sayfa.setViewportSize({ width: genislik, height: yukseklik });
      await sayfa.waitForTimeout(300);
      if (!o || !o.acik) return "menü açılmadı";
      if (o.altBosluk >= o.yukseklik + 14) return `kısaltma yetmedi (bosluk ${o.altBosluk} >= ${o.yukseklik})`;
      return `ustte:${o.ustte} ekranIci:${o.ekranIci} sil:${o.silGorunur}/${o.silTiklanabilir}`;
    }, "ustte:true ekranIci:true sil:true/true");

    /* ---------- K3: çalışmaya bağlı OLMAYAN tek kaynak ---------- */
    await git(sayfa, BAGSIZ);
    await esit(`K3-${ad} bağsız tek kaynakta menü açılıyor, sil tıklanabilir`, async () => {
      const n = await menuAc(sayfa, "ilk");
      const o = await menuOlcusu(sayfa);
      if (!o.acik) return "menü açılmadı";
      return `satir:${n} ekranIci:${o.ekranIci} konum:${konumDogru(o)} sil:${o.silGorunur}/${o.silTiklanabilir}`;
    }, "satir:1 ekranIci:true konum:true sil:true/true");
    await cek(sayfa, `k3-bagsiz-tek-${genislik}`);
    await menuKapat(sayfa);
    await ctx.close();
  }

  /* ---------- K4: silme akışı (yalnızca bir kez, sentetik kaynakla) ---------- */
  {
    const { ctx, sayfa } = await oturum(1440, 900);
    await git(sayfa, LISTE);
    const silSatiriniAc = async () => {
      const satir = sayfa.locator(".kaynak-satiri", { hasText: SILINECEK });
      await satir.scrollIntoViewIfNeeded();
      await satir.locator("button.kaynak-satir-menu, .kaynak-satir-menu > summary").click();
      await sayfa.waitForTimeout(250);
    };
    const silTikla = async (karar) => {
      let soru = null;
      const kanca = async (dl) => { soru = dl.message(); await (karar === "onayla" ? dl.accept() : dl.dismiss()); };
      sayfa.on("dialog", kanca);
      await sayfa.locator(".kaynak-satir-menu-liste:popover-open button, .kaynak-satir-menu[open] .kart-menu-liste button", { hasText: "Kaynağı sil" }).click();
      await sayfa.waitForTimeout(2500);
      sayfa.off("dialog", kanca);
      return soru;
    };

    await esit("K4a onay sorusu kaynağın adıyla çıkıyor ve VAZGEÇİNCE silinmiyor", async () => {
      const once = kaynakSayisi();
      await silSatiriniAc();
      const soru = await silTikla("vazgec");
      return `soru:${Boolean(soru && soru.includes(SILINECEK))} geriAlinamaz:${Boolean(soru && /geri alınamaz/.test(soru))} duruyor:${silinecekVar()} sayiAyni:${kaynakSayisi() === once}`;
    }, "soru:true geriAlinamaz:true duruyor:true sayiAyni:true");

    await esit("K4b onaylayınca kaynak gerçekten siliniyor", async () => {
      const once = kaynakSayisi();
      await git(sayfa, LISTE);
      await silSatiriniAc();
      await silTikla("onayla");
      await sayfa.waitForTimeout(1500);
      return `silindi:${!silinecekVar()} birAzaldi:${kaynakSayisi() === once - 1}`;
    }, "silindi:true birAzaldi:true");
    await cek(sayfa, "k4-silme-sonrasi");
    await ctx.close();
  }
} finally {
  await tarayici.close();
  psql(`delete from public.literature_sources where owner_id = ${q(KULLANICI)}`);
  psql(`delete from public.academic_projects where owner_id = ${q(KULLANICI)}`);
  await auth(`/admin/users/${KULLANICI}`, {}, "DELETE");
}

const gecen = sonuclar.filter((s) => s.durum === "PASS").length;
const dusen = sonuclar.length - gecen;
console.log(`\n${gecen} PASS · ${dusen} FAIL`);
for (const s of sonuclar.filter((x) => x.durum === "FAIL")) console.log(` - ${s.ad}: ${s.not}`);
fs.mkdirSync(path.join(KOK, "scripts/yerel-yigin/sonuclar"), { recursive: true });
fs.writeFileSync(
  path.join(KOK, "scripts/yerel-yigin/sonuclar/kaynak-menu-kabul.json"),
  `${JSON.stringify({ tarih: new Date().toISOString(), head: HEAD, buildId: BUILD_ID, uygulama: UYG, gecen, dusen, sonuclar }, null, 2)}\n`,
  "utf8",
);
kod = dusen ? 1 : 0;
process.exit(kod);
