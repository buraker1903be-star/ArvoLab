// KILAVUZDAKİ İNTERNET ÖRNEKLERİ VE KÜNYE BAŞINA SEÇİM — KABUL (24.11.2026).
//
// Kusur: hazır kaynakça düzeltmesi internet kaynaklarında "kılavuzun özel
// kuralı doğrulanmadı" deyip düzeltmeyi seçili getirmiyordu, ama öğrenciye
// kılavuzunda ne yazdığını da göstermiyordu — karşılaştıracağı bir şey yoktu.
//
// Burada kılavuz GERÇEK akıştan yükleniyor (tarama → doğrulama → uygula),
// örnekler kılavuz kaydından geri okunuyor ve editördeki panelde
// karşılaştırma/seçim ölçülüyor.
//
// Kullanım: node scripts/yerel-yigin/kilavuz-ornek-kabul.mjs http://localhost:3141 [görüntü-dizini]
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
    if (GORSEL && sonSayfa && !sonSayfa.isClosed()) await sonSayfa.screenshot({ path: `${GORSEL}/hata-${no}.png`, fullPage: true }).catch(() => {});
    kaydet(no, ad, "FAIL", String(e.message).slice(0, 300));
  }
};
const dogru = (kosul, mesaj) => { if (!kosul) throw new Error(mesaj); };

/* ---------- Kullanıcı ve çalışmalar ---------- */
const SOZLESME = fs.readFileSync(`${KOK}/lib/sozlesme/kullanim-sozlesmesi.ts`, "utf8").match(/SOZLESME_SURUMU = "([^"]+)"/)[1];
const ek = crypto.randomBytes(3).toString("hex");
const adres = `ornek-${ek}@yerel.test`, parola = `Ok7!${crypto.randomBytes(9).toString("base64url")}`;
const yeni = await auth("/admin/users", { email: adres, email_confirm: true, user_metadata: { full_name: "Ornek Denegi" } });
if (yeni.durum >= 300) { console.error("kullanıcı kurulamadı", yeni); process.exit(2); }
const KULLANICI = yeni.json.id;
await auth(`/admin/users/${KULLANICI}`, { password: parola }, "PUT");
psql(`insert into public.sozlesme_onaylari (user_id, belge, surum, dil, metin_ozeti, olay, kaydirma_tamamlandi)
      values (${q(KULLANICI)}, 'kullanim_sozlesmesi', ${q(SOZLESME)}, 'tr', ${q("0".repeat(64))}, 'giris', true)`);
const proje = (ad) => psql(`insert into public.academic_projects (owner_id, project_type, title, citation_style)
  values (${q(KULLANICI)}, 'thesis', ${q(ad)}, 'apa7') returning id`).split("\n")[0];

const P_IKI = proje("Iki ornekli kilavuz calismasi");
const P_KILAVUZSUZ = proje("Kilavuzsuz calisma");
const P_ORNEKSIZ = proje("Orneksiz kilavuz calismasi");
const P_OKUNAMAYAN = proje("Okunamayan kilavuz calismasi");

/* ---------- Kılavuz PDF'leri (ASCII) ---------- */
const IKI_ORNEKLI = sentetikPdf([[
  "T.C. ORNEK UNIVERSITESI",
  "TEZ YAZIM KILAVUZU",
  "",
  "4. KAYNAK GOSTERME",
  "Kaynaklar APA sistemine gore yazilir.",
  "APA sisteminde yazar ve yil metin icinde verilir.",
  "Kaynakca APA kurallarina gore duzenlenir.",
  "",
  "4.3 INTERNET KAYNAKLARI",
  "Internet kaynaklari asagidaki bicimde yazilir:",
  "Ornek: Turkiye Istatistik Kurumu. (2023). Adrese dayali nufus kayit sistemi. https://www.tuik.gov.tr/adnks",
  "Ornek: Saglik Bakanligi. (2022). Yillik saglik raporu 2022. Erisim adresi: https://saglik.gov.tr/rapor-2022",
]]);
const ORNEKSIZ = sentetikPdf([[
  "T.C. ORNEK UNIVERSITESI",
  "TEZ YAZIM KILAVUZU",
  "",
  "4. KAYNAK GOSTERME",
  "Kaynaklar APA sistemine gore yazilir.",
  "APA sisteminde yazar ve yil metin icinde verilir.",
  "Kaynakca APA kurallarina gore duzenlenir ve alfabetik siralanir.",
]]);
/* Metin katmanı olmayan PDF: taranmış sayfanın yerel karşılığı. */
const OKUNAMAYAN = sentetikPdf([[]]);

