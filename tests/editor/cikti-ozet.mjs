/*
  ÇIKTI ÖZETİ — Word (.docx) ve yazdırma/PDF HTML'inin YAPISAL özeti
  (R0, 07.11.2026).

  Neden metin eşitliği değil: iki çıktıyı bayt bayt karşılaştırmak her
  zararsız değişiklikte (öznitelik sırası, kimlik numarası, zaman damgası)
  düşer ve kimse neyin bozulduğunu okuyamaz; yalnızca düz metni
  karşılaştırmak ise asıl hata sınıfını kaçırır — 26.09.2026'da kaynakçanın
  asılı girintisi yazdırma çıktısında YOKTU ama metin birebir aynıydı.
  Özet, öğrencinin teslim ettiği belgede anlamı olan şeyleri tutar:
  başlık düzeyi ve numarası, paragraf stili, hizalama, girinti, satır
  aralığı, kalın/italik/altı çizili/üst simge parçaları, tablolar,
  dipnotlar. Uzun metinler kısa bir parmak iziyle tutulur ki referans
  dosyası okunabilir kalsın ve fark çıktığında hangi paragraf olduğu
  görülsün.

  Bağımlılık yok (yalnızca node:crypto); Word dosyası JSZip ile açılıp
  buraya XML olarak verilir. Hem tests/editor/cikti-referans.test.ts hem
  de tarayıcıdan indirilen dosyayı özetleyen betik
  (scripts/onizleme/cikti-kabul.mjs) bu dosyayı kullanır: iki yol aynı
  özetleyiciyi kullanmazsa biri ötekinin hatasını örter.
*/
import { createHash } from "node:crypto";

const iz = (s) => createHash("sha1").update(s).digest("hex").slice(0, 10);
/** Metin: kısa olduğunda kendisi, uzunsa baş + uzunluk + parmak izi. */
export function metinOzeti(s) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= 80 ? t : `${t.slice(0, 60)}… [${t.length}·${iz(t)}]`;
}

const VARLIK = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };
const coz = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tam, v) =>
    v[0] === "#" ? String.fromCodePoint(v[1] === "x" || v[1] === "X" ? parseInt(v.slice(2), 16) : parseInt(v.slice(1), 10)) : (VARLIK[v] ?? tam)
  );

/** Ardışık aynı biçimli parçaları birleştirir: [["b,i", uzunluk], …] */
function parcala(parcalar) {
  const out = [];
  for (const [bicim, metin] of parcalar) {
    if (!metin) continue;
    const son = out[out.length - 1];
    if (son && son[0] === bicim) son[1] += metin.length;
    else out.push([bicim, metin.length]);
  }
  // Yalnızca düz metinden oluşan paragrafta biçim listesi gürültüdür.
  return out.length === 1 && out[0][0] === "" ? [] : out;
}

/* ---------------------------------------------------------------- Word */

const ozn = (xml, ad) => {
  const m = xml.match(new RegExp(`<${ad}\\b([^>]*)/?>`));
  if (!m) return null;
  const o = {};
  for (const [, k, v] of m[1].matchAll(/w:([A-Za-z]+)="([^"]*)"/g)) o[k] = v;
  return o;
};

function runBicimi(rPr) {
  if (!rPr) return "";
  const b = [];
  if (/<w:b\/>|<w:b w:val="(true|1)"\/>/.test(rPr)) b.push("b");
  if (/<w:i\/>|<w:i w:val="(true|1)"\/>/.test(rPr)) b.push("i");
  const u = rPr.match(/<w:u w:val="([^"]+)"/);
  if (u && u[1] !== "none") b.push("u");
  if (/<w:strike\/>/.test(rPr)) b.push("s");
  const va = rPr.match(/<w:vertAlign w:val="([^"]+)"/);
  if (va) b.push(va[1] === "superscript" ? "sup" : va[1] === "subscript" ? "sub" : va[1]);
  return b.join(",");
}

