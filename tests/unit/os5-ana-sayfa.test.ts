import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/*
  Signature OS 5 / Phase 4: öğrencinin ana sayfası. Sayfa sunucu
  bileşeni ve Supabase'e bağlı; burada kaynak metni üzerinden kurum
  sahibinin kuralları sabitleniyor:
   - tek birincil eylem,
   - ilerleme yalnızca gerçek veriden (uydurma yüzde yok),
   - yeni metrik ya da yeni sorgu yok,
   - stil yalnızca ana sayfaya dokunuyor.
  Tarayıcı kabulü (taşma, klavye, uzun başlık, boş hesap, çoklu çalışma):
  PR açıklamasındaki ölçümler.
*/

const oku = (yol: string) => readFileSync(yol, "utf8");
const yorumsuz = (m: string) => m.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const sayfa = oku("app/dashboard/page.tsx");
const ogrenci = sayfa.slice(sayfa.indexOf(") : ogrenciGorunumu && resume ? ("), sayfa.indexOf("<SeriKarti"));

describe("tek birincil eylem", () => {
  test("öğrenci görünümünde yalnızca bir birincil düğme var: Yazmaya devam et", () => {
    const kod = yorumsuz(ogrenci);
    assert.equal(kod.match(/tur="birincil"/g)?.length, 1);
    assert.doesNotMatch(kod, /projects-primary-button/);
    assert.match(kod, /tur="birincil">\s*<PenLine[^>]*\/>\s*\{resumeStats \? t\(\{ tr: "Yazmaya devam et"/);
  });
  test("ritim kartı ana sayfada ikinci 'Yazmaya devam et' bağlantısı çizmiyor", () => {
    assert.match(ogrenci, /<RitimKarti ritim=\{ritim\} \/>/);
  });
  test("boş hesapta da tek birincil: İlk çalışmayı oluştur", () => {
    const bas = sayfa.slice(sayfa.indexOf("{yeniKullanici ? ("), sayfa.indexOf(") : ogrenciGorunumu && resume ? ("));
    assert.equal(yorumsuz(bas).match(/tur="birincil"/g)?.length, 1);
  });
});

describe("ilerleme yalnızca gerçek veriden", () => {
  test("yazılan çubuğu yalnızca kılavuz hedefi varken (yazilanYuzde)", () => {
    assert.match(ogrenci, /\{yazilanYuzde !== null \? \(\s*<div className="os5-ana-cubuk" role="progressbar" aria-valuenow=\{yazilanYuzde\}/);
    assert.match(sayfa, /const yazilanYuzde = tempo \?/);
  });
  test("hazırlık çubuğu teslim kontrol listesinin done/total değerlerinden", () => {
    assert.match(ogrenci, /aria-valuenow=\{resumeReadiness\.done\}/);
    assert.match(ogrenci, /aria-valuemax=\{resumeReadiness\.total\}/);
  });
  test("sabit ya da uydurma yüzde yok", () => {
    assert.doesNotMatch(yorumsuz(ogrenci), /--w": `\d+%`|aria-valuenow=\{\d+\}/);
  });
});

describe("veri modeli ve sorgular değişmedi", () => {
  test("yeni tablo ya da RPC okunmuyor", () => {
    const tablolar = new Set([...sayfa.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]));
    const izinli = ["project_manuscripts", "literature_sources", "citation_checks", "consultancy_requests", "app_support_requests", "profiles", "manuscript_comments", "kanit_kayitlari", "manuscript_share_links"];
    for (const t of tablolar) assert.ok(izinli.includes(t) || t === "document_uploads" || t === "tablo", `beklenmeyen tablo: ${t}`);
    const rpc = new Set([...sayfa.matchAll(/\.rpc\("([a-z_]+)"/g)].map((m) => m[1]));
    assert.deepEqual([...rpc].sort(), ["ai_kredi_durumum", "calisma_hareketlerim", "yazim_ritmi"]);
  });
  test("sunucu eylemi çağrısı eklenmedi", () => {
    assert.doesNotMatch(sayfa, /from "@\/app\/actions\/(?!projects|profile|geri-bildirim|tez-takvimi)/);
  });
});

describe("ana sayfa stili yalnızca .os5-ana altında", () => {
  const css = oku("app/styles/os5-ana-sayfa.css").replace(/\/\*[\s\S]*?\*\//g, "");
  const seciciler = [...css.matchAll(/(^|[{}])\s*([^{}@]+?)\s*\{/g)].map((m) => m[2].trim()).filter((s) => s && !/^(to|from|\d+%)$/.test(s));
  test("her seçici os5-ana önekli", () => {
    assert.ok(seciciler.length > 30);
    for (const s of seciciler) for (const p of s.split(",")) assert.match(p, /\.os5-ana/, `ana sayfaya bağlı olmayan seçici: ${p.trim()}`);
  });
  test("ham renk yok, en küçük yazı 11 px, azaltılmış hareket karşılığı var", () => {
    assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(/i);
    for (const m of css.matchAll(/font-size:\s*(\d+)px/g)) assert.ok(Number(m[1]) >= 11);
    assert.match(css, /prefers-reduced-motion: reduce/);
  });
  test("os5-ana yalnızca öğrenci ve boş hesap görünümüne verilir (personel ana sayfası değişmez)", () => {
    assert.match(sayfa, /className=\{ogrenciGorunumu \|\| yeniKullanici \? "dashboard-page gb gb-ana-sayfa os5-ana" : "dashboard-page gb gb-ana-sayfa"\}/);
  });
});

describe("bağımsız incelemede yakalananlar (Phase 4 kabulü)", () => {
  const css = oku("app/styles/os5-ana-sayfa.css").replace(/\/\*[\s\S]*?\*\//g, "");
  test("'Şimdi' satırının aciliyet seçicileri lib/siradaki-is.ts'teki değerlerle aynı", () => {
    const tip = oku("lib/siradaki-is.ts").match(/export type Aciliyet = ([^;]+);/)?.[1] ?? "";
    const degerler = [...tip.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
    assert.ok(degerler.includes("yaklasiyor") && degerler.includes("acil"));
    const css5 = [...css.matchAll(/\.os5-ana-simdi\[data-aciliyet="([a-z]+)"\]/g)].map((m) => m[1]);
    assert.ok(css5.length >= 2);
    for (const d of css5) assert.ok(degerler.includes(d), `CSS'te var olmayan aciliyet: ${d}`);
    assert.ok(css5.includes("yaklasiyor") && css5.includes("acil"));
  });
  test("gecikmiş kilometre taşı ayrı tonda", () => {
    assert.match(css, /\.os5-ana-satir\[data-durum="gecikti"\]/);
  });
  test("'Teslim için kalanlar' tam listeden kuruluyor; fazlası notla ve bağlantıyla söyleniyor", () => {
    assert.match(sayfa, /const teslimKalanlariTam = \[\s*\.\.\.readinessGaps\.map/);
    assert.match(sayfa, /const teslimKalanSayisi = teslimKalanlariTam\.length;/);
    assert.match(sayfa, /teslimKalanSayisi > teslimKalanlari\.length \? t\(\{ tr: `ilk \$\{teslimKalanlari\.length\} gösteriliyor`/);
    assert.match(sayfa, /href=\{teslimKalanSayisi > teslimKalanlari\.length \? `\/dashboard\/editor\/\$\{resume\.id\}\/write\?teslim=liste`/);
  });
});
