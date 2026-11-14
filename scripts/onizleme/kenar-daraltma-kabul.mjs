/*
  PHASE 5.1c TARAYICI KABULÜ: masaüstü kenar çubuğu 240 px açık / 64 px dar.

  Yerel önizlemede (npm run onizleme, sahte Supabase) gerçek tarayıcıda
  sınar: düğme ve aria-expanded, odak, ad etiketlerinin kırpılmaması, logo
  ve hesap menüsünün yeri, "Daha fazla", çalışma sekmeleri, ilk boyama,
  azaltılmış hareket, kırılım sınırları ve editör kâğıdının genişliği.
  Kâğıt kuralı kurum sahibinin kararı: daraltma belgeyi GENİŞLETMEZ.

  CI'da DEĞİL: önizleme sunucusu ve Chromium ister. Kullanım:
    NODE_PATH=$(npm root -g) node scripts/onizleme/kenar-daraltma-kabul.mjs [taban-adres]
  Bir senaryo düşerse çıkış kodu 1.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const MAKALE = "00000000-0000-4000-8000-0000000000b2";
const ANAHTAR = "arvolab.gezinme.dar";
const INCELEME = "arvolab:inceleme-paneli";
const sonuclar = [];

async function senaryo(ad, govde) {
  try {
    await govde();
    sonuclar.push({ ad, tamam: true });
  } catch (hata) {
    sonuclar.push({ ad, tamam: false, neden: String(hata?.message ?? hata).split("\n").filter((l, i) => i === 0 || /intercepts|stable|visible|waiting for|resolved/.test(l)).slice(0, 8).join(" ⏎ ").slice(0, 900) });
  }
}
function bekle(kosul, mesaj) {
  if (!kosul) throw new Error(mesaj);
}
const git = (sayfa, yol) => sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 150000 });
const tarayici = await chromium.launch();

/** Yeni bağlam: tercihler ilk betikten ÖNCE depoya yazılır (gerçek kullanıcının kayıtlı tercihi gibi). */
async function baglam({ w, h, tema = "light", dar, inceleme, hareket = "no-preference" }) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: h }, colorScheme: tema, reducedMotion: hareket });
  await ctx.addInitScript(({ dar, inceleme, ANAHTAR, INCELEME }) => {
    try {
      if (!sessionStorage.getItem("kabul-kuruldu")) {
        sessionStorage.setItem("kabul-kuruldu", "1");
        if (dar === undefined) localStorage.removeItem(ANAHTAR); else localStorage.setItem(ANAHTAR, dar);
        if (inceleme !== undefined) localStorage.setItem(INCELEME, inceleme);
      }
    } catch {}
  }, { dar, inceleme, ANAHTAR, INCELEME });
  /*
    Next'in YALNIZCA geliştirme sunucusunda çizdiği "N" göstergesi
    (nextjs-portal) sol alt köşede durur ve dar raydaki "Daha fazla"
    düğmesinin tıklamasını yutar (ilk koşularda böyle düştü). Üretim
    derlemesinde bu öğe yok; sınanan uygulama değil, geliştirme katmanı.
  */
  await ctx.addInitScript(() => {
    const gizle = () => { const st = document.createElement("style"); st.textContent = "nextjs-portal{display:none!important}"; document.documentElement.appendChild(st); };
    if (document.documentElement) gizle(); else document.addEventListener("DOMContentLoaded", gizle);
  });
  const sayfa = await ctx.newPage();
  const uyarilar = [];
  sayfa.on("console", (m) => { if (/hydrat|did not match|mismatch/i.test(m.text())) uyarilar.push(m.text().slice(0, 200)); });
  sayfa.on("pageerror", (e) => uyarilar.push("pageerror: " + String(e).slice(0, 200)));
  return { ctx, sayfa, uyarilar };
}