/* ---------- Kaynaklar, müsvedde ve denetim ---------- */
const SITE_KURUMSAL = "TUIK 2023 Adrese dayali nufus kayit sistemi sonuclari";
const SITE_BELIRSIZ = "Yilmaz A 2021 Bir blog yazisi uzerine notlar";
const MAKALE_BOZUK = "Demir B 2019 Motivasyonun sinif ici rolu Psikoloji Dergisi 8 1 10-25";
const kaynakEkle = (projeId, alanlar) => psql(`insert into public.literature_sources
  (owner_id, project_id, title, authors, year, container_title, volume, issue, pages, doi_or_url, source_type, status)
  values (${q(KULLANICI)}, ${q(projeId)}, ${alanlar}) returning id`).split("\n")[0];
const kur = (projeId) => {
  kaynakEkle(projeId, `'Adrese dayali nufus kayit sistemi sonuclari', 'Turkiye Istatistik Kurumu', 2023, null, null, null, null, 'https://www.tuik.gov.tr/adnks', 'website', 'used'`);
  kaynakEkle(projeId, `'Bir blog yazisi uzerine notlar', 'Yilmaz, A.', 2021, null, null, null, null, 'https://ornek.com/yazi', 'website', 'used'`);
  kaynakEkle(projeId, `'Motivasyonun sinif ici rolu', 'Demir, B.', 2019, 'Psikoloji Dergisi', '8', '1', '10-25', null, 'article', 'used'`);
  const govde = "Nufus verileri (TUIK, 2023), blog notlari (Yilmaz, 2021) ve motivasyon (Demir, 2019) birlikte ele alinir.";
  const icerik = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Giris" }] },
      { type: "paragraph", content: [{ type: "text", text: govde }] },
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Kaynakça" }] },
      ...[SITE_KURUMSAL, SITE_BELIRSIZ, MAKALE_BOZUK].map((k) => ({ type: "paragraph", content: [{ type: "text", text: k }] })),
    ],
  };
  const duz = ["Giris", govde, "", "Kaynakça", SITE_KURUMSAL, SITE_BELIRSIZ, MAKALE_BOZUK].join("\n");
  psql(`insert into public.project_manuscripts (project_id, content, plain_text, word_count, updated_by)
        values (${q(projeId)}, ${q(JSON.stringify(icerik))}::jsonb, ${q(duz)}, ${duz.split(/\s+/).length}, ${q(KULLANICI)})`);
  const ayristirilan = [SITE_KURUMSAL, SITE_BELIRSIZ, MAKALE_BOZUK].map((raw) => ({
    raw, authors: null, year: null, title: null,
    issues: [{ field: "year", message: "Yıl parantez içinde bulunamadı, örn: (2023).", severity: "error" }],
  }));
  psql(`insert into public.citation_checks (project_id, project_title, raw_reference_list, parsed_references, in_text_citations, cross_check, compliance_score, citation_style, created_by)
    values (${q(projeId)}, 'Ornek', ${q([SITE_KURUMSAL, SITE_BELIRSIZ, MAKALE_BOZUK].join("\n"))},
      ${q(JSON.stringify(ayristirilan))}::jsonb, '[]'::jsonb, '{}'::jsonb, 60, 'apa7', ${q(KULLANICI)})`);
};
[P_IKI, P_KILAVUZSUZ, P_ORNEKSIZ].forEach(kur);

