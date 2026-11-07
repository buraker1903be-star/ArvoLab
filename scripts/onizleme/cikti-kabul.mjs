/*
  GERÇEK ÇIKTI KABUL TESTİ — Word ve PDF (R0, 07.11.2026).

  tests/editor/cikti-referans.test.ts çıktı KÜTÜPHANESİNİ (lib/tiptap-docx,
  lib/tiptap-html) referans sürümle karşılaştırıyor. Bu betik kullanıcının
  eline geçen DOSYAYI karşılaştırır:
    • Word: editördeki "İndir → Word (.docx)" düğmesinden inen dosya —
      belge editörden, kapak/kenar boşluğu/sayfa ayarı çalışmadan gelir.
    • PDF: /print/manuscript/[id] sayfasını Chromium'un yazdırma
      motoruyla basmak (kullanıcının "PDF olarak kaydet"i). Sayfa düzeni
      yalnızca burada görünür: hangi başlığın hangi sayfaya düştüğü,
      sayfa sayısı, kaybolan bir bölüm.
  İkisi de aynı özetleyiciden geçer (tests/editor/cikti-ozet.mjs).

  Referans, Phase 4.5'ten önceki ürün sürümünde (d12de9f) üretildi:
  o sürümün önizlemesi ayrı bir porta açılır ve betik `--referans-yaz`
  ile çalıştırılır. Kullanım:
    ONIZLEME_YAZ=1 npm run onizleme:ai        (ya da npm run onizleme)
    NODE_PATH=$(npm root -g) node scripts/onizleme/cikti-kabul.mjs [taban-adres] [--referans-yaz]
  Bir denetim düşerse çıkış kodu 1.

  Önizleme verisi YAZMA kipinde değişebilir (başka bir betik belgeye
  yazdıysa çıktı da değişir): karşılaştırmadan önce sunucuyu yeniden
  başlatın. Belge kimliği sabit (önizleme tezi).
*/
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const projeIste = createRequire(join(KOK, "package.json"));
const JSZip = projeIste("jszip");
const { wordOzeti, basliklar, metinOzeti } = await import(pathToFileURL(join(KOK, "tests/editor/cikti-ozet.mjs")).href);
const { PDFParse } = await import(pathToFileURL(projeIste.resolve("pdf-parse")).href);

const argumanlar = process.argv.slice(2);
const TABAN = argumanlar.find((a) => !a.startsWith("--")) ?? "http://localhost:3123";
const YAZ = argumanlar.includes("--referans-yaz");
const TEZ = "00000000-0000-4000-8000-0000000000b1";
const REF = join(KOK, "scripts/onizleme/referans");
const fikstur = JSON.parse(readFileSync(join(KOK, "tests/fixtures/tez-enflasyon-issizlik.json"), "utf8"));

let hata = 0;
const bekle = (kosul, mesaj) => {
  if (!kosul) hata++;
  console.log(`${kosul ? "✓" : "✗"} ${mesaj}`);
};

/* Kaynak belgedeki başlıklar ve metin içi atıflar (cikti-referans.test.ts ile aynı kural). */
const kaynakBasliklari = [];
(function gez(n) {
  if (n.type === "heading") kaynakBasliklari.push({ duzey: n.attrs.level, metin: (n.content ?? []).map((c) => c.text ?? "").join("").trim() });
  (n.content ?? []).forEach(gez);
})(fikstur);
const kaynakMetin = JSON.stringify(fikstur).match(/"text":"((?:[^"\\]|\\.)*)"/g).map((m) => JSON.parse(m.slice(7))).join(" ");
const atiflar = [...new Set([...kaynakMetin.matchAll(/\(([A-ZÇĞİÖŞÜ][^()]{0,80}?,\s*\d{4}[a-z]?(?:,\s*s\.\s*[\d–-]+)?)\)/g)].map((m) => m[1]))];
const duz = (s) => s.replace(/\s+/g, " ").replace(/-\s+/g, "-").trim();

