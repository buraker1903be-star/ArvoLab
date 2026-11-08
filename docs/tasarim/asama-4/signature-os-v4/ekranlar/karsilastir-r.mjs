#!/usr/bin/env node
/* V4.2R: eski v4 (ekran-goruntuleri/) ↔ revize v4 (ekran-goruntuleri-v42r/)
   yan yana; her görselin altında revizyon-olcum.json'dan ölçülen fark.
     node ekranlar/karsilastir-r.mjs */
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const KOK = path.dirname(new URL(import.meta.url).pathname);
const ESKI = path.resolve(KOK, "../ekran-goruntuleri");
const YENI = path.resolve(KOK, "../ekran-goruntuleri-v42r");
const CIKTI = path.resolve(KOK, "../karsilastirma-v42r");
fs.mkdirSync(CIKTI, { recursive: true });
const { eski: E, yeni: Y } = JSON.parse(fs.readFileSync(path.join(KOK, "revizyon-olcum.json"), "utf8"));
const ok = (a, b) => `${a} → <b>${b}</b>`;
// [ad, başlık, eski dosya, yeni dosya, telefon mu, ölçü satırları]
const ISLER = [
  ["1-editor-ai-masaustu", "Editör + Arvo AI · masaüstü", "08-editor-ai-1440", "08-editor-ai-1440", false, [
    `AI akışında kutu ${ok(E.edAiMasa.panelKutu, Y.edAiMasa.panelKutu)} (kalanlar istem balonları)`,
    `Panel aç/kapa: metin sütunu ${ok(`${E.edMasa.metinSutunu}/${E.edAiMasa.metinSutunu}`, `${Y.edMasa.metinSutunu}/${Y.edAiMasa.metinSutunu}`)} px · ilk paragraf ${ok(`${E.edMasa.p1Satir}/${E.edAiMasa.p1Satir}`, `${Y.edMasa.p1Satir}/${Y.edAiMasa.p1Satir}`)} satır (yeniden kırılma yok)`,
    "Tur yapısı: istem → önerilen metin (fark) → dayanak → karar; uyarı kenar notu"]],
  ["2-editor-ai-telefon", "Editör + Arvo AI · telefon", "09-editor-ai-390", "09-editor-ai-390", true, [
    `Alt sayfa ${ok(E.edAiTel.altSayfaYuksekligi, Y.edAiTel.altSayfaYuksekligi)} px · görünür belge ${ok(E.edAiTel.gorunurBelge, Y.edAiTel.gorunurBelge)} px`,
    `Örtü ${ok(E.edAiTel.ortu ? "var" : "yok", Y.edAiTel.ortu ? "var" : "yok")} · seçili cümle görünür ${ok(E.edAiTel.seciliCumleGorunur ? "evet" : "hayır", Y.edAiTel.seciliCumleGorunur ? "evet" : "hayır")}`,
    `AI akışında kutu ${ok(E.edAiTel.panelKutu, Y.edAiTel.panelKutu)} · karar dipte sabit`]],
  ["3-calismalarim-masaustu", "Çalışmalarım · masaüstü", "03-calismalarim-1440", "03-calismalarim-1440", false, [
    `Liste / ayrıntı ${ok(`${E.calMasa.listeGenislik}/${E.calMasa.ayrintiGenislik}`, `${Y.calMasa.listeGenislik}/${Y.calMasa.ayrintiGenislik}`)} px, tek bölünmüş yüzey`,
    `Yüzey dışında boşta kalan liste alanı ${ok(E.calMasa.yuzeyDisiBosluk, Y.calMasa.yuzeyDisiBosluk)} px (sahte içerik eklenmedi)`,
    `"Yeni çalışma": ${ok(E.calMasa.yeniCalismaYeri, Y.calMasa.yeniCalismaYeri)}`]],
  ["4-calismalarim-telefon", "Çalışmalarım · telefon", "04-calismalarim-390", "04-calismalarim-390", true, [
    `Satırda ≥44 px açık geçiş bölgesi ${ok(E.calTel390.acikGecisBolgesi, Y.calTel390.acikGecisBolgesi)} / ${Y.calTel390.satir}`,
    "Etkin çalışmada \"Sıradaki\" adım (gerçek veri)"]],
  ["5-calisma-ayrintisi-telefon", "Çalışma ayrıntısı · telefon", "05-calisma-ayrinti-390", "05-calisma-ayrinti-390", true, [
    `Kesik sekme 390 px: ${ok(E.ayrTel390.kesikSekme, Y.ayrTel390.kesikSekme)} · 360 px: ${ok(E.ayrTel360.kesikSekme, Y.ayrTel360.kesikSekme)}`,
    `Şerit kayıyor ${ok(E.ayrTel390.kayan ? "evet" : "hayır", Y.ayrTel390.kayan ? "evet" : "hayır")} · sıra masaüstü sekmeleriyle aynı`]],
  ["6-ana-sayfa-masaustu", "Ana Sayfa · masaüstü", "01-ana-sayfa-1440", "01-ana-sayfa-1440", false, [
    `Alt bölümde rozet ${ok(E.ana.altRozet, Y.ana.altRozet)} · anahtar-değer satırı ${ok(E.ana.anahtarDegerSatiri, Y.ana.anahtarDegerSatiri)} · ayar bloğu ${ok(E.ana.ayarBlogu, Y.ana.ayarBlogu)}`,
    `Eylem fiiliyle biten teslim maddesi ${ok(E.ana.eylemFiilliMadde, Y.ana.eylemFiilliMadde)} · alt bölüm ${ok(E.ana.altBolumYuksekligi, Y.ana.altBolumYuksekligi)} px · birincil ${Y.ana.birincil}`]],
  ["7-kaynak-kutuphanesi-masaustu", "Kaynak Kütüphanesi · masaüstü", "10-kaynaklar-1440", "10-kaynaklar-1440", false, [
    `PDF ekseninin satırlar arası x sapması ${ok(E.kay.pdfEkseniXSapma, Y.kay.pdfEkseniXSapma)} px · ortalama satır ${ok(E.kay.ortSatir, Y.kay.ortSatir)} px`,
    `Ayrıntı paneli ${ok(E.kay.panelYukseklik, Y.kay.panelYukseklik)} px · görünüme sığar ${ok(E.kay.panelGorunumeSigar ? "evet" : "hayır", Y.kay.panelGorunumeSigar ? "evet" : "hayır")} · iç kaydırma ${ok(E.kay.panelIcKaydirma ? "var" : "yok", Y.kay.panelIcKaydirma ? "var" : "yok")}`,
    `Kaynağa sor ${ok(E.kay.kaynagaSor, Y.kay.kaynagaSor)} yerde · PDF'i aç ${Y.kay.pdfAc} · doğrulama korunur`]],
];
const veri = (p) => `data:image/png;base64,${fs.readFileSync(p).toString("base64")}`;
const b = await chromium.launch();
for (const [ad, baslik, e, y, tel, olcu] of ISLER) for (const tema of ["acik", "koyu"]) {
  const s = await b.newPage({ viewport: { width: tel ? 1000 : 2000, height: 900 }, deviceScaleFactor: 1 });
  const acik = tema === "acik";
  await s.setContent(`<!doctype html><style>
    body{margin:0;padding:24px;background:${acik ? "#e7eaee" : "#05080d"};font:500 20px/1.4 Inter,system-ui,sans-serif;color:${acik ? "#15233a" : "#e4e9f0"}}
    h1{font-size:26px;margin:0 0 6px} ul{margin:0 0 18px;padding-left:22px;font-size:${tel ? 17 : 19}px} li b{color:${acik ? "#23457a" : "#7fa3e2"}}
    .cift{display:flex;gap:24px;align-items:flex-start} figure{margin:0;flex:1} figcaption{margin-bottom:8px;font-weight:600}
    img{width:100%;display:block;border:1px solid #8793a5}
  </style><h1>${baslik}</h1><ul>${olcu.map((o) => `<li>${o}</li>`).join("")}</ul>
  <div class="cift"><figure><figcaption>Eski v4 (V4.2)</figcaption><img src="${veri(path.join(ESKI, `${e}-${tema}.png`))}"/></figure><figure><figcaption>Revize v4 (V4.2R)</figcaption><img src="${veri(path.join(YENI, `${y}-${tema}.png`))}"/></figure></div>`);
  await s.waitForLoadState("load");
  await s.screenshot({ path: path.join(CIKTI, `${ad}-${tema}.png`), fullPage: true });
  await s.close();
}
// Hiza: revize editör, panel kapalı ↔ açık (aynı satır kırılmaları).
for (const tema of ["acik", "koyu"]) {
  const s = await b.newPage({ viewport: { width: 2000, height: 900 }, deviceScaleFactor: 1 });
  await s.setContent(`<!doctype html><style>body{margin:0;padding:24px;background:${tema === "acik" ? "#e7eaee" : "#05080d"};font:500 20px/1.4 Inter,system-ui,sans-serif;color:${tema === "acik" ? "#15233a" : "#e4e9f0"}}h1{font-size:26px;margin:0 0 6px}p{margin:0 0 18px;font-size:19px}.cift{display:flex;gap:24px}figure{margin:0;flex:1}figcaption{margin-bottom:8px;font-weight:600}img{width:100%;display:block;border:1px solid #8793a5}</style>
    <h1>Revize v4 · belge hizası: Arvo AI kapalı ↔ açık</h1><p>Kâğıt iki durumda da 760 px (metin ${Y.edMasa.metinSutunu} px); ilk paragraf ${Y.edMasa.p1Satir} / ${Y.edAiMasa.p1Satir} satır. Panel açılınca kâğıt yalnızca yer değiştirir, satırlar yeniden kırılmaz. Eski v4'te metin ${E.edMasa.metinSutunu} → ${E.edAiMasa.metinSutunu} px'e iniyor, paragraf ${E.edMasa.p1Satir} → ${E.edAiMasa.p1Satir} satıra çıkıyordu.</p>
    <div class="cift"><figure><figcaption>Panel kapalı</figcaption><img src="${veri(path.join(YENI, `06-editor-1440-${tema}.png`))}"/></figure><figure><figcaption>Panel açık</figcaption><img src="${veri(path.join(YENI, `08-editor-ai-1440-${tema}.png`))}"/></figure></div>`);
  await s.waitForLoadState("load");
  await s.screenshot({ path: path.join(CIKTI, `1b-editor-hiza-${tema}.png`), fullPage: true });
  await s.close();
}
await b.close();
console.log(`${ISLER.length * 2 + 2} karşılaştırma → ${CIKTI}`);