const tarayici = await chromium.launch({ args: ["--no-sandbox"] });
const oturum = async () => {
  psql(`update public.profiles set arayuz_dili = 'tr' where id = ${q(KULLANICI)}`);
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  await ctx.addCookies([{ name: "arvolab_dil", value: "tr", url: UYG }]);
  const s = await ctx.newPage();
  sonSayfa = s;
  await s.goto(`${UYG}/`, { waitUntil: "domcontentloaded" });
  await s.fill('input[name="email"]', adres);
  await s.fill('input[name="password"]', parola);
  await Promise.all([s.waitForURL(/dashboard/, { timeout: 60000 }), s.press('input[name="password"]', "Enter")]);
  return { ctx, s };
};

/** Kılavuzu gerçek akıştan yükler ve uygular. */
const kilavuzUygula = async (s, projeId, pdf, ad) => {
  await s.goto(`${UYG}/dashboard/editor/${projeId}?kilavuz=1`, { waitUntil: "domcontentloaded" });
  await s.waitForLoadState("networkidle").catch(() => {});
  const pencere = s.locator(".drawer-root.open section.drawer").first();
  await pencere.waitFor({ state: "visible", timeout: 20000 });
  await pencere.locator('input[type="file"]').first().setInputFiles({ name: ad, mimeType: "application/pdf", buffer: pdf });
  await pencere.locator("label", { hasText: /Kaynakça sistemi/ }).waitFor({ state: "visible", timeout: 180000 });
  const bolum = pencere.locator('input[placeholder*="Bölüm ekle"]');
  await bolum.fill("Giriş");
  await bolum.press("Enter");
  await pencere.locator("button", { hasText: /Kurallarımı uygula/ }).click();
  for (let i = 0; i < 90; i += 1) {
    if (Number(psql(`select count(*) from public.calisma_kilavuzu where project_id = ${q(projeId)}`)) > 0) break;
    await s.waitForTimeout(500);
  }
  dogru(Number(psql(`select count(*) from public.calisma_kilavuzu where project_id = ${q(projeId)}`)) > 0, "kılavuz kaydedilmedi");
};

/** Editördeki düzeltme panelini açar ve listeyi getirir. */
const paneliAc = async (s, projeId) => {
  await s.goto(`${UYG}/dashboard/editor/${projeId}/write?sol=kaynakca`, { waitUntil: "domcontentloaded" });
  await s.waitForLoadState("networkidle").catch(() => {});
  const panel = s.locator(".kaynakca-duzeltme");
  await panel.waitFor({ state: "visible", timeout: 30000 });
  await panel.locator("button", { hasText: /Hazır düzeltmeleri göster/ }).click();
  await panel.locator(".kaynakca-duzeltme-liste").first().waitFor({ state: "visible", timeout: 30000 });
  return panel;
};
const belgeMetni = async (s) => (await s.locator(".ProseMirror").first().innerText()).replace(/\s+/g, " ");

/* ================= SENARYOLAR ================= */

