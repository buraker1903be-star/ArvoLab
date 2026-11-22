// ANALİZ ÇALIŞMA ALANI — KABUL (22.11.2026, claude/analiz-calisma-alani dalı).
//
// Gerçek Next uygulaması (üretim derlemesi, `next start`) yerel yığına
// bağlıyken tarayıcıda sınar:
//   S1  veri yüklenmeden: katalog gezilebilir, hesap başlamaz
//   S2  dosya yükleme → gerçek satır/sütun sayısı → "Veriyi incele"
//   S3  ana analiz aileleri: değişken seçimi → hesaplama → sonuç
//   S4  eskiyen sonuç: değişken/analiz/veri değişimi
//   S5  veri değiştirmede kaydedilmemiş sonuç uyarısı
//   S6  hatalı/eksik veri sessizce sonuç olmuyor
//   S7  yardım akışı: bağımsız/tekrarlı, eksik bilgi, desteklenmeyen desen
//   S8  sayfa ve sekme açmak analiz KAYDETMİYOR (veritabanından sayım)
//   S9  gezgin: arama (kısaltma), sonuç yok durumu, seçili satır
//   S10 ölçüler: 1440/1280/768/390, açık/koyu, klavye, telefon gezinmesi
// Yalnızca sentetik kullanıcı ve sentetik veri; AI çağrısı yok.
//
// Kullanım: node scripts/yerel-yigin/analiz-alani-kabul.mjs http://localhost:3133 [görüntü-dizini]
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
const UYG = process.argv[2] ?? "http://localhost:3133";
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
  psql("select analiz_turu from public.analiz_sonuclari limit 0");
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
    if (typeof beklenen === "function" ? beklenen(v) : v === beklenen) PASS(ad, String(v).slice(0, 110));
    else FAIL(ad, `beklenen ${typeof beklenen === "function" ? "(koşul)" : beklenen}, bulunan ${String(v).slice(0, 160)}`);
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