const olcu = (sayfa) => sayfa.evaluate(() => {
  const nav = document.querySelector("nav.os-gezinme").getBoundingClientRect();
  const kabuk = document.querySelector(".dashboard-content-shell").getBoundingClientRect();
  const dugme = document.querySelector(".os-gezinme-daralt");
  const gor = (s) => { const e = document.querySelector(s); return !!e && e.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && e.getBoundingClientRect().width > 0; };
  const html = document.documentElement;
  return {
    navW: Math.round(nav.width), navTop: Math.round(nav.top), navH: Math.round(nav.height), kabukX: Math.round(kabuk.left),
    dugmeGorunur: gor(".os-gezinme-daralt"),
    expanded: dugme?.getAttribute("aria-expanded"), etiket: dugme?.getAttribute("aria-label"),
    navLogo: gor(".os-gezinme-logo"), ustLogo: gor(".os-marka-logo"),
    // next/image adresi kodlar (/_next/image?url=%2Farvolab-logo.png…): dosya adı çözülmüş adresten okunur.
    ustLogoSrc: [...document.querySelectorAll(".os-marka-logo img")].filter((i) => i.checkVisibility()).map((i) => decodeURIComponent(i.getAttribute("src") ?? "")).join(","),
    kenarHesap: gor(".os-kullanici--kenar"), ustHesap: gor(".os-kullanici--ust"),
    diger: gor(".os-gezinme-diger"), daha: gor(".os-gezinme-daha"), baglam: gor(".os-gezinme-baglam"),
    sekmeler: gor(".calisma-sekmeleri"),
    tasma: html.scrollWidth - html.clientWidth,
    attr: html.getAttribute("data-gezinme"), tema: html.getAttribute("data-theme"),
    gecis: getComputedStyle(document.querySelector("nav.os-gezinme")).transitionDuration,
  };
});

/*
  Etiket kırpılmıyor mu. elementFromPoint burada KULLANILAMAZ: etiket
  pointer-events:none taşıyor ve her zaman alttaki öğe döner (ilk koşuda
  bu yüzden yanlış FAIL verdi). Onun yerine etiketin bütün ataları
  yürünür: taşmayı kesen (overflow ≠ visible) ya da clip-path/contain
  taşıyan her atanın kutusu etiketin kutusunu tamamen içermeli.
*/
const etiketDenetimi = (sayfa, i) => sayfa.evaluate((i) => {
  const ogeler = [...document.querySelectorAll("nav.os-gezinme .os-gezinme-oge")].filter((e) => e.checkVisibility({ visibilityProperty: true }) && e.getBoundingClientRect().width > 0);
  const oge = ogeler[i];
  if (!oge) return { yok: true, toplam: ogeler.length };
  const ad = oge.querySelector(".os-gezinme-ad");
  const r = ad.getBoundingClientRect();
  let tam = r.width > 0 && r.height > 0;
  const kirpan = [];
  for (let a = ad.parentElement; a && a !== document.documentElement; a = a.parentElement) {
    const cs = getComputedStyle(a);
    const kesiyor = cs.overflowX !== "visible" || cs.overflowY !== "visible" || cs.clipPath !== "none" || /paint|strict|content/.test(cs.contain);
    if (!kesiyor) continue;
    const k = a.getBoundingClientRect();
    if (r.left < k.left - 0.5 || r.right > k.right + 0.5 || r.top < k.top - 0.5 || r.bottom > k.bottom + 0.5) { tam = false; kirpan.push(a.className || a.tagName); }
  }
  return { toplam: ogeler.length, metin: ad.textContent.trim(), opak: getComputedStyle(ad).opacity, tam, kirpan: kirpan.join(" > "), ekranda: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, ad: oge.getAttribute("aria-label") || ad.textContent.trim() };
}, i);

