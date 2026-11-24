// ABONELİK VE KREDİ SAYFASI KABULÜ (24.11.2026).
//
// Dört durum: bireysel (veri var), kurum yönetimli, iç ekip ve abonelik
// verisi alınamayan. Ölçtükleri: iki kompakt kart, kullanım çubuğunun
// yalnızca doğrulanabilen veride çizilmesi, ek kredi alanının yetkiye
// göre görünmesi, Faturalar/Kredi hareketleri sekmeleri, iki karşılaştırma
// penceresi (Esc, odak dönüşü, mobil kaydırma) ve Ayarlar'dan gelen bağlantı.
//
// Kullanım: node scripts/yerel-yigin/abonelik-kredi-kabul.mjs <uygulama> [görüntü-dizini]
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

const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");

async function kullaniciKur({ etiket, tamAd, kurum, rol }) {
  const adres = `${etiket}-${ek}@yerel.test`;
  const parola = `Ab7!${crypto.randomBytes(9).toString("base64url")}`;
  const y = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: tamAd } });
  if (y.d >= 300) throw new Error(`kullanıcı kurulamadı: ${JSON.stringify(y.j)}`);
  const id = y.j.id;
  await auth(`/admin/users/${id}`, { password: parola }, "PUT");
  psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
        values (${q(id)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
  psql(`update public.profiles set full_name = ${q(tamAd)}${kurum ? `, organization_id = ${q(kurum)}` : ""}${rol ? `, role = ${q(rol)}::public.user_role` : ""} where id = ${q(id)}`);
  return { adres, parola, id, tamAd };
}

const KURUM = psql(`insert into public.organizations (name, license_status, synced_at, current_period_end, ai_credit_limit)
  values (${q(`Abonelik Universitesi ${ek}`)}, 'active', now(), now() + interval '200 days', 5000) returning id`).split("\n")[0];

const BIREYSEL = await kullaniciKur({ etiket: "ab-birey", tamAd: "Deniz Yilmaz", kurum: null });
const KOPUK = await kullaniciKur({ etiket: "ayar-kopuk", tamAd: "Kopuk Denegi", kurum: null });
const KURUMLU = await kullaniciKur({ etiket: "ab-kurum", tamAd: "Kurum Uyesi", kurum: KURUM });
const ICEKIP = await kullaniciKur({ etiket: "ab-icekip", tamAd: "Ic Ekip", kurum: null, rol: "founder" });
/*
  DOLU KATALOG AYRI BİR KULLANICI (24.11.2026). Taklit, e-postası
  "ayar-katalog" ile başlayana ArvoOS'un adı ve krediyi bildirmeye
  BAŞLADIĞINDA oluşacak plan listesini veriyor. BIREYSEL ise bugünkü
  gerçek biçimi (yalnızca kod/dönem/tutar) alıyor; böylece hem müşterinin
  ÜRETİMDE gördüğü ekran hem de katalog dolduğunda açılacak pencere aynı
  koşuda ölçülüyor.
*/
const KATALOGLU = await kullaniciKur({ etiket: "ayar-katalog", tamAd: "Katalog Denegi", kurum: null });

/* Bireysel aboneye kredi durumu ve hareket: kart ve sekme dolu görünsün.
   Dönem, aylık kalan ve satın alınan bakiye ai_kredi_durumum'un okuduğu
   tablodan geliyor; kullanım çubuğunun paydası buradan doğrulanıyor. */
psql(`insert into public.ai_bireysel_kredi_hesabi (user_id, donem, aylik_kalan, ek_bakiye)
      values (${q(BIREYSEL.id)}, date_trunc('month', now())::date, 640, 0)
      on conflict (user_id) do update set donem = excluded.donem, aylik_kalan = excluded.aylik_kalan, ek_bakiye = excluded.ek_bakiye`);
psql(`insert into public.ai_bireysel_kredi_hareketleri (user_id, tur, kredi, kaynak)
      values (${q(BIREYSEL.id)}, 'yenileme', 1000, ${q(`kabul-${ek}-y`)}), (${q(BIREYSEL.id)}, 'tuketim', 360, ${q(`kabul-${ek}-t`)})`);

const sonuclar = [];
const yaz = (ad, ekran, tema, gecti, ayrinti) => {
  sonuclar.push({ ad, ekran, tema, gecti, ayrinti });
  console.log(`${gecti ? "GEÇTİ " : "KALDI "} ${String(ekran).padEnd(4)} ${tema.padEnd(5)} ${ad.padEnd(50)} ${ayrinti}`);
};
const tarayici = await chromium.launch({ args: ["--no-sandbox"] });
/*
  İKİ EYLEM AYRI AYRI (24.11.2026). Plan yönetimi ve kredi satın alma
  birbirinden bağımsız: her biri KENDİ yetkisi ve kendi verisi
  doğrulandığında görünmeli. Eskiden ikisi de "bireysel kullanıcı"
  koşuluna bağlıydı; abonelik verisi alınamadığında "Planı yönet" ve
  "Kredi paketlerini incele" yine çıkıyor, açılan pencerede yönetilecek
  ya da satın alınacak hiçbir şey olmuyordu.
*/
const eylemler = (s) => s.evaluate(() => {
  const dugmeler = [...document.querySelectorAll("button")].map((b) => b.textContent ?? "");
  return {
    /* Eylemsiz durumda düğme "Abonelik özeti" (24.11.2026): pencere
       yönetim vaat etmiyor. İkisini de tanıyoruz, hangisi çıktığı
       ayrıntıya yazılıyor. */
    planYonet: dugmeler.some((m) => /Planı yönet/.test(m)),
    planOzet: dugmeler.some((m) => /Abonelik özeti/.test(m)),
    krediIncele: dugmeler.some((m) => /Kredi paketlerini incele/.test(m)),
    ekKrediEylem: Boolean(document.querySelector(".abonelik-ek-kredi:not([data-bilgi])")),
    ekKrediBilgi: Boolean(document.querySelector('.abonelik-ek-kredi[data-bilgi="true"]')),
    ekKrediMetin: (document.querySelector(".abonelik-ek-kredi")?.innerText ?? "").replace(/\s+/g, " "),
    planMetin: (document.querySelector(".abonelik-kartlar")?.innerText ?? "").replace(/\s+/g, " "),
  };
});

const odak = (s) => s.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "BODY (kayıp)";
  return `${a.tagName}${a.className ? "." + String(a.className).split(" ")[0] : ""}[${(a.textContent ?? "").trim().slice(0, 24)}]`;
});