const tarayici = await chromium.launch();
const ozet = {};

/* ---- Word: editörün indirme düğmesi ---- */
{
  const baglam = await tarayici.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const sayfa = await baglam.newPage();
  await sayfa.goto(`${TABAN}/dashboard/editor/${TEZ}/write`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.locator(".ProseMirror").waitFor({ timeout: 30000 });
  await sayfa.locator('[aria-label="Word, PDF ya da LaTeX olarak indir"], [title="Word, PDF ya da LaTeX olarak indir"]').first().click();
  const [indirme] = await Promise.all([
    sayfa.waitForEvent("download", { timeout: 60000 }),
    sayfa.locator(".arac-menu-pencere:not([hidden]) button", { hasText: "Word (.docx)" }).first().click(),
  ]);
  const yol = await indirme.path();
  const zip = await JSZip.loadAsync(readFileSync(yol));
  const xml = await zip.file("word/document.xml").async("string");
  const fn = (await zip.file("word/footnotes.xml")?.async("string")) ?? "";
  ozet.word = { dosya: indirme.suggestedFilename(), ...wordOzeti(xml, fn) };
  const ham = [...(xml + fn).matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join("").replace(/&amp;/g, "&");

  const b = basliklar(ozet.word);
  bekle(b.length === kaynakBasliklari.length, `Word: ${b.length}/${kaynakBasliklari.length} başlık`);
  bekle(b.every((x, i) => x.duzey === kaynakBasliklari[i]?.duzey), "Word: başlık düzeyleri sırasıyla aynı");
  const eksikAtif = atiflar.filter((a) => !ham.includes(a));
  bekle(atiflar.length > 0 && eksikAtif.length === 0, `Word: ${atiflar.length - eksikAtif.length}/${atiflar.length} metin içi atıf${eksikAtif.length ? " — eksik: " + eksikAtif.slice(0, 3).join(" | ") : ""}`);
  const kaynakca = ozet.word.bloklar.findIndex((x) => /Kaynak(ça|lar)$/.test(x.metin ?? ""));
  bekle(kaynakca >= 0 && ozet.word.bloklar.slice(kaynakca + 1).filter((x) => /\(\d{4}[a-z]?\)/.test(x.metin ?? "")).length >= 3, "Word: Kaynakça başlığı ve satırları var");
  bekle(ozet.word.bloklar.filter((x) => x.tablo).length === 14, `Word: ${ozet.word.bloklar.filter((x) => x.tablo).length}/14 tablo`);
  await baglam.close();
}

/* ---- PDF: yazdırma sayfası, Chromium'un yazdırma motoru ---- */
{
  const sayfa = await tarayici.newPage();
  // Sayfa açılınca kendiliğinden window.print() çağırıyor; başsız tarayıcıda etkisiz ama yine de kapat.
  await sayfa.addInitScript(() => { window.print = () => {}; });
  await sayfa.goto(`${TABAN}/print/manuscript/${TEZ}`, { waitUntil: "networkidle", timeout: 150000 });
  await sayfa.emulateMedia({ media: "print" });
  const pdf = await sayfa.pdf({ preferCSSPageSize: true, printBackground: true });
  const ayr = new PDFParse({ data: new Uint8Array(pdf) });
  const sonuc = await ayr.getText();
  await ayr.destroy();
  const sayfalar = sonuc.pages.map((s) => duz(s.text));
  ozet.pdf = {
    sayfa: sayfalar.length,
    // Her sayfanın ilk satırı + metin parmak izi: hangi sayfanın kaydığı okunabilsin.
    sayfalar: sayfalar.map((t, i) => ({ no: i + 1, metin: metinOzeti(t) })),
    // Başlıkların düştüğü sayfa: düzen değişikliğinin en okunur izi. Her
    // başlık bir öncekinin sayfasından İTİBAREN aranır: ana bölüm adları
    // İçindekiler sayfasında da geçiyor ve ilk eşleşme oraya düşüyordu.
    basliklar: (() => {
      let bas = 0;
      return kaynakBasliklari.map((b) => {
        const i = sayfalar.findIndex((t, no) => no >= bas && t.includes(duz(b.metin)));
        if (i >= 0) bas = i;
        return { metin: b.metin, sayfa: i >= 0 ? i + 1 : null };
      });
    })(),
  };
  const tum = sayfalar.join(" ");
  const kayip = ozet.pdf.basliklar.filter((b) => b.sayfa === null);
  bekle(kayip.length === 0, `PDF: ${kaynakBasliklari.length - kayip.length}/${kaynakBasliklari.length} başlık, belgedeki sırasıyla bulundu${kayip.length ? " — yok ya da sıra dışı: " + kayip.slice(0, 3).map((b) => b.metin).join(" | ") : ""}`);
  const eksikAtif = atiflar.filter((a) => !tum.includes(duz(a)));
  bekle(eksikAtif.length === 0, `PDF: ${atiflar.length - eksikAtif.length}/${atiflar.length} metin içi atıf${eksikAtif.length ? " — eksik: " + eksikAtif.slice(0, 3).join(" | ") : ""}`);
  bekle(/Kaynak(ça|lar)/.test(tum), "PDF: Kaynakça var");
}
await tarayici.close();

/* ---- referansla karşılaştırma ---- */
mkdirSync(REF, { recursive: true });
for (const ad of ["word", "pdf"]) {
  const dosya = join(REF, `tez-${ad}.json`);
  const yeni = ozet[ad];
  if (YAZ) {
    writeFileSync(dosya, JSON.stringify(yeni, null, 1) + "\n");
    console.log(`• referans yazıldı: ${dosya}`);
    continue;
  }
  if (!existsSync(dosya)) {
    bekle(false, `${ad}: referans yok (${dosya}) — referans sürümde --referans-yaz ile üretin`);
    continue;
  }
  const eski = JSON.parse(readFileSync(dosya, "utf8"));
  if (ad === "word") {
    const n = Math.max(eski.bloklar.length, yeni.bloklar.length);
    const farkli = [];
    for (let i = 0; i < n; i++) if (JSON.stringify(eski.bloklar[i]) !== JSON.stringify(yeni.bloklar[i])) farkli.push(i);
    bekle(farkli.length === 0, `Word: yapı referansla aynı (${n} blok)${farkli.length ? ` — ${farkli.length} blok farklı, ilki #${farkli[0]}: ${JSON.stringify(eski.bloklar[farkli[0]])?.slice(0, 120)} → ${JSON.stringify(yeni.bloklar[farkli[0]])?.slice(0, 120)}` : ""}`);
    bekle(JSON.stringify(eski.dipnotlar) === JSON.stringify(yeni.dipnotlar) && eski.resim === yeni.resim && eski.bolum === yeni.bolum, "Word: dipnot, resim ve bölüm sayısı aynı");
  } else {
    bekle(eski.sayfa === yeni.sayfa, `PDF: sayfa sayısı ${yeni.sayfa} (referans ${eski.sayfa})`);
    const kayan = yeni.basliklar.filter((b, i) => b.sayfa !== eski.basliklar[i]?.sayfa);
    bekle(kayan.length === 0, `PDF: başlıkların sayfaları referansla aynı${kayan.length ? " — kayan: " + kayan.slice(0, 3).map((b) => `${b.metin}→${b.sayfa}`).join(" | ") : ""}`);
    const farkSayfa = yeni.sayfalar.filter((s, i) => s.metin !== eski.sayfalar[i]?.metin).map((s) => s.no);
    bekle(farkSayfa.length === 0, `PDF: sayfa metinleri referansla aynı${farkSayfa.length ? " — farklı sayfalar: " + farkSayfa.slice(0, 8).join(", ") : ""}`);
  }
}

console.log(hata ? `\n${hata} denetim düştü` : "\nÇıktı kabulü temiz");
process.exit(hata ? 1 : 0);