function wordParagrafi(p) {
  const pPr = (p.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/) || [])[1] || "";
  const stil = ozn(pPr, "w:pStyle")?.val ?? null;
  const jc = ozn(pPr, "w:jc")?.val ?? null;
  const ind = ozn(pPr, "w:ind");
  const sp = ozn(pPr, "w:spacing");
  const num = /<w:numPr>/.test(pPr) ? Number(ozn(pPr, "w:ilvl")?.val ?? 0) : null;
  const parcalar = [];
  const dipnotlar = [];
  let sayfaSonu = /<w:pageBreakBefore\/>/.test(pPr);
  for (const [r] of p.matchAll(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g)) {
    const rPr = (r.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || [])[1];
    const fn = r.match(/<w:footnoteReference w:id="(\d+)"/);
    if (fn) dipnotlar.push(Number(fn[1]));
    if (/<w:br w:type="page"\/>/.test(r)) sayfaSonu = true;
    let metin = "";
    for (const [, , t] of r.matchAll(/<w:(t|delText)\b[^>]*>([\s\S]*?)<\/w:\1>/g)) metin += coz(t);
    if (/<w:tab\/>/.test(r)) metin += "\t";
    if (/<w:br\/>/.test(r)) metin += "\n";
    parcalar.push([runBicimi(rPr), metin]);
  }
  const metin = parcalar.map((x) => x[1]).join("");
  const o = { metin: metinOzeti(metin) };
  if (stil) o.stil = stil;
  if (jc) o.hiza = jc;
  if (ind) o.girinti = ind;
  if (sp && (sp.line || sp.lineRule)) o.aralik = `${sp.line ?? ""}${sp.lineRule ? "/" + sp.lineRule : ""}`;
  if (num !== null) o.liste = num;
  if (sayfaSonu) o.sayfaSonu = true;
  const bicim = parcala(parcalar);
  if (bicim.length) o.bicim = bicim;
  if (dipnotlar.length) o.dipnot = dipnotlar;
  return o;
}

/** document.xml (+ footnotes.xml) → yapısal özet. */
export function wordOzeti(documentXml, footnotesXml = "") {
  const govde = (documentXml.match(/<w:body>([\s\S]*)<\/w:body>/) || [])[1] || "";
  const bloklar = [];
  // Tablolar paragraflardan önce ayrılır: hücredeki paragraf ana akışta sayılmasın.
  const tablolar = [];
  const tablosuz = govde.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) => {
    tablolar.push(tbl);
    return `<w:tablo n="${tablolar.length - 1}"/>`;
  });
  for (const [blok] of tablosuz.matchAll(/<w:tablo n="\d+"\/>|<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)) {
    if (blok.startsWith("<w:tablo")) {
      const tbl = tablolar[Number(blok.match(/\d+/)[0])];
      const satirlar = [...tbl.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)].map(([tr]) => [...tr.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].length);
      const metin = [...tbl.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => coz(m[1])).join(" ");
      bloklar.push({ tablo: { satir: satirlar.length, hucre: satirlar, metin: metinOzeti(metin) } });
    } else if (blok.endsWith("/>")) {
      bloklar.push({ metin: "" });
    } else {
      bloklar.push(wordParagrafi(blok));
    }
  }
  const dipnotlar = [];
  for (const [, id, fn] of footnotesXml.matchAll(/<w:footnote\b[^>]*w:id="(-?\d+)"[^>]*>([\s\S]*?)<\/w:footnote>/g)) {
    if (Number(id) <= 0) continue; // ayraç ve devam dipnotları
    const metin = [...fn.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => coz(m[1])).join("");
    dipnotlar.push({ id: Number(id), metin: metinOzeti(metin) });
  }
  const resim = (documentXml.match(/<w:drawing>/g) || []).length;
  const bolum = (documentXml.match(/<w:sectPr\b/g) || []).length;
  return { bloklar, dipnotlar, resim, bolum };
}

/* ---------------------------------------------------------------- HTML */

const BLOK = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "td", "th", "figcaption", "blockquote", "pre"]);
const SATIR = { strong: "b", b: "b", em: "i", i: "i", u: "u", s: "s", sup: "sup", sub: "sub", a: "a", code: "code" };

function stilAyikla(attrs) {
  const o = {};
  const cls = attrs.match(/\bclass="([^"]*)"/);
  if (cls && cls[1].trim()) o.sinif = cls[1].trim().split(/\s+/).sort().join(" ");
  const st = attrs.match(/\bstyle="([^"]*)"/);
  if (st && st[1].trim()) {
    o.stil = st[1]
      .split(";")
      .map((x) => x.trim().replace(/\s*:\s*/, ":"))
      .filter(Boolean)
      .sort()
      .join(";");
  }
  for (const ad of ["data-numara", "data-level", "colspan", "rowspan", "start"]) {
    const m = attrs.match(new RegExp(`\\b${ad}="([^"]*)"`));
    if (m) o[ad] = m[1];
  }
  return o;
}

