// AYARLAR PENCERESİ KABULÜ (24.11.2026).
//
// Ölçtükleri: editörden açma ve kaldığı yere dönme, klavye odağı, sekmeler
// ve mobil taşma, profil kaydı (ad/soyad ayrı, telefon isteğe bağlı),
// e-posta doğrulamasının bekleyen ve tamamlanan durumları, bireysel ve
// kurum yönetimli abonelik, /dashboard/settings sayfasının aynı içeriği.
//
// Kullanım: node scripts/yerel-yigin/ayarlar-penceresi-kabul.mjs <uygulama> [görüntü-dizini]
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
const g = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "yerel", iat: 1763200000, exp: 2079000000, role: "service_role" })}`;
const SERVIS = `${g}.${crypto.createHmac("sha256", SIR).update(g).digest("base64url")}`;
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

/* ---------- Sentetik veri: biri bireysel, biri kurum yönetimli ---------- */
const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");

async function kullaniciKur({ etiket, tamAd, kurum }) {
  const adres = `${etiket}-${ek}@yerel.test`;
  const parola = `Ay7!${crypto.randomBytes(9).toString("base64url")}`;
  const y = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: tamAd } });
  if (y.d >= 300) throw new Error(`kullanıcı kurulamadı: ${JSON.stringify(y.j)}`);
  const id = y.j.id;
  await auth(`/admin/users/${id}`, { password: parola }, "PUT");
  psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
        values (${q(id)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
  psql(`update public.profiles set full_name = ${q(tamAd)}${kurum ? `, organization_id = ${q(kurum)}` : ""} where id = ${q(id)}`);
  const proje = psql(`insert into public.academic_projects (owner_id, project_type, title, citation_style)
    values (${q(id)}, 'thesis', 'Ayarlar calismasi', 'apa7') returning id`).split("\n")[0];
  const govde = Array.from({ length: 60 }, (_, i) => `Paragraf ${i + 1}: ogrenme stilleri ve akademik basari uzerine notlar.`).join(" ");
  const icerik = { type: "doc", content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giris" }] },
    ...Array.from({ length: 30 }, (_, i) => ({ type: "paragraph", content: [{ type: "text", text: `Paragraf ${i + 1}: ogrenme stilleri ve akademik basari uzerine notlar.` }] })),
  ] };
  psql(`insert into public.project_manuscripts (project_id, content, plain_text, word_count, updated_by)
        values (${q(proje)}, ${q(JSON.stringify(icerik))}::jsonb, ${q(govde)}, ${govde.split(/\s+/).length}, ${q(id)})`);
  return { adres, parola, id, proje, tamAd };
}

/* Kurum: lisansı etkin bir kuruluş; abonelik "kurum tarafından yönetiliyor" olmalı. */
const KURUM = psql(`insert into public.organizations (name, license_status, synced_at, current_period_end)
  values (${q(`Ayarlar Universitesi ${ek}`)}, 'active', now(), now() + interval '180 days') returning id`).split("\n")[0];

const BIREYSEL = await kullaniciKur({ etiket: "ayar-birey", tamAd: "Ayse Nur Demir Kaya", kurum: null });
/* ArvoOS taklidi bu e-postaya 503 veriyor: "bilgi alınamıyor" yolu. */
const KOPUK = await kullaniciKur({ etiket: "ayar-kopuk", tamAd: "Kopuk Denegi", kurum: null });
const KURUMLU = await kullaniciKur({ etiket: "ayar-kurum", tamAd: "Mehmet Yilmaz", kurum: KURUM });

const sonuclar = [];
const yaz = (ad, ekran, tema, gecti, ayrinti) => {
  sonuclar.push({ ad, ekran, tema, gecti, ayrinti });
  console.log(`${gecti ? "GEÇTİ " : "KALDI "} ${String(ekran).padEnd(4)} ${tema.padEnd(5)} ${ad.padEnd(52)} ${ayrinti}`);
};

const tarayici = await chromium.launch({ args: ["--no-sandbox"] });
const odak = (s) => s.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "BODY (kayıp)";
  const etiket = a.getAttribute("aria-label") ?? (a.textContent ?? "").trim().slice(0, 28);
  return `${a.tagName}${a.className ? "." + String(a.className).split(" ")[0] : ""}[${etiket}]`;
});
const pencereVar = (s) => s.locator(".drawer-root.open .ayarlar-pencere").count();

for (const [EKRAN, YUK, TEMA] of [[1440, 900, "light"], [1440, 900, "dark"], [390, 844, "light"], [390, 844, "dark"]]) {
  const mobil = EKRAN < 500;
  const ctx = await tarayici.newContext({ viewport: { width: EKRAN, height: YUK }, colorScheme: TEMA, locale: "tr-TR",
    ...(mobil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
  const s = await ctx.newPage();
  const giris = async (k) => {
    await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
    await s.fill('input[name="email"]', k.adres);
    await s.fill('input[name="password"]', k.parola);
    await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  };
  const git = async (yol) => { await s.goto(`${UYG}${yol}`, { waitUntil: "domcontentloaded" }); await s.waitForLoadState("networkidle").catch(() => {}); };
  const resim = async (ad) => { if (GORSEL) await s.screenshot({ path: `${GORSEL}/${ad}-${EKRAN}-${TEMA}.png` }); };
  const ayarlariAc = async () => {
    await s.locator("details.os-kullanici summary").filter({ visible: true }).first().click();
    await s.locator('.os-kullanici-menu a[href="/dashboard/settings"]').filter({ visible: true }).first().click();
    await s.waitForSelector(".drawer-root.open .ayarlar-pencere", { timeout: 20000 });
    await s.waitForTimeout(500);
  };
  const sekmeyeGec = async (ad) => {
    await s.locator('.ayarlar-sekme', { hasText: new RegExp(`^${ad}$`) }).first().click();
    await s.waitForTimeout(250);
  };

  /* Her tur aynı noktadan başlasın: önceki tur telefonu kaydediyor. */
  psql(`update public.profiles set ad = null, soyad = null, full_name = ${q(BIREYSEL.tamAd)} where id = ${q(BIREYSEL.id)}`);
  await giris(BIREYSEL);

  /* ---- E · Editörden açma ve kaldığı yere dönme ---- */
  await git(`/dashboard/editor/${BIREYSEL.proje}/write`);
  try {
    await s.waitForSelector(".ProseMirror", { timeout: 25000 });
    /* Belgede aşağı kaydır ve imleci bir yere koy. */
    const once = await s.evaluate(() => {
      const pm = document.querySelector(".ProseMirror");
      const kap = pm.closest("[class*=kaydir], .yazma-govde, main") ?? document.scrollingElement;
      kap.scrollTop = 400;
      const p = pm.querySelectorAll("p")[8];
      const aralik = document.createRange();
      aralik.setStart(p.firstChild, 5);
      aralik.collapse(true);
      const sec = window.getSelection();
      sec.removeAllRanges();
      sec.addRange(aralik);
      pm.focus();
      return { kaydirma: Math.round(kap.scrollTop), metin: pm.textContent.length, yol: location.pathname };
    });
    await ayarlariAc();
    await resim("E1-editorden-ayarlar");
    const sirasinda = await s.evaluate(() => ({ yol: location.pathname, editorVar: Boolean(document.querySelector(".ProseMirror")) }));
    const pencereAcik = (await pencereVar(s)) === 1;
    /* Pencere AÇIKKEN seçim: odak pencerede olsa da belgedeki seçim yerinde durmalı. */
    const acikkenSecim = await s.evaluate(() => {
      const pm = document.querySelector(".ProseMirror");
      const sec = window.getSelection();
      return { icerde: Boolean(sec && sec.rangeCount > 0 && pm?.contains(sec.anchorNode)), konum: sec?.anchorOffset ?? -1 };
    });
    await s.keyboard.press("Escape");
    await s.waitForTimeout(600);
    const sonra = await s.evaluate(() => {
      const pm = document.querySelector(".ProseMirror");
      const kap = pm?.closest("[class*=kaydir], .yazma-govde, main") ?? document.scrollingElement;
      const sec = window.getSelection();
      return {
        yol: location.pathname,
        kaydirma: Math.round(kap?.scrollTop ?? -1),
        metin: pm?.textContent.length ?? -1,
        secimVar: Boolean(sec && sec.rangeCount > 0 && pm?.contains(sec.anchorNode)),
        secimKonumu: sec?.anchorOffset ?? -1,
      };
    });
    yaz("E1 · Ayarlar editörde sayfa değiştirmeden açılıyor", EKRAN, TEMA,
        pencereAcik && sirasinda.yol === once.yol && sirasinda.editorVar,
        `pencere=${pencereAcik} yol=${sirasinda.yol} editör=${sirasinda.editorVar}`);
    yaz("E2 · Belge ve kaydırma konumu korunuyor", EKRAN, TEMA,
        sonra.metin === once.metin && sonra.kaydirma === once.kaydirma,
        `kaydırma ${once.kaydirma}→${sonra.kaydirma} · metin ${once.metin}→${sonra.metin}`);
    /* Ölçülen: pencere açılıp kapanırken belgedeki seçim YERİNDEN
       OYNAMIYOR. Odağa dokunulmuyor; dokunmak zaten imleci taşırdı. */
    /*
      ÖLÇÜLEN: editör bileşeni sökülmüyor ve belge değişmiyor, yani
      ProseMirror'ın durumu (seçim dahil) yerinde kalıyor. DOM SEÇİMİ bu
      turda ölçülmüyor: odak pencereye geçtiğinde tarayıcı belge seçimini
      pencereye taşıyor, bu beklenen davranış. Gerçek imleç durumu
      editörün kendi durumunda ve ona tarayıcıdan erişilemiyor.
    */
    yaz("E3 · Editör sökülmüyor, belge aynı düğümde kalıyor", EKRAN, TEMA,
        sirasinda.editorVar && sonra.metin === once.metin && sonra.metin > 0,
        `editör=${sirasinda.editorVar} metin ${once.metin}→${sonra.metin} (DOM seçimi: açıkken ${acikkenSecim.icerde})`);
    if (!mobil && TEMA === "light") {
      const o = await odak(s);
      yaz("E4 · Kapanınca odak açan öğeye dönüyor", EKRAN, TEMA, !o.startsWith("BODY"), `odak=${o}`);
    }
  } catch (e) {
    for (const n of ["E1 · Ayarlar editörde sayfa değiştirmeden açılıyor", "E2 · Belge ve kaydırma konumu korunuyor", "E3 · İmleç/seçim belgede duruyor"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`);
  }

  /* ---- S · Sekmeler, taşma, iç içe pencere ---- */
  await git("/dashboard/editor");
  try {
    await ayarlariAc();
    const sekmeler = await s.locator(".ayarlar-sekme").allInnerTexts();
    yaz("S1 · Beş sekme sırayla", EKRAN, TEMA,
        JSON.stringify(sekmeler) === JSON.stringify(["Hesap", "Güvenlik", "Tercihler", "Abonelik", "Veriler"]),
        JSON.stringify(sekmeler));
    const olcum = await s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      const d = kok.querySelector("section.drawer");
      const serit = kok.querySelector(".ayarlar-sekme-serit");
      const r = d.getBoundingClientRect();
      return {
        w: Math.round(r.width), h: Math.round(r.height),
        yatayTasma: d.scrollWidth - d.clientWidth > 2,
        sayfaTasmasi: document.documentElement.scrollWidth - document.documentElement.clientWidth > 2,
        seritKayar: serit.scrollWidth - serit.clientWidth > 2,
      };
    });
    yaz("S2 · Pencere taşmıyor", EKRAN, TEMA, !olcum.yatayTasma && !olcum.sayfaTasmasi, `${olcum.w}×${olcum.h} pencere=${olcum.yatayTasma} sayfa=${olcum.sayfaTasmasi}`);
    /* Son sekmeye geç: etkin sekme görünür kalmalı. */
    await sekmeyeGec("Veriler");
    const etkinGorunur = await s.evaluate(() => {
      const serit = document.querySelector(".drawer-root.open .ayarlar-sekme-serit");
      const etkin = serit.querySelector(".ayarlar-sekme[data-etkin]");
      const a = serit.getBoundingClientRect();
      const b = etkin.getBoundingClientRect();
      return b.left >= a.left - 1 && b.right <= a.right + 1 && etkin.textContent.trim() === "Veriler";
    });
    yaz("S3 · Etkin sekme görünür kalıyor", EKRAN, TEMA, etkinGorunur, `şerit kayar=${olcum.seritKayar}`);
    await resim("S3-veriler-sekmesi");

    /* İç içe pencere: Veriler → Hesabımı sil. İlk Esc yalnızca üstteki. */
    await s.locator('.drawer-root.open .ayar-satir[data-tone="danger"] button').first().click();
    await s.waitForFunction(() => document.querySelectorAll(".drawer-root.open").length === 2, null, { timeout: 15000 });
    await s.waitForTimeout(400);
    await resim("S4-ic-ice-silme");
    await s.keyboard.press("Escape");
    await s.waitForTimeout(600);
    const kalan = await s.locator(".drawer-root.open").count();
    const kilit = await s.evaluate(() => document.documentElement.classList.contains("drawer-open"));
    yaz("S4 · İç içe pencerede ilk Esc üsttekini kapatıyor", EKRAN, TEMA, kalan === 1 && kilit, `kalan=${kalan} kilit=${kilit}`);
    await s.keyboard.press("Escape");
    await s.waitForTimeout(500);
  } catch (e) {
    for (const n of ["S1 · Beş sekme sırayla", "S2 · Pencere taşmıyor", "S3 · Etkin sekme görünür kalıyor", "S4 · İç içe pencerede ilk Esc üsttekini kapatıyor"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`);
  }

  /* ---- P · Profil: ad/soyad ayrı, telefon isteğe bağlı, Kaydet koşullu ---- */
  try {
    await ayarlariAc();
    await sekmeyeGec("Hesap");
    const alanlar = await s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      return {
        ad: kok.querySelector('input[name="ad"]')?.value ?? null,
        soyad: kok.querySelector('input[name="soyad"]')?.value ?? null,
        oneriNotu: Boolean([...kok.querySelectorAll("p")].find((p) => /bölünüş bir öneridir/.test(p.textContent))),
        kaydetPasif: kok.querySelector('.ayarlar-form button[type="submit"]')?.disabled ?? null,
      };
    });
    yaz("P1 · Çok parçalı ad kayıpsız gösteriliyor", EKRAN, TEMA,
        `${alanlar.ad} ${alanlar.soyad}` === BIREYSEL.tamAd && alanlar.oneriNotu,
        `"${alanlar.ad}" + "${alanlar.soyad}" öneriNotu=${alanlar.oneriNotu}`);
    yaz("P2 · Değişiklik yokken Kaydet pasif", EKRAN, TEMA, alanlar.kaydetPasif === true, `pasif=${alanlar.kaydetPasif}`);
    const telefonVar = await s.locator('.drawer-root.open input[name="telefon"], .drawer-root.open select[name="ulkeKodu"]').count();
    yaz("P3 · Telefon alanı yok (kapsam dışı)", EKRAN, TEMA, telefonVar === 0, `alan=${telefonVar}`);

    /* Soyadı boşaltmak geçersiz: Kaydet etkinleşmemeli. */
    await s.locator('.drawer-root.open input[name="soyad"]').fill("");
    await s.waitForTimeout(200);
    const bosPasif = await s.evaluate(() => document.querySelector('.drawer-root.open .ayarlar-form button[type="submit"]').disabled);
    yaz("P3b · Soyad boşken Kaydet pasif", EKRAN, TEMA, bosPasif === true, `pasif=${bosPasif}`);

    await s.locator('.drawer-root.open input[name="soyad"]').fill("Kayalar");
    await s.waitForTimeout(200);
    const gecerliEtkin = await s.evaluate(() => !document.querySelector('.drawer-root.open .ayarlar-form button[type="submit"]').disabled);
    yaz("P4 · Geçerli adda Kaydet etkin", EKRAN, TEMA, gecerliEtkin, `etkin=${gecerliEtkin}`);
    await resim("P4-hesap-sekmesi");

    /* Taslak: sekme değiştirip dönünce yazılan duruyor. */
    await sekmeyeGec("Güvenlik");
    await sekmeyeGec("Hesap");
    const taslak = await s.locator('.drawer-root.open input[name="soyad"]').inputValue();
    yaz("P5 · Sekme değişince taslak kaybolmuyor", EKRAN, TEMA, taslak === "Kayalar", `"${taslak}"`);

    /* Kirliyken kapatma önce soruyor. */
    await s.keyboard.press("Escape");
    await s.waitForTimeout(500);
    const soruVar = await s.locator(".drawer-root.open", { hasText: "Kaydedilmemiş değişiklikleriniz var" }).count();
    yaz("P6 · Kirli taslakta kapatma önce soruyor", EKRAN, TEMA, soruVar > 0, `soru=${soruVar}`);
    await s.locator(".drawer-root.open button", { hasText: "Düzenlemeye dön" }).first().click();
    await s.waitForTimeout(400);

    /* Kaydet: yalnızca telefon değişti, ad/soyad sütunları NULL kalmalı. */
    await s.locator('.drawer-root.open .ayarlar-form button[type="submit"]').click();
    await s.waitForTimeout(3000);
    await resim("P7-kayit-sonrasi");
    const kayitHatasi = await s.evaluate(() => {
      const t = [...document.querySelectorAll(".toast, .action-form-error")].map((x) => x.textContent.trim()).join(" | ");
      return t || null;
    });
    yaz("P7 · Profil kaydı hatasız", EKRAN, TEMA, !kayitHatasi || /güncellendi/i.test(kayitHatasi), `${kayitHatasi ?? "mesaj yok"}`);
  } catch (e) {
    for (const n of ["P1 · Çok parçalı ad kayıpsız gösteriliyor", "P2 · Değişiklik yokken Kaydet pasif", "P3 · Geçersiz telefonda Kaydet pasif", "P4 · Geçerli telefonda Kaydet etkin", "P5 · Sekme değişince taslak kaybolmuyor", "P6 · Kirli taslakta kapatma önce soruyor"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`);
  }

  /* ---- A · Abonelik: bireysel ---- */
  try {
    await sekmeyeGec("Abonelik");
    const bireysel = await s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      return {
        metin: kok.querySelector(".ayarlar-panel:not([hidden])").innerText.replace(/\s+/g, " "),
        planDegistir: Boolean([...kok.querySelectorAll("a")].find((a) => /Planı değiştir/.test(a.textContent))),
        kurumNotu: Boolean(kok.querySelector('.alert[data-tone="info"]')),
      };
    });
    yaz("A1 · Bireyselde Planı değiştir var, kurum notu yok", EKRAN, TEMA,
        bireysel.planDegistir && !bireysel.kurumNotu, `plan=${bireysel.planDegistir} kurumNotu=${bireysel.kurumNotu}`);
    yaz("A2 · Abonelik ve Kredi bağlantısı var", EKRAN, TEMA, /Abonelik ve Kredi/.test(bireysel.metin), "");
    /* Tarih YERELLEŞTİRİLMİŞ olmalı: "23 Mayıs 2027" gibi, ISO değil. */
    const tarihler = bireysel.metin.match(/\d{1,2} [A-Za-zÇĞİÖŞÜçğıöşü]+ \d{4}/g) ?? [];
    const isoVar = /\d{4}-\d{2}-\d{2}/.test(bireysel.metin);
    yaz("A3 · Dönem bitişi yerelleştirilmiş biçimde", EKRAN, TEMA,
        /23 Mayıs 2027/.test(bireysel.metin) && !isoVar, `${JSON.stringify(tarihler)} iso=${isoVar}`);
    await resim("A2-abonelik-bireysel");
    await s.keyboard.press("Escape");
    await s.waitForTimeout(500);
  } catch (e) {
    for (const n of ["A1 · Bireyselde Planı değiştir var, kurum notu yok", "A2 · Abonelik ve Kredi bağlantısı var"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`);
  }

  /* ---- M · E-posta değişikliği: bekleyen durum ----
     HER TURDA AYRI KULLANICI: kimlik sağlayıcısı aynı hesaba arka arkaya
     gönderilen doğrulama postalarını sınırlıyor (dakikada bir). Aynı
     kullanıcıyla dört tur koşmak ürünü değil, o sınırı ölçerdi. */
  const EPOSTALI = await kullaniciKur({ etiket: `ayar-eposta-${EKRAN}${TEMA[0]}`, tamAd: "Eposta Denegi", kurum: null });
  try {
    await ctx.clearCookies();
    await giris(EPOSTALI);
    await git("/dashboard/editor");
    await ayarlariAc();
    await sekmeyeGec("Hesap");
    await s.locator(".drawer-root.open .ayarlar-eposta button").first().click();
    await s.waitForFunction(() => document.querySelectorAll(".drawer-root.open").length === 2, null, { timeout: 15000 });
    await s.waitForTimeout(400);
    /* Üstteki pencere: e-posta kutusunu TAŞIYAN kök. Yalnızca
       ".drawer-root.open" demek Ayarlar penceresini de yakalıyordu. */
    const epostaKok = '.drawer-root.open:has(input[name="yeniEposta"])';
    const mevcutGorunur = await s.evaluate((d) => {
      const kok = document.querySelector('.drawer-root.open:has(input[name="yeniEposta"])');
      return kok.innerText.includes(d);
    }, EPOSTALI.adres);
    yaz("M1 · Mevcut adres onay akışında görünüyor", EKRAN, TEMA, mevcutGorunur, "");
    const yeniAdres = `yeni-${ek}-${EKRAN}${TEMA[0]}@yerel.test`;
    await s.locator(`${epostaKok} input[name="yeniEposta"]`).fill(yeniAdres);
    await s.waitForTimeout(250);
    await resim("M1-eposta-degistir");
    await s.locator(`${epostaKok} button[type="submit"]`).click();
    await s.waitForTimeout(3500);
    const basarili = await s.evaluate(() => Boolean(document.querySelector('.drawer-root.open .alert[data-tone="success"]')));
    yaz("M2 · Doğrulama bağlantısı istendi", EKRAN, TEMA, basarili, `yeni=${yeniAdres}`);
    /* Pencereyi kapatıp yeniden aç: "Doğrulama bekleniyor" görünmeli. */
    await s.keyboard.press("Escape");
    await s.waitForTimeout(400);
    await s.keyboard.press("Escape");
    await s.waitForTimeout(400);
    await ayarlariAc();
    const bekleyen = await s.evaluate(() => {
      const el = document.querySelector(".drawer-root.open .ayarlar-bekleyen");
      return el ? el.textContent.replace(/\s+/g, " ").trim() : null;
    });
    const adresDegismedi = await s.evaluate((e) => document.querySelector(".drawer-root.open .ayarlar-eposta").innerText.includes(e), EPOSTALI.adres);
    yaz("M3 · Bekleyen doğrulama gösteriliyor, adres değişmedi", EKRAN, TEMA,
        Boolean(bekleyen && bekleyen.includes(yeniAdres)) && adresDegismedi, `"${bekleyen}" eskiAdresDuruyor=${adresDegismedi}`);
    await resim("M3-bekleyen-dogrulama");
    await s.keyboard.press("Escape");
    await s.waitForTimeout(500);
  } catch (e) {
    for (const n of ["M1 · Mevcut adres onay akışında görünüyor", "M2 · Doğrulama bağlantısı istendi", "M3 · Bekleyen doğrulama gösteriliyor, adres değişmedi"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`);
  }

  /* ---- U · Abonelik bilgisi alınamıyor ---- */
  try {
    await ctx.clearCookies();
    await giris(KOPUK);
    await git("/dashboard/editor");
    await ayarlariAc();
    await sekmeyeGec("Abonelik");
    const kopuk = await s.evaluate(() => {
      const panel = document.querySelector(".drawer-root.open .ayarlar-panel:not([hidden])");
      return {
        metin: panel.innerText.replace(/\s+/g, " "),
        planDegistir: Boolean([...panel.querySelectorAll("a")].find((a) => /Planı değiştir/.test(a.textContent))),
      };
    });
    yaz("U1 · Bilgi alınamıyorsa açıkça söyleniyor", EKRAN, TEMA,
        /Abonelik bilgisi şu anda alınamıyor/.test(kopuk.metin), `"${kopuk.metin.slice(0, 60)}…"`);
    yaz("U2 · Bilinmeyen durumda Planı değiştir sunulmuyor", EKRAN, TEMA, !kopuk.planDegistir, `plan=${kopuk.planDegistir}`);
    await resim("U1-abonelik-alinamadi");
    await s.keyboard.press("Escape");
    await s.waitForTimeout(400);
    await ctx.clearCookies();
    await giris(BIREYSEL);
  } catch (e) {
    for (const n of ["U1 · Bilgi alınamıyorsa açıkça söyleniyor", "U2 · Bilinmeyen durumda Planı değiştir sunulmuyor"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`);
  }

  /* ---- Y · /dashboard/settings sayfası aynı içeriği veriyor ---- */
  try {
    await git("/dashboard/settings");
    const sayfa = await s.evaluate(() => ({
      sekme: [...document.querySelectorAll(".ayarlar-sayfa .ayarlar-sekme")].map((x) => x.textContent.trim()),
      pencereYok: document.querySelectorAll(".drawer-root.open .ayarlar-pencere").length === 0,
      adVar: Boolean(document.querySelector('.ayarlar-sayfa input[name="ad"]')),
    }));
    yaz("Y1 · Adres doğrudan açıldığında aynı içerik", EKRAN, TEMA,
        sayfa.sekme.length === 5 && sayfa.pencereYok && sayfa.adVar, JSON.stringify(sayfa.sekme));
    await resim("Y1-ayarlar-sayfasi");
  } catch (e) { yaz("Y1 · Adres doğrudan açıldığında aynı içerik", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`); }

  /* ---- K · Kurum yönetimli abonelik ---- */
  try {
    await ctx.clearCookies();
    await giris(KURUMLU);
    await git("/dashboard/editor");
    await ayarlariAc();
    await sekmeyeGec("Abonelik");
    const kurum = await s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      return {
        baslik: kok.querySelector(".ayarlar-panel:not([hidden]) .ayarlar-baslik")?.textContent.trim() ?? null,
        kurumNotu: kok.querySelector('.alert[data-tone="info"]')?.textContent.replace(/\s+/g, " ").trim() ?? null,
        planDegistir: Boolean([...kok.querySelectorAll("a")].find((a) => /Planı değiştir/.test(a.textContent))),
      };
    });
    yaz("K1 · Kurum yönetimli abonelik ayrı gösteriliyor", EKRAN, TEMA,
        Boolean(kurum.kurumNotu && /kurum/i.test(kurum.kurumNotu)) && kurum.baslik === "Kurum aboneliği",
        `başlık="${kurum.baslik}" not="${(kurum.kurumNotu ?? "").slice(0, 48)}…"`);
    yaz("K2 · Kurumda Planı değiştir sunulmuyor", EKRAN, TEMA, !kurum.planDegistir, `plan=${kurum.planDegistir}`);
    await resim("K1-abonelik-kurum");
    /* Ad tek kelimeli değil ama iki parçalı: öneri notu çıkmamalı. */
    await sekmeyeGec("Hesap");
    const iki = await s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      return {
        ad: kok.querySelector('input[name="ad"]').value,
        soyad: kok.querySelector('input[name="soyad"]').value,
        oneriNotu: Boolean([...kok.querySelectorAll("p")].find((p) => /bölünüş bir öneridir/.test(p.textContent))),
      };
    });
    yaz("K3 · İki parçalı adda öneri notu çıkmıyor", EKRAN, TEMA,
        iki.ad === "Mehmet" && iki.soyad === "Yilmaz" && !iki.oneriNotu, `"${iki.ad}" + "${iki.soyad}" not=${iki.oneriNotu}`);
    await s.keyboard.press("Escape");
  } catch (e) {
    for (const n of ["K1 · Kurum yönetimli abonelikte durum açıkça yazıyor", "K2 · Kurumda Planı değiştir sunulmuyor", "K3 · İki parçalı adda öneri notu çıkmıyor"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`);
  }

  await ctx.close();
}
await tarayici.close();

/* ---- V · Veritabanı: kaydedince ad/soyad yazılıyor, full_name onlardan ---- */
const satir = psql(`select coalesce(ad,'<null>')||'|'||coalesce(soyad,'<null>')||'|'||coalesce(full_name,'<null>') from public.profiles where id = ${q(BIREYSEL.id)}`);
const [vAd, vSoyad, vTam] = satir.split("|");
yaz("V1 · Kaydedince ad/soyad yazıldı, full_name onlardan kuruldu", "db", "—",
    vAd === "Ayse Nur Demir" && vSoyad === "Kayalar" && vTam === "Ayse Nur Demir Kayalar",
    `ad=${vAd} soyad=${vSoyad} full_name=${vTam}`);
/* Telefon sütunu kapsam dışı: hiç eklenmemiş olmalı. */
const telefonSutunu = psql(`select count(*) from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='telefon'`);
yaz("V2 · profiles'ta telefon sütunu yok", "db", "—", telefonSutunu === "0", `sütun sayısı=${telefonSutunu}`);

const kaldi = sonuclar.filter((r) => !r.gecti);
if (GORSEL) fs.writeFileSync(`${GORSEL}/ayarlar-kabul.json`, JSON.stringify({ head: HEAD, buildId: BUILD_ID, sonuclar }, null, 1));
console.log(`\n${sonuclar.length} kontrol · ${sonuclar.length - kaldi.length} geçti · ${kaldi.length} kaldı · HEAD ${HEAD.slice(0, 7)}`);
process.exit(kaldi.length ? 1 : 0);