await dene("Ö1", "İki örnekli kılavuz: her örnek dayanağıyla, belirsiz kaynakta öneri yok", async () => {
  const { ctx, s } = await oturum();
  try {
    await kilavuzUygula(s, P_IKI, IKI_ORNEKLI, `iki-ornek-${ek}.pdf`);
    /* Örnekler kılavuz KAYDINDAN geri okunabiliyor mu. */
    const kayitli = JSON.parse(psql(`select coalesce(kurallar->'extracted_rules'->'internetOrnekleri', '[]') from public.calisma_kilavuzu where project_id = ${q(P_IKI)}`));
    dogru(kayitli.length === 2, `kılavuz kaydında iki örnek yok: ${JSON.stringify(kayitli).slice(0, 300)}`);
    dogru(kayitli.every((o) => o.bolum === "INTERNET KAYNAKLARI"), `örneklerin bölümü yanlış: ${kayitli.map((o) => o.bolum).join(" | ")}`);
    dogru(kayitli.map((o) => o.tur).sort().join(",") === "cevrimici-rapor,kurumsal-sayfa", `türler ayrışmadı: ${kayitli.map((o) => o.tur).join(",")}`);

    const panel = await paneliAc(s, P_IKI);
    const metin = await panel.innerText();
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/O1-iki-ornek.png`, fullPage: true });
    /* Kurumsal kaynakta tür KESİN: uygun örnek önerilmiş. */
    dogru(/Kılavuzunuzdaki uygun örnek/.test(metin), `öneri yok: ${metin.slice(0, 400)}`);
    /* Belirsiz kaynakta karşılaştırma sunulmuş. */
    dogru(/güvenle söyleyemiyorum/.test(metin), `karşılaştırma sunulmamış: ${metin.slice(0, 500)}`);
    /* Her örnek kılavuzdaki METNİYLE ve bölümüyle. */
    dogru(/Adrese dayali nufus kayit sistemi/.test(metin), `kurumsal örnek metni yok: ${metin.slice(0, 500)}`);
    dogru(/Yillik saglik raporu 2022/.test(metin), `rapor örneği metni yok: ${metin.slice(0, 500)}`);
    dogru(/“INTERNET KAYNAKLARI” bölümü/.test(metin), `örneklerin dayanağı yazılmamış: ${metin.slice(0, 500)}`);
    dogru(/Kurumsal web sayfası/.test(metin) && /Çevrimiçi rapor/.test(metin), `tür adları yok: ${metin.slice(0, 500)}`);
    return { ayrinti: `kayıtta 2 örnek (kurumsal-sayfa, cevrimici-rapor), bölüm "INTERNET KAYNAKLARI"; kurumsal kaynakta öneri, belirsizde karşılaştırma` };
  } finally { await ctx.close(); }
});

await dene("Ö2", "Seçim doğru künyeye uygulanıyor; öteki düzeltmeler bağımsız", async () => {
  const { ctx, s } = await oturum();
  try {
    const panel = await paneliAc(s, P_IKI);
    const once = await belgeMetni(s);
    /* Üç düzeltme var; biri seçim bekliyor, ikisi işaretli. */
    const kutular = panel.locator('.kaynakca-duzeltme-liste > li input[type="checkbox"]');
    dogru((await kutular.count()) === 3, `üç düzeltme beklenirdi: ${await kutular.count()}`);
    const isaretliOnce = await panel.locator('.kaynakca-duzeltme-liste > li input[type="checkbox"]:checked').count();
    dogru(isaretliOnce === 2, `seçim bekleyen künye işaretli gelmemeli: ${isaretliOnce}`);

    /* Seçim öncesi önizlemeler: seçimden sonra ÖTEKİNİN değişmediği ölçülecek. */
    const onizleme = async (desen) =>
      (await panel.locator(".kaynakca-duzeltme-liste > li").filter({ hasText: desen }).first()
        .locator(".kaynakca-duzeltme-yeni").first().innerText()).trim();
    const kurumsalOnce = await onizleme(/nufus kayit sistemi/);
    const makaleOnce = await onizleme(/Motivasyonun sinif ici rolu/);
    const belirsizOnce = await onizleme(/Bir blog yazisi/);

    /* Seçim bekleyen künyede çevrimiçi rapor örneği seçiliyor. */
    const belirsizSatir = panel.locator(".kaynakca-duzeltme-liste > li").filter({ hasText: /Bir blog yazisi/ }).first();
    await belirsizSatir.locator('.kaynakca-ornek-liste input[type="radio"]').nth(1).click();
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/O2-secim.png`, fullPage: true });

    /*
      SEÇİM YALNIZCA İLGİLİ KÜNYEYE. Öteki künyelerin önizlemesi
      DEĞİŞMEMELİ; seçilen künyenin önizlemesi de aynı kalır (örnek
      seçmek yazımı değiştirmez, eksik bilgi tamamlanmaz).
    */
    dogru((await onizleme(/nufus kayit sistemi/)) === kurumsalOnce, "kurumsal künyenin önizlemesi değişti");
    dogru((await onizleme(/Motivasyonun sinif ici rolu/)) === makaleOnce, "makale künyesinin önizlemesi değişti");
    dogru((await onizleme(/Bir blog yazisi/)) === belirsizOnce, "seçim künyenin yazımını değiştirdi (eksik bilgi uydurulmuş olabilir)");
    /* BELGE henüz değişmemeli: yazan tek şey "Seçilenleri uygula". */
    dogru((await belgeMetni(s)) === once, "seçim belgeyi değiştirdi");
    dogru((await panel.locator('.kaynakca-duzeltme-liste > li input[type="checkbox"]:checked').count()) === 3,
      "seçimden sonra künye işaretli gelmedi");
    /* Seçim YALNIZCA o künyede: öteki internet kaynağının seçimi değişmedi. */
    const kurumsalSatir = panel.locator(".kaynakca-duzeltme-liste > li").filter({ hasText: /nufus kayit sistemi/ }).first();
    dogru((await kurumsalSatir.locator('.kaynakca-ornek-liste input[type="radio"]:checked').count()) === 1,
      "kurumsal künyenin seçimi bozuldu");

    await panel.locator("button", { hasText: /Seçilenleri uygula/ }).click();
    await s.waitForTimeout(1500);
    const sonra = await belgeMetni(s);
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/O2-uygulandi.png`, fullPage: true });
    /* Üçü de düzeldi: makale (örnek sorulmayan) da yazıldı. */
    dogru(/Demir, B\. \(2019\)\./.test(sonra), `öteki düzeltme uygulanmadı: ${sonra.slice(0, 400)}`);
    dogru(!sonra.includes(MAKALE_BOZUK), "eski makale künyesi duruyor");
    dogru(!sonra.includes(SITE_BELIRSIZ), "seçilen künye uygulanmadı");
    dogru(!sonra.includes(SITE_KURUMSAL), "önerilen künye uygulanmadı");

    /* TEK geri alma hepsini kaldırıyor. */
    await panel.locator("button", { hasText: /Geri al/ }).click();
    await s.waitForTimeout(1200);
    const geri = await belgeMetni(s);
    dogru(geri.includes(MAKALE_BOZUK) && geri.includes(SITE_BELIRSIZ) && geri.includes(SITE_KURUMSAL),
      `tek geri alma üçünü birden kaldırmadı: ${geri.slice(0, 400)}`);
    dogru(geri === once, "geri alma başlangıç durumunu vermedi");
    return { ayrinti: "3 düzeltme, 2 işaretli geldi; seçim yalnızca ilgili künyeyi işaretledi; toplu uygulama ve tek geri alma çalıştı" };
  } finally { await ctx.close(); }
});

await dene("Ö3", "Kılavuzsuz çalışmada örnek sorulmuyor, düzeltmeler çalışıyor", async () => {
  const { ctx, s } = await oturum();
  try {
    const panel = await paneliAc(s, P_KILAVUZSUZ);
    const metin = await panel.innerText();
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/O3-kilavuzsuz.png`, fullPage: true });
    dogru(!/Kılavuzunuzdaki uygun örnek|güvenle söyleyemiyorum/.test(metin), `kılavuzsuzken örnek sunuldu: ${metin.slice(0, 400)}`);
    dogru(/örnek künye bulamadım/.test(metin), `internet kaynağı uyarısı yok: ${metin.slice(0, 400)}`);
    dogru(/3 kaynakça düzeltmesi hazır/.test(metin), `düzeltmeler üretilmedi: ${metin.slice(0, 300)}`);
    await panel.locator("button", { hasText: /Seçilenleri uygula/ }).click();
    await s.waitForTimeout(1500);
    dogru(/Demir, B\. \(2019\)\./.test(await belgeMetni(s)), "kılavuzsuz düzeltme uygulanmadı");
    return { ayrinti: "örnek sunulmadı, üç düzeltme hazır, uygulama çalıştı" };
  } finally { await ctx.close(); }
});