for (const [w, h] of [[1366, 768], [1440, 900]]) for (const tema of ["light", "dark"]) {
  const et = `${w}×${h} ${tema === "light" ? "açık" : "koyu"}`;
  await senaryo(`${et}: açık 240 px, düğme klavyeyle daraltır (64 px), odak düğmede, tercih saklanır`, async () => {
    const { ctx, sayfa, uyarilar } = await baglam({ w, h, tema });
    await git(sayfa, "/dashboard");
    let o = await olcu(sayfa);
    bekle(o.navW === 240 && o.kabukX === 240, `açık: ray ${o.navW}, içerik ${o.kabukX}`);
    bekle(o.expanded === "true" && o.etiket === "Kenar çubuğunu daralt" && o.dugmeGorunur, `düğme: ${o.expanded} / ${o.etiket}`);
    bekle(o.navLogo && !o.ustLogo && o.kenarHesap && !o.ustHesap && !o.diger && !o.daha, `açık hâl öğeleri: ${JSON.stringify(o)}`);
    await sayfa.locator(".os-gezinme-daralt").focus();
    await sayfa.keyboard.press("Enter");
    await sayfa.waitForTimeout(450);
    o = await olcu(sayfa);
    bekle(o.navW === 64 && o.kabukX === 64, `dar: ray ${o.navW}, içerik ${o.kabukX}`);
    bekle(o.expanded === "false" && o.etiket === "Kenar çubuğunu genişlet", `dar düğme: ${o.expanded} / ${o.etiket}`);
    bekle(await sayfa.evaluate(() => document.activeElement?.classList.contains("os-gezinme-daralt")), "odak düğmede kalmadı");
    bekle((await sayfa.evaluate((k) => localStorage.getItem(k), ANAHTAR)) === "1", "tercih saklanmadı");
    bekle(o.tasma <= 0, `yatay taşma ${o.tasma}`);
    bekle(uyarilar.length === 0, uyarilar.join(" | "));
    await sayfa.screenshot({ path: `/tmp/kenar-${w}-${tema}-dar.png` }).catch(() => {});
    await ctx.close();
  });

  await senaryo(`${et}: dar hâlde logo üst çubukta (resmî dosya, tema varyantı), hesap üst çubukta, Diğer yok, Daha fazla erişilebilir`, async () => {
    const { ctx, sayfa } = await baglam({ w, h, tema, dar: "1" });
    await git(sayfa, "/dashboard");
    const o = await olcu(sayfa);
    bekle(o.attr === "dar" && o.navW === 64, `dar başlamadı: ${o.attr} ${o.navW}`);
    bekle(!o.navLogo && o.ustLogo, "logo üst çubukta değil");
    // Tek görünür logo, resmî dosya, temanın varyantı (koyu temada LAB yeşili korunan koyu dosya).
    const koyuDosya = o.ustLogoSrc.includes("/arvolab-logo-koyu.png");
    const acikDosya = /\/arvolab-logo\.png/.test(o.ustLogoSrc);
    bekle(!o.ustLogoSrc.includes(",") && (tema === "dark" ? koyuDosya && !acikDosya : acikDosya && !koyuDosya), `logo dosyası (${tema}): ${o.ustLogoSrc}`);
    bekle(!o.kenarHesap && o.ustHesap, "hesap menüsü yeri yanlış");
    bekle(!o.diger && o.daha && !o.baglam, `Diğer/Daha fazla/bağlam: ${o.diger}/${o.daha}/${o.baglam}`);
    await sayfa.locator(".os-kullanici--ust > summary").click();
    const menu = await sayfa.evaluate(() => { const r = document.querySelector(".os-kullanici--ust .os-kullanici-menu").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && r.width > 0; });
    bekle(menu, "hesap menüsü ekranın dışına taşıyor");
    await sayfa.keyboard.press("Escape");
    await sayfa.locator(".os-gezinme-daha").click();
    const pencere = sayfa.locator("dialog.os-daha[open]");
    await pencere.waitFor({ state: "visible", timeout: 5000 });
    const metin = await pencere.innerText();
    bekle(/Kullanım Kılavuzu/.test(metin) && /Abonelik/.test(metin), `Daha fazla içeriği: ${metin.slice(0, 160)}`);
    await sayfa.keyboard.press("Escape");
    await ctx.close();
  });

  await senaryo(`${et}: dar hâlde her bağlantının adı var; ad etiketi farede ve klavye odağında görünür, kırpılmaz`, async () => {
    const { ctx, sayfa } = await baglam({ w, h, tema, dar: "1" });
    await git(sayfa, "/dashboard");
    const ilk = await etiketDenetimi(sayfa, 0);
    bekle(!ilk.yok && ilk.toplam >= 6, `öğe sayısı ${ilk.toplam}`);
    for (let i = 0; i < ilk.toplam; i++) {
      const oge = sayfa.locator("nav.os-gezinme .os-gezinme-oge:visible").nth(i);
      await oge.hover();
      await sayfa.waitForTimeout(220);
      const d = await etiketDenetimi(sayfa, i);
      bekle(d.metin && d.opak === "1" && d.tam && d.ekranda, `fare #${i} ${d.metin}: opak ${d.opak}, tam ${d.tam} (${d.kirpan}), ekranda ${d.ekranda}`);
    }
    await sayfa.mouse.move(w - 5, h - 5);
    await sayfa.locator("nav.os-gezinme .os-gezinme-oge:visible").nth(1).focus();
    await sayfa.keyboard.press("Tab");
    await sayfa.keyboard.press("Shift+Tab");
    await sayfa.waitForTimeout(220);
    const odak = await sayfa.evaluate(() => { const a = document.activeElement; const ad = a?.querySelector?.(".os-gezinme-ad"); return ad ? getComputedStyle(ad).opacity : "yok"; });
    bekle(odak === "1", `klavye odağında etiket görünmüyor (${odak})`);
    await ctx.close();
  });
}