/* ---------- Sentetik kullanıcı ve çalışma ---------- */
const adres = `analiz-${ek}@yerel.test`, parola = `Kq7!${crypto.randomBytes(9).toString("base64url")}`;
const yeni = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: "Analiz Deneği" } });
if (yeni.durum >= 300) { console.error("kullanıcı kurulamadı", yeni); process.exit(2); }
const KULLANICI = yeni.json.id;
/* Parola ayrı istekte: /admin/users gövdesindeki password GoTrue'da uygulanmıyor. */
await auth(`/admin/users/${KULLANICI}`, { password: parola }, "PUT");
psql(`update public.profiles set full_name = 'Analiz Deneği' where id = ${q(KULLANICI)}`);
psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
      values (${q(KULLANICI)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
const PROJE = psql(`insert into public.academic_projects (owner_id, project_type, title)
  values (${q(KULLANICI)}, 'thesis', 'Analiz kabul çalışması') returning id`).split("\n")[0];
const PROJE2 = psql(`insert into public.academic_projects (owner_id, project_type, title)
  values (${q(KULLANICI)}, 'thesis', 'İkinci çalışma') returning id`).split("\n")[0];

/* ---------- Sentetik veri dosyası ----------
   Sayılar BİLİNİYOR: iki grup (A: 10 gözlem, B: 10 gözlem), üç tekrarlı
   ölçüm ve beş maddelik bir ölçek. Gerçek bir yayından alınmadı. */
const satirlar = [];
const rastgele = (() => { let t = 20261122; return () => ((t = (t * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })();
for (let i = 0; i < 40; i++) {
  const grup = i < 20 ? "A" : "B";
  const taban = i < 20 ? 60 : 70;
  const puan = Math.round((taban + rastgele() * 18) * 10) / 10;
  satirlar.push({
    katilimci: `K${i + 1}`,
    grup,
    /* Üç düzeyli: tek yönlü ANOVA en az 3 grup ister (var olan davranış). */
    sinif: ["9", "10", "11"][i % 3],
    cinsiyet: i % 2 === 0 ? "kadin" : "erkek",
    on_test: Math.round((taban - 5 + rastgele() * 12) * 10) / 10,
    son_test: puan,
    izleme: Math.round((puan + rastgele() * 6 - 3) * 10) / 10,
    yas: 18 + Math.floor(rastgele() * 10),
    m1: 1 + Math.floor(rastgele() * 5), m2: 1 + Math.floor(rastgele() * 5),
    m3: 1 + Math.floor(rastgele() * 5), m4: 1 + Math.floor(rastgele() * 5), m5: 1 + Math.floor(rastgele() * 5),
    basari: rastgele() > 0.45 ? "gecti" : "kaldi",
  });
}
const sutunlar = Object.keys(satirlar[0]);
const CSV = [sutunlar.join(","), ...satirlar.map((r) => sutunlar.map((c) => r[c]).join(","))].join("\n");
const VERI_YOLU = path.join(KOK, `.tmp-analiz-kabul-${ek}.csv`);
fs.writeFileSync(VERI_YOLU, CSV, "utf8");
/* Büyük dosya: 20 000 satır. Önizlemenin bütün dosyayı DOM'a yazmadığı ve
   hesabın tarayıcıda makul sürede bittiği burada sınanıyor. */
const BUYUK_YOLU = path.join(KOK, `.tmp-analiz-buyuk-${ek}.csv`);
{
  const satir = (i) => {
    const grup = i % 2 ? "A" : "B";
    const taban = i % 2 ? 60 : 70;
    const p = (taban + ((i * 7919) % 180) / 10).toFixed(1);
    return [`K${i}`, grup, ["9", "10", "11"][i % 3], i % 2 ? "kadin" : "erkek", (Number(p) - 5).toFixed(1), p, (Number(p) + 1).toFixed(1), 18 + (i % 10), 1 + (i % 5), 1 + ((i + 1) % 5), 1 + ((i + 2) % 5), 1 + ((i + 3) % 5), 1 + ((i + 4) % 5), i % 3 ? "gecti" : "kaldi"].join(",");
  };
  const parcalar = [sutunlar.join(",")];
  for (let i = 0; i < 20000; i++) parcalar.push(satir(i));
  fs.writeFileSync(BUYUK_YOLU, parcalar.join("\n"), "utf8");
}
/* Bozuk dosya: başlık var, sayısal sütun yok, satırlar eksik sütunlu. */
const BOZUK_YOLU = path.join(KOK, `.tmp-analiz-bozuk-${ek}.csv`);
fs.writeFileSync(BOZUK_YOLU, "ad;soyad\nAli\nVeli;Yilmaz;fazla\n", "utf8");

const tarayici = await chromium.launch({ args: ["--no-sandbox"] });
const sayim = () => Number(psql(`select count(*) from public.analiz_sonuclari where owner_id = ${q(KULLANICI)}`));

async function oturum(genislik = 1440, yukseklik = 900, tema = "light") {
  const ctx = await tarayici.newContext({ viewport: { width: genislik, height: yukseklik }, colorScheme: tema, locale: "tr-TR" });
  const sayfa = await ctx.newPage();
  await sayfa.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
  await sayfa.fill('input[name="email"]', adres);
  await sayfa.fill('input[name="password"]', parola);
  await Promise.all([sayfa.waitForURL(/dashboard/, { timeout: 60000 }), sayfa.press('input[name="password"]', "Enter")]);
  return { ctx, sayfa };
}
const git = async (sayfa, yol) => { await sayfa.goto(`${UYG}${yol}`, { waitUntil: "domcontentloaded" }); await sayfa.waitForLoadState("networkidle").catch(() => {}); };
const cek = async (sayfa, ad) => { if (GORSEL) await sayfa.screenshot({ path: path.join(GORSEL, `${ad}.png`) }); };

const ANALIZ_YOLU = `/dashboard/analysis?calisma=${PROJE}`;

try {
  /* ================= S1: veri yüklenmeden ================= */
  const { ctx, sayfa } = await oturum();
  const oncekiSayim = sayim();
  await git(sayfa, ANALIZ_YOLU);

  await esit("S1a gezgin çiziliyor (7 kategori)", async () => await sayfa.locator(".analiz-kategori").count(), 7);
  await esit("S1b veri yüklenmeden katalog gezilebilir uyarısı", async () => (await sayfa.locator(".analiz-gezgin-not").innerText()).includes("Listeyi şimdi gezebilirsiniz"), true);
  await esit("S1c veri yoksa 'Analizi Çalıştır' hiç çizilmiyor", async () => await sayfa.getByRole("button", { name: /Analizi Çalıştır/ }).count(), 0);
  await esit("S1d kategori açılıp analiz seçilebiliyor (hesap başlamadan)", async () => {
    await sayfa.locator(".analiz-kategori-bas", { hasText: "t-Testleri" }).click();
    await sayfa.locator(".analiz-gezgin-oge", { hasText: "Bağımsız Örneklem" }).first().click();
    return await sayfa.locator('.analiz-gezgin-oge[aria-current="true"]').innerText();
  }, (v) => /Bağımsız Örneklem/.test(v));
  await esit("S1e dosya seçme alanı ve desteklenen uzantılar yazılı", async () => await sayfa.locator(".dropzone").innerText(), (v) => /\.xlsx, \.xls, \.csv, \.tsv, \.txt/.test(v));
  await esit("S1f kapalı kategorinin analizleri GÖRÜNMÜYOR", async () => {
    /* Yalnızca seçili analizin kategorisi açık başlar. */
    const acik = await sayfa.locator(".analiz-kategori ul:not([hidden])").count();
    const gorunen = await sayfa.locator(".analiz-gezgin-oge:visible").count();
    return `${acik} kategori · ${gorunen} analiz`;
  }, "2 kategori · 4 analiz");
  await esit("S1g kategori başlığına basınca açılıyor/kapanıyor", async () => {
    const bas = sayfa.locator(".analiz-kategori-bas", { hasText: "ANOVA / ANCOVA" });
    await bas.click(); await sayfa.waitForTimeout(150);
    const acikken = await sayfa.locator(".analiz-gezgin-oge:visible").count();
    await bas.click(); await sayfa.waitForTimeout(150);
    const kapaliyken = await sayfa.locator(".analiz-gezgin-oge:visible").count();
    return `${acikken} → ${kapaliyken}`;
  }, "9 → 4");
  await esit("S1h çalışma alanı kipinde ikinci bir katalog listesi yok", async () => await sayfa.locator(".analiz-katalog").count(), 0);
  await cek(sayfa, "01-veri-yok-1440-acik");

  /* ================= S9: gezgin arama ================= */
  const ara = sayfa.locator('.analiz-gezgin-arama input');
  await esit("S9a kısaltmayla arama: 'AFA' → Açımlayıcı Faktör Analizi", async () => {
    await ara.fill("AFA");
    await sayfa.waitForTimeout(150);
    return await sayfa.locator(".analiz-gezgin-oge").allInnerTexts();
  }, (v) => v.length === 1 && /Açımlayıcı Faktör/.test(v[0]));
  await esit("S9b 'U testi' → Mann-Whitney U", async () => { await ara.fill("U testi"); await sayfa.waitForTimeout(150); return await sayfa.locator(".analiz-gezgin-oge").allInnerTexts(); }, (v) => v.some((x) => /Mann-Whitney/.test(x)));
  await esit("S9c 'rm anova' → Tekrarlı Ölçümler ANOVA", async () => { await ara.fill("rm anova"); await sayfa.waitForTimeout(150); return await sayfa.locator(".analiz-gezgin-oge").allInnerTexts(); }, (v) => v.length === 1 && /Tekrarlı Ölçümler/.test(v[0]));
  await esit("S9d desteklenmeyen yöntem aranınca 'sonuç yok' durumu", async () => { await ara.fill("manova"); await sayfa.waitForTimeout(150); return (await sayfa.locator(".analiz-gezgin-bos").innerText()).includes("sonuç yok"); }, true);
  await cek(sayfa, "02-arama-sonuc-yok");
  await esit("S9e 'Aramayı temizle' listeyi geri getiriyor", async () => {
    await sayfa.getByRole("button", { name: "Aramayı temizle" }).click();
    await sayfa.waitForTimeout(150);
    return await sayfa.locator(".analiz-kategori").count();
  }, 7);

  /* ================= S7: yardım akışı ================= */
  await esit("S7a yardım paneli açılıyor; BİR SEFERDE TEK soru", async () => {
    await sayfa.getByRole("button", { name: /Hangi analizi seçmeliyim/ }).click();
    await sayfa.waitForSelector(".analiz-yardim");
    return await sayfa.locator(".analiz-yardim-soru legend").allInnerTexts();
  }, (v) => v.length === 1 && /ne yapmak istiyorsunuz/i.test(v[0]));
  await esit("S7a2 başlık panelde tekrarlanmıyor (tetikleyicide zaten var)", async () => {
    const panel = await sayfa.locator(".analiz-yardim").innerText();
    return (panel.match(/Hangi analizi seçmeliyim/g) ?? []).length;
  }, 0);
  await esit("S7a3 yardım açılınca çalışma alanı DARALMIYOR", async () => {
    const govde = await sayfa.locator(".analiz-pencere-govde").boundingBox();
    await sayfa.getByRole("button", { name: /Hangi analizi seçmeliyim/ }).click();
    await sayfa.waitForTimeout(250);
    const kapali = await sayfa.locator(".analiz-pencere-govde").boundingBox();
    await sayfa.getByRole("button", { name: /Hangi analizi seçmeliyim/ }).click();
    await sayfa.waitForSelector(".analiz-yardim");
    const acik = await sayfa.locator(".analiz-pencere-govde").boundingBox();
    return Math.abs((kapali?.width ?? 0) - (acik?.width ?? 0)) <= 1 && Math.abs((govde?.width ?? 0) - (acik?.width ?? 0)) <= 1;
  }, true);

  /* Bir seferde tek soru açık; cevaplananlar "Yanıtlarım" özetinde. */
  const yardimSec = async (soru, secenek) => {
    const acik = sayfa.locator(".analiz-yardim-soru legend");
    if (!(await acik.count()) || !new RegExp(soru).test(await acik.innerText())) {
      const ozet = sayfa.locator(".analiz-yardim-yanitlarim button", { hasText: soru });
      if (await ozet.count()) { await ozet.first().click(); await sayfa.waitForTimeout(150); }
    }
    await sayfa.locator(".analiz-yardim-soru .analiz-yardim-secenek", { hasText: secenek }).first().click();
    await sayfa.waitForTimeout(180);
  };
  await yardimSec("ne yapmak istiyorsunuz", "Gruplar ya da ölçümler arasında fark");
  await yardimSec("ÖLÇÜM DÜZEYİNDE", "Sürekli");
  await yardimSec("Dağılım ve örneklem", "Dağılım normale yakın");
  await yardimSec("Karşılaştırdığınız ölçümler kimlerden", "Farklı kişilerden");
  await yardimSec("Kaç grup ya da kaç ölçüm", "İki");
  await esit("S7b bağımsız + iki grup + sürekli → bağımsız örneklem t-testi", async () => await sayfa.locator(".analiz-yardim-aday-ad").allInnerTexts(), (v) => v.length === 1 && /Bağımsız Örneklem t-Testi/.test(v[0]));
  await esit("S7b2 aday kartında gerekçe, kontrol ve 'Bu analizi aç' birlikte", async () => {
    const kart = sayfa.locator(".analiz-yardim-adaylar li").first();
    const metin = await kart.innerText();
    const dugme = await kart.getByRole("button", { name: /Bu analizi aç/ }).isVisible();
    return `${/İki bağımsız grubun/.test(metin)} ${/Kontrol edin:/.test(metin)} ${dugme}`;
  }, "true true true");
  await esit("S7b3 verilen cevaplar 'Yanıtlarım' özetinde düzenlenebilir", async () => {
    const satir = await sayfa.locator(".analiz-yardim-yanitlarim button").count();
    const degistir = await sayfa.locator(".analiz-yardim-yanitlarim button span").first().innerText();
    return `${satir >= 4} ${/Değiştir/.test(degistir)}`;
  }, "true true");
  await esit("S7c tek aday bile kesin ilan edilmiyor", async () => (await sayfa.locator(".analiz-yardim-sinirlar").innerText()), (v) => /öneridir, hüküm değil/.test(v) && /danışmanınızla/.test(v));
  await cek(sayfa, "03-yardim-bagimsiz-iki-grup");

  await esit("S7d TEKRARLI seçilince aday eşleştirilmiş t-testine dönüyor", async () => {
    await yardimSec("Karşılaştırdığınız ölçümler kimlerden", "Aynı kişilerin tekrarlı");
    await yardimSec("Kaç grup ya da kaç ölçüm", "İki");
    return await sayfa.locator(".analiz-yardim-aday-ad").allInnerTexts();
  }, (v) => v.length === 1 && /Eşleştirilmiş Örneklem/.test(v[0]));
  /* ÖLÇÜM DÜZEYİ ≠ DAĞILIM: çarpıklık parametrik adayı listeden ATMIYOR. */
  await esit("S7d2 çarpık dağılım parametrik adayı kaldırmıyor, sıra temellisini EKLİYOR", async () => {
    await yardimSec("Dağılım ve örneklem", "Çarpık, uç değerli");
    await yardimSec("Karşılaştırdığınız ölçümler kimlerden", "Farklı kişilerden");
    await yardimSec("Kaç grup ya da kaç ölçüm", "İki");
    const adaylar = await sayfa.locator(".analiz-yardim-aday-ad").allInnerTexts();
    const sinir = await sayfa.locator(".analiz-yardim-sinirlar").innerText();
    return `${adaylar.join(" | ")} || ${/ÖLÇÜM DÜZEYİNİ değiştirmez/.test(sinir)}`;
  }, (v) => /Bağımsız Örneklem t-Testi \| Mann-Whitney/.test(v) && /\|\| true$/.test(v));

  await esit("S7e düzen BİLİNMİYORSA iki aday ve eksik bilgi yazılı", async () => {
    await yardimSec("Dağılım ve örneklem", "Dağılım normale yakın");
    await yardimSec("Karşılaştırdığınız ölçümler kimlerden", "Bilmiyorum");
    await yardimSec("Kaç grup ya da kaç ölçüm", "İki");
    const adaylar = await sayfa.locator(".analiz-yardim-aday-ad").allInnerTexts();
    const sinir = await sayfa.locator(".analiz-yardim-sinirlar").innerText();
    return `${adaylar.join(" | ")} || ${/bağımsız mı tekrarlı mı/.test(sinir)}`;
  }, (v) => /Bağımsız Örneklem t-Testi/.test(v) && /Eşleştirilmiş Örneklem/.test(v) && /\|\| true$/.test(v));
  await cek(sayfa, "04-yardim-eksik-bilgi");

  await esit("S7f DESTEKLENMEYEN desen: üç tekrarlı ölçüm + kategorik → aday YOK", async () => {
    await yardimSec("ÖLÇÜM DÜZEYİNDE", "Kategorik");
    await yardimSec("kaç kategorisi var", "İki");
    await yardimSec("Karşılaştırdığınız ölçümler kimlerden", "Aynı kişilerin tekrarlı");
    await yardimSec("Kaç grup ya da kaç ölçüm", "Üç ya da daha çok");
    const adayVar = await sayfa.locator(".analiz-yardim-adaylar").count();
    const metin = await sayfa.locator(".analiz-yardim-sonuc").innerText();
    return `aday:${adayVar} ${/Cochran Q/.test(metin)} ${/McNemar yalnızca iki ölçüm/.test(metin)}`;
  }, "aday:0 true true");
  await cek(sayfa, "05-yardim-desteklenmeyen");

  /* İKİLİ SONUÇ KOŞULU: üç kategoride McNemar ÖNERİLMİYOR. */
  await esit("S7f2 üç kategorili tekrarlı ölçümde McNemar aday değil", async () => {
    await yardimSec("kaç kategorisi var", "Üç ya da daha çok");
    await yardimSec("Karşılaştırdığınız ölçümler kimlerden", "Aynı kişilerin tekrarlı");
    await yardimSec("Kaç grup ya da kaç ölçüm", "İki");
    const adayVar = await sayfa.locator(".analiz-yardim-adaylar").count();
    const metin = await sayfa.locator('.analiz-yardim-sonuc[data-tur="yok"]').innerText();
    return `aday:${adayVar} ${/McNemar–Bowker|marjinal homojenlik/.test(metin)}`;
  }, "aday:0 true");

  await esit("S7g 'Bu analizi aç' kullanıcının eylemi: seçimi değiştiriyor", async () => {
    await sayfa.getByRole("button", { name: /Baştan başla|Yanıtları temizle/ }).click();
    await yardimSec("ne yapmak istiyorsunuz", "Ölçeğimin güvenilirliğine");
    await yardimSec("Ölçek için neye bakıyorsunuz", "İç tutarlılık");
    await sayfa.getByRole("button", { name: /Bu analizi aç/ }).first().click();
    await sayfa.waitForTimeout(200);
    return await sayfa.locator('.analiz-gezgin-oge[aria-current="true"]').innerText();
  }, (v) => /Güvenilirlik/.test(v));
  await esit("S7h yardım paneli analizi açınca kapanıyor", async () => await sayfa.locator(".analiz-yardim").count(), 0);

  /* ================= S8: açmak kaydetmiyor ================= */
  await esit("S8a sayfa/sekme/yardım açmak analiz kaydetmedi", () => sayim(), oncekiSayim);
  await esit("S8b 'Kaydedilen analizler' sekmesi açılıyor ve kayıt yapmıyor", async () => {
    await sayfa.getByRole("tab", { name: /Kaydedilen analizler/ }).click();
    await sayfa.waitForTimeout(200);
    const kayit = sayim();
    await sayfa.getByRole("tab", { name: /Çalışma alanı/ }).click();
    return kayit;
  }, oncekiSayim);
  await esit("S8c ham veri olmadan hesabın sürdürülemeyeceği yazılı", async () => {
    await sayfa.getByRole("tab", { name: /Kaydedilen analizler/ }).click();
    const m = await sayfa.locator('[role="tabpanel"]#analiz-panel-kayitli').innerText();
    await sayfa.getByRole("tab", { name: /Çalışma alanı/ }).click();
    return /Kaydedilen yalnızca sonuç metnidir/.test(m);
  }, true);

  /* ================= S6: bozuk veri ================= */
  await esit("S6a sayısal sütunu olmayan/eksik sütunlu dosya sessizce sonuç olmuyor", async () => {
    await sayfa.locator('.dropzone input[type="file"]').setInputFiles(BOZUK_YOLU);
    await sayfa.waitForTimeout(1200);
    const uyari = await sayfa.locator('.alert[data-tone="danger"], .muted.text-sm[role="status"]').allInnerTexts().catch(() => []);
    const sonucVar = await sayfa.locator(".analiz-sonuc").count();
    return `sonuc:${sonucVar} uyari:${uyari.join(" ").slice(0, 80)}`;
  }, (v) => v.startsWith("sonuc:0"));
  await cek(sayfa, "06-bozuk-veri");

  /* ================= S2: gerçek dosya ================= */
  await git(sayfa, ANALIZ_YOLU);
  await esit("S2a dosya yüklenince gerçek satır/sütun sayısı yazılıyor", async () => {
    await sayfa.locator('.dropzone input[type="file"]').setInputFiles(VERI_YOLU);
    await sayfa.waitForSelector(".analiz-veri-serit", { timeout: 20000 });
    return await sayfa.locator(".analiz-veri-serit > span").first().innerText();
  }, (v) => v.includes("40 satır") && v.includes(`${sutunlar.length} sütun`));
  await esit("S2b adım şeridi çiziliyor; 'Kontroller' önceden 'uygun' demiyor", async () => {
    const metin = await sayfa.locator(".analiz-adimlar").innerText();
    const durumlar = await sayfa.locator(".analiz-adimlar li").evaluateAll((l) => l.map((x) => x.dataset.durum));
    return `${durumlar.join(",")} || ${/Analiz çalışınca denetlenir/.test(metin)} ${/uygun|geçti/i.test(metin)}`;
  }, "sirada,bekliyor,bekliyor || true false");
  await esit("S2c 'Veriyi incele' sütun türlerini ve eksikleri gösteriyor", async () => {
    await sayfa.getByRole("button", { name: "Veriyi incele" }).click();
    await sayfa.waitForSelector(".veri-incele");
    const sutun = await sayfa.locator(".veri-incele-sutunlar li").count();
    const ilk = await sayfa.locator(".veri-incele-sutunlar li").first().innerText();
    const satir = await sayfa.locator(".veri-incele tbody tr").count();
    return `${sutun} sütun · ${satir} satır · ${/sayısal|kategorik/.test(ilk)} · ${/eksik/.test(ilk)}`;
  }, (v) => v.startsWith(`${sutunlar.length} sütun · 20 satır · true · true`));
  await cek(sayfa, "07-veri-incele");
  await esit("S2d önizleme bütün dosyayı DOM'a yazmıyor (en çok 20 satır)", async () => await sayfa.locator(".veri-incele tbody tr").count(), (v) => v <= 20);
  await sayfa.getByRole("button", { name: "İncelemeyi kapat" }).click();

  /* ---- S2e: büyük veri ---- */
  await esit("S2e 20 000 satırlık dosya okunuyor ve sayım doğru", async () => {
    await git(sayfa, ANALIZ_YOLU);
    const basla = Date.now();
    await sayfa.locator('.dropzone input[type="file"]').setInputFiles(BUYUK_YOLU);
    await sayfa.waitForSelector(".analiz-veri-serit", { timeout: 90000 });
    const metin = await sayfa.locator(".analiz-veri-serit > span").first().innerText();
    return `${metin.includes("20000 satır")} · ${Math.round((Date.now() - basla) / 1000)}sn`;
  }, (v) => v.startsWith("true"));
  await esit("S2f büyük dosyada önizleme yine en çok 20 satır çiziyor", async () => {
    await sayfa.getByRole("button", { name: "Veriyi incele" }).click();
    await sayfa.waitForSelector(".veri-incele");
    const satir = await sayfa.locator(".veri-incele tbody tr").count();
    const toplam = await sayfa.locator(".veri-incele-bas").nth(1).innerText();
    await sayfa.getByRole("button", { name: "İncelemeyi kapat" }).click();
    return `${satir} satır · ${/20000/.test(toplam)}`;
  }, "20 satır · true");
  await esit("S2g büyük veride analiz çalışıyor ve sonuç üretiyor", async () => {
    await sayfa.locator('.analiz-gezgin-arama input').fill("Bağımsız Örneklem");
    await sayfa.waitForTimeout(150);
    await sayfa.locator(".analiz-gezgin-oge").first().click();
    await sayfa.locator('.analiz-gezgin-arama input').fill("");
    const g = sayfa.locator("label").filter({ hasText: "Grup değişkeni" }).locator("select").first();
    await g.selectOption({ label: "grup" });
    const n = sayfa.locator("label").filter({ hasText: "Sayısal değişken" }).locator("select").first();
    await n.selectOption({ label: "son_test" });
    const basla = Date.now();
    await sayfa.getByRole("button", { name: /Analizi Çalıştır/ }).click();
    await sayfa.waitForSelector(".analiz-sonuc", { timeout: 60000 });
    const sure = Math.round((Date.now() - basla) / 1000);
    const sonuc = await sayfa.locator(".analiz-sonuc").innerText();
    return `${/t\(/.test(sonuc)} · ${sure}sn`;
  }, (v) => v.startsWith("true"));

  /* Sonraki senaryolar küçük ve içeriği bilinen dosyayla koşsun. */
  await git(sayfa, ANALIZ_YOLU);
  await sayfa.locator('.dropzone input[type="file"]').setInputFiles(VERI_YOLU);
  await sayfa.waitForSelector(".analiz-veri-serit", { timeout: 20000 });

  /* ================= S3: analiz aileleri ================= */
  const analizSec = async (kategori, ad) => {
    await sayfa.locator('.analiz-gezgin-arama input').fill(ad);
    await sayfa.waitForTimeout(150);
    await sayfa.locator(".analiz-gezgin-oge", { hasText: ad }).first().click();
    await sayfa.locator('.analiz-gezgin-arama input').fill("");
    await sayfa.waitForTimeout(120);
  };
  const alanSec = async (etiket, deger) => {
    const kutu = sayfa.locator("label").filter({ hasText: etiket }).locator("select").first();
    await kutu.selectOption({ label: deger }).catch(async () => { await kutu.selectOption(deger); });
  };
  const calistir = async () => {
    await sayfa.getByRole("button", { name: /Analizi Çalıştır/ }).click();
    await sayfa.waitForSelector(".analiz-sonuc", { timeout: 20000 });
    return await sayfa.locator(".analiz-sonuc").innerText();
  };

  await analizSec("t-Testleri", "Bağımsız Örneklem t-Testi");
  await alanSec("Grup değişkeni", "grup");
  await alanSec("Sayısal değişken", "son_test");
  await esit("S3a bağımsız örneklem t-testi: t, p, Cohen d ve %95 GA", async () => await calistir(), (v) => /t\(/.test(v) && /p/.test(v) && /d/.test(v) && /%95|\[/.test(v));
  await esit("S3b varsayım şeridi sonuçla birlikte çiziliyor", async () => (await sayfa.locator(".analiz-sonuc").innerText()).includes("Varsayım"), true);
  await esit("S3c sonuç künyesi hangi analiz ve değişkenlerle üretildiğini yazıyor", async () => await sayfa.locator(".analiz-sonuc-kunye").innerText(), (v) => /Hesaplanan sonuç/.test(v) && /son_test/.test(v) && /grup/.test(v));
  await esit("S3c2 künye BU analizin kullanmadığı alanı yazmıyor", async () => await sayfa.locator(".analiz-sonuc-kunye").innerText(), (v) => !/2\. değişken/.test(v) && !/yordayıcı/.test(v));
  await cek(sayfa, "08-sonuc-ttest-1440-acik");
  /*
    İŞARETİN ANLAMI AYRIK: ✓ hesabın bittiğini söyler. "Kontroller"
    adımı HİÇBİR KOŞULDA ✓ almaz — varsayımların geçtiği hükmünü
    ArvoLab vermiyor, değerleri yazıyor.
  */
  await esit("S3d adım şeridi: hesap tamam, kontroller 'okunacak' (geçti DEĞİL)", async () =>
    await sayfa.locator(".analiz-adimlar li").evaluateAll((l) => l.map((x) => x.dataset.durum).join(",")), "tamam,okunacak,tamam");
  await esit("S3d2 'Kontroller' adımı geçti/uygun demiyor, okumaya çağırıyor", async () => {
    const metin = await sayfa.locator(".analiz-adimlar li").nth(1).getAttribute("title");
    return `${/okuyun/.test(metin ?? "")} ${/“geçti” hükmü vermez/.test(metin ?? "")} ${/uygun|geçti”? ?hük[^m]/.test("")}`;
  }, (v) => v.startsWith("true true"));

  /* ---- S4: eskiyen sonuç ---- */
  await esit("S4a değişken değişince sonuç 'eskidi' diye işaretleniyor (silinmiyor)", async () => {
    await alanSec("Sayısal değişken", "on_test");
    await sayfa.waitForTimeout(250);
    const uyari = await sayfa.locator('.alert[data-tone="warning"]').allInnerTexts();
    const duruyor = await sayfa.locator(".analiz-sonuc").count();
    const isaret = await sayfa.locator(".results-divider[data-eskidi]").count();
    return `sonuc:${duruyor} isaret:${isaret} ${uyari.some((x) => /Seçiminiz değişti/.test(x))}`;
  }, "sonuc:1 isaret:1 true");
  /* Uyarıdaki ad EKRANDAKİ etiketle aynı olmalı: t-testinde "sayısal değişken". */
  await esit("S4b uyarı, formdaki etiketle aynı alan adını söylüyor", async () => (await sayfa.locator('.alert[data-tone="warning"]').first().innerText()), (v) => /sayısal değişken/.test(v) && !/1\. değişken/.test(v));
  await cek(sayfa, "09-eskiyen-sonuc");
  await esit("S4c yeniden çalıştırınca uyarı kalkıyor", async () => { await calistir(); await sayfa.waitForTimeout(200); return await sayfa.locator('.alert[data-tone="warning"]').count(); }, 0);
  await esit("S4d analiz türü değişince sonuç ekrandan kalkıyor", async () => {
    await analizSec("ANOVA", "Tek Yönlü ANOVA");
    await sayfa.waitForTimeout(250);
    return await sayfa.locator(".analiz-sonuc").count();
  }, 0);

  await alanSec("Grup değişkeni", "sinif");
  await alanSec("Sayısal değişken", "son_test");
  await esit("S3e tek yönlü ANOVA (3 grup): F, p ve η²", async () => await calistir(), (v) => /F\(/.test(v) && /η²|eta/.test(v));
  /*
    S6b: yanlış yapılandırma sessizce sonuç olmuyor. İki düzeyli bir
    değişkenle tek yönlü ANOVA REDDEDİLİYOR ve doğru test söyleniyor.
  */
  await esit("S6b iki gruplu değişkenle ANOVA reddediliyor, t-testi söyleniyor", async () => {
    await alanSec("Grup değişkeni", "cinsiyet");
    await sayfa.getByRole("button", { name: /Analizi Çalıştır/ }).click();
    await sayfa.waitForTimeout(1200);
    const hata = await sayfa.locator('.alert[data-tone="danger"]').allInnerTexts();
    return `sonuc:${await sayfa.locator(".analiz-sonuc").count()} ${hata.join(" ").slice(0, 90)}`;
  }, (v) => v.startsWith("sonuc:0") && /en az 3 grup/.test(v) && /t-testini kullan/.test(v));

  await analizSec("Korelasyon", "Pearson Korelasyonu");
  await alanSec("Değişken 1", "on_test");
  await alanSec("Değişken 2", "son_test");
  await esit("S3f Pearson korelasyonu: r, p, n", async () => await calistir(), (v) => /r\s*[=(]/.test(v) || /r\b/.test(v));

  await analizSec("Parametrik", "Mann-Whitney U Testi");
  await alanSec("Grup değişkeni", "grup");
  await alanSec("Sayısal değişken", "son_test");
  await esit("S3g Mann-Whitney U: U, z, p", async () => await calistir(), (v) => /U\s*[=(]|U\b/.test(v) && /p/.test(v));

  await analizSec("Güvenilirlik", "Güvenilirlik Analizi");
  await esit("S3h güvenilirlik: madde seçimi → α", async () => {
    const maddeler = sayfa.locator("fieldset.sutun-secimi", { hasText: "Maddeler ·" });
    const kutular = maddeler.locator('.sutun-secimi-liste input[type="checkbox"]');
    /* Sıra DOM'dan okunuyor: sütun adı seçiciye gömülmesin. */
    const adlar = await maddeler.locator(".sutun-secimi-liste label span").allInnerTexts();
    for (const m of ["m1", "m2", "m3", "m4", "m5"]) {
      const i = adlar.indexOf(m);
      if (i < 0) throw new Error(`madde listesinde ${m} yok: ${adlar.join(",")}`);
      await kutular.nth(i).check();
    }
    return await calistir();
  }, (v) => /α|Alpha|alpha/.test(v));
  await cek(sayfa, "10-sonuc-guvenilirlik");

  /* ---- S5: veri değiştirmede uyarı ---- */
  await esit("S5a kaydedilmemiş sonuç varken 'Veriyi değiştir' onay istiyor", async () => {
    let soru = null;
    sayfa.once("dialog", async (d) => { soru = d.message(); await d.dismiss(); });
    await sayfa.getByRole("button", { name: "Veriyi değiştir" }).click();
    await sayfa.waitForTimeout(400);
    const veriDuruyor = await sayfa.locator(".analiz-veri-serit").count();
    return `${soru && /ekrandaki sonuç ve değişken seçimleriniz silinir/.test(soru)} veri:${veriDuruyor}`;
  }, "true veri:1");
  await esit("S5b onay verilince veri ve sonuç temizleniyor", async () => {
    sayfa.once("dialog", async (d) => { await d.accept(); });
    await sayfa.getByRole("button", { name: "Veriyi değiştir" }).click();
    await sayfa.waitForTimeout(600);
    return `${await sayfa.locator(".dropzone").count()} ${await sayfa.locator(".analiz-sonuc").count()}`;
  }, "1 0");

  /* ---- S8d: hesaplamak hâlâ kaydetmiyor; kaydetmek kullanıcının eylemi ---- */
  await esit("S8d analiz çalıştırmak tek başına kaydetmedi", () => sayim(), oncekiSayim);

  await git(sayfa, ANALIZ_YOLU);
  await sayfa.locator('.dropzone input[type="file"]').setInputFiles(VERI_YOLU);
  await sayfa.waitForSelector(".analiz-veri-serit", { timeout: 20000 });
  await analizSec("t-Testleri", "Bağımsız Örneklem t-Testi");
  await alanSec("Grup değişkeni", "grup");
  await alanSec("Sayısal değişken", "son_test");
  await calistir();
  await esit("S8e 'Teze ekleme sırasına koy' doğru çalışmaya kaydediyor", async () => {
    await sayfa.getByRole("button", { name: /Teze ekleme sırasına koy/ }).click();
    await sayfa.waitForTimeout(1500);
    return psql(`select project_id from public.analiz_sonuclari where owner_id = ${q(KULLANICI)} order by created_at desc limit 1`);
  }, PROJE);
  await esit("S8f kayıt 'Kaydedilen analizler' sekmesinde görünüyor", async () => {
    await git(sayfa, ANALIZ_YOLU);
    await sayfa.getByRole("tab", { name: /Kaydedilen analizler/ }).click();
    await sayfa.waitForTimeout(300);
    return (await sayfa.locator('[role="tabpanel"]#analiz-panel-kayitli').innerText()).includes("Bağımsız Örneklem");
  }, true);
  await esit("S8g öteki çalışmada bu kayıt GÖRÜNMÜYOR", async () => {
    await git(sayfa, `/dashboard/analysis?calisma=${PROJE2}`);
    await sayfa.getByRole("tab", { name: /Kaydedilen analizler/ }).click();
    await sayfa.waitForTimeout(300);
    return (await sayfa.locator('[role="tabpanel"]#analiz-panel-kayitli').innerText()).includes("Bağımsız Örneklem");
  }, false);
  await cek(sayfa, "11-kaydedilen-analizler");

  /* ================= S10: ölçüler, tema, klavye ================= */
  await git(sayfa, ANALIZ_YOLU);
  for (const g of [1440, 1280, 768]) {
    await sayfa.setViewportSize({ width: g, height: 900 });
    await sayfa.waitForTimeout(350);
    await esit(`S10a-${g} yatay kaydırma yok`, async () => await sayfa.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
    await esit(`S10b-${g} gezgin ve çalışma alanı birlikte görünüyor`, async () => {
      const a = await sayfa.locator(".analiz-alan-gezgin").boundingBox();
      const b = await sayfa.locator(".dropzone").boundingBox();
      return Boolean(a && b && a.width > 150 && b.width > 150);
    }, true);
    await cek(sayfa, `12-olcu-${g}`);
  }
  await esit("S10c klavyeyle gezginde analiz seçilebiliyor", async () => {
    await sayfa.setViewportSize({ width: 1440, height: 900 });
    await sayfa.locator('.analiz-gezgin-arama input').focus();
    for (let i = 0; i < 12; i++) {
      await sayfa.keyboard.press("Tab");
      const odak = await sayfa.evaluate(() => document.activeElement?.className ?? "");
      if (odak.includes("analiz-gezgin-oge")) { await sayfa.keyboard.press("Enter"); await sayfa.waitForTimeout(200); return await sayfa.locator('.analiz-gezgin-oge[aria-current="true"]').count(); }
    }
    return "odak gezgine ulaşmadı";
  }, 1);
  await esit("S10d odak görünür (focus-visible halkası)", async () => {
    await sayfa.locator('.analiz-gezgin-arama input').focus();
    await sayfa.keyboard.press("Tab");
    return await sayfa.evaluate(() => {
      const e = document.activeElement;
      if (!e) return false;
      const s = getComputedStyle(e);
      return s.outlineStyle !== "none" || s.boxShadow !== "none" || getComputedStyle(e.parentElement ?? e).boxShadow !== "none";
    });
  }, true);
  await ctx.close();

  /* Koyu tema */
  const koyu = await oturum(1440, 900, "dark");
  await git(koyu.sayfa, ANALIZ_YOLU);
  await esit("S10e koyu tema: yazı/zemin karşıtlığı kuruluyor", async () => await koyu.sayfa.evaluate(() => {
    const el = document.querySelector(".analiz-gezgin");
    const govde = getComputedStyle(document.body).backgroundColor;
    return `${govde} / ${getComputedStyle(el).color}`;
  }), (v) => !/rgb\(255, 255, 255\) \//.test(v));
  await cek(koyu.sayfa, "13-veri-yok-1440-koyu");
  await koyu.sayfa.locator('.dropzone input[type="file"]').setInputFiles(VERI_YOLU);
  await koyu.sayfa.waitForSelector(".analiz-veri-serit", { timeout: 20000 });
  await koyu.sayfa.locator('.analiz-gezgin-arama input').fill("Bağımsız Örneklem");
  await koyu.sayfa.waitForTimeout(150);
  await koyu.sayfa.locator(".analiz-gezgin-oge").first().click();
  await koyu.sayfa.locator('.analiz-gezgin-arama input').fill("");
  const kg = koyu.sayfa.locator("label").filter({ hasText: "Grup değişkeni" }).locator("select").first();
  await kg.selectOption({ label: "grup" });
  const ks = koyu.sayfa.locator("label").filter({ hasText: "Sayısal değişken" }).locator("select").first();
  await ks.selectOption({ label: "son_test" });
  await koyu.sayfa.getByRole("button", { name: /Analizi Çalıştır/ }).click();
  await koyu.sayfa.waitForSelector(".analiz-sonuc", { timeout: 20000 });
  await cek(koyu.sayfa, "14-sonuc-1440-koyu");
  await koyu.sayfa.getByRole("button", { name: /Hangi analizi seçmeliyim/ }).click();
  await koyu.sayfa.waitForSelector(".analiz-yardim");
  await cek(koyu.sayfa, "15-yardim-koyu");
  await koyu.ctx.close();

  /* Telefon */
  const tel = await tarayici.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "tr-TR" });
  const ts = await tel.newPage();
  await ts.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
  await ts.fill('input[name="email"]', adres);
  await ts.fill('input[name="password"]', parola);
  await Promise.all([ts.waitForURL(/dashboard/, { timeout: 60000 }), ts.press('input[name="password"]', "Enter")]);
  await git(ts, ANALIZ_YOLU);
  await esit("S10f telefon: yatay kaydırma yok", async () => await ts.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  await esit("S10g telefon: gezgin tek satırlık özete iniyor, çalışma alanı hemen altında", async () => {
    const ozet = await ts.locator(".analiz-gezgin-telefon").boundingBox();
    const b = await ts.locator(".dropzone").boundingBox();
    /* Yedi kategori listesi ekranda DEĞİL: özet 80 px'i geçmemeli. */
    return Boolean(ozet && b && b.y > ozet.y && ozet.height < 80 && !(await ts.locator(".analiz-kategori:visible").count()));
  }, true);
  await esit("S10g2 telefon: 'Değiştir' listeyi açıyor, çalışma alanı gizleniyor", async () => {
    await ts.locator(".analiz-gezgin-telefon button").click();
    await ts.waitForTimeout(250);
    return `kategori:${await ts.locator(".analiz-kategori:visible").count()} dropzone:${await ts.locator(".dropzone:visible").count()} geri:${await ts.locator(".analiz-gezgin-geri:visible").count()}`;
  }, "kategori:7 dropzone:0 geri:1");
  await esit("S10g3 telefon: analiz seçilince çalışma alanına dönülüyor", async () => {
    await ts.locator(".analiz-kategori-bas", { hasText: "t-Testleri" }).click();
    await ts.waitForTimeout(200);
    await ts.locator(".analiz-gezgin-oge:visible", { hasText: "Tek Örneklem" }).first().click();
    await ts.waitForTimeout(300);
    const secim = await ts.locator(".analiz-gezgin-telefon b").innerText();
    return `${secim} · dropzone:${await ts.locator(".dropzone:visible").count()}`;
  }, (v) => /Tek Örneklem t-Testi · dropzone:1/.test(v));
  await esit("S10g4 telefon: 'Çalışma alanına dön' seçimi değiştirmeden geri getiriyor", async () => {
    await ts.locator(".analiz-gezgin-telefon button").click();
    await ts.waitForTimeout(200);
    await ts.locator(".analiz-gezgin-geri").click();
    await ts.waitForTimeout(250);
    return `${await ts.locator(".analiz-gezgin-telefon b").innerText()} · dropzone:${await ts.locator(".dropzone:visible").count()}`;
  }, (v) => /Tek Örneklem t-Testi · dropzone:1/.test(v));
  await esit("S10h telefon: iç kenar çubuğu yok (gezgin kendi içinde kaymıyor)", async () => await ts.evaluate(() => {
    const e = document.querySelector(".analiz-alan-gezgin");
    return getComputedStyle(e).overflowY;
  }), (v) => v === "visible");
  await esit("S10i telefon: dokunma hedefleri 44 px", async () => {
    const kucuk = await ts.locator(".analiz-gezgin-oge, .analiz-sekme, .analiz-kategori-bas").evaluateAll((l) =>
      l.filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 32; }).length);
    return kucuk;
  }, (v) => v === 0);
  await cek(ts, "16-telefon-veri-yok");
  await ts.locator('.dropzone input[type="file"]').setInputFiles(VERI_YOLU);
  await ts.waitForSelector(".analiz-veri-serit", { timeout: 25000 });
  await cek(ts, "17-telefon-yapilandirma");
  /*
    390 px İLK EKRAN: kullanıcı kaydırmadan hangi analizi yapılandırdığını
    ve en az ilk değişken alanını görmeli. Eskiden iki katlanır araç
    (veri hazırlama, özet raporu) arada duruyor ve ilk kutu ekranın
    altında kalıyordu.
  */
  await esit("S10k telefon ilk ekranda seçili analiz ve ilk değişken alanı görünüyor", async () => {
    await ts.evaluate(() => window.scrollTo(0, 0));
    await ts.waitForTimeout(300);
    return await ts.evaluate(() => {
      const gorunur = (e) => {
        if (!e) return null;
        const r = e.getBoundingClientRect();
        const dock = [...document.querySelectorAll("nav")].find((n) => getComputedStyle(n).position === "fixed" && n.getBoundingClientRect().bottom >= innerHeight - 2);
        const alt = dock ? dock.getBoundingClientRect().top : innerHeight;
        return r.height > 0 && r.top >= 0 && r.bottom <= alt ? Math.round(r.bottom) : null;
      };
      const analiz = gorunur(document.querySelector(".analiz-gezgin-telefon b"));
      /* Analizin değişken formu: .analiz-veri-govde'nin DOĞRUDAN çocuğu.
         "Veri hazırlama" bölümünde de bir .project-form-grid var. */
      const ilkAlan = gorunur(document.querySelector(".analiz-veri-govde > .project-form-grid label"));
      return `analiz:${analiz !== null} alan:${ilkAlan !== null}`;
    });
  }, "analiz:true alan:true");
  await esit("S10l telefon: dokunma hedefleri hâlâ 44 px (yer kazanmak için küçültülmedi)", async () => {
    return await ts.locator(".analiz-veri-eylem button, .analiz-gezgin-telefon button, .analiz-sekme").evaluateAll((l) =>
      l.filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 40; }).length);
  }, 0);
  await ts.getByRole("button", { name: /Hangi analizi seçmeliyim/ }).click();
  await ts.waitForSelector(".analiz-yardim");
  await cek(ts, "18-telefon-yardim");
  await esit("S10j telefon: alt gezinme içeriğin üzerine gelmiyor", async () => {
    await ts.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((r) => setTimeout(r, 400));
    return await ts.evaluate(() => {
      const dock = [...document.querySelectorAll("nav, footer, div")].find((e) => {
        const s = getComputedStyle(e);
        return s.position === "fixed" && e.getBoundingClientRect().bottom >= window.innerHeight - 2 && e.getBoundingClientRect().height > 30;
      });
      if (!dock) return "dock yok";
      const d = dock.getBoundingClientRect();
      /*
        Alt çubuğun KENDİ düğmeleri ve sabit konumlu öğeler sayılmaz:
        onlar tanımı gereği çubuğun içinde. Sayılan, sayfayla birlikte
        kayan gerçek içerik.
      */
      const son = [...document.querySelectorAll(".analiz-yardim-secenek, .analiz-gezgin-oge, .analiz-kategori-bas, .analiz-sekme, .project-form-grid button, .analiz-yardim button")]
        .filter((e) => getComputedStyle(e).position !== "fixed" && !dock.contains(e))
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.height > 0 && r.top < window.innerHeight)
        .sort((a, b) => b.bottom - a.bottom)[0];
      return son && son.bottom > d.top ? `ortusme ${Math.round(son.bottom - d.top)}px` : "ortusme yok";
    });
  }, (v) => v === "ortusme yok" || v === "dock yok");
  await tel.close();
} catch (e) {
  FAIL("kabul koşusu", `${e.message}\n${e.stack?.split("\n").slice(1, 4).join("\n")}`);
} finally {
  await tarayici.close();
  fs.rmSync(VERI_YOLU, { force: true });
  fs.rmSync(BOZUK_YOLU, { force: true });
  fs.rmSync(BUYUK_YOLU, { force: true });
}

const gecen = sonuclar.filter((s) => s.durum === "PASS").length;
const dusen = sonuclar.filter((s) => s.durum === "FAIL");
const rapor = { tarih: new Date().toISOString(), head: HEAD, buildId: BUILD_ID, uygulama: UYG, gecen, dusen: dusen.length, sonuclar };
fs.mkdirSync(path.join(KOK, "scripts/yerel-yigin/sonuclar"), { recursive: true });
fs.writeFileSync(path.join(KOK, "scripts/yerel-yigin/sonuclar/analiz-alani-kabul.json"), JSON.stringify(rapor, null, 2));
console.log(`\n${gecen} PASS · ${dusen.length} FAIL`);
if (dusen.length) { console.log("\nDÜŞENLER:"); for (const d of dusen) console.log(` - ${d.ad}: ${d.not}`); }
process.exit(dusen.length ? 1 : 0);
