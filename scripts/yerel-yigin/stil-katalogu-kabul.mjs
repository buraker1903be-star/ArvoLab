// STİL KATALOĞU VE PDF DENETİMİ — KABUL (23.11.2026).
//
// Kusur: Belge Kontrol akışı atıf stilini HİÇ geçirmiyordu. Sunucu
// kaynakçayı her zaman APA olarak ayrıştırıyordu (app/actions/document-upload.ts,
// parseReferenceList/extractInTextCitations): Vancouver, IEEE ya da Chicago
// yazan öğrenci doğru yazdığı künyelerin tamamı için biçim hatası,
// atıflarının tamamı için "kaynakçada karşılığı yok" alıyordu. Kaydedilen
// denetimler de hangi stile göre yapıldığını saklamıyordu.
//
// Ölçüm, aynı PDF'in İKİ kez yüklenmesiyle yapılıyor: bir kez kendi
// stiliyle, bir kez APA 7 ile. Stil gerçekten uygulanıyorsa bulgu sayısı
// kendi stilinde belirgin biçimde DÜŞÜK olmak zorunda. Metin eşleşmesi
// yalnızca uyarının hangi stilin kuralını yazdığını ölçerken kullanılıyor
// (Chicago kuralı istenen yerde).
//
// Kullanım: node scripts/yerel-yigin/stil-katalogu-kabul.mjs http://localhost:3141 [görüntü-dizini]
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
const { sentetikPdf } = await import(`${KOK}/scripts/yerel-yigin/sentetik-pdf.mjs`);
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
  psql("select citation_style from public.citation_checks limit 0");
} catch (e) {
  console.error("Ön koşul yok:", e.message);
  process.exit(2);
}

const sonuclar = [];
let sonSayfa = null;
const kaydet = (no, ad, durum, ayrinti = "") => {
  sonuclar.push({ no, ad, durum, ayrinti });
  console.log(`${durum.padEnd(5)} ${no} ${ad}${ayrinti ? ` — ${ayrinti}` : ""}`);
};
const SADECE = process.env.KABUL_SADECE ? new Set(process.env.KABUL_SADECE.split(",")) : null;
const dene = async (no, ad, fn) => {
  if (SADECE && !SADECE.has(no)) return;
  try {
    const r = await fn();
    kaydet(no, ad, r?.durum ?? "PASS", r?.ayrinti ?? "");
  } catch (e) {
    if (GORSEL && sonSayfa && !sonSayfa.isClosed()) await sonSayfa.screenshot({ path: `${GORSEL}/hata-${no}.png` }).catch(() => {});
    kaydet(no, ad, "FAIL", String(e.message).slice(0, 300));
  }
};
const dogru = (kosul, mesaj) => { if (!kosul) throw new Error(mesaj); };

