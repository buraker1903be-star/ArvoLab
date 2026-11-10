/*
  YAZIM EKRANI GÖRSEL HİYERARŞİ KABULÜ (Phase 4.6 D2, 10.11.2026).

  Karar: akademik belge çalışma alanının görsel merkezi. Eskiden sağ panel
  kâğıtla aynı beyaz karttı, "Yeni çalışma" ekranın en doygun öğesiydi,
  yapı uyarısı sarı dolgulu kalıcı bir alarm gibi duruyordu. Bu betik
  1024 / 1200 / 1366 / 1440 px × açık/koyu × kenar geniş/dar × panel
  açık/kapalı için şunları sınar:
    - kâğıt ekrandaki en açık yüzey (koyu temada da); yerleşik panel
      kenar çubuğunun tonunda, kâğıttan ayrı;
    - kenar çubuğu ve paneldeki GÖRÜNÜR her metin WCAG AA (≥ 4,5; büyük
      yazı ≥ 3); uyarı kartının başlığı ≥ 4,5, simgesi ≥ 3 ve uyarı
      rengini taşıyor;
    - "Yeni çalışma" yazım ekranında dolgusuz; Ana Sayfa'da dolu kalır;
    - etkin bölüm (aria-current) dolgu + sol çizgiyle ötekilerden ayrı;
    - "Yeni çalışma" klavye odağında halka görünür;
    - yatay taşma yok; belge sütunu 638 px (varsayılan) değişmez.
  Önizleme: npm run onizleme
    NODE_PATH=$(npm root -g) node scripts/onizleme/yazim-hiyerarsi-kabul.mjs [taban]
  Çıkış: 0 temiz, 1 bir denetim düştü.
*/
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "http://localhost:3123";
const TEZ = "00000000-0000-4000-8000-0000000000b1";
let toplam = 0;
const hatalar = [];
const denetle = (kosul, mesaj) => {
  toplam++;
  if (!kosul) hatalar.push(mesaj);
};
const tarayici = await chromium.launch();

async function ac(w, tema, kenar, panel, yol = `/dashboard/editor/${TEZ}/write`) {
  const ctx = await tarayici.newContext({ viewport: { width: w, height: 900 }, hasTouch: w < 1200 });
  await ctx.addInitScript((a) => { localStorage.setItem("arvolab.theme", a.tema); localStorage.setItem("arvolab.kenar", a.kenar); localStorage.setItem("arvolab:inceleme-paneli", a.panel); }, { tema, kenar, panel });
  const sayfa = await ctx.newPage();
  await sayfa.goto(`${TABAN}${yol}`, { waitUntil: "networkidle", timeout: 180000 });
  await sayfa.addStyleTag({ content: "*{animation:none!important;transition:none!important}" });
  await sayfa.evaluate(() => document.fonts.ready);
  await sayfa.waitForTimeout(500);
  return { ctx, sayfa };
}