for (const [EKRAN, YUK, TEMA] of [[1440, 900, "light"], [1440, 900, "dark"], [390, 844, "light"], [390, 844, "dark"]]) {
  const mobil = EKRAN < 500;
  const ctx = await tarayici.newContext({ viewport: { width: EKRAN, height: YUK }, colorScheme: TEMA, locale: "tr-TR",
    ...(mobil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
  const s = await ctx.newPage();
  const giris = async (k) => {
    await ctx.clearCookies();
    await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
    await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
    await s.fill('input[name="email"]', k.adres);
    await s.fill('input[name="password"]', k.parola);
    await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  };
  const git = async (yol) => { await s.goto(`${UYG}${yol}`, { waitUntil: "domcontentloaded" }); await s.waitForLoadState("networkidle").catch(() => {}); };
  const resim = async (ad) => { if (GORSEL) await s.screenshot({ path: `${GORSEL}/${ad}-${EKRAN}-${TEMA}.png`, fullPage: !mobil }); };

  /* ---- B · Bireysel (veri var) ---- */
  await giris(BIREYSEL);
  await git("/dashboard/abonelik");
  try {
    const sayfa = await s.evaluate(() => {
      const kartlar = [...document.querySelectorAll(".abonelik-kart")];
      const kap = document.querySelector(".abonelik-kartlar");
      return {
        kartSayisi: kartlar.length,
        sutunlar: kap ? getComputedStyle(kap).gridTemplateColumns.split(" ").length : 0,
        cubuk: Boolean(document.querySelector(".abonelik-cubuk")),
        ekKredi: Boolean(document.querySelector(".abonelik-ek-kredi:not([data-bilgi])")),
        sekmeler: [...document.querySelectorAll(".abonelik-sekmeler .ayarlar-sekme")].map((x) => x.textContent.trim()),
        /* Eylem yoksa etiket "Abonelik özeti" (24.11.2026): pencere
           yönetim vaat etmiyor. Burada aranan, plan penceresinin
           ERİŞİLEBİLİR olması. */
        planYonet: Boolean([...document.querySelectorAll("button")].find((b) => /Planı yönet|Abonelik özeti/.test(b.textContent))),
        sayfaTasmasi: document.documentElement.scrollWidth - document.documentElement.clientWidth > 2,
      };
    });
    yaz("B1 · İki kompakt kart", EKRAN, TEMA, sayfa.kartSayisi === 2 && sayfa.sutunlar === (mobil ? 1 : 2),
        `kart=${sayfa.kartSayisi} sütun=${sayfa.sutunlar}`);
    yaz("B2 · Kullanım çubuğu doğrulanabilen veride", EKRAN, TEMA, sayfa.cubuk, `çubuk=${sayfa.cubuk}`);
    yaz("B3 · Ek kredi alanı ve plan penceresi var", EKRAN, TEMA, sayfa.ekKredi && sayfa.planYonet, `ekKredi=${sayfa.ekKredi} plan=${sayfa.planYonet}`);
    yaz("B4 · Faturalar ve Kredi hareketleri sekmeleri", EKRAN, TEMA,
        JSON.stringify(sayfa.sekmeler) === JSON.stringify(["Faturalar", "Kredi hareketleri"]), JSON.stringify(sayfa.sekmeler));
    yaz("B5 · Sayfa yatay taşmıyor", EKRAN, TEMA, !sayfa.sayfaTasmasi, `taşma=${sayfa.sayfaTasmasi}`);
    await resim("B1-abonelik-sayfasi");

    /* Sekme geçişi */
    await s.locator(".abonelik-sekmeler .ayarlar-sekme", { hasText: /^Kredi hareketleri$/ }).click();
    await s.waitForTimeout(250);
    const hareketGorunur = await s.evaluate(() => {
      const paneller = [...document.querySelectorAll(".abonelik-sekmeler .ayarlar-panel")];
      return paneller[1] && !paneller[1].hidden && paneller[0].hidden;
    });
    yaz("B6 · Sekme değişiyor", EKRAN, TEMA, Boolean(hareketGorunur), `görünür=${hareketGorunur}`);
    /* Matrisin diğer ucu: verisi ve yetkisi olan bireysel abonede İKİ
       eylem de sunuluyor. U2/U3 ile birlikte okununca hangi eylemin
       hangi durumda göründüğü kabulde sabitlenmiş oluyor. */
    const be = await eylemler(s);
    yaz("B7 · Bireysel (veri var): plan penceresi ve kredi satın alma sunuluyor", EKRAN, TEMA,
        (be.planYonet || be.planOzet) && be.krediIncele,
        `planYönet=${be.planYonet} planÖzet=${be.planOzet} krediİncele=${be.krediIncele}`);

    /* ---- K · Kredileri karşılaştır penceresi ---- */
    await s.locator("button", { hasText: /Kredi paketlerini incele/ }).first().click();
    await s.waitForSelector(".drawer-root.open .karsilastir", { timeout: 15000 });
    await s.waitForTimeout(400);
    const kredi = await s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      const sutunlar = [...kok.querySelectorAll(".karsilastir-sutun")];
      const govde = kok.querySelector(".drawer-body");
      return {
        sutun: sutunlar.length,
        yogun: Boolean(kok.querySelector('.karsilastir-rozet[data-tur="one-cikan"]')),
        /* "100 kredi başına" artık her KARTIN içinde (K9); eskiden
           kartların altındaki ortak dl satırındaydı. */
        yuzKredi: [...kok.querySelectorAll(".karsilastir-sutun")].every((k) => /100 kredi/.test(k.innerText)),
        tekSeferlik: /tek seferlik|Tek seferlik/i.test(kok.innerText),
        gonderPasif: kok.querySelector('button[type="submit"]')?.disabled ?? null,
        icKaydirma: govde ? govde.scrollHeight - govde.clientHeight > 2 : null,
        yatayTasma: kok.querySelector("section.drawer").scrollWidth - kok.querySelector("section.drawer").clientWidth > 2,
      };
    });
    yaz("K1 · Paketler gerçek katalogdan", EKRAN, TEMA, kredi.sutun > 0, `sütun=${kredi.sutun}`);
    yaz("K2 · Yoğun kullanım etiketi ve 100 kredi başına", EKRAN, TEMA, kredi.yogun && kredi.yuzKredi, `yoğun=${kredi.yogun} yüz=${kredi.yuzKredi}`);
    yaz("K3 · Tek seferlik olduğu yazıyor", EKRAN, TEMA, kredi.tekSeferlik, "");
    yaz("K4 · Seçim yapılmadan gönderilemiyor", EKRAN, TEMA, kredi.gonderPasif === true, `pasif=${kredi.gonderPasif}`);
    yaz("K5 · Pencere yatay taşmıyor", EKRAN, TEMA, !kredi.yatayTasma, `taşma=${kredi.yatayTasma} içKaydırma=${kredi.icKaydirma}`);
    /*
      HER SEÇENEK KENDİ KARTINDA TAM (24.11.2026). Eskiden "100 kredi
      başına" ortak bir dl satırındaydı: mobilde kartlar alt alta
      inince avantaj bilgisi kartından KOPUYOR, müşteri bir seçeneğin
      neden avantajlı olduğunu kendi kartından göremiyordu.
    */
    const kartlar = await s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      return [...kok.querySelectorAll(".karsilastir-sutun")].map((k) => {
        const m = k.innerText.replace(/\s+/g, " ");
        return { fiyat: /(TL|₺)/.test(m), yuz: /100 kredi/.test(m), kredi: /kredi/.test(m) };
      });
    });
    yaz("K9 · Her kredi kartında toplam fiyat ve 100 kredi başına maliyet", EKRAN, TEMA,
        kartlar.length > 0 && kartlar.every((k) => k.fiyat && k.yuz && k.kredi),
        `kart=${kartlar.length} eksik=${kartlar.filter((k) => !(k.fiyat && k.yuz)).length}`);
    await resim("K1-kredileri-karsilastir");
    /* Seçince özet çıkıyor */
    await s.locator('.drawer-root.open .karsilastir-sec input').first().check();
    await s.waitForTimeout(250);
    const ozet = await s.evaluate(() => document.querySelector(".drawer-root.open .karsilastir-ozet")?.innerText.replace(/\s+/g, " ") ?? null);
    yaz("K6 · Seçimde toplam tahsilat okunuyor", EKRAN, TEMA, Boolean(ozet && /Toplam tahsilat/.test(ozet)), `"${(ozet ?? "").slice(0, 60)}…"`);
    /* Seçili kart AYRI belirtilsin: yalnızca kenarlık rengi, renk
       körlüğünde ve yüksek parlaklıkta ayırt edilmiyor. */
    const secim = await s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      const secili = kok.querySelector('.karsilastir-sutun[data-secili]');
      return {
        var: Boolean(secili),
        metin: secili ? secili.innerText.replace(/\s+/g, " ") : null,
        isaretli: secili ? Boolean(secili.querySelector(".karsilastir-secildi")) : false,
        tek: kok.querySelectorAll(".karsilastir-sutun[data-secili]").length === 1,
      };
    });
    yaz("K10 · Seçili kart metinle de belirtiliyor", EKRAN, TEMA, secim.var && secim.tek && secim.isaretli,
        `seçili=${secim.var} tek=${secim.tek} işaret=${secim.isaretli}`);
    /*
      GÜÇLÜ ÇERÇEVE YALNIZCA SEÇİLİ KARTTA. Eskiden çift lacivert
      çerçeve ÖNE ÇIKAN karta aitti: 250 kredi seçiliyken 1.000 kredi
      kartı seçilmiş görünüyor, özet "Seçilen: 250 kredi" diyordu.
      Burada 250 kredi seçili (K6 ilk radyoyu işaretliyor, liste
      krediye göre artan sıralı) ve çerçeve ONDA olmalı.
    */
    const cerceve = await s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      return [...kok.querySelectorAll(".karsilastir-sutun")].map((k) => {
        const st = getComputedStyle(k);
        return {
          baslik: (k.querySelector("h3")?.textContent ?? "").trim(),
          secili: k.dataset.secili !== undefined,
          oneCikan: k.dataset.oneCikan !== undefined,
          guclu: st.boxShadow !== "none" && st.boxShadow.includes("inset"),
          radyo: Boolean(k.querySelector("input[type=radio]")?.checked),
        };
      });
    });
    const gucluler = cerceve.filter((k) => k.guclu);
    yaz("K11 · Güçlü çerçeve yalnızca seçili kartta", EKRAN, TEMA,
        gucluler.length === 1 && gucluler[0].secili && gucluler[0].radyo &&
          cerceve.every((k) => !k.guclu || k.secili),
        `güçlü=[${gucluler.map((k) => k.baslik).join(", ")}] seçili=[${cerceve.filter((k) => k.secili).map((k) => k.baslik).join(", ")}] öneri=[${cerceve.filter((k) => k.oneCikan).map((k) => k.baslik).join(", ")}]`);
    /* MOBİL KAYDIRMA GERÇEKTEN ÖLÇÜLÜYOR (24.11.2026). Eskiden içKaydırma
       yalnızca K5'in notuna yazılıyordu, geçti/kaldı kontrolü değildi:
       390 px'te gövde kaydırılamasa ya da yapışkan eylem satırı son
       seçeneği örtse kabul yine yeşil kalırdı. Şimdi gövde sona
       kaydırılıyor ve gönder düğmesinin ekranda, hiçbir şeyin altında
       kalmadan tıklanabilir olduğu sınanıyor (elementFromPoint). */
    if (mobil) {
      const kaydirma = await s.evaluate(() => {
        const kok = document.querySelector(".drawer-root.open");
        const govde = kok.querySelector(".drawer-body");
        const once = govde.scrollTop;
        govde.scrollTop = govde.scrollHeight;
        const sonra = govde.scrollTop;
        const dugme = kok.querySelector('button[type="submit"]');
        const k = dugme.getBoundingClientRect();
        const orta = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2);
        return {
          kaydirabilir: govde.scrollHeight - govde.clientHeight > 2,
          ilerledi: sonra > once,
          ekranda: k.top >= 0 && k.bottom <= window.innerHeight,
          ustunde: Boolean(dugme.contains(orta) || dugme === orta),
          sonSutunGorunur: (() => {
            const sutunlar = [...kok.querySelectorAll(".karsilastir-sutun")];
            const son = sutunlar[sutunlar.length - 1];
            if (!son) return null;
            const r = son.getBoundingClientRect();
            return r.top < window.innerHeight && r.bottom > 0;
          })(),
        };
      });
      yaz("K8 · Mobilde pencere kaydırılıyor, eylem satırı içeriği örtmüyor", EKRAN, TEMA,
          kaydirma.kaydirabilir && kaydirma.ilerledi && kaydirma.ekranda && kaydirma.ustunde,
          `kaydırılabilir=${kaydirma.kaydirabilir} ilerledi=${kaydirma.ilerledi} ekranda=${kaydirma.ekranda} tıklanabilir=${kaydirma.ustunde} sonSütun=${kaydirma.sonSutunGorunur}`);
      await resim("K8-kredileri-karsilastir-sona-kaydirilmis");
    }
    if (!mobil && TEMA === "light") {
      await s.keyboard.press("Escape");
      await s.waitForTimeout(500);
      const o = await odak(s);
      yaz("K7 · Esc kapatıyor, odak açan düğmeye dönüyor", EKRAN, TEMA,
          (await s.locator(".drawer-root.open").count()) === 0 && /Kredi paketlerini incele/.test(o), `odak=${o}`);
    } else {
      await s.keyboard.press("Escape");
      await s.waitForTimeout(400);
    }

    /* ---- G · BUGÜNKÜ katalog: karşılaştırma sunulmuyor ---- */
    /*
      ArvoOS bugün plan ADI bildirmiyor. Adsız sütunlarla bir
      "Standart / Plus / Pro" ekranı çizmek, müşteriye var olmayan bir
      seçim sunmak olurdu: seçtiği planın adını, kapsamını ve
      halihazırda hangisinde olduğunu bilemezdi. Pencere mevcut
      abonelik yönetimi yolunu gösteriyor.
    */
    await s.locator("button", { hasText: /Planı yönet|Abonelik özeti/ }).first().click();
    await s.waitForSelector(".drawer-root.open .plan-yonet", { timeout: 15000 });
    await s.waitForTimeout(350);
    const bugun = await s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      const eylemler = [...kok.querySelectorAll("button, a[href]")]
        .map((e) => (e.textContent ?? "").trim())
        .filter((m) => m && !/^Pencereyi kapat$/.test(m));
      return {
        karsilastirVar: [...kok.querySelectorAll("button")].some((b) => /Planları karşılaştır/.test(b.textContent)),
        baslik: kok.querySelector(".drawer-title, h2")?.textContent?.trim() ?? null,
        destek: Boolean(kok.querySelector('a[href="/dashboard/support"]')),
        eylemler,
        metin: kok.innerText.replace(/\s+/g, " "),
      };
    });
    yaz("G1 · Bugünkü katalogda karşılaştırma sunulmuyor", EKRAN, TEMA,
        !bugun.karsilastirVar && /gelmiyor/.test(bugun.metin),
        `karşılaştır=${bugun.karsilastirVar}`);
    /*
      EYLEMSİZ PENCERE "YÖNET" DEMİYOR. Tek eylem "Kapat" iken başlığın
      "Planı yönet", metnin "buradan yönetebilirsiniz" demesi
      kullanıcıyı olmayan bir eylemi aramaya bırakıyordu.
    */
    const yonetVaadi = /yönet/i.test(bugun.baslik ?? "") || /yönetebilirsiniz/i.test(bugun.metin);
    yaz("G2 · Eylemsiz pencere abonelik özeti olarak tanımlanıyor", EKRAN, TEMA,
        /özet/i.test(bugun.baslik ?? "") && /özetini/i.test(bugun.metin) && !yonetVaadi,
        `başlık="${bugun.baslik}" yönetVaadi=${yonetVaadi}`);
    /* Destek yönlendirmesi varsa MEVCUT destek bağlantısı olmalı. */
    yaz("G3 · Destek yönlendirmesi gerçek bağlantı", EKRAN, TEMA,
        !/Destek/i.test(bugun.metin) || bugun.destek, `destekBağlantısı=${bugun.destek}`);
    await resim("G1-plani-yonet-katalog-bos");
    await s.keyboard.press("Escape");
    await s.waitForTimeout(400);
  } catch (e) {
    yaz("B/K/G · bireysel akış", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`);
  }

  /* ---- P · Katalog dolu: Planı yönet → Planları karşılaştır (iç içe) ---- */
  try {
    await giris(KATALOGLU);
    await git("/dashboard/abonelik");
    await s.locator("button", { hasText: /Planı yönet/ }).first().click();
    await s.waitForSelector(".drawer-root.open .plan-yonet", { timeout: 15000 });
    await s.waitForTimeout(350);
    const yonet = await s.evaluate(() => {
      const kok = document.querySelector(".drawer-root.open");
      return {
        mevcut: kok.querySelector(".plan-yonet-mevcut")?.innerText.replace(/\s+/g, " ").trim() ?? null,
        karsilastirVar: Boolean([...kok.querySelectorAll("button")].find((b) => /Planları karşılaştır/.test(b.textContent))),
      };
    });
    yaz("P1 · Planı yönet: mevcut plan ve yenileme", EKRAN, TEMA, Boolean(yonet.mevcut), `"${(yonet.mevcut ?? "").slice(0, 50)}"`);
    await resim("P1-plani-yonet");
    if (yonet.karsilastirVar) {
      await s.locator(".drawer-root.open button", { hasText: /Planları karşılaştır/ }).click();
      await s.waitForFunction(() => document.querySelectorAll(".drawer-root.open").length === 2, null, { timeout: 15000 });
      await s.waitForTimeout(400);
      const plan = await s.evaluate(() => {
        /* Kredi ve dönem artık her KARTIN içinde; ortak dl satırı
           kaldırıldı (mobilde karttan kopuyordu). */
        const kok = [...document.querySelectorAll(".drawer-root.open")].find((k) => k.querySelector(".karsilastir-sutun"));
        const kartlar = [...kok.querySelectorAll(".karsilastir-sutun")];
        return {
          sutun: kartlar.length,
          krediSatiri: kartlar.length > 0 && kartlar.every((k) => /Asistan kredisi/.test(k.innerText)),
          donemSatiri: kartlar.length > 0 && kartlar.every((k) => /Faturalama dönemi/.test(k.innerText)),
        };
      });
      yaz("P2 · Plan karşılaştırma: kredi ve dönem satırları", EKRAN, TEMA, plan.krediSatiri && plan.donemSatiri,
          `sütun=${plan.sutun} kredi=${plan.krediSatiri} dönem=${plan.donemSatiri}`);
      /* Dahil asistan kredisi PLANIN KARTINDA: ortak dl satırı mobilde
         karttan kopuyordu (K9 ile aynı sınıf). */
      const planKart = await s.evaluate(() => {
        const kok = [...document.querySelectorAll(".drawer-root.open")].find((k) => k.querySelector(".karsilastir-sutun"));
        return [...kok.querySelectorAll(".karsilastir-sutun")].map((k) => {
          const m = k.innerText.replace(/\s+/g, " ");
          return { kredi: /kredi/i.test(m), fiyat: /(TL|₺|—)/.test(m) };
        });
      });
      yaz("P7 · Her plan kartında dahil asistan kredisi", EKRAN, TEMA,
          planKart.length > 0 && planKart.every((k) => k.kredi && k.fiyat),
          `kart=${planKart.length} eksik=${planKart.filter((k) => !k.kredi).length}`);
      /* Aynı kural plan kartlarında: öneriyi rozet, seçimi çerçeve. */
      await s.locator(".drawer-root.open .karsilastir-sec input:not([disabled])").first().check();
      await s.waitForTimeout(250);
      const planCerceve = await s.evaluate(() => {
        const kok = [...document.querySelectorAll(".drawer-root.open")].find((k) => k.querySelector(".karsilastir-sutun"));
        return [...kok.querySelectorAll(".karsilastir-sutun")].map((k) => {
          const st = getComputedStyle(k);
          return {
            baslik: (k.querySelector("h3")?.textContent ?? "").trim(),
            secili: k.dataset.secili !== undefined,
            guclu: st.boxShadow !== "none" && st.boxShadow.includes("inset"),
          };
        });
      });
      const pg = planCerceve.filter((k) => k.guclu);
      yaz("P8 · Plan kartlarında da güçlü çerçeve yalnızca seçilide", EKRAN, TEMA,
          pg.length === 1 && pg[0].secili,
          `güçlü=[${pg.map((k) => k.baslik).join(", ")}] seçili=[${planCerceve.filter((k) => k.secili).map((k) => k.baslik).join(", ")}]`);
      await resim("P2-planlari-karsilastir");
      /* Mobilde üst pencere de kaydırılabiliyor mu? Plan karşılaştırması
         390 px'te en uzun içerik; kaydırılamazsa alttaki planlar hiç
         görülmez. */
      if (mobil) {
        const pk = await s.evaluate(() => {
          const kok = [...document.querySelectorAll(".drawer-root.open")].find((k) => k.querySelector(".karsilastir-sutun"));
          const govde = kok.querySelector(".drawer-body");
          const once = govde.scrollTop;
          govde.scrollTop = govde.scrollHeight;
          const dugme = kok.querySelector('button[type="submit"]');
          const k = dugme.getBoundingClientRect();
          const orta = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2);
          return {
            ilerledi: govde.scrollTop > once,
            kaydirabilir: govde.scrollHeight - govde.clientHeight > 2,
            ekranda: k.top >= 0 && k.bottom <= window.innerHeight,
            ustunde: Boolean(dugme.contains(orta) || dugme === orta),
          };
        });
        yaz("P4 · Mobilde plan karşılaştırması kaydırılıyor, eylem erişilebilir", EKRAN, TEMA,
            pk.kaydirabilir && pk.ilerledi && pk.ekranda && pk.ustunde,
            `kaydırılabilir=${pk.kaydirabilir} ilerledi=${pk.ilerledi} ekranda=${pk.ekranda} tıklanabilir=${pk.ustunde}`);
      }
      await s.keyboard.press("Escape");
      await s.waitForTimeout(500);
      const kalan = await s.locator(".drawer-root.open").count();
      const kilit = await s.evaluate(() => document.documentElement.classList.contains("drawer-open"));
      const altOdak = await odak(s);
      yaz("P3 · İç içe: ilk Esc üsttekini kapatıyor", EKRAN, TEMA, kalan === 1 && kilit, `kalan=${kalan} kilit=${kilit}`);
      /* ODAK ALTTAKİ PENCEREYE (#148'in kuralı). Üstteki kapanınca odak
         sayfaya değil, alttaki pencerede onu açan düğmeye dönmeli. */
      yaz("P5 · İç içe: odak alttaki pencerenin açan düğmesine dönüyor", EKRAN, TEMA,
          /Planları karşılaştır/.test(altOdak), `odak=${altOdak}`);
    }
    await s.keyboard.press("Escape");
    await s.waitForTimeout(500);
    const sonOdak = await odak(s);
    const kilitKalkti = await s.evaluate(() => !document.documentElement.classList.contains("drawer-open"));
    yaz("P6 · Son pencere kapanınca odak Planı yönet'e, kaydırma serbest", EKRAN, TEMA,
        /Planı yönet/.test(sonOdak) && kilitKalkti, `odak=${sonOdak} kilitKalktı=${kilitKalkti}`);
  } catch (e) {
    yaz("P · katalog dolu akışı", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`);
  }

  /* ---- A · Ayarlar'dan bağlantı bu sayfaya açılıyor ---- */
  try {
    await git("/dashboard/settings");
    await s.locator(".ayarlar-sekme", { hasText: /^Abonelik$/ }).click();
    await s.waitForTimeout(250);
    await s.locator('.ayarlar-sayfa a[href="/dashboard/abonelik"]').first().click();
    await s.waitForURL(/\/dashboard\/abonelik/, { timeout: 20000 });
    await s.waitForSelector(".abonelik-kart", { timeout: 20000 });
    yaz("A1 · Ayarlar'daki bağlantı bu sayfaya açılıyor", EKRAN, TEMA,
        (await s.locator(".abonelik-kart").count()) === 2, s.url().replace(UYG, ""));
  } catch (e) { yaz("A1 · Ayarlar'daki bağlantı bu sayfaya açılıyor", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 60)}`); }

  /* ---- U · Abonelik verisi alınamıyor ---- */
  try {
    await giris(KOPUK);
    await git("/dashboard/abonelik");
    const u = await s.evaluate(() => {
      const metin = document.querySelector(".abonelik-kartlar").innerText.replace(/\s+/g, " ");
      return { metin, planYonet: Boolean([...document.querySelectorAll("button")].find((b) => /Planı yönet/.test(b.textContent))) };
    });
    yaz("U1 · Bilgi alınamıyorsa açıkça söyleniyor", EKRAN, TEMA, /alınamıyor/.test(u.metin), `"${u.metin.slice(0, 70)}…"`);
    const ue = await eylemler(s);
    /* Yönetilecek veri yok: durum, dönem ve plan listesi boş. Düğme
       açılsa pencerede hiçbir şey olmazdı. */
    yaz("U2 · Veri alınamıyorsa plan yönetimi SUNULMUYOR", EKRAN, TEMA, !ue.planYonet, `planYönet=${ue.planYonet}`);
    /* Paket listesi de ensure yanıtından gelir: köprü kopukken boş. */
    yaz("U3 · Veri alınamıyorsa kredi satın alma SUNULMUYOR, nedeni yazıyor", EKRAN, TEMA,
        !ue.krediIncele && ue.ekKrediBilgi && /alınamıyor|ulaşılamıyor/.test(ue.ekKrediMetin),
        `krediİncele=${ue.krediIncele} bilgi=${ue.ekKrediBilgi} "${ue.ekKrediMetin.slice(0, 60)}"`);
    await resim("U1-abonelik-alinamadi");
  } catch (e) {
    for (const n of ["U1 · Bilgi alınamıyorsa açıkça söyleniyor", "U2 · Veri alınamıyorsa plan yönetimi SUNULMUYOR",
                     "U3 · Veri alınamıyorsa kredi satın alma SUNULMUYOR, nedeni yazıyor"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 60)}`);
  }

  /* ---- O · Kurum yönetimli ---- */
  try {
    await giris(KURUMLU);
    await git("/dashboard/abonelik");
    const o = await s.evaluate(() => ({
      metin: document.querySelector(".abonelik-kartlar").innerText.replace(/\s+/g, " "),
      ekKrediEylem: Boolean(document.querySelector(".abonelik-ek-kredi:not([data-bilgi])")),
      ekKrediBilgi: Boolean(document.querySelector('.abonelik-ek-kredi[data-bilgi="true"]')),
      planYonet: Boolean([...document.querySelectorAll("button")].find((b) => /Planı yönet/.test(b.textContent))),
      sekmeler: [...document.querySelectorAll(".abonelik-sekmeler .ayarlar-sekme")].length,
    }));
    yaz("O1 · Kurum yönetimli olduğu yazıyor", EKRAN, TEMA, /kurum/i.test(o.metin), `"${o.metin.slice(0, 60)}…"`);
    yaz("O2 · Kurum üyesine satın alma sunulmuyor", EKRAN, TEMA, !o.ekKrediEylem && o.ekKrediBilgi && !o.planYonet,
        `eylem=${o.ekKrediEylem} bilgi=${o.ekKrediBilgi} planYönet=${o.planYonet}`);
    yaz("O3 · Kullanım geçmişi görünür kalıyor", EKRAN, TEMA, o.sekmeler === 2, `sekme=${o.sekmeler}`);
    await resim("O1-abonelik-kurum");
  } catch (e) {
    for (const n of ["O1 · Kurum yönetimli olduğu yazıyor", "O2 · Kurum üyesine satın alma sunulmuyor", "O3 · Kullanım geçmişi görünür kalıyor"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 60)}`);
  }

  /* ---- I · İç ekip ---- */
  try {
    await giris(ICEKIP);
    await git("/dashboard/abonelik");
    const i = await s.evaluate(() => ({
      metin: document.querySelector(".abonelik-kartlar").innerText.replace(/\s+/g, " "),
      ekKrediEylem: Boolean(document.querySelector(".abonelik-ek-kredi:not([data-bilgi])")),
      sekmeler: [...document.querySelectorAll(".abonelik-sekmeler .ayarlar-sekme")].length,
    }));
    yaz("I1 · İç ekip durumu yazıyor, satın alma yok", EKRAN, TEMA,
        /İç ekip/i.test(i.metin) && !i.ekKrediEylem, `"${i.metin.slice(0, 60)}…" eylem=${i.ekKrediEylem}`);
    yaz("I2 · Kayıtlar görünür kalıyor", EKRAN, TEMA, i.sekmeler === 2, `sekme=${i.sekmeler}`);
    await resim("I1-abonelik-icekip");
  } catch (e) {
    for (const n of ["I1 · İç ekip durumu yazıyor, satın alma yok", "I2 · Kayıtlar görünür kalıyor"])
      yaz(n, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 60)}`);
  }

  await ctx.close();
}
await tarayici.close();
const kaldi = sonuclar.filter((r) => !r.gecti);
if (GORSEL) fs.writeFileSync(`${GORSEL}/abonelik-kabul.json`, JSON.stringify({ head: HEAD, buildId: BUILD_ID, sonuclar }, null, 1));
console.log(`\n${sonuclar.length} kontrol · ${sonuclar.length - kaldi.length} geçti · ${kaldi.length} kaldı · HEAD ${HEAD.slice(0, 7)}`);
process.exit(kaldi.length ? 1 : 0);