/* ---------- Sentetik kullanıcı ve çalışmalar ---------- */
const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");
const adres = `stil-${ek}@yerel.test`, parola = `Sk7!${crypto.randomBytes(9).toString("base64url")}`;
const yeni = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: "Stil Denegi" } });
if (yeni.durum >= 300) { console.error("kullanıcı kurulamadı", yeni); process.exit(2); }
const KULLANICI = yeni.json.id;
await auth(`/admin/users/${KULLANICI}`, { password: parola }, "PUT");
psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
      values (${q(KULLANICI)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
const proje = (ad, stil, tur = "thesis") => psql(`insert into public.academic_projects (owner_id, project_type, title, citation_style)
  values (${q(KULLANICI)}, ${q(tur)}, ${q(ad)}, ${q(stil)}) returning id`).split("\n")[0];

/* ---------- Beş stilde PDF örneği (ASCII: sentetikPdf WinAnsi) ---------- */
const ORNEKLER = {
  apa7: {
    ad: "APA 7",
    govde: [
      "Introduction",
      "Learning styles affect academic achievement (Smith, 2020). Motivation also",
      "matters for outcomes (Brown & Clark, 2019). Classroom routines shape both",
      "(Davis, 2018).",
    ],
    kunyeler: [
      "Smith, A. (2020). Learning styles and academic achievement. Journal of Synthetic Studies, 12(3), 45-67.",
      "Brown, B., & Clark, C. (2019). The role of motivation. Synthetic Psychology Review, 8(1), 10-25.",
      "Davis, D. (2018). Classroom management. Academy Press.",
    ],
  },
  vancouver: {
    ad: "Vancouver",
    govde: [
      "Introduction",
      "Quality of life declines in long-term disease (1). Treatment options have",
      "widened over the last decade (2,3).",
    ],
    kunyeler: [
      "1. Smith A, Brown B. Quality of life in diabetes patients. Synthetic Med J. 2020;12(3):45-67.",
      "2. Clark C. Hypertension treatment. Ankara: Med Press; 2019.",
      "3. Davis D, Evans E. Cardiology handbook. 2nd ed. Istanbul: Health Press; 2018.",
    ],
  },
  ieee: {
    ad: "IEEE",
    govde: [
      "Introduction",
      "Deep learning methods have spread across imaging tasks [1]. Convolutional",
      "networks stand out in recent benchmarks [2], [3].",
    ],
    kunyeler: [
      '[1] A. Smith and B. Brown, "Image classification with deep learning," IEEE Trans. Image Process., vol. 29, no. 3, pp. 45-67, 2020.',
      "[2] C. Clark, Machine Learning. Ankara: Tech Press, 2019.",
      '[3] D. Davis, "Convolutional networks," in Proc. IEEE Conf., 2018, pp. 10-15.',
    ],
  },
  chicago: {
    ad: "Chicago (Yazar-Tarih)",
    govde: [
      "Introduction",
      "The tax system changed through the century (Smith 2020). Education policy",
      "shifted in the same period (Brown 2019). Archives confirm both (Davis 2018).",
    ],
    kunyeler: [
      'Smith, John. 2020. "Taxation in the Empire." Synthetic History Review 12 (3): 45-67.',
      "Brown, Brenda. 2019. Education in the Republican Era. Istanbul: History Press.",
      'Davis, Daniel. 2018. "Archive Documents." Synthetic Bulletin 8 (1): 10-25.',
    ],
  },
  "chicago-notlar": {
    ad: "Chicago (Notlar-Kaynakca)",
    govde: [
      "Introduction",
      "The tax system changed through the nineteenth century, and education",
      "policy shifted with it.",
      "1 John Smith, Taxation in the Empire (Istanbul: History Press, 2020), 45.",
      '2 Brenda Brown, "Education in the Republican Era," Synthetic History Review 12, no. 3 (2019): 50.',
      "3 Daniel Davis, Archive Documents and Method (Ankara: Bulletin Press, 2018), 11.",
    ],
    kunyeler: [
      "Smith, John. Taxation in the Empire. Istanbul: History Press, 2020.",
      'Brown, Brenda. "Education in the Republican Era." Synthetic History Review 12, no. 3 (2019): 45-67.',
      "Davis, Daniel. Archive Documents and Method. Ankara: Bulletin Press, 2018.",
    ],
  },
};
const pdfYap = (ornek) => sentetikPdf([ornek.govde, ["References", "", ...ornek.kunyeler]]);

/* Her stil için ayrı çalışma: tez ve makale çalışmaları bağımsız stil tutuyor mu da burada ölçülüyor. */
const CALISMA = {};
for (const [id, ornek] of Object.entries(ORNEKLER)) CALISMA[id] = proje(`${ornek.ad} tezi`, id);
/* AYNI stil kimliğiyle ikinci bir çalışma türü: makale. */
const MAKALE_VANCOUVER = proje("Vancouver makalesi", "vancouver", "article");
const TEZ_APA = proje("APA 7 tezi (ikinci)", "apa7");
/*
  K7'nin KENDİ çifti: aynı kaynağı kullanan bir tez ve bir makale, iki
  ayrı stil. Öteki senaryolar çalışmaların stilini değiştirebildiği için
  bağımsızlık ölçümü paylaşılan çalışmalarla yapılamaz.
*/
const K7_TEZ = proje("Aynı kaynak · tez (APA 7)", "apa7");
const K7_MAKALE = proje("Aynı kaynak · makale (Vancouver)", "vancouver", "article");

/*
  Makale çalışmasına GERÇEK müsvedde: denetim kaynakçayı ve metni
  editörün son kaydedilmiş hâlinden alıyor (app/actions/citation-check.ts).
  Metinsiz çalışmada akış doğru olarak duruyor ("henüz yazılmış metin yok").
*/
const musvedde = [...ORNEKLER.vancouver.govde, "", "Kaynakça", ...ORNEKLER.vancouver.kunyeler].join("\n");
psql(`insert into public.project_manuscripts (project_id, plain_text, word_count, updated_by)
      values (${q(MAKALE_VANCOUVER)}, ${q(musvedde)}, ${musvedde.split(/\s+/).length}, ${q(KULLANICI)})`);

const tarayici = await chromium.launch({ args: ["--no-sandbox"] });
const oturum = async (g, y, dil, tema = "light") => {
  psql(`update public.profiles set arayuz_dili = ${q(dil)} where id = ${q(KULLANICI)}`);
  const ctx = await tarayici.newContext({ viewport: { width: g, height: y }, colorScheme: tema, locale: dil === "en" ? "en-US" : "tr-TR" });
  await ctx.addCookies([{ name: "arvolab_dil", value: dil, url: UYG }]);
  const s = await ctx.newPage();
  sonSayfa = s;
  await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
  await s.fill('input[name="email"]', adres);
  await s.fill('input[name="password"]', parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { ctx, s };
};

/** Belge Kontrol'de yükleme penceresini aç. */
const yuklemeAc = async (s, projeId) => {
  await s.goto(`${UYG}/dashboard/documents?calisma=${projeId}`, { waitUntil: "domcontentloaded" });
  await s.waitForLoadState("networkidle").catch(() => {});
  await s.locator(".drawer-trigger, button, summary").filter({ hasText: /Belge yükle|Upload document/ }).first().click();
  const pencere = s.locator(".drawer-root.open section.drawer");
  await pencere.waitFor({ state: "visible", timeout: 15000 });
  return pencere;
};

/** Pencereden PDF yükler; seçilen stille. Dönen: kaydın analysis'i. */
const pdfYukle = async (s, projeId, ornek, stil) => {
  const pencere = await yuklemeAc(s, projeId);
  const stilKutusu = pencere.locator("label", { hasText: /Denetim stili|Check style/ }).locator("select");
  await stilKutusu.selectOption(stil);
  await pencere.locator('input[type="file"]').setInputFiles({
    name: `${stil}-${ek}.pdf`, mimeType: "application/pdf", buffer: pdfYap(ornek),
  });
  const oncekiSayi = Number(psql(`select count(*) from public.document_uploads where project_id = ${q(projeId)}`));
  await pencere.locator('button[type="submit"]').click();
  /* Çözümleme sunucuda; satır düşene kadar bekle. */
  for (let i = 0; i < 90; i += 1) {
    const sayi = Number(psql(`select count(*) from public.document_uploads where project_id = ${q(projeId)}`));
    if (sayi > oncekiSayi) break;
    await s.waitForTimeout(500);
  }
  const satir = psql(`select coalesce(analysis::text, '') from public.document_uploads
                      where project_id = ${q(projeId)} order by created_at desc limit 1`);
  dogru(satir.length > 2, "çözümleme kaydı oluşmadı");
  return JSON.parse(satir);
};

/** Bulgu sayısı: künye sorunları + çapraz kontrol. */
const bulguSayisi = (a) => {
  const kunye = (a.references ?? []).reduce((t, r) => t + (r.issues?.length ?? 0), 0);
  const atifsiz = (a.crossCheck?.referencesWithoutCitation ?? []).length;
  const karsiliksiz = (a.crossCheck?.citationsWithoutReference ?? []).length;
  return { kunye, atifsiz, karsiliksiz, toplam: kunye + atifsiz + karsiliksiz };
};

/* ================= SENARYOLAR ================= */

await dene("K1", "Katalog: iki seçici de bütün stilleri gösteriyor (TR)", async () => {
  const { ctx, s } = await oturum(1440, 900, "tr");
  try {
    /*
      DENETİM STİLİ SEÇİCİSİ: Kaynaklar → Kaynakça penceresinde
      ("Bu denetimde başka bir stil kullan" katlısının içinde).
      /dashboard/citations bu sekmeye yönleniyor.
    */
    await s.goto(`${UYG}/dashboard/literature?calisma=${CALISMA.apa7}&sekme=kaynakca`, { waitUntil: "domcontentloaded" });
    await s.waitForLoadState("networkidle").catch(() => {});
    /* Şeridin eylemi: denetim yoksa "Kaynakçamı denetle", varsa "Sonuçları aç" — sınıfından açılıyor. */
    await s.locator(".kaynakca-serit-eylem").first().click();
    const dPencere = s.locator(".drawer-root.open section.drawer");
    await dPencere.waitFor({ state: "visible", timeout: 15000 });
    await dPencere.locator("summary", { hasText: /başka bir stil kullan/ }).click();
    const denetim = await dPencere.locator("label", { hasText: /Denetim stili/ }).locator("select")
      .evaluate((el) => [...el.options].map((o) => o.value));
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/K1-denetim-stili-tr.png`, fullPage: true });
    await s.keyboard.press("Escape");
    /* PDF yükleme penceresindeki seçici. */
    const pencere = await yuklemeAc(s, CALISMA.apa7);
    const yukleme = await pencere.locator("label", { hasText: /Denetim stili/ }).locator("select")
      .evaluate((el) => [...el.options].map((o) => ({ deger: o.value, metin: o.textContent.trim() })));
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/K1-yukleme-stil-tr.png` });
    const KATALOG = ["apa7", "harvard", "chicago", "chicago-notlar", "ieee", "vancouver", "mla", "dipnot"];
    for (const stil of KATALOG) {
      dogru(denetim.includes(stil), `Atıf Kontrolü seçicisinde ${stil} yok: ${denetim.join(",")}`);
      dogru(yukleme.some((o) => o.deger === stil), `Yükleme seçicisinde ${stil} yok: ${yukleme.map((o) => o.deger).join(",")}`);
    }
    dogru(denetim.includes("__csl_ara__"), "CSL arama seçeneği yok");
    const yt = yukleme.find((o) => o.deger === "chicago").metin;
    const nk = yukleme.find((o) => o.deger === "chicago-notlar").metin;
    dogru(/Yazar–Tarih/.test(yt), `Chicago yazar–tarih adı: ${yt}`);
    dogru(/Notlar–Kaynakça/.test(nk), `Chicago notlar adı: ${nk}`);
    dogru(/dipnot/.test(nk), `Notlar–Kaynakça türü yazılı değil: ${nk}`);
    return { ayrinti: `katalog:${KATALOG.length} seçenek:${yukleme.length} "${yt}" / "${nk}"` };
  } finally { await ctx.close(); }
});

await dene("K1b", "Katalog İngilizce arayüzde de eksiksiz ve çevrili", async () => {
  const { ctx, s } = await oturum(1440, 900, "en");
  try {
    const pencere = await yuklemeAc(s, CALISMA.apa7);
    const secenekler = await pencere.locator("label", { hasText: /Check style/ }).locator("select")
      .evaluate((el) => [...el.options].map((o) => o.textContent.trim()));
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/K1b-yukleme-stil-en.png` });
    dogru(secenekler.some((m) => /Chicago \(Author–Date\) — author–date/.test(m)), `EN yazar–tarih: ${secenekler.join(" | ")}`);
    dogru(secenekler.some((m) => /Chicago \(Notes–Bibliography\) — footnote/.test(m)), `EN notlar: ${secenekler.join(" | ")}`);
    dogru(!secenekler.some((m) => /Yazar–Tarih|dipnot/.test(m)), `EN listede Türkçe kaldı: ${secenekler.join(" | ")}`);
    return { ayrinti: `${secenekler.length} seçenek, Chicago türleri çevrili` };
  } finally { await ctx.close(); }
});

for (const [id, ornek] of Object.entries(ORNEKLER)) {
  await dene(`K2-${id}`, `PDF denetimi: ${ornek.ad} kendi stilinde APA'dan AZ bulgu veriyor`, async () => {
    const { ctx, s } = await oturum(1440, 900, "tr");
    try {
      const kendi = await pdfYukle(s, CALISMA[id], ornek, id);
      const apa = await pdfYukle(s, CALISMA[id], ornek, "apa7");
      const k = bulguSayisi(kendi), a = bulguSayisi(apa);
      dogru(kendi.denetlenenStil === id, `denetlenen stil ${kendi.denetlenenStil}, beklenen ${id}`);
      dogru(apa.denetlenenStil === "apa7", `APA koşusunda stil ${apa.denetlenenStil}`);
      dogru(kendi.referenceSectionFound, "kaynakça bölümü bulunamadı");
      if (id === "apa7") {
        /* APA örneğinde iki koşu aynı olmalı: ölçüm aracının kendisi doğrulanıyor. */
        dogru(k.toplam === a.toplam, `APA örneğinde iki koşu ayrıştı: ${k.toplam} / ${a.toplam}`);
        dogru(k.toplam <= 3, `APA örneğinde beklenmeyen bulgu: ${JSON.stringify(k)}`);
      } else {
        dogru(k.toplam < a.toplam, `stil uygulanmıyor olabilir: kendi ${JSON.stringify(k)} APA ${JSON.stringify(a)}`);
      }
      /* Çalışmanın kayıtlı stili denetimden ETKİLENMEDİ. */
      const kayitli = psql(`select citation_style from public.academic_projects where id = ${q(CALISMA[id])}`);
      dogru(kayitli === id, `çalışmanın stili değişti: ${kayitli}`);
      return { ayrinti: `kendi:${k.toplam} (künye ${k.kunye}, atıfsız ${k.atifsiz}) · APA:${a.toplam} (künye ${a.kunye}, atıfsız ${a.atifsiz})` };
    } finally { await ctx.close(); }
  });
}

await dene("K3", "Chicago uyarıları Chicago kuralını yazıyor", async () => {
  const { ctx, s } = await oturum(1440, 900, "tr");
  try {
    /* Chicago kaynakçasında yazar adı APA gibi kısaltılmış: Chicago "Soyad, Ad" ister. */
    const bozuk = {
      ...ORNEKLER.chicago,
      kunyeler: [
        'Smith, A. 2020. "Taxation in the Empire." Synthetic History Review 12 (3): 45-67.',
        "Brown, B. 2019. Education in the Republican Era. Istanbul: History Press.",
        'Davis, D. 2018. "Archive Documents." Synthetic Bulletin 8 (1): 10-25.',
      ],
    };
    const a = await pdfYukle(s, CALISMA.chicago, bozuk, "chicago");
    const mesajlar = (a.references ?? []).flatMap((r) => (r.issues ?? []).map((i) => i.message));
    dogru(mesajlar.length > 0, "Chicago kaynakçasında hiç uyarı üretilmedi");
    dogru(mesajlar.some((m) => /Chicago/.test(m)), `uyarı Chicago demiyor: ${mesajlar.join(" | ").slice(0, 300)}`);
    dogru(mesajlar.some((m) => /Soyad, Ad|Surname, First name/.test(m)), `beklenen biçim yazılı değil: ${mesajlar.join(" | ").slice(0, 300)}`);
    dogru(!mesajlar.some((m) => /APA/.test(m)), `Chicago denetiminde APA kuralı yazıldı: ${mesajlar.join(" | ").slice(0, 300)}`);
    return { ayrinti: `${mesajlar.length} uyarı; ilki: ${mesajlar[0].slice(0, 110)}` };
  } finally { await ctx.close(); }
});

await dene("K3b", "Chicago Notlar–Kaynakça dipnottaki atıfları okuyor", async () => {
  const { ctx, s } = await oturum(1440, 900, "tr");
  try {
    const notlar = await pdfYukle(s, CALISMA["chicago-notlar"], ORNEKLER["chicago-notlar"], "chicago-notlar");
    const yazarTarih = await pdfYukle(s, CALISMA["chicago-notlar"], ORNEKLER["chicago-notlar"], "chicago");
    dogru((notlar.citations ?? []).length >= 3, `dipnottan atıf okunmadı: ${(notlar.citations ?? []).length}`);
    const n = bulguSayisi(notlar), y = bulguSayisi(yazarTarih);
    dogru(n.atifsiz === 0, `dipnotlu stilde kaynaklar atıfsız sayıldı: ${n.atifsiz}`);
    dogru(y.atifsiz > n.atifsiz, `yazar–tarih seçimi aynı sonucu verdi: ${y.atifsiz} / ${n.atifsiz}`);
    return { ayrinti: `dipnot atıfları:${(notlar.citations ?? []).length} atıfsız notlar:${n.atifsiz} yazar–tarih:${y.atifsiz}` };
  } finally { await ctx.close(); }
});

await dene("K4", "Olası stil gerekçesiyle öneriliyor, çalışma ayarı değişmiyor", async () => {
  const { ctx, s } = await oturum(1440, 900, "tr");
  try {
    /* Vancouver kaynakçası APA 7 seçilerek denetlendi: öneri Vancouver demeli. */
    const a = await pdfYukle(s, CALISMA.vancouver, ORNEKLER.vancouver, "apa7");
    const adaylar = a.olasiStil?.adaylar ?? [];
    dogru(a.olasiStil?.yeterliKanit, "kanıt yeterli sayılmadı");
    dogru(adaylar[0]?.stil === "vancouver", `ilk aday: ${adaylar.map((x) => x.stil).join(",")}`);
    dogru((adaylar[0].gerekce ?? []).length > 0 && /\d/.test(adaylar[0].gerekce[0].tr), "gerekçe sayı taşımıyor");
    const kayitli = psql(`select citation_style from public.academic_projects where id = ${q(CALISMA.vancouver)}`);
    dogru(kayitli === "vancouver", `öneri çalışmanın ayarını değiştirdi: ${kayitli}`);
    /* Ekranda da görünüyor. */
    await s.goto(`${UYG}/dashboard/documents?calisma=${CALISMA.vancouver}`, { waitUntil: "domcontentloaded" });
    await s.waitForLoadState("networkidle").catch(() => {});
    const metin = await s.locator(".denetlenen-stil").first().innerText();
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/K4-olasi-stil.png`, fullPage: true });
    dogru(/Olası stil/.test(metin), `ekranda öneri yok: ${metin.slice(0, 200)}`);
    dogru(/Denetlenen stil/.test(metin) && /APA 7/.test(metin), `denetlenen stil yazılı değil: ${metin.slice(0, 200)}`);
    return { ayrinti: `aday:${adaylar.map((x) => x.stil).join(",")} gerekçe:"${adaylar[0].gerekce[0].tr.slice(0, 90)}"` };
  } finally { await ctx.close(); }
});

await dene("K5", "CSL stilinde uygulanamayan kontroller sonuçta yazılı", async () => {
  const { ctx, s } = await oturum(1440, 900, "tr");
  try {
    psql(`update public.academic_projects set citation_style = 'csl:a:nature' where id = ${q(TEZ_APA)}`);
    const pencere = await yuklemeAc(s, TEZ_APA);
    /* Çalışmanın CSL stili seçicide hazır: seçimi değiştirmeden yükle. */
    const secili = await pencere.locator("label", { hasText: /Denetim stili/ }).locator("select").inputValue();
    dogru(secili === "csl:a:nature", `CSL stili seçicide hazır değil: ${secili}`);
    await pencere.locator('input[type="file"]').setInputFiles({ name: `csl-${ek}.pdf`, mimeType: "application/pdf", buffer: pdfYap(ORNEKLER.apa7) });
    const once = Number(psql(`select count(*) from public.document_uploads where project_id = ${q(TEZ_APA)}`));
    await pencere.locator('button[type="submit"]').click();
    for (let i = 0; i < 90; i += 1) {
      if (Number(psql(`select count(*) from public.document_uploads where project_id = ${q(TEZ_APA)}`)) > once) break;
      await s.waitForTimeout(500);
    }
    const a = JSON.parse(psql(`select coalesce(analysis::text, '') from public.document_uploads where project_id = ${q(TEZ_APA)} order by created_at desc limit 1`));
    const uygulanamayan = (a.kapsam ?? []).filter((x) => x.durum === "uygulanamadi").map((x) => x.anahtar);
    dogru(uygulanamayan.includes("yazarBicimi"), `yazar biçimi uygulanamadı denmiyor: ${JSON.stringify(a.kapsam)}`);
    await s.goto(`${UYG}/dashboard/documents?calisma=${TEZ_APA}`, { waitUntil: "domcontentloaded" });
    await s.waitForLoadState("networkidle").catch(() => {});
    const metin = await s.locator(".denetlenen-stil").first().innerText();
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/K5-kismi-kapsam.png`, fullPage: true });
    dogru(/uygulanamadı/.test(metin), `ekran kısmi kapsamı yazmıyor: ${metin.slice(0, 250)}`);
    dogru(/Yazar biçimi/.test(metin), `uygulanamayan kontrol adı yok: ${metin.slice(0, 250)}`);
    /*
      ÖLÇÜLMEYEN KATEGORİ "YOK" DEMEMELİ ve puan kısmi olduğunu
      söylemeli: denetlenmediği hâlde temiz görünen rapor, raporsuzluktan
      kötüdür.
    */
    const sayfa = await s.locator("main").first().innerText();
    dogru(/Biçim sorunu olan künye[\s\S]{0,40}bakılmadı/.test(sayfa), `biçim satırı hâlâ "Yok" diyor: ${sayfa.slice(0, 400)}`);
    dogru(/yalnızca uygulanabilen kontrollerden/.test(sayfa), `puan kısmi olduğunu söylemiyor: ${sayfa.slice(0, 400)}`);
    return { ayrinti: `uygulanamayan:${uygulanamayan.join(",")}; biçim satırı "bakılmadı", puan kısmi` };
  } finally {
    psql(`update public.academic_projects set citation_style = 'apa7' where id = ${q(TEZ_APA)}`);
    await ctx.close();
  }
});