/* Renk, saydamlık katmanları ve kontrast: tarayıcıda hesaplanır. */
const OLC = () => {
  const rgba = (c) => { const m = c.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0]; if (c.startsWith("color(srgb")) return [m[0] * 255, m[1] * 255, m[2] * 255, m[3] ?? 1]; return [m[0], m[1], m[2], m[3] ?? 1]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const kon = (a, z) => { const x = lum(a), y = lum(z); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const karis = (on, arka) => { const a = on[3]; return [on[0] * a + arka[0] * (1 - a), on[1] * a + arka[1] * (1 - a), on[2] * a + arka[2] * (1 - a), 1]; };
  const zemin = (e) => { const kat = []; while (e) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) kat.push(c); if (c[3] >= 1) break; e = e.parentElement; } let z = [255, 255, 255, 1]; for (const k of kat.reverse()) z = karis(k, z); return z; };
  const gorunur = (e) => { const k = e.getBoundingClientRect(); const s = getComputedStyle(e); return k.width > 0 && k.height > 0 && s.visibility !== "hidden" && s.display !== "none" && k.right > 0 && k.bottom > 0 && k.left < innerWidth && k.top < innerHeight; };
  const metinler = (kok) => {
    if (!kok || !gorunur(kok)) return [];
    const r = [];
    for (const e of kok.querySelectorAll("*")) {
      if (![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      if (!gorunur(e) || e.closest("[hidden],.sr-only,[aria-hidden=true]")) continue;
      const s = getComputedStyle(e); const z = zemin(e);
      const fs = parseFloat(s.fontSize), fw = +s.fontWeight;
      r.push({ m: e.textContent.trim().slice(0, 30), k: kon(karis(rgba(s.color), z), z), esik: fs >= 24 || (fs >= 18.66 && fw >= 700) ? 3 : 4.5 });
    }
    return r;
  };
  const q = (s) => document.querySelector(s);
  const pm = q(".ProseMirror"); const ps = pm ? getComputedStyle(pm) : null;
  const panel = q(".yan-panel:not([hidden])");
  const yeni = q(".os-gezinme-yeni");
  const uyari = q(".yan-panel .kontrol-yapi[data-tone=warning]");
  const etkin = q(".os-gezinme-alt.is-active"); const etkinOlmayan = q(".os-gezinme-alt:not(.is-active)");
  const ust = q(".dashboard-header");
  return {
    tasma: document.documentElement.scrollWidth > innerWidth + 1,
    sutun: pm ? pm.getBoundingClientRect().width - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight) : null,
    lum: { kagit: pm ? lum(zemin(pm)) : null, kenar: lum(zemin(q(".os-gezinme"))), panel: panel ? lum(zemin(panel)) : null, ust: lum(zemin(ust)) },
    panelBicim: panel?.dataset.bicim ?? null,
    panelKenarAyni: panel ? zemin(panel).map(Math.round).join() === zemin(q(".os-gezinme")).map(Math.round).join() : null,
    dusuk: [...metinler(q(".os-gezinme")), ...metinler(panel)].filter((x) => x.k < x.esik).map((x) => `${x.m} ${x.k.toFixed(2)}`),
    yeniDolgu: yeni && gorunur(yeni) ? getComputedStyle(yeni).backgroundColor : null,
    birincil: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    uyari: uyari && gorunur(uyari) ? (() => { const z = zemin(uyari); const b = uyari.querySelector("b"); const svg = uyari.querySelector("svg"); return { baslik: kon(karis(rgba(getComputedStyle(b).color), z), z), simge: kon(karis(rgba(getComputedStyle(svg).color), z), z), simgeRenk: getComputedStyle(svg).color, baslikRenk: getComputedStyle(b).color }; })() : null,
    etkin: etkin && gorunur(etkin) ? { aria: etkin.getAttribute("aria-current"), golge: getComputedStyle(etkin).boxShadow, zemin: zemin(etkin).map(Math.round).join(), oteki: etkinOlmayan ? zemin(etkinOlmayan).map(Math.round).join() : null, agirlik: getComputedStyle(etkin).fontWeight } : null,
  };
};

const renkEsit = (a, b) => {
  const x = (c) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => Math.round(+v)).join();
  return x(a) === x(b);
};

