// TAKİP KABULÜ (24.11.2026): Destek gezinmesi, deneme metinleri, dosya seçici.
//
// Üç kusur canlı kabulde görüldü:
//   1. /dashboard/support bir YÖNLENDİRME; uygulama içinden tıklanınca
//      iki RSC turu boyunca içerik alanı boş kalıyordu.
//   2. Denemede kart "Sonraki yenileme" ve "Aylık asistan kredisi 1.000"
//      diyordu; denemede yenilenen bir şey yok ve hak 2 ÇALIŞMA.
//   3. .dropzone bırakma alanı gibi görünüyor ama onDrop yoktu:
//      sürüklenen dosya tarayıcıda açılıyordu.
//
// Kullanım: node scripts/yerel-yigin/takip-kabul.mjs <uygulama> [görüntü-dizini]
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
const psql = (sql) => execFileSync("psql", ["-h","127.0.0.1","-p","56432","-U","postgres","-At","-v","ON_ERROR_STOP=1","-c",sql],
  { env: { ...process.env, PGPASSWORD: "yerel-yigin" }, encoding: "utf8" }).trim();
const q = (x) => `'${String(x).replace(/'/g, "''")}'`;
const auth = async (yol, gv, m = "POST") => {
  const r = await fetch(`${GECIT}/auth/v1${yol}`, { method: m,
    headers: { apikey: SERVIS, Authorization: `Bearer ${SERVIS}`, "Content-Type": "application/json" }, body: JSON.stringify(gv) });
  return { d: r.status, j: await r.json().catch(() => ({})) };
};

const BUILD_ID = fs.existsSync(`${KOK}/.next/BUILD_ID`) ? fs.readFileSync(`${KOK}/.next/BUILD_ID`, "utf8").trim() : null;
try {
  const html = await (await fetch(`${UYG}/`)).text();
  if (!BUILD_ID || !html.includes(BUILD_ID)) throw new Error(`BUILD_ID (${BUILD_ID ?? "yok"}) sunulan sayfada yok`);
} catch (e) { console.error("Ön koşul yok:", e.message); process.exit(2); }