await dene("K6", "Denetlenen stil kayıtta: çalışmanın stili değişince kaymıyor", async () => {
  const { ctx, s } = await oturum(1440, 900, "tr");
  try {
    /* Denetim Kaynaklar → Kaynakça penceresinden yapılıyor (sayfa oraya yönleniyor). */
    await s.goto(`${UYG}/dashboard/literature?calisma=${MAKALE_VANCOUVER}&sekme=kaynakca`, { waitUntil: "domcontentloaded" });
    await s.waitForLoadState("networkidle").catch(() => {});
    await s.locator(".kaynakca-serit-eylem").first().click();
    const dPencere = s.locator(".drawer-root.open section.drawer");
    await dPencere.waitFor({ state: "visible", timeout: 15000 });
    await dPencere.locator("summary", { hasText: /başka bir stil kullan/ }).click();
    const stilKutusu = dPencere.locator("label", { hasText: /Denetim stili/ }).locator("select");
    dogru((await stilKutusu.inputValue()) === "vancouver", `makalenin stili pencereye gelmedi: ${await stilKutusu.inputValue()}`);
    /* Kaynakça ve metin müsveddeden alınıyor: öğrencinin tek düğmesi. */
    await dPencere.locator("button", { hasText: /Kaynakçamı denetle|Check my reference list/ }).first().click();
    /* Dizin doğrulaması ağa gidiyor; yerelde ağ yok ve istekler zaman
       aşımına düşüyor — bekleme ona göre uzun. */
    let olustu = false;
    for (let i = 0; i < 300; i += 1) {
      if (Number(psql(`select count(*) from public.citation_checks where project_id = ${q(MAKALE_VANCOUVER)}`)) > 0) { olustu = true; break; }
      await s.waitForTimeout(1000);
    }
    if (!olustu) {
      const uyari = await s.locator('[role="alert"], .alert').allInnerTexts().catch(() => []);
      throw new Error(`denetim kaydı oluşmadı; ekrandaki uyarı: ${uyari.join(" | ").slice(0, 200)}`);
    }
    const kayitli = psql(`select coalesce(citation_style, 'YOK') from public.citation_checks where project_id = ${q(MAKALE_VANCOUVER)} order by created_at desc limit 1`);
    dogru(kayitli === "vancouver", `denetimin stili kaydedilmedi: ${kayitli}`);
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/K6-denetlenen-stil.png`, fullPage: true });
    /* Çalışmanın stili SONRADAN değişiyor; kayıtlı sonuç yine Vancouver demeli. */
    psql(`update public.academic_projects set citation_style = 'apa7' where id = ${q(MAKALE_VANCOUVER)}`);
    await s.goto(`${UYG}/dashboard/literature?calisma=${MAKALE_VANCOUVER}&sekme=kaynakca`, { waitUntil: "domcontentloaded" });
    await s.waitForLoadState("networkidle").catch(() => {});
    await s.locator(".kaynakca-serit-eylem").first().click();
    await s.locator(".drawer-root.open section.drawer").waitFor({ state: "visible", timeout: 15000 });
    await s.waitForLoadState("networkidle").catch(() => {});
    const metin = await s.locator(".denetlenen-stil").first().innerText();
    dogru(/Vancouver/.test(metin), `kayıtlı sonuç yeni stile kaydı: ${metin.slice(0, 200)}`);
    dogru(!/APA 7/.test(metin), `kayıtlı sonuçta APA 7 yazıyor: ${metin.slice(0, 200)}`);
    return { ayrinti: `kayıtlı stil:${kayitli}; ekran: ${metin.replace(/\n/g, " ").slice(0, 110)}` };
  } finally { await ctx.close(); }
});

await dene("K7", "Tez ve makale aynı kaynakla kendi stillerini bağımsız kullanıyor", async () => {
  const { ctx, s } = await oturum(1440, 900, "tr");
  try {
    /* Aynı künye metni, iki çalışma, iki stil: ayrı sonuç. */
    /*
      AYNI kaynak metni (Vancouver künyeleri) iki çalışmaya yükleniyor.
      Stil seçicisine DOKUNULMUYOR: her çalışma kendi kayıtlı stilini
      kullanmalı. Aynı girdi, iki ayrı sonuç.
    */
    const tez = await pdfYukle(s, K7_TEZ, ORNEKLER.vancouver, "apa7");
    const makale = await pdfYukle(s, K7_MAKALE, ORNEKLER.vancouver, "vancouver");
    dogru(tez.denetlenenStil === "apa7", `tezin denetim stili: ${tez.denetlenenStil}`);
    dogru(makale.denetlenenStil === "vancouver", `makalenin denetim stili: ${makale.denetlenenStil}`);
    const t2 = bulguSayisi(tez), m = bulguSayisi(makale);
    dogru(t2.toplam > m.toplam, `aynı girdi iki stilde aynı sonucu verdi: ${t2.toplam} / ${m.toplam}`);
    const stiller = psql(`select project_type || ':' || citation_style from public.academic_projects
                          where id in (${q(K7_TEZ)}, ${q(K7_MAKALE)}) order by project_type`).split("\n");
    dogru(stiller.join(" ") === "article:vancouver thesis:apa7", `çalışma stilleri değişti: ${stiller.join(" ")}`);
    return { ayrinti: `tez(APA 7):${t2.toplam} bulgu · makale(Vancouver):${m.toplam} bulgu; ${stiller.join(" ")}` };
  } finally { await ctx.close(); }
});

await tarayici.close();

const fail = sonuclar.filter((x) => x.durum === "FAIL");
console.log(`\n${sonuclar.length - fail.length} PASS · ${fail.length} FAIL   (HEAD ${HEAD.slice(0, 7)}, BUILD_ID ${BUILD_ID})`);
if (GORSEL) fs.writeFileSync(`${GORSEL}/sonuc.json`, JSON.stringify({ head: HEAD, buildId: BUILD_ID, sonuclar }, null, 2));
process.exit(fail.length ? 1 : 0);