for (const w of [1024, 1200, 1366, 1440]) for (const tema of ["light", "dark"]) for (const kenar of (w >= 1200 ? ["genis", "dar"] : ["genis"])) for (const panel of ["1", "0"]) {
  const ad = `${w} ${tema} ${kenar} panel=${panel === "1" ? "açık" : "kapalı"}`;
  const { ctx, sayfa } = await ac(w, tema, kenar, panel);
  const o = await sayfa.evaluate(OLC);
  denetle(!o.tasma, `${ad}: yatay taşma`);
  denetle(o.sutun !== null && Math.abs(o.sutun - 638) < 0.6, `${ad}: belge sütunu ${o.sutun?.toFixed(1)} (beklenen 638)`);
  denetle(o.dusuk.length === 0, `${ad}: AA altı metin: ${o.dusuk.join(" | ")}`);
  // Kâğıt en açık yüzey (koyu temada loş kâğıt yine kabuktan açık).
  denetle(o.lum.kagit >= o.lum.kenar && o.lum.kagit >= o.lum.ust - 1e-6, `${ad}: kâğıt en açık yüzey değil (${JSON.stringify(o.lum)})`);
  if (o.panelBicim === "sutun") {
    denetle(o.panelKenarAyni, `${ad}: yerleşik panel kenar çubuğunun tonunda değil`);
    denetle(o.lum.kagit > o.lum.panel, `${ad}: panel kâğıt kadar açık (panel ${o.lum.panel.toFixed(3)}, kâğıt ${o.lum.kagit.toFixed(3)})`);
  }
  if (o.yeniDolgu) denetle(!renkEsit(o.yeniDolgu, o.birincil.startsWith("#") ? `rgb(${parseInt(o.birincil.slice(1, 3), 16)},${parseInt(o.birincil.slice(3, 5), 16)},${parseInt(o.birincil.slice(5, 7), 16)})` : o.birincil), `${ad}: "Yeni çalışma" yazım ekranında hâlâ birincil dolgulu`);
  if (o.uyari) {
    denetle(o.uyari.baslik >= 4.5, `${ad}: uyarı başlığı ${o.uyari.baslik.toFixed(2)} (≥ 4,5)`);
    denetle(o.uyari.simge >= 3, `${ad}: uyarı simgesi ${o.uyari.simge.toFixed(2)} (≥ 3)`);
    denetle(o.uyari.simgeRenk !== o.uyari.baslikRenk, `${ad}: uyarı simgesi uyarı rengini kaybetti`);
  }
  if (o.etkin) {
    denetle(o.etkin.aria === "page" || o.etkin.aria === "true", `${ad}: etkin bölümde aria-current yok`);
    denetle(/inset/.test(o.etkin.golge) && o.etkin.zemin !== o.etkin.oteki && +o.etkin.agirlik >= 600, `${ad}: etkin bölüm ötekilerden ayrılmıyor (${JSON.stringify(o.etkin)})`);
  }
  await ctx.close();
}

/* Kapsam: Ana Sayfa'da "Yeni çalışma" dolu kalır (kural yalnızca yazım ekranında). */
for (const tema of ["light", "dark"]) {
  const { ctx, sayfa } = await ac(1440, tema, "genis", "1", "/dashboard");
  const o = await sayfa.evaluate(() => ({ dolgu: getComputedStyle(document.querySelector(".os-gezinme-yeni")).backgroundColor, birincil: getComputedStyle(document.querySelector(".os-gezinme-yeni")).getPropertyValue("--primary").trim() }));
  denetle(!/255, 255, 255|20, 28, 40/.test(o.dolgu), `Ana Sayfa ${tema}: "Yeni çalışma" dolgusunu kaybetti (${o.dolgu})`);
  await ctx.close();
}

/* Klavye odağı: "Yeni çalışma"da halka görünür. */
for (const tema of ["light", "dark"]) {
  const { ctx, sayfa } = await ac(1440, tema, "genis", "1");
  await sayfa.locator(".os-gezinme-yeni").focus();
  await sayfa.keyboard.press("Shift+Tab"); await sayfa.keyboard.press("Tab");
  const halka = await sayfa.evaluate(() => { const e = document.activeElement; return e?.classList.contains("os-gezinme-yeni") ? getComputedStyle(e).boxShadow : null; });
  denetle(halka && halka !== "none" && !/inset/.test(halka.split("),")[0]), `1440 ${tema}: "Yeni çalışma" odak halkası görünmüyor (${halka})`);
  await ctx.close();
}

await tarayici.close();
for (const h of hatalar) console.log(`✗ ${h}`);
console.log(hatalar.length ? `Yazım hiyerarşisi kabulü: ${hatalar.length} denetim düştü (${toplam - hatalar.length}/${toplam})` : `Yazım hiyerarşisi kabulü temiz (${toplam} denetim)`);
process.exit(hatalar.length ? 1 : 0);