await senaryo("ilk boyama: dar kayıtlıyken JS paketleri gelmeden ray 64 px, içerik 64 px'ten başlıyor; hydration uyarısı yok (iki tema)", async () => {
  for (const tema of ["light", "dark"]) {
    const { ctx, sayfa, uyarilar } = await baglam({ w: 1440, h: 900, tema, dar: "1" });
    await sayfa.route("**/_next/static/**/*.js", async (r) => { await new Promise((z) => setTimeout(z, 4000)); await r.continue(); });
    await sayfa.goto(TABAN + "/dashboard", { waitUntil: "commit", timeout: 150000 });
    await sayfa.waitForSelector("nav.os-gezinme", { timeout: 60000 });
    const ilk = await sayfa.evaluate(() => ({ next: !!window.next, w: Math.round(document.querySelector("nav.os-gezinme").getBoundingClientRect().width), x: Math.round(document.querySelector(".dashboard-content-shell").getBoundingClientRect().left) }));
    bekle(!ilk.next && ilk.w === 64 && ilk.x === 64, `${tema} ilk kare: ${JSON.stringify(ilk)}`);
    await sayfa.waitForLoadState("networkidle", { timeout: 150000 });
    await sayfa.waitForTimeout(600);
    const son = await olcu(sayfa);
    bekle(son.navW === 64 && son.expanded === "false", `${tema} hydration sonrası: ${son.navW} ${son.expanded}`);
    bekle(uyarilar.length === 0, `${tema}: ${uyarilar.join(" | ")}`);
    await ctx.close();
  }
});

await senaryo("geçiş: normalde 200 ms, azaltılmış harekette yok (≤ 0,1 ms)", async () => {
  /* Azaltılmış harekette base.css bütün öğelere transition-duration: .01ms
     !important uygular (1e-05s): "hareket yok"un uygulamadaki karşılığı. */
  for (const [hareket, uygun] of [["no-preference", (s) => s === "0.2s"], ["reduce", (s) => parseFloat(s) <= 0.0001]]) {
    const { ctx, sayfa } = await baglam({ w: 1440, h: 900, hareket });
    await git(sayfa, "/dashboard");
    const o = await olcu(sayfa);
    bekle(uygun(o.gecis), `${hareket}: ${o.gecis}`);
    await ctx.close();
  }
});