const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");
async function kullaniciKur({ etiket, tamAd }) {
  const adres = `${etiket}-${ek}@yerel.test`;
  const parola = `Tk7!${crypto.randomBytes(9).toString("base64url")}`;
  const y = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: tamAd } });
  if (y.d >= 300) throw new Error(`kullanıcı kurulamadı: ${JSON.stringify(y.j)}`);
  await auth(`/admin/users/${y.j.id}`, { password: parola }, "PUT");
  psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
        values (${q(y.j.id)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
  return { adres, parola, id: y.j.id };
}
const DENEME = await kullaniciKur({ etiket: "ayar-deneme", tamAd: "Deneme Kullanici" });
const AKTIF = await kullaniciKur({ etiket: "tk-aktif", tamAd: "Aktif Abone" });
psql(`insert into public.ai_bireysel_kredi_hesabi (user_id, donem, aylik_kalan, ek_bakiye)
      values (${q(AKTIF.id)}, date_trunc('month', now())::date, 640, 0)
      on conflict (user_id) do update set aylik_kalan = excluded.aylik_kalan`);

const sonuclar = [];
const yaz = (ad, ekran, tema, gecti, ayrinti) => {
  sonuclar.push({ ad, ekran, tema, gecti, ayrinti });
  console.log(`${gecti ? "GEÇTİ " : "KALDI "} ${String(ekran).padEnd(4)} ${tema.padEnd(5)} ${ad.padEnd(56)} ${ayrinti}`);
};
const tarayici = await chromium.launch({ args: ["--no-sandbox"] });

for (const [EKRAN, YUK, TEMA] of [[1440, 900, "light"], [1440, 900, "dark"], [390, 844, "light"], [390, 844, "dark"]]) {
  const mobil = EKRAN < 500;
  const ctx = await tarayici.newContext({ viewport: { width: EKRAN, height: YUK }, colorScheme: TEMA, locale: "tr-TR",
    ...(mobil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { deviceScaleFactor: 2 }) });
  await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
  const s = await ctx.newPage();
  const resim = async (ad) => { if (GORSEL) await s.screenshot({ path: `${GORSEL}/${ad}-${EKRAN}-${TEMA}.png`, fullPage: !mobil }); };
  const git = async (yol) => { await s.goto(`${UYG}${yol}`, { waitUntil: "domcontentloaded" }); await s.waitForLoadState("networkidle").catch(() => {}); };
  const giris = async (k) => {
    await ctx.clearCookies();
    await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
    await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
    await s.fill('input[name="email"]', k.adres);
    await s.fill('input[name="password"]', k.parola);
    await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  };

  /* ---- D · DENEME metinleri ---- */
  try {
    await giris(DENEME);
    await git("/dashboard/abonelik");
    await s.waitForSelector(".abonelik-kart", { timeout: 30000 });
    const d = await s.evaluate(() => {
      const m = document.querySelector(".abonelik-kartlar").innerText.replace(/\s+/g, " ");
      return {
        metin: m,
        yenilemeDiyor: /Sonraki yenileme/.test(m),
        denemeBitisi: /Deneme bitişi/.test(m),
        aylikKredi: /Aylık asistan kredisi/.test(m),
        denemeHakki: /Deneme hakkı/.test(m),
      };
    });
    /* Denemede yenilenen bir şey yok: tarih denemenin BİTİŞİ. */
    yaz("D1 · Denemede 'Sonraki yenileme' yazmıyor, 'Deneme bitişi' yazıyor", EKRAN, TEMA,
        !d.yenilemeDiyor && d.denemeBitisi, `yenileme=${d.yenilemeDiyor} denemeBitişi=${d.denemeBitisi}`);
    /* Denemede hak KREDİYLE değil SAYIYLA ölçülüyor; 1.000 kredi yanlış. */
    yaz("D2 · Denemede 'Aylık asistan kredisi' yazmıyor, deneme hakkı yazıyor", EKRAN, TEMA,
        !d.aylikKredi && d.denemeHakki, `aylıkKredi=${d.aylikKredi} denemeHakkı=${d.denemeHakki}`);
    yaz("D3 · İki kart birbiriyle çelişmiyor", EKRAN, TEMA,
        !(/Aylık asistan kredisi/.test(d.metin) && /kez kullanabilirsiniz/.test(d.metin)),
        `"${d.metin.slice(0, 90)}"`);
    await resim("SONRA-deneme-abonelik");
  } catch (e) { yaz("D · deneme metinleri", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`); }

  /* ---- S · Destek bağlantısı: boş ekran kalmıyor ---- */
  try {
    await s.locator("button", { hasText: /Planı yönet|Abonelik özeti/ }).first().click();
    await s.waitForSelector(".drawer-root.open .plan-yonet", { timeout: 20000 });
    await s.locator(".drawer-root.open a").filter({ hasText: /Destek/ }).first().click();
    /* İçerik alanı ne kadar süre BOŞ kalıyor? Yönlendirme turu kalkınca
       ilk ölçümde bile içerik gelmiş olmalı. */
    const olcumler = [];
    for (const ms of [250, 600, 1200]) {
      await s.waitForTimeout(ms === 250 ? 250 : 350);
      olcumler.push(await s.evaluate(() => {
        const ana = document.querySelector("main");
        const metin = (ana?.innerText ?? "").replace(/\s+/g, " ").trim();
        return { yol: location.pathname, uzunluk: metin.length, yukleniyor: /Yükleniyor|Loading/i.test(metin) };
      }));
    }
    const son = olcumler[olcumler.length - 1];
    yaz("S1 · Destek sayfası içerikle geliyor", EKRAN, TEMA, son.uzunluk > 200 && /expert-requests/.test(son.yol),
        `yol=${son.yol} uzunluk=${son.uzunluk}`);
    /*
      ASIL DÜZELTME: yönlendirme turu kalktı. Eskiden gezinme önce
      /dashboard/support'a uğruyor, onun RSC yanıtı yönlendirme
      döndürüyor, sonra gerçek sayfa çekiliyordu — iki tur. Artık
      bağlantı doğrudan hedefe gidiyor, hiçbir ölçümde ara adres yok.
    */
    yaz("S2 · Yönlendirme turu yok (ara adres /dashboard/support değil)", EKRAN, TEMA,
        olcumler.every((o) => !/\/dashboard\/support/.test(o.yol)),
        olcumler.map((o) => o.yol).join(" → "));
    /* Geçiş sırasında alan ya içerik ya da açık bir "Yükleniyor…"
       göstermeli; bomboş bir alan kullanıcıya hiçbir şey söylemiyor. */
    yaz("S3 · Geçişte boş alan yok (içerik ya da 'Yükleniyor…')", EKRAN, TEMA,
        olcumler.every((o) => o.uzunluk > 200 || o.yukleniyor),
        olcumler.map((o) => (o.yukleniyor ? "yükleniyor" : o.uzunluk)).join(" → "));
    await resim("SONRA-destek");
  } catch (e) { yaz("S · destek gezinmesi", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`); }

  /* ---- A · AKTİF abonelik: kredi paketi seçimi, mobil kaydırma ---- */
  try {
    await giris(AKTIF);
    await git("/dashboard/abonelik");
    await s.waitForSelector(".abonelik-kart", { timeout: 30000 });
    const a = await s.evaluate(() => {
      const m = document.querySelector(".abonelik-kartlar").innerText.replace(/\s+/g, " ");
      return { metin: m, yenileme: /Sonraki yenileme/.test(m), aylikKredi: /Aylık asistan kredisi/.test(m),
        krediIncele: [...document.querySelectorAll("button")].some((b) => /Kredi paketlerini incele/.test(b.textContent)) };
    });
    yaz("A1 · Aktifte 'Sonraki yenileme' ve aylık kredi yazıyor", EKRAN, TEMA, a.yenileme && a.aylikKredi,
        `yenileme=${a.yenileme} aylıkKredi=${a.aylikKredi}`);
    yaz("A2 · Aktifte kredi satın alma sunuluyor", EKRAN, TEMA, a.krediIncele, `krediİncele=${a.krediIncele}`);
    await resim("SONRA-aktif-abonelik");

    await s.locator("button", { hasText: /Kredi paketlerini incele/ }).first().click();
    await s.waitForSelector(".drawer-root.open .karsilastir", { timeout: 20000 });
    await s.waitForTimeout(500);
    /* ÖDEME YOK: yalnızca seçim yapılıyor, gönder düğmesine BASILMIYOR. */
    await s.locator(".drawer-root.open .karsilastir-sec input").first().check();
    await s.waitForTimeout(350);
    const k = await s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      const kartlar = [...kok.querySelectorAll(".karsilastir-sutun")].map((x) => ({
        baslik: (x.querySelector("h3")?.textContent ?? "").trim(),
        secili: x.dataset.secili !== undefined,
        guclu: getComputedStyle(x).boxShadow.includes("inset"),
        isaret: Boolean(x.querySelector(".karsilastir-secildi")),
        yuz: /100 kredi/.test(x.innerText),
      }));
      return { kartlar, ozet: kok.querySelector(".karsilastir-ozet")?.innerText.replace(/\s+/g, " ") ?? null };
    });
    const guclu = k.kartlar.filter((x) => x.guclu);
    yaz("A3 · Kredi paketi seçimi: çerçeve seçilide, her kartta 100 kredi", EKRAN, TEMA,
        k.kartlar.length > 0 && guclu.length === 1 && guclu[0].secili && guclu[0].isaret && k.kartlar.every((x) => x.yuz),
        `güçlü=[${guclu.map((x) => x.baslik).join(", ")}] kart=${k.kartlar.length}`);
    yaz("A4 · Seçimde toplam tahsilat okunuyor", EKRAN, TEMA, Boolean(k.ozet && /Toplam tahsilat/.test(k.ozet)), `"${(k.ozet ?? "").slice(0, 70)}"`);
    await resim("SONRA-kredi-secimi");
    if (mobil) {
      const kay = await s.evaluate(() => {
        const kok = document.querySelector(".drawer-root.open");
        const gv = kok.querySelector(".drawer-body");
        const once = gv.scrollTop; gv.scrollTop = gv.scrollHeight;
        const dg = kok.querySelector('button[type="submit"]');
        const r = dg.getBoundingClientRect();
        const orta = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { kaydirabilir: gv.scrollHeight - gv.clientHeight > 2, ilerledi: gv.scrollTop > once,
          ekranda: r.top >= 0 && r.bottom <= window.innerHeight, ustunde: Boolean(dg.contains(orta) || dg === orta) };
      });
      yaz("A5 · Mobilde kaydırma ve eylem erişilebilir", EKRAN, TEMA,
          kay.kaydirabilir && kay.ilerledi && kay.ekranda && kay.ustunde,
          `kaydırılabilir=${kay.kaydirabilir} ilerledi=${kay.ilerledi} ekranda=${kay.ekranda} tıklanabilir=${kay.ustunde}`);
      await resim("SONRA-kredi-mobil-kaydirilmis");
    }
    await s.keyboard.press("Escape");
    await s.waitForTimeout(400);
  } catch (e) { yaz("A · aktif abonelik", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`); }

  /* ---- F · Dosya seçici: sürükle–bırak GERÇEKTEN çalışıyor ---- */
  try {
    /* Kılavuz penceresi ÇALIŞMA AYRINTI görünümünde (calisma-durum-karti);
       çalışma listesinde yok. Çalışma yoksa önce açılıyor. */
    await git("/dashboard/editor");
    await s.waitForTimeout(900);
    let calismaId = await s.evaluate(() =>
      document.querySelector('a[href*="/dashboard/editor/"]')?.getAttribute("href")?.split("/")[3] ?? null);
    if (!calismaId) {
      await s.locator("button, a", { hasText: /^Yeni çalışma$/ }).first().click();
      await s.waitForSelector('.drawer-root.open input[name="title"]', { timeout: 20000 });
      await s.fill('.drawer-root.open input[name="title"]', "Takip kabulu");
      await s.locator(".drawer-root.open button", { hasText: /^Proje/ }).first().click();
      await Promise.all([s.waitForURL(/\/dashboard\/editor\//, { timeout: 60000 }),
                         s.locator(".drawer-root.open button", { hasText: /Oluştur ve yaz/ }).click()]);
      calismaId = s.url().match(/\/dashboard\/editor\/([^/?]+)/)?.[1] ?? null;
    }
    await git(`/dashboard/editor?sec=${calismaId}&ayrinti=1`);
    await s.waitForTimeout(1200);
    await s.locator("button", { hasText: /Kılavuz yükle|Yazım kılavuzu/ }).first().click();
    await s.waitForSelector(".drawer-root.open .dropzone", { timeout: 20000 });
    await s.waitForTimeout(500);

    const sinir = await s.evaluate(() => /MB/.test(document.querySelector(".drawer-root.open .dropzone").innerText));
    yaz("F1 · Biçim ve boyut sınırı yazıyor", EKRAN, TEMA, sinir, `MB geçiyor=${sinir}`);

    /* dragover → görsel geri bildirim. Eskiden alan bırakma alanı gibi
       görünüyor ama hiçbir şeye tepki vermiyordu. */
    const dt = await s.evaluateHandle(() => new DataTransfer());
    await s.dispatchEvent(".drawer-root.open .dropzone", "dragover", { dataTransfer: dt });
    await s.waitForTimeout(250);
    const suruklu = await s.evaluate(() => document.querySelector(".drawer-root.open .dropzone").dataset.surukleniyor !== undefined);
    yaz("F2 · Sürüklerken alan tepki veriyor", EKRAN, TEMA, suruklu, `data-surukleniyor=${suruklu}`);
    await resim("SONRA-dosya-surukleme");

    /* UYMAYAN dosya bırakılıyor: yükleme BAŞLAMAMALI, uyarı çıkmalı.
       (Geçerli PDF bırakmak yükleme ve tarama başlatırdı; kabul ücretli
       çağrı yapmıyor, o yüzden burada reddedilen yol sınanıyor.) */
    const dt2 = await s.evaluateHandle(() => {
      const d = new DataTransfer();
      d.items.add(new File(["x"], "tez.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      return d;
    });
    await s.dispatchEvent(".drawer-root.open .dropzone", "drop", { dataTransfer: dt2 });
    await s.waitForTimeout(900);
    const red = await s.evaluate(() => ({
      halaSecim: Boolean(document.querySelector(".drawer-root.open .dropzone")),
      uyari: /yalnızca PDF|Only PDFs/i.test(document.body.innerText),
    }));
    yaz("F3 · Uymayan dosya reddediliyor, yükleme başlamıyor", EKRAN, TEMA, red.halaSecim && red.uyari,
        `seçimde=${red.halaSecim} uyarı=${red.uyari}`);
    await s.keyboard.press("Escape");
    await s.waitForTimeout(400);
  } catch (e) { yaz("F · dosya seçici", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`); }

  await ctx.close();
}
await tarayici.close();
if (GORSEL) fs.writeFileSync(`${GORSEL}/takip-kabul.json`, JSON.stringify(sonuclar, null, 1));
const gec = sonuclar.filter((r) => r.gecti).length;
console.log(`\n${sonuclar.length} kontrol · ${gec} geçti · ${sonuclar.length - gec} kaldı`);
process.exit(gec === sonuclar.length ? 0 : 1);