/** Yazdırma HTML'i (+ ayrı dipnot listesi) → yapısal özet. */
export function htmlOzeti(html, dipnotlar = []) {
  const bloklar = [];
  let acik = null; // { etiket, oz, parcalar }
  const satirYigini = [];
  let sayfaSonuBekliyor = false;
  let tablo = null;
  let liDerinlik = 0;
  let alintiDerinlik = 0;
  const kapat = () => {
    if (!acik) return;
    const metin = acik.parcalar.map((x) => x[1]).join("");
    if (tablo) {
      // Word özetiyle aynı: hücre paragrafları ana akışta sayılmaz, tablonun metnine girer.
      tablo.metinler.push(metin);
      acik = null;
      return;
    }
    const o = { etiket: acik.etiket, ...acik.oz, metin: metinOzeti(metin) };
    if (liDerinlik > 0) o.liste = liDerinlik - 1;
    if (alintiDerinlik > 0) o.alinti = true;
    const bicim = parcala(acik.parcalar);
    if (bicim.length) o.bicim = bicim;
    if (acik.dipnot.length) o.dipnot = acik.dipnot;
    if (sayfaSonuBekliyor) { o.sayfaSonu = true; sayfaSonuBekliyor = false; }
    bloklar.push(o);
    acik = null;
  };
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    const [, kapanis, etiketHam, attrs = "", , metin] = m;
    if (metin !== undefined) {
      if (acik) acik.parcalar.push([satirYigini.map((x) => SATIR[x]).filter(Boolean).sort().join(","), coz(metin)]);
      continue;
    }
    const etiket = etiketHam.toLowerCase();
    if (etiket === "table") {
      if (!kapanis) { kapat(); tablo = { satir: 0, hucre: [], metinler: [] }; }
      else if (tablo) {
        kapat();
        const { metinler, ...t } = tablo;
        tablo = null;
        bloklar.push({ tablo: { ...t, metin: metinOzeti(metinler.join(" ")) } });
      }
      continue;
    }
    if (tablo && etiket === "tr" && !kapanis) { tablo.satir++; tablo.hucre.push(0); continue; }
    if (tablo && (etiket === "td" || etiket === "th") && !kapanis) tablo.hucre[tablo.hucre.length - 1]++;
    if (etiket === "img" && !kapanis) { kapat(); bloklar.push({ resim: true }); continue; }
    if (etiket === "br") { if (acik) acik.parcalar.push(["", "\n"]); continue; }
    if (/class="[^"]*(sayfa-sonu|page-break)/.test(attrs) || /break-(before|after):\s*page/.test(attrs)) sayfaSonuBekliyor = true;
    if (BLOK.has(etiket)) {
      if (!kapanis) {
        // Alıntı bloğu bir kap: içindeki paragraflar kendi blokları olarak sayılır.
        if (etiket === "blockquote") { kapat(); alintiDerinlik++; continue; }
        // Liste maddesi ve tablo hücresi kap: içerikleri <p> olarak geliyor.
        if (etiket === "li") { kapat(); liDerinlik++; continue; }
        if (etiket === "td" || etiket === "th") { kapat(); continue; }
        kapat();
        acik = { etiket, oz: stilAyikla(attrs), parcalar: [], dipnot: [] };
      } else if (etiket === "blockquote") {
        kapat();
        alintiDerinlik = Math.max(0, alintiDerinlik - 1);
      } else if (etiket === "li") {
        kapat();
        liDerinlik = Math.max(0, liDerinlik - 1);
      } else if (acik && acik.etiket === etiket) {
        kapat();
      }
      continue;
    }
    if (SATIR[etiket]) {
      if (!kapanis) {
        satirYigini.push(etiket);
        const dn = attrs.match(/href="#(?:fn|dipnot)-?(\d+)"/);
        if (etiket === "a" && dn && acik) acik.dipnot.push(Number(dn[1]));
      } else {
        const i = satirYigini.lastIndexOf(etiket);
        if (i >= 0) satirYigini.splice(i, 1);
      }
    }
  }
  kapat();
  return { bloklar, dipnotlar: dipnotlar.map((d, i) => ({ id: i + 1, metin: metinOzeti(String(d).replace(/<[^>]+>/g, "")) })) };
}

/* ------------------------------------------------------ anlam denetimleri */

/** Özetteki başlıklar, sırayla: [{ duzey, metin }] (Word: Heading1…, HTML: h1…). */
export function basliklar(ozet) {
  return ozet.bloklar
    .map((b) => {
      const d = b.etiket?.match(/^h([1-6])$/)?.[1] ?? b.stil?.match(/^Heading([1-6])$/)?.[1];
      return d ? { duzey: Number(d), metin: b.metin } : null;
    })
    .filter(Boolean);
}

/** Özetin bütün görünür metni (kısaltılmamış metin için kaynağa bakılmalı). */
export const ozetMetni = (ozet) => ozet.bloklar.map((b) => b.metin ?? b.tablo?.metin ?? "").join("\n");