await senaryo("geri genişletme: 240 px'e döner, odak düğmede, tercih \"0\"", async () => {
  const { ctx, sayfa } = await baglam({ w: 1440, h: 900, dar: "1" });
  await git(sayfa, "/dashboard");
  await sayfa.locator(".os-gezinme-daralt").click();
  await sayfa.waitForTimeout(450);
  const o = await olcu(sayfa);
  bekle(o.navW === 240 && o.expanded === "true" && o.attr === null, JSON.stringify(o));
  bekle(await sayfa.evaluate(() => document.activeElement?.classList.contains("os-gezinme-daralt")), "odak düğmede değil");
  bekle((await sayfa.evaluate((k) => localStorage.getItem(k), ANAHTAR)) === "0", "tercih 0 değil");
  await ctx.close();
});

await senaryo("çalışma sekmeleri: dar hâlde yazım, kanıt, etik ve (makalede) makale sayfasında görünür; açık hâlde gizli", async () => {
  for (const dar of ["1", undefined]) {
    const { ctx, sayfa } = await baglam({ w: 1366, h: 768, dar });
    for (const [yol, aktif, makaleVar] of [[`/dashboard/editor/${TEZ}/write`, "Yazım", false], [`/dashboard/editor/${TEZ}/kanit`, "Kanıt matrisi", false], [`/dashboard/editor/${TEZ}/etik`, "Etik kurul", false], [`/dashboard/editor/${MAKALE}/makale`, "Makale", true]]) {
      await git(sayfa, yol);
      const o = await olcu(sayfa);
      if (dar) {
        bekle(o.sekmeler, `${yol}: dar hâlde sekmeler görünmüyor`);
        const s = await sayfa.evaluate(() => [...document.querySelectorAll(".calisma-sekmeleri a")].map((a) => [a.textContent.trim(), a.getAttribute("aria-current") ?? ""]));
        bekle(s.some(([m, c]) => m === aktif && c === "page"), `${yol}: etkin sekme yok ${JSON.stringify(s)}`);
        bekle(s.some(([m]) => m === "Makale") === makaleVar, `${yol}: Makale sekmesi tür kuralına uymuyor`);
        bekle(o.tasma <= 0, `${yol}: yatay taşma ${o.tasma}`);
      } else {
        bekle(!o.sekmeler, `${yol}: açık masaüstünde sekmeler görünmemeli (kenar çubuğunda)`);
      }
    }
    await ctx.close();
  }
});

/*
  KÂĞIT GEOMETRİSİ: açık hâl referans. Ölçülen: yazım düzeni, ana sütun,
  belge kutusu ve metin sütunu (belge kutusunun iç genişliği, dolgu hariç).
  Dar hâlde dördü de piksel düzeyinde aynı olmalı (±1 px yuvarlama).
*/
await senaryo("kâğıt geometrisi: 1366 ve 1440'ta, inceleme paneli açık ve kapalıyken dar hâl açık hâlle aynı genişlikte", async () => {
  const kayit = [];
  for (const [w, h] of [[1366, 768], [1440, 900]]) for (const inceleme of ["1", "0"]) {
    const geo = {};
    for (const dar of [undefined, "1"]) {
      const { ctx, sayfa } = await baglam({ w, h, dar, inceleme });
      await git(sayfa, `/dashboard/editor/${TEZ}/write`);
      await sayfa.locator(".manuscript-editor-content").first().waitFor({ state: "visible", timeout: 60000 });
      await sayfa.waitForTimeout(300);
      geo[dar ? "dar" : "acik"] = await sayfa.evaluate(() => {
        const g = (s) => document.querySelector(s)?.getBoundingClientRect().width ?? -1;
        const icerik = document.querySelector(".manuscript-editor-content");
        const cs = getComputedStyle(icerik);
        return {
          inceleme: document.querySelector(".manuscript-layout").hasAttribute("data-inceleme"),
          duzen: Math.round(g(".manuscript-layout")), ana: Math.round(g(".manuscript-main")), belge: Math.round(g(".manuscript-editor-content")),
          sutun: Math.round(icerik.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)),
        };
      });
      await ctx.close();
    }
    kayit.push(`${w} inceleme=${inceleme}: açık ${JSON.stringify(geo.acik)} · dar ${JSON.stringify(geo.dar)}`);
    for (const k of ["duzen", "ana", "belge", "sutun"]) bekle(Math.abs(geo.acik[k] - geo.dar[k]) <= 1, `${w} inceleme=${inceleme} ${k}: açık ${geo.acik[k]} ≠ dar ${geo.dar[k]}`);
    bekle(geo.acik.inceleme === (inceleme === "1") && geo.dar.inceleme === (inceleme === "1"), `inceleme tercihi uygulanmadı: ${JSON.stringify(geo)}`);
  }
  console.log("KÂĞIT ÖLÇÜLERİ\n  " + kayit.join("\n  "));
});