await dene("Ö4", "Örneksiz kılavuzda bugünkü uyarı kalıyor, düzeltme engellenmiyor", async () => {
  const { ctx, s } = await oturum();
  try {
    await kilavuzUygula(s, P_ORNEKSIZ, ORNEKSIZ, `orneksiz-${ek}.pdf`);
    const kayitli = JSON.parse(psql(`select coalesce(kurallar->'extracted_rules'->'internetOrnekleri', '[]') from public.calisma_kilavuzu where project_id = ${q(P_ORNEKSIZ)}`));
    dogru(kayitli.length === 0, `örneksiz kılavuzda örnek uyduruldu: ${JSON.stringify(kayitli).slice(0, 200)}`);
    const panel = await paneliAc(s, P_ORNEKSIZ);
    const metin = await panel.innerText();
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/O4-orneksiz.png`, fullPage: true });
    dogru(/örnek künye bulamadım/.test(metin), `örneksiz uyarısı yok: ${metin.slice(0, 400)}`);
    dogru(!/Kılavuzdaki örnekleri|uygun örnek/.test(metin), `olmayan örnek gösterildi: ${metin.slice(0, 400)}`);
    await panel.locator("button", { hasText: /Seçilenleri uygula/ }).click();
    await s.waitForTimeout(1500);
    dogru(/Demir, B\. \(2019\)\./.test(await belgeMetni(s)), "örneksiz kılavuzda düzeltme uygulanmadı");
    return { ayrinti: "örnek uydurulmadı, uyarı yerinde, düzeltme uygulanabildi" };
  } finally { await ctx.close(); }
});

await dene("Ö5", "Okunamayan PDF akışı kırmıyor, sebebini söylüyor", async () => {
  const { ctx, s } = await oturum();
  try {
    await s.goto(`${UYG}/dashboard/editor/${P_OKUNAMAYAN}?kilavuz=1`, { waitUntil: "domcontentloaded" });
    await s.waitForLoadState("networkidle").catch(() => {});
    const pencere = s.locator(".drawer-root.open section.drawer").first();
    await pencere.waitFor({ state: "visible", timeout: 20000 });
    await pencere.locator('input[type="file"]').first().setInputFiles({ name: `bos-${ek}.pdf`, mimeType: "application/pdf", buffer: OKUNAMAYAN });
    /* Ya hata söylenir ya da doğrulama adımı açılır; ikisi de akışı kırmaz. */
    await s.waitForTimeout(20000);
    const metin = await pencere.innerText();
    if (GORSEL) await s.screenshot({ path: `${GORSEL}/O5-okunamayan.png`, fullPage: true });
    const kilavuzSayisi = Number(psql(`select count(*) from public.calisma_kilavuzu where project_id = ${q(P_OKUNAMAYAN)}`));
    dogru(kilavuzSayisi === 0, "okunamayan PDF'ten kılavuz kaydedilmiş");
    /* Ekran donmuş olmamalı: ya yükleme ekranı ya da doğrulama formu görünür. */
    const yasiyor = /Kılavuzunuzu yükleyin|Kılavuzunuzdan şunları okudum|okunamadı|Kılavuz okunamadı/.test(metin);
    dogru(yasiyor, `ekran kullanılabilir durumda değil: ${metin.slice(0, 400)}`);
    dogru(!/Kılavuzunuzdaki uygun örnek/.test(metin), "metinsiz PDF'ten örnek çıkarılmış");
    return { ayrinti: `kılavuz kaydı yok, ekran kullanılabilir (${metin.replace(/\n/g, " ").slice(0, 90)}…)` };
  } finally { await ctx.close(); }
});

await tarayici.close();

const fail = sonuclar.filter((x) => x.durum === "FAIL");
console.log(`\n${sonuclar.length - fail.length} PASS · ${fail.length} FAIL   (HEAD ${HEAD.slice(0, 7)}, BUILD_ID ${BUILD_ID})`);
if (GORSEL) fs.writeFileSync(`${GORSEL}/ornek-sonuc.json`, JSON.stringify({ head: HEAD, buildId: BUILD_ID, sonuclar }, null, 2));
process.exit(fail.length ? 1 : 0);
