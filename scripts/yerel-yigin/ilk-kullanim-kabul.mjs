// İLK KULLANIM VE PLAN SEÇİMİ KABULÜ (25.11.2026).
//
// Ölçülenler: hiç çalışması olmayan kullanıcıda "İlk çalışmanızı
// oluşturun" kartının KARŞILAMANIN HEMEN ALTINDA olması; deneme
// üyesine üç eşit plan kartı (fiyat, dönem, dahil kredi, avantajlar
// KATALOGDAN); deneme bitiş satırı; düğmenin seçilen plan koduyla
// ödeme akışını açması; ödeme başarılı doğrulandığında üyeliğin
// etkinleşip dört ekrana yansıması; iptal ve hatada denemenin sürmesi;
// katalog hazır değilken bölümün gizlenip mevcut ödeme yolunun
// sunulması.
//
// ÖDEME: gerçek ödeme YOK. Taklit ArvoOS https bir ödeme adresi
// döndürüyor, bu betik o adresi yakalayıp uygulamaya geri
// yönlendiriyor — gerçek akışın ArvoOS'tan dönüş adımının karşılığı.
//
// Kullanım: node scripts/yerel-yigin/ilk-kullanim-kabul.mjs <uygulama> [görüntü-dizini]
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
async function kullaniciKur(etiket) {
  const adres = `${etiket}-${ek}@yerel.test`;
  const parola = `Ik7!${crypto.randomBytes(9).toString("base64url")}`;
  const y = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: "Ilk Kullanim" } });
  if (y.d >= 300) throw new Error(`kullanıcı kurulamadı: ${JSON.stringify(y.j)}`);
  await auth(`/admin/users/${y.j.id}`, { password: parola }, "PUT");
  psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
        values (${q(y.j.id)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
  return { adres, parola, id: y.j.id };
}

/* Kullanıcılar bir kez: döngü içinde kurulunca ikinci ekran geçişinde
   aynı e-posta ikinci kez yaratılıyor ve betik düşüyordu. */
/* BOŞ hesap her ekranda aynı kalabilir (hiç çalışma açmıyor); ödeme
   senaryoları EKRAN BAŞINA ayrı kullanıcı istiyor, çünkü başarılı
   ödeme aboneliği kalıcı olarak etkinleştiriyor. */
const BOS = await kullaniciKur("ik-bos");

const sonuclar = [];
const yaz = (ad, ekran, tema, gecti, ayrinti) => {
  sonuclar.push({ ad, ekran, tema, gecti, ayrinti });
  console.log(`${gecti ? "GEÇTİ " : "KALDI "} ${String(ekran).padEnd(4)} ${tema.padEnd(5)} ${ad.padEnd(60)} ${ayrinti}`);
};
const tarayici = await chromium.launch({ args: ["--no-sandbox"] });

for (const [EKRAN, YUK, TEMA] of [[1440, 900, "light"], [1440, 900, "dark"], [390, 844, "light"], [390, 844, "dark"]]) {
  const mobil = EKRAN < 500;
  const ctx = await tarayici.newContext({ viewport: { width: EKRAN, height: YUK }, colorScheme: TEMA, locale: "tr-TR",
    ...(mobil ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { deviceScaleFactor: 2 }) });
  await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
  /* TAKLİT ÖDEME SAYFASI: ArvoOS'un ödeme adresi yakalanıp uygulamaya
     geri yönlendiriliyor. Gerçek para hareketi yok. */
  /* Ödeme ekranına GİDEN planı kaydediyoruz: seçilen kart, ödeme
     ekranındaki plan ve etkinleşen plan birbirini tutmalı. */
  let odemeEkranindakiPlan = null;
  await ctx.route("https://odeme.arvoos.taklit/**", async (route) => {
    const u = new URL(route.request().url());
    odemeEkranindakiPlan = u.searchParams.get("plan");
    const donus = u.searchParams.get("donus") ?? "kart=tamam";
    await route.fulfill({ status: 302, headers: { location: `${UYG}/dashboard/abonelik?${donus}` }, body: "" });
  });
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

  /* ---- I · İlk kullanım: karşılamanın hemen altında ---- */
  try {
    await giris(BOS);
    await git("/dashboard");
    const d = await s.evaluate(() => {
      const ana = document.querySelector("main");
      const selam = ana.querySelector("header");
      const baslangic = ana.querySelector(".pw-baslangic");
      const lisans = ana.querySelector(".license-card, .lisans-karti, [class*=license]");
      const sirala = (e) => (e ? [...ana.querySelectorAll("*")].indexOf(e) : -1);
      return {
        baslangicVar: Boolean(baslangic),
        dugme: baslangic ? /İlk çalışmayı oluştur/.test(baslangic.innerText) : false,
        baslik: baslangic?.querySelector("h2")?.textContent?.trim() ?? null,
        selamSonra: sirala(selam) < sirala(baslangic),
        lisansSonra: lisans ? sirala(baslangic) < sirala(lisans) : null,
      };
    });
    yaz("I1 · 'İlk çalışmanızı oluşturun' kartı ve düğmesi var", EKRAN, TEMA,
        d.baslangicVar && d.dugme && /İlk çalışmanızı oluşturun/.test(d.baslik ?? ""), `başlık="${d.baslik}"`);
    yaz("I2 · Kart karşılamanın HEMEN altında (lisans kartı sonra)", EKRAN, TEMA,
        d.selamSonra && d.lisansSonra !== false, `selamSonra=${d.selamSonra} lisansSonra=${d.lisansSonra}`);
    await resim("ilk-kullanim");
  } catch (e) { yaz("I · ilk kullanım", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`); }

  /* ---- G · BUGÜNKÜ ArvoOS kataloğu: üç kart kapalı, mevcut ödeme yolu çalışıyor ---- */
  /*
    SENARYO ÜRETİMİN BULUNDUĞU DURUMU YENİDEN ÜRETİYOR (25.11.2026, ölçüm
    düzeltmesi).

    Bu blok eskiden `ik-bos` kullanıcısında koşuyordu ve iki ölçümü de
    YANLIŞ YERDEN geçiyordu:
    - O kullanıcı taklitte `active` (deneme DEĞİL) ve yenilemeye 14 günden
      fazla var. `PlanSecimi` yalnızca denemede çizildiği için bölüm
      "katalog eksik" diye değil, kullanıcı denemede olmadığı için
      gizliydi: katalog kapısı hiç sınanmıyordu.
    - `showPayment` etkin abonede (yenileme uzakken) false, yani ödeme
      düğmesi zaten çizilmiyordu. Ölçüt `main` metninde "abonelik"
      kelimesini arıyordu ve o kelime "Abonelik planı henüz tanımlanmadı"
      cümlesinden geliyordu — düğme hiç olmadan da geçiyordu.

    Artık kullanıcı DENEME üyesi ve kataloğu KATALOG_BUGUN: yalnızca kod,
    dönem ve tutar; ad, kredi ve avantaj YOK — gerçek köprünün bugün
    bildirdiği biçim. Böylece bölümün gizli kalması kataloğun
    EKSİKLİĞİNDEN geliyor ve lisans kartındaki ödeme düğmesinin gerçekten
    var olup çalıştığı ölçülebiliyor.
  */
  const BUGUN = await kullaniciKur(`ayar-deneme-bugun-${EKRAN}${TEMA}`);
  try {
    await giris(BUGUN);
    await git("/dashboard");
    const d = await s.evaluate(() => {
      const ana = document.querySelector("main");
      const dugmeler = [...ana.querySelectorAll("form button[type=submit]")]
        .map((b) => (b.textContent ?? "").replace(/\s+/g, " ").trim())
        .filter((metin) => /Kartla öde/.test(metin));
      return {
        planBolumu: Boolean(document.querySelector(".plan-secimi")),
        deneme: /Deneme süresi|Deneme bitişi/.test(ana.innerText),
        dugmeler,
        /* Düğme tutarı da taşımalı: ne ödeyeceğini söylemeyen bir
           "Kartla öde", müşteriden bilmediği bir bedeli istemek olurdu. */
        tutarli: dugmeler.some((metin) => /\d/.test(metin) && /₺/.test(metin)),
        tarih: Boolean(document.querySelector(".license-card-validity")),
      };
    });
    yaz("G1 · Bugünkü katalogla üç kartlı bölüm GİZLİ (kullanıcı DENEMEDE)", EKRAN, TEMA,
        !d.planBolumu && d.deneme, `bölüm=${d.planBolumu} deneme=${d.deneme}`);
    yaz("G2 · Lisans kartında gerçek ödeme düğmesi var (tutarıyla)", EKRAN, TEMA,
        d.dugmeler.length > 0 && d.tutarli, `düğme=${JSON.stringify(d.dugmeler)}`);
    yaz("G3 · Deneme bitiş tarihi lisans kartında erişilebilir", EKRAN, TEMA, d.tarih, `tarih=${d.tarih}`);
    await resim("katalog-bugun");
    /* ÇALIŞIYOR = düğme ödeme akışını AÇIYOR ve bir plan kodu gönderiyor.
       Taklidin ödeme adresi yakalanıp uygulamaya dönüyor; gerçek para
       hareketi yok. */
    odemeEkranindakiPlan = null;
    await s.locator("form button[type=submit]").filter({ hasText: "Kartla öde" }).first().click();
    await s.waitForURL(/\/dashboard\/abonelik/, { timeout: 60000 });
    yaz("G4 · Mevcut ödeme yolu ÇALIŞIYOR (akış açıldı, plan kodu gitti)", EKRAN, TEMA,
        Boolean(odemeEkranindakiPlan), `ödeme ekranındaki plan=${odemeEkranindakiPlan}`);
  } catch (e) { yaz("G · bugünkü katalog", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`); }

  /* ---- P · Üç plan kartı (katalog dolu, deneme üyesi) ---- */
  const KARTLI = await kullaniciKur(`ayar-katalog-iptal-kartlar-${EKRAN}${TEMA}`);
  try {
    await giris(KARTLI);
    await git("/dashboard");
    const p = await s.evaluate(() => {
      const bolum = document.querySelector(".plan-secimi");
      if (!bolum) return { yok: true };
      const kartlar = [...bolum.querySelectorAll(".plan-secimi-kart")].map((k) => ({
        ad: k.querySelector("h3")?.textContent?.trim() ?? "",
        metin: k.innerText.replace(/\s+/g, " "),
        genislik: Math.round(k.getBoundingClientRect().width),
        kod: k.querySelector('input[name="plan"]')?.value ?? null,
        dugme: k.querySelector("button")?.textContent?.trim() ?? "",
      }));
      return {
        yok: false,
        baslik: bolum.querySelector("h2")?.textContent?.trim() ?? "",
        deneme: bolum.querySelector(".plan-secimi-deneme")?.textContent?.trim() ?? null,
        kartlar,
      };
    });
    yaz("P1 · Başlık ve üç kart", EKRAN, TEMA,
        !p.yok && /Çalışma temponuza uygun planı seçin/.test(p.baslik) && p.kartlar.length === 3,
        `başlık="${p.baslik}" kart=${p.kartlar?.length ?? 0}`);
    yaz("P2 · Kartlar EŞİT genişlikte", EKRAN, TEMA,
        !p.yok && new Set(p.kartlar.map((k) => k.genislik)).size === 1, `genişlikler=${JSON.stringify(p.kartlar?.map((k) => k.genislik))}`);
    yaz("P3 · Deneme bitiş satırı kartların üstünde", EKRAN, TEMA,
        Boolean(p.deneme && /bitiyor/.test(p.deneme)), `"${p.deneme ?? ""}"`);
    const beklenen = [
      { ad: "Standart", kod: "standart-ay", fiyat: "149", kredi: "1.000", dugme: "Standart'ı seç", satis: "tek yerde düzenleyin" },
      { ad: "Plus", kod: "plus-ay", fiyat: "249", kredi: "2.500", dugme: "Plus'ı seç", satis: "daha fazla alan açın" },
      { ad: "Pro", kod: "pro-ay", fiyat: "399", kredi: "6.000", dugme: "Pro'yu seç", satis: "en yüksek kullanım kapasitesiyle" },
    ];
    const eksik = p.yok ? ["bölüm yok"] : beklenen.filter((b, i) => {
      const k = p.kartlar[i];
      return !k || k.ad !== b.ad || k.kod !== b.kod || !k.metin.includes(b.fiyat) ||
        !k.metin.includes(b.kredi) || !k.dugme.includes(b.dugme) || !k.metin.includes(b.satis);
    }).map((b) => b.ad);
    yaz("P4 · Her kartta ad, fiyat, dönem, kredi, satış metni, kod ve düğme", EKRAN, TEMA, eksik.length === 0,
        eksik.length ? `eksik=[${eksik.join(", ")}]` : p.kartlar.map((k) => `${k.ad}/${k.kod}`).join(" "));
    const avantaj = p.yok ? false : p.kartlar.every((k) => /çalışma/.test(k.metin));
    yaz("P5 · Avantajlar katalogdan", EKRAN, TEMA, avantaj, `kartlarda avantaj satırı=${avantaj}`);
    if (mobil) {
      /* 390 px'te kartlar alt alta, sıra Standart → Plus → Pro ve her
         ana düğmeye kaydırarak ulaşılabilmeli. */
      const m = await s.evaluate(() => {
        const kartlar = [...document.querySelectorAll(".plan-secimi-kart")];
        const ustler = kartlar.map((k) => Math.round(k.getBoundingClientRect().top));
        return {
          sira: kartlar.map((k) => k.querySelector("h3")?.textContent?.trim()),
          altAlta: ustler.every((u, i) => i === 0 || u > ustler[i - 1]),
          tekSutun: new Set(kartlar.map((k) => Math.round(k.getBoundingClientRect().left))).size === 1,
        };
      });
      yaz("P6 · 390'da kartlar alt alta ve sıra Standart→Plus→Pro", EKRAN, TEMA,
          m.altAlta && m.tekSutun && JSON.stringify(m.sira) === JSON.stringify(["Standart", "Plus", "Pro"]),
          `sıra=${JSON.stringify(m.sira)} altAlta=${m.altAlta} tekSütun=${m.tekSutun}`);
      const ulasim = [];
      for (const ad of ["Standart", "Plus", "Pro"]) {
        const dugme = s.locator(`.plan-secimi-kart:has(h3:text-is("${ad}")) .plan-secimi-ana-eylem button`);
        await dugme.scrollIntoViewIfNeeded();
        await s.waitForTimeout(200);
        const gorunur = await dugme.evaluate((b) => {
          const r = b.getBoundingClientRect();
          const orta = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return r.top >= 0 && r.bottom <= window.innerHeight && Boolean(b.contains(orta) || b === orta);
        });
        if (!gorunur) ulasim.push(ad);
      }
      yaz("P7 · 390'da üç düğmeye de kaydırarak ulaşılıyor", EKRAN, TEMA, ulasim.length === 0,
          ulasim.length ? `ulaşılamayan=[${ulasim.join(", ")}]` : "üçü de tıklanabilir");
      await resim("plan-secimi-mobil-kaydirilmis");
    }
    await resim("plan-secimi");
  } catch (e) { yaz("P · plan kartları", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 70)}`); }

  /* ---- B · Ödeme BAŞARILI: üç kademe AYRI AYRI ---- */
  for (const kademe of [
    { ad: "Standart", kod: "standart-ay" },
    { ad: "Plus", kod: "plus-ay" },
    { ad: "Pro", kod: "pro-ay" },
  ]) {
    const K = await kullaniciKur(`ayar-katalog-basari-${kademe.ad.toLowerCase()}-${EKRAN}${TEMA}`);
    try {
      await giris(K);
      await git("/dashboard");
      /* DENEMEDE ÜCRETLİ ETİKET OLMAMALI: ekran aynı anda "Deneme
         süresi" ve "Pro" gösteriyordu. */
      const once = await s.evaluate(() => ({
        nav: [...document.querySelectorAll(".os-kullanici-kimlik, .os-kullanici-bas")]
          .find((e) => e.getClientRects().length > 0)?.querySelector("small")?.textContent?.trim() ?? "",
        deneme: /Deneme/.test(document.querySelector("main")?.innerText ?? ""),
      }));
      yaz(`B0 ${kademe.ad} · Denemede navigasyonda ücretli etiket YOK`, EKRAN, TEMA,
          once.deneme && once.nav === "", `deneme=${once.deneme} nav="${once.nav}"`);
      /* Lisans kartı ödeme düğmelerini TEKRARLAMIYOR; sözleşme notu
         üç kartın hemen altında, tek kez. */
      const tekrar = await s.evaluate(() => {
        const ana = document.querySelector("main");
        const kartlar = document.querySelector(".plan-secimi");
        return {
          kartlaOde: [...ana.querySelectorAll("button")].filter((b) => /Kartla öde/.test(b.textContent ?? "")).length,
          yasalNot: ana.querySelectorAll(".yasal-not").length,
          yasalKartlarda: Boolean(kartlar?.querySelector(".yasal-not")),
          anaHizalar: [...(kartlar?.querySelectorAll(".plan-secimi-ana-eylem button") ?? [])]
            .map((e) => Math.round(e.getBoundingClientRect().top)),
          yillikAltta: [...(kartlar?.querySelectorAll(".plan-secimi-kart") ?? [])].every((k) => {
            const ana = k.querySelector(".plan-secimi-ana-eylem button");
            const yil = k.querySelector(".plan-secimi-yillik-eylem button");
            return !yil || yil.getBoundingClientRect().top > ana.getBoundingClientRect().top;
          }),
          bosDugme: [...(kartlar?.querySelectorAll(".plan-secimi-kart button") ?? [])]
            .filter((b) => !(b.textContent ?? "").trim()).length,
          tarihSayisi: ((document.querySelector("main")?.innerText ?? "").match(/8 Aralık 2026/g) ?? []).length,
          lisansTarih: Boolean(document.querySelector(".license-card-validity")),
          yillik: [...(kartlar?.querySelectorAll(".plan-secimi-kart") ?? [])].map((k) => {
            const formlar = [...k.querySelectorAll("form")];
            const yillikForm = formlar.find((f) => /yıllık/i.test(f.querySelector("button")?.textContent ?? ""));
            if (!yillikForm) return null;
            const ad = k.querySelector("h3")?.textContent?.trim();
            const kod = yillikForm.querySelector('input[name="plan"]')?.value ?? "";
            const aylikKod = formlar[0]?.querySelector('input[name="plan"]')?.value ?? "";
            return `${ad}→${yillikForm.querySelector("button").textContent.trim()}|kod=${kod}|aylık=${aylikKod}`;
          }),
        };
      });
      yaz(`B0b ${kademe.ad} · Lisans kartında tekrar eden ödeme düğmesi yok`, EKRAN, TEMA,
          tekrar.kartlaOde === 0, `"Kartla öde" sayısı=${tekrar.kartlaOde}`);
      yaz(`B0c ${kademe.ad} · Sözleşme notu TEK ve üç kartın altında`, EKRAN, TEMA,
          tekrar.yasalNot === 1 && tekrar.yasalKartlarda, `not=${tekrar.yasalNot} kartlarda=${tekrar.yasalKartlarda}`);
      if (!mobil) {
        /* ANA düğmelerin ÜST kenarı aynı olmalı. Eskiden yalnızca eylem
           bloğunun ALTI hizalanıyordu; yıllığı olan kartta ana düğme
           yukarı kayıyordu. */
        yaz(`B0d ${kademe.ad} · Masaüstünde ANA düğmeler aynı yatay çizgide`, EKRAN, TEMA,
            tekrar.anaHizalar.length === 3 && new Set(tekrar.anaHizalar).size === 1,
            `ana düğme üstleri=${JSON.stringify(tekrar.anaHizalar)}`);
      }
      yaz(`B0f ${kademe.ad} · Yıllık kendi ana düğmesinin altında, boş düğme yok`, EKRAN, TEMA,
          tekrar.yillikAltta && tekrar.bosDugme === 0,
          `yıllıkAltta=${tekrar.yillikAltta} boşDüğme=${tekrar.bosDugme}`);
      yaz(`B0g ${kademe.ad} · Deneme tarihi tek yerde (kartların üstünde)`, EKRAN, TEMA,
          tekrar.tarihSayisi === 1 && !tekrar.lisansTarih,
          `tarih sayısı=${tekrar.tarihSayisi} lisansKartındaTarih=${tekrar.lisansTarih}`);
      /* Yıllık düğme hem ADIYLA hem de KENDİ koduyla kendi planına
         bağlı olmalı: "Standart yıllık" düğmesi standart-yil kodunu
         göndermeli, aylık kodu değil. */
      yaz(`B0e ${kademe.ad} · Yıllık seçenek kendi planına bağlı (ad ve kod)`, EKRAN, TEMA,
          tekrar.yillik.some((x) => x && /Standart→Standart yıllık.*kod=standart-yil\|aylık=standart-ay/.test(x)) &&
          tekrar.yillik.some((x) => x && /Pro→Pro yıllık.*kod=pro-yil\|aylık=pro-ay/.test(x)),
          JSON.stringify(tekrar.yillik));

      odemeEkranindakiPlan = null;
      await s.locator(`.plan-secimi-kart:has(h3:text-is("${kademe.ad}"))`).locator("button[type=submit]").first().click();
      await s.waitForURL(/\/dashboard\/abonelik/, { timeout: 60000 });
      await s.waitForLoadState("networkidle").catch(() => {});
      await s.waitForTimeout(900);
      yaz(`B1 ${kademe.ad} · Ödeme ekranına SEÇİLEN planın kodu gidiyor`, EKRAN, TEMA,
          odemeEkranindakiPlan === kademe.kod, `gönderilen=${odemeEkranindakiPlan} beklenen=${kademe.kod}`);
      const abonelik = await s.evaluate(() => (document.querySelector(".abonelik-kartlar")?.innerText ?? "").replace(/\s+/g, " "));
      yaz(`B2 ${kademe.ad} · Etkinleşen plan Abonelik ekranında`, EKRAN, TEMA,
          new RegExp(kademe.ad).test(abonelik), `"${abonelik.slice(0, 70)}"`);
      await git("/dashboard");
      const sonra = await s.evaluate(() => ({
        planBolumu: Boolean(document.querySelector(".plan-secimi")),
        nav: [...document.querySelectorAll(".os-kullanici-kimlik, .os-kullanici-bas")]
          .find((e) => e.getClientRects().length > 0)?.querySelector("small")?.textContent?.trim() ?? null,
      }));
      yaz(`B3 ${kademe.ad} · Ana sayfada plan seçimi kalktı, navigasyonda plan adı`, EKRAN, TEMA,
          !sonra.planBolumu && sonra.nav === kademe.ad, `bölüm=${sonra.planBolumu} nav="${sonra.nav}"`);
      await s.locator("details.os-kullanici summary").filter({ visible: true }).first().click();
      await s.locator('.os-kullanici-menu a[href="/dashboard/settings"]').filter({ visible: true }).first().click();
      await s.waitForSelector(".drawer-root.open .ayarlar-pencere", { timeout: 25000 });
      await s.waitForTimeout(700);
      const ayarlar = await s.evaluate(() => {
        const liste = document.querySelector(".drawer-root.open .ayarlar-bilgiler");
        return [...(liste?.querySelectorAll("div") ?? [])].map((d) => `${d.querySelector("dt")?.textContent?.trim()}=${d.querySelector("dd")?.textContent?.trim()}`).join(" ");
      });
      yaz(`B4 ${kademe.ad} · Ayarlar'da üyelik tipi aynı plan`, EKRAN, TEMA,
          new RegExp(`Üyelik tipi=${kademe.ad}`).test(ayarlar), `"${ayarlar}"`);
      if (kademe.ad === "Plus") await resim("odeme-basarili");
      await s.keyboard.press("Escape");
      await s.waitForTimeout(350);
    } catch (e) { yaz(`B · ${kademe.ad} başarı senaryosu`, EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 80)}`); }
  }

  /* ---- V · İPTAL: deneme sürüyor ---- */
  const IPTAL = await kullaniciKur(`ayar-katalog-iptal-${EKRAN}${TEMA}`);
  try {
    await giris(IPTAL);
    await git("/dashboard");
    await s.locator('.plan-secimi-kart:has(h3:text-is("Pro"))').locator("button[type=submit]").first().click();
    await s.waitForURL(/\/dashboard\/abonelik/, { timeout: 60000 });
    await s.waitForLoadState("networkidle").catch(() => {});
    await s.waitForTimeout(800);
    const d = await s.evaluate(() => (document.querySelector(".abonelik-kartlar")?.innerText ?? "").replace(/\s+/g, " "));
    yaz("V1 · İptalde deneme üyeliği sürüyor", EKRAN, TEMA, /Deneme/.test(d) && !/Üyelik tipi/.test(d), `"${d.slice(0, 80)}"`);
    await git("/dashboard");
    const bolum = await s.evaluate(() => Boolean(document.querySelector(".plan-secimi")));
    yaz("V2 · İptalden sonra plan seçimi hâlâ sunuluyor", EKRAN, TEMA, bolum, `bölüm=${bolum}`);
    await resim("odeme-iptal");
  } catch (e) { yaz("V · ödeme iptali", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 80)}`); }

  /* ---- H · HATA: ödeme başlatılamıyor, deneme sürüyor ---- */
  const HATA = await kullaniciKur(`ayar-katalog-hata-${EKRAN}${TEMA}`);
  try {
    await giris(HATA);
    await git("/dashboard");
    await s.locator('.plan-secimi-kart:has(h3:text-is("Standart"))').locator("button[type=submit]").first().click();
    /*
      Ürün hatayı TOAST ile söylüyor (ActionErrorToast): sunucu
      /dashboard?error=odeme-baslatilamadi'ya yönlendiriyor, bileşen
      mesajı gösterip parametreyi adresten siliyor. Bu yüzden ne
      adrese ne de sayfa gövdesine bakılıyor; toast'ın kendisi
      yakalanıyor ve kısa ömürlü olduğu için HEMEN bekleniyor.
    */
    const toast = await s.locator(".toast").filter({ hasText: /Ödeme sayfası şu an açılamadı/ })
      .first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    const d = await s.evaluate(() => ({
      yol: location.pathname + location.search,
      bolum: Boolean(document.querySelector(".plan-secimi")),
    }));
    yaz("H1 · Hatada kullanıcıya mesaj gösteriliyor", EKRAN, TEMA, toast, `toast=${toast} yol=${d.yol}`);
    await git("/dashboard");
    const sonra = await s.evaluate(() => ({
      bolum: Boolean(document.querySelector(".plan-secimi")),
      deneme: /Deneme/.test(document.querySelector("main")?.innerText ?? ""),
    }));
    yaz("H2 · Hatadan sonra deneme sürüyor ve seçim yine sunuluyor", EKRAN, TEMA, sonra.bolum && sonra.deneme,
        `bölüm=${sonra.bolum} deneme=${sonra.deneme}`);
    await resim("odeme-hata");
  } catch (e) { yaz("H · ödeme hatası", EKRAN, TEMA, false, `HATA ${String(e.message).slice(0, 80)}`); }

  await ctx.close();
}
await tarayici.close();
if (GORSEL) fs.writeFileSync(`${GORSEL}/ilk-kullanim.json`, JSON.stringify(sonuclar, null, 1));
const gec = sonuclar.filter((r) => r.gecti).length;
console.log(`\n${sonuclar.length} kontrol · ${gec} geçti · ${sonuclar.length - gec} kaldı`);
process.exit(gec === sonuclar.length ? 0 : 1);