await senaryo("kırılımlar: 1200 tercih etkili; 1199 ve 761 her iki tercihte 64 px ray (düğme gizli); 760 alt çubuk", async () => {
  const satir = [];
  for (const [w, dar, beklenen] of [[1200, undefined, 240], [1200, "1", 64], [1199, undefined, 64], [1199, "1", 64], [761, undefined, 64], [761, "1", 64], [760, undefined, "alt"], [760, "1", "alt"]]) {
    const { ctx, sayfa } = await baglam({ w, h: 900, dar });
    await git(sayfa, "/dashboard");
    const o = await olcu(sayfa);
    satir.push(`${w}/${dar ?? "-"}: w${o.navW} top${o.navTop} h${o.navH} düğme ${o.dugmeGorunur}`);
    if (beklenen === "alt") bekle(o.navW === w && o.navH < 120 && !o.dugmeGorunur, `${w}: alt çubuk değil ${JSON.stringify(o)}`);
    else bekle(o.navW === beklenen && o.dugmeGorunur === (w >= 1200), `${w}/${dar}: ${o.navW} düğme ${o.dugmeGorunur}`);
    if (w < 1200 && w > 760) bekle(o.navTop > 0, `${w}: tablet rayı üst çubuğun altından başlamalı (top ${o.navTop})`);
    bekle(o.tasma <= 0, `${w}: taşma ${o.tasma}`);
    await ctx.close();
  }
  console.log("KIRILIMLAR\n  " + satir.join("\n  "));
});

await senaryo("localStorage engelliyken açık başlar, düğme çalışır, sayfa hatası yok", async () => {
  const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("engelli", "SecurityError"); } }); });
  const sayfa = await ctx.newPage();
  const hatalar = [];
  sayfa.on("pageerror", (e) => hatalar.push(String(e).slice(0, 160)));
  await git(sayfa, "/dashboard");
  let o = await olcu(sayfa);
  bekle(o.navW === 240, `açık başlamadı ${o.navW}`);
  await sayfa.locator(".os-gezinme-daralt").click();
  await sayfa.waitForTimeout(450);
  o = await olcu(sayfa);
  bekle(o.navW === 64 && o.expanded === "false", `düğme çalışmadı ${o.navW}`);
  bekle(!hatalar.some((x) => /gezinme|localStorage/i.test(x)), hatalar.join(" | "));
  await ctx.close();
});

await tarayici.close();
let dusen = 0;
for (const s of sonuclar) {
  console.log(`${s.tamam ? "PASS" : "FAIL"}  ${s.ad}${s.tamam ? "" : `\n      → ${s.neden}`}`);
  if (!s.tamam) dusen++;
}
console.log(`\n${sonuclar.length - dusen}/${sonuclar.length} PASS`);
process.exit(dusen ? 1 : 0);
