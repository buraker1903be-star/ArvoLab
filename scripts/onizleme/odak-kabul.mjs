/*
  ODAK HALKASI KABULÜ (Signature OS 2.0 Aşama 1, 08.11.2026).

  Klavyeyle gezen kullanıcı hangi öğede olduğunu YALNIZCA odak halkasından
  anlar. Halka bileşende tanımlı (--odak-halkasi), ama sayfa CSS'leri
  global ve bir sayfa kuralı onu sessizce ezebiliyor: Aşama 2'de
  ".calisma-araclari … { box-shadow: none }" Çalışmalarım'daki yedi aracın
  halkasını yok etmişti ve hiçbir denetim görmemişti.

  Yöntem: sayfada Tab ile ilerlenir; her durakta öğenin ODAKLIYKEN ve
  ODAKSIZKEN görünümü karşılaştırılır (outline, box-shadow, kenarlık ve
  zemin rengi). Hiçbiri değişmiyorsa o öğede görünür bir odak işareti
  yok demektir. "box-shadow var mı" diye bakmak yetmiyor: düğmelerin
  kendi hafif gölgesi zaten var ve halkasız düğmeyi "halkalı" sayıyordu.

  12 sayfa × 1440 (ince işaretçi) × açık/koyu. Salt okunur.
    node scripts/onizleme/odak-kabul.mjs [taban]
*/
import { createRequire } from "node:module";
import { onkosul } from "./onkosul.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const TABAN = process.argv[2] ?? "http://localhost:3123";
/* Ön koşul (scripts/onizleme/onkosul.mjs): yanlış sunucuya karşı sıradan FAIL değil, BLOCKED (2). */
await onkosul("odak-kabul", TABAN, "varsayilan");
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const SAYFALAR = {
  dashboard: "/dashboard",
  calismalarim: `/dashboard/editor?sec=${TEZ}`,
  editor: `/dashboard/editor/${TEZ}/write`,
  kaynaklar: `/dashboard/literature?calisma=${TEZ}`,
  kaynakca: `/dashboard/citations?calisma=${TEZ}`,
  kanit: `/dashboard/editor/${TEZ}/kanit`,
  analiz: "/dashboard/analysis",
  belge: "/dashboard/documents",
  ayarlar: "/dashboard/settings",
  abonelik: "/dashboard/abonelik",
  yardim: "/dashboard/yardim",
  destek: "/dashboard/expert-requests",
};
const EN_FAZLA_DURAK = 160;

const tarayici = await chromium.launch();
let hata = 0;
let toplamDurak = 0;
for (const tema of ["light", "dark"]) {
  for (const [ad, yol] of Object.entries(SAYFALAR)) {
    const ctx = await tarayici.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem("arvolab.theme", t);
      } catch {}
    }, tema);
    const sayfa = await ctx.newPage();
    await sayfa.goto(TABAN + yol, { waitUntil: "networkidle", timeout: 180000 });
    await sayfa.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
    await sayfa.waitForTimeout(400);
    const halkasiz = new Map();
    const goruldu = new Set();
    for (let i = 0; i < EN_FAZLA_DURAK; i++) {
      await sayfa.keyboard.press("Tab");
      const o = await sayfa.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        // Editör kâğıdı (ProseMirror) imleçle odaklanır; halka beklenmez.
        // nextjs-portal yalnız geliştirme sunucusunun göstergesi, üründe yok.
        if (a.closest(".ProseMirror") || a.tagName === "NEXTJS-PORTAL") return { atla: true };
        const yol = [];
        for (let x = a; x && x !== document.body; x = x.parentElement) yol.push([...(x.parentElement?.children ?? [])].indexOf(x));
        /*
          Öğenin kendisi ve iki üst kabı: arama kutusu gibi bileşenlerde
          halka kabın :focus-within kuralında, girdinin kendisinde değil.
        */
        const kaplar = [a, a.parentElement, a.parentElement?.parentElement].filter(Boolean);
        const al = () =>
          kaplar
            .map((el) => {
              const s = getComputedStyle(el);
              return [s.outlineStyle === "none" || parseFloat(s.outlineWidth) === 0 ? "none" : `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`, s.boxShadow, s.borderColor, s.backgroundColor, s.textDecorationLine].join(" | ");
            })
            .join(" || ");
        const odakli = al();
        // Odaksız görünüm: odağı geçici olarak gövdeye ver, sonra geri al.
        const onceki = a;
        a.blur();
        const odaksiz = al();
        onceki.focus();
        return {
          anahtar: yol.join("."),
          ad: (a.getAttribute("aria-label") || a.textContent || a.tagName).trim().replace(/\s+/g, " ").slice(0, 40),
          sinif: String(a.className).slice(0, 60),
          isaretVar: odakli !== odaksiz,
        };
      });
      if (!o || o.atla) continue;
      if (goruldu.has(o.anahtar)) break; // tur tamamlandı
      goruldu.add(o.anahtar);
      if (!o.isaretVar) halkasiz.set(o.anahtar, `${o.ad} [${o.sinif}]`);
    }
    toplamDurak += goruldu.size;
    if (halkasiz.size) {
      hata += halkasiz.size;
      console.log(`✗ ${ad} ${tema}: ${halkasiz.size}/${goruldu.size} durakta görünür odak yok`);
      for (const s of halkasiz.values()) console.log(`    · ${s}`);
    } else console.log(`✓ ${ad} ${tema}: ${goruldu.size} durak, hepsinde görünür odak`);
    await ctx.close();
  }
}
await tarayici.close();
console.log(hata ? `\n${hata} durakta odak görünmüyor (toplam ${toplamDurak} durak)` : `\nOdak kabulü temiz (${toplamDurak} durak)`);
process.exit(hata ? 1 : 0);
