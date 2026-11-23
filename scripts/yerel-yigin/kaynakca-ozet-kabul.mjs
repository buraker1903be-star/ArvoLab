// KAYNAKLAR → KAYNAKÇA: SON DENETİM ÖZETİ ve GEÇMİŞ — KABUL (23.11.2026).
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
const D_ERKEN = denetimEkle(P_BICIM, saatli(6, 15), { temiz: 3, atifsiz: ["Kaynak A"], notFound: 1, dogrulanan: 3, citations: ["(Yılmaz, 2020)"] });
denetimEkle(P_BICIM, saatli(7, 40), { hata: 1, uyari: 1, temiz: 1, dogrulanan: 0, citations: [] });
denetimEkle(P_TEMIZ, saatli(6, 0), { temiz: 4, dogrulanan: 4, citations: ["(Yılmaz, 2020)"], tyk: [] });
denetimEkle(P_COK, saatli(6, 30), {
  hata: 2, uyari: 1, temiz: 2, atifsiz: ["Kaynak B"], karsiliksiz: ["(Demir, 2019)", "(Kaya, 2021)"],
  notFound: 1, unreachable: 2, dogrulanan: 5, citations: ["(Yılmaz, 2020)"], tyk: [{ tur: "yilsiz", atif: "(Yılmaz)", aciklama: "Yıl yok" }],
});
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
    const kart = document.querySelector(".kaynak-tek-kart");
    if (!kart) return null;
    const satir = (li) => ({
      ad: li.querySelector("b")?.innerText.trim() ?? "",
      not: li.querySelector("small")?.innerText.trim() ?? "",
      rozet: li.querySelector(".status-pill")?.innerText.trim() ?? "",
    });
    const kategoriler = [...kart.querySelectorAll(".kaynakca-kategoriler li")].map(satir);
    const gecmis = [...kart.querySelectorAll(".kaynakca-gecmis li a")].map((a) => ({ metin: a.innerText.trim(), href: a.getAttribute("href") }));
    const liste = kart.querySelector(".kaynakca-kategoriler") ?? kart.querySelector(".gb-liste");
    const gecmisBaslik = kart.querySelector(".calisma-durum-alt");
    return {
      ustBilgi: kart.querySelector(".gb-kart-bas p")?.innerText.trim() ?? "",
      toplam: kart.querySelector(".kaynakca-puan b")?.innerText.trim() ?? "",
      toplamMetni: kart.querySelector(".kaynakca-puan span")?.innerText.trim() ?? "",
      ozetSatiri: kart.querySelector(".kaynakca-ozet-satiri")?.innerText.trim() ?? "",
      kategoriler, gecmis,
      bosMetin: kart.querySelector(".gb-bos")?.innerText.trim() ?? "",
      /* GÖRÜNEN boşluk: SON SATIRIN altı ile "Önceki denetimler"
         başlığının üstü arası. Kapsayıcının altını ölçmek yanıltıyor:
         tek ekran kuralında liste büyüyor ve boşluk LİSTENİN İÇİNDE
         kalıyor (eski halde kapsayıcı farkı 10 px, görünen boşluk
         ~170 px'ti). */
      bosluk: (() => {
        const satirlar = [...(liste?.querySelectorAll("li") ?? [])];
        const son = satirlar[satirlar.length - 1];
        return son && gecmisBaslik ? Math.round(gecmisBaslik.getBoundingClientRect().top - son.getBoundingClientRect().bottom) : null;
      })(),
      yatayTasma: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

try {
  /* ================= K1: ekran görüntüsündeki durum ================= */
  {
    const { ctx, s } = await oturum(1440, 900, "tr");
    await kaynakcaya(s, P_BICIM);
    await esit("K1a toplam ile kategoriler aynı denetimi gösteriyor (biçim satırları var)", async () => {
      const k = await kartOku(s);
      const bicimHata = k.kategoriler.find((x) => x.ad.startsWith("Biçim hatası"));
      const bicimUyari = k.kategoriler.find((x) => x.ad.startsWith("Biçim uyarısı"));
      const toplamSayilar = k.kategoriler
        .filter((x) => /^\d+$/.test(x.rozet) && !x.ad.startsWith("Dizine ulaşılamayan"))
        .reduce((a, x) => a + Number(x.rozet), 0);
      return `toplam:${k.toplam} bicimHata:${bicimHata?.rozet} bicimUyari:${bicimUyari?.rozet} kategoriToplami:${toplamSayilar}`;
    }, "toplam:2 bicimHata:1 bicimUyari:1 kategoriToplami:2");

    await esit("K1b açık sorunun hangi kategoride olduğu özette yazılı", async () => {
      const k = await kartOku(s);
      return `ozet:${/Biçim hatası olan künye: 1/.test(k.ozetSatiri) && /Biçim uyarısı olan künye: 1/.test(k.ozetSatiri)}`;
    }, "ozet:true");

    await esit("K1c ölçülmeyen kategori 'Yok' değil 'Denetlenmedi'", async () => {
      const k = await kartOku(s);
      const olculmeyen = k.kategoriler.filter((x) => x.rozet === "Denetlenmedi");
      const yokYazan = k.kategoriler.filter((x) => x.rozet === "Yok");
      return `denetlenmedi:${olculmeyen.length} sebepli:${olculmeyen.every((x) => x.not.length > 3)} yok:${yokYazan.length}`;
    }, "denetlenmedi:4 sebepli:true yok:0");

    await esit("K1d son denetimin tarihi, saati ve künye sayısı aynı kartta", async () => {
      const k = await kartOku(s);
      return `ustBilgi:${/Son denetim \d{2}\.\d{2}\.\d{4} \d{2}:\d{2} · 3 künye/.test(k.ustBilgi)} toplamMetni:${/3 künye denetlendi/.test(k.toplamMetni)}`;
    }, "ustBilgi:true toplamMetni:true");

    await esit("K1e aynı gün iki denetim saatleriyle ayrışıyor ve satır kendi sonucunu açıyor", async () => {
      const k = await kartOku(s);
      const satir = k.gecmis[0];
      return `sayi:${k.gecmis.length} saatli:${/\d{2}:\d{2}/.test(satir?.metin ?? "")} hedef:${satir?.href?.includes(`denetim=${D_ERKEN}`)}`;
    }, (v) => /sayi:1 saatli:true hedef:true/.test(v));

    await esit("K1f geçmiş satırına KLAVYEYLE ulaşılıyor ve o denetimin sonucu açılıyor", async () => {
      const bag = s.locator(".kaynakca-gecmis a").first();
      await bag.focus();
      const odakli = await s.evaluate(() => document.activeElement?.tagName.toLowerCase() ?? "");
      await s.keyboard.press("Enter");
      await s.waitForURL(/denetim=/, { timeout: 20000 });
      await s.waitForLoadState("networkidle").catch(() => {});
      /* Seçilen denetim ERKEN olan: 4 künye değil 3 künye + atıfsız kaynak 1. */
      /* Sayfada birden çok pencere DOM'da duruyor (hepsi inert);
         AÇIK olanı kökündeki "open" sınıfından bulunuyor. */
      const acikPencere = s.locator(".drawer-root.open section.drawer");
      const pencere = (await acikPencere.count()) ? await acikPencere.first().innerText() : "";
      /* Açılan, SEÇİLEN denetim olmalı: erken denetimin bulgusu
         ("Kaynak A" atıfsız kaynağı) sonuncusunda yok. */
      return `odak:${odakli} adres:${s.url().includes(D_ERKEN)} pencereAcik:${pencere.length > 50} secilen:${pencere.includes("Kaynak A")}`;
    }, (v) => /odak:a adres:true pencereAcik:true secilen:true/.test(v));

    await esit("K1g yerleşim: liste ile geçmiş arasında büyük boşluk ve yatay taşma yok", async () => {
      await kaynakcaya(s, P_BICIM);
      const k = await kartOku(s);
      return `bosluk:${k.bosluk} yatayTasma:${k.yatayTasma}`;
    }, (v) => {
      const [, bosluk, tasma] = v.match(/bosluk:(-?\d+) yatayTasma:(-?\d+)/) ?? [];
      return Number(bosluk) <= 80 && Number(tasma) <= 0;
    });
    if (GORSEL) await s.screenshot({ path: path.join(GORSEL, "kaynakca-bicim-1440.png"), fullPage: true });
    await ctx.close();
  }

  /* ================= K2: öteki denetim durumları ================= */
  {
    const { ctx, s } = await oturum(1440, 900, "tr");
    await esit("K2a denetim yapılmamış çalışmada özet değil açıklama var", async () => {
      await kaynakcaya(s, P_YOK);
      const k = await kartOku(s);
      return `ustBilgi:${k.ustBilgi} toplam:${k.toplam === ""} bos:${k.bosMetin.length > 40}`;
    }, (v) => /ustBilgi:Henüz denetlenmedi toplam:true bos:true/.test(v));

    await esit("K2b sorunsuz denetimde toplam 0 ve kategoriler 'Yok'", async () => {
      await kaynakcaya(s, P_TEMIZ);
      const k = await kartOku(s);
      const yok = k.kategoriler.filter((x) => x.rozet === "Yok").length;
      return `toplam:${k.toplam} yok:${yok} denetlenmedi:${k.kategoriler.filter((x) => x.rozet === "Denetlenmedi").length} ozet:${k.ozetSatiri}`;
    }, (v) => /toplam:0 yok:6 denetlenmedi:0 ozet:$/.test(v));

    await esit("K2c çok kategorili bulguda toplam kategorilerin toplamına eşit", async () => {
      await kaynakcaya(s, P_COK);
      const k = await kartOku(s);
      const sayilar = k.kategoriler.filter((x) => /^\d+$/.test(x.rozet));
      const ulasilamayan = sayilar.find((x) => x.ad.startsWith("Dizine ulaşılamayan"));
      const katilan = sayilar.filter((x) => !x.ad.startsWith("Dizine ulaşılamayan")).reduce((a, x) => a + Number(x.rozet), 0);
      return `toplam:${k.toplam} katilan:${katilan} ulasilamayan:${ulasilamayan?.rozet} not:${/toplama katılmıyor/.test(ulasilamayan?.not ?? "")} ozetKategori:${k.ozetSatiri.split(" · ").length}`;
    }, (v) => /toplam:8 katilan:8 ulasilamayan:2 not:true ozetKategori:6/.test(v));

    await esit("K2d çalışma değişince doğru özet ve geçmiş geliyor", async () => {
      await kaynakcaya(s, P_BICIM);
      const bicim = await kartOku(s);
      await kaynakcaya(s, P_TEMIZ);
      const temiz = await kartOku(s);
      return `bicim:${bicim.toplam} bicimGecmis:${bicim.gecmis.length} temiz:${temiz.toplam} temizGecmis:${temiz.gecmis.length}`;
    }, "bicim:2 bicimGecmis:1 temiz:0 temizGecmis:0");

    await esit("K2e Kütüphanem sekmesi çalışıyor", async () => {
      await s.goto(`${UYG}/dashboard/literature?calisma=${P_BICIM}`, { waitUntil: "domcontentloaded" });
      await s.waitForLoadState("networkidle").catch(() => {});
      const metin = await s.locator("main").innerText();
      return `kaynak:${/Sentetik kaynak başlığı/.test(metin)} sekme:${await s.locator(".kaynak-sekme, [role='tab'], a").filter({ hasText: "Kaynakça" }).count()}`;
    }, (v) => /kaynak:true/.test(v) && !/sekme:0/.test(v));

    await esit("K2f kaynakça dışa aktarma akışı çalışıyor", async () => {
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
    await esit(`K3a-${ad} özet ve kategoriler çeviride eksiksiz`, async () => {
      const k = await kartOku(s);
      const beklenen = dil === "tr"
        ? ["Biçim hatası olan künye", "Biçim uyarısı olan künye", "Kaynakçada karşılığı olmayan atıf", "Dizinlerde bulunamayan kaynak"]
        : ["References with format errors", "References with format warnings", "Citations missing from the reference list", "Sources not found in the indexes"];
      const turkceKalinti = dil === "en" && /künye|Yok|Denetlenmedi/.test(k.kategoriler.map((x) => x.ad + x.rozet).join(" "));
      return `toplam:${k.toplam} adlar:${beklenen.every((b) => k.kategoriler.some((x) => x.ad === b))} turkceKalinti:${turkceKalinti}`;
    }, (v) => /toplam:8 adlar:true turkceKalinti:false/.test(v));

    await esit(`K3b-${ad} yatay taşma yok, uzun kategori adı sarıyor`, async () => {
      const k = await kartOku(s);
      const kirpik = await s.evaluate(() =>
        [...document.querySelectorAll(".kaynakca-kategoriler .gb-satir-govde b")].some((b) => b.scrollHeight > b.clientHeight + 1),
      );
      return `yatayTasma:${k.yatayTasma} kirpikDegil:${!kirpik}`;
    }, (v) => /kirpikDegil:true/.test(v) && Number(v.match(/yatayTasma:(-?\d+)/)?.[1] ?? 1) <= 0);

    await esit(`K3c-${ad} karşıtlık: özet sayısı okunur`, async () => {
      return await s.locator(".kaynakca-puan b").evaluate((el) => {
        const r = getComputedStyle(el).color;
        const z = getComputedStyle(el.closest(".kaynakca-puan")).backgroundColor;
        const lum = (c) => {
          const [x, y, w] = c.match(/\d+/g).slice(0, 3).map((n) => {
            const s2 = Number(n) / 255;
            return s2 <= 0.03928 ? s2 / 12.92 : ((s2 + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * x + 0.7152 * y + 0.0722 * w;
        };
        const a = lum(r), b = lum(z);
        return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10;
      });
    }, (v) => Number(v) >= 3);
    if (GORSEL) await s.screenshot({ path: path.join(GORSEL, `kaynakca-${ad}.png`), fullPage: true });
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
