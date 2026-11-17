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

/*
  PREMIUM ÇALIŞMA ALANI (17.11.2026, onaylı tasarım): öğrencinin ana
  sayfası iki bölüm — "Çalışmanıza devam edin" ve "Son kaynaklar".
  Eskiden (Phase 4) burada ölçüler, ilerleme çubukları ve "Teslim için
  kalanlar" vardı; o testler (uydurma yüzde yok, tam liste) artık çalışma
  özetini (calisma-durum-karti.tsx) ilgilendiriyor ve bu dosyada değil.
*/
describe("tek birincil eylem", () => {
  test("öğrenci görünümünde yalnızca bir birincil düğme var: Yazmaya devam et", () => {
    const kod = yorumsuz(ogrenci);
    assert.equal(kod.match(/tur="birincil"/g)?.length, 1);
    assert.doesNotMatch(kod, /projects-primary-button/);
    assert.match(kod, /tur="birincil">\s*<PenLine[^>]*\/>\s*\{resumeStats \? t\(\{ tr: "Yazmaya devam et"/);
  });
  test("boş hesapta da tek birincil: İlk çalışmayı oluştur", () => {
    const bas = sayfa.slice(sayfa.indexOf("{yeniKullanici ? ("), sayfa.indexOf(") : ogrenciGorunumu && resume ? ("));
    assert.equal(yorumsuz(bas).match(/tur="birincil"/g)?.length, 1);
  });
});

describe("sade ana sayfa: yalnızca devam ve son kaynaklar", () => {
  test("ölçüler, araç ızgarası ve abonelik kartı öğrenci ana sayfasında yok", () => {
    const kod = yorumsuz(ogrenci);
    for (const yok of ["os5-ana-olcu", "os5-ana-arac", "AbonelikOzetKarti", "RitimKarti", "DanismanaGonder", "TeslimTarihiFormu"]) {
      assert.doesNotMatch(kod, new RegExp(yok), yok);
    }
  });
  test("ayrıntılara giden yol açık: çalışma özeti bağlantısı ve son kaynaklarda kütüphane", () => {
    assert.match(ogrenci, /href=\{calismaAdresi\(resume\.id\)\}/);
    assert.match(ogrenci, /\/dashboard\/literature\?calisma=/);
  });
  test("son kaynaklar okunamazsa 'kaynak yok' çizilmez, uyarı çıkar", () => {
    assert.match(ogrenci, /\{sonKaynakHatasi \? \(/);
  });
  test("çok çalışmalı öğrenci: en fazla üç çalışma daha, tamamı Çalışmalarım'da", () => {
    assert.match(sayfa, /const sonrakiCalismalar = resume \? activeProjects\.filter\(\(p\) => p\.id !== resume\.id\)\.slice\(0, 3\) : \[\];/);
  });
  test("Danışmanıma gönder kartı çalışma özetine taşındı (bireysel abone)", () => {
    const ozet = oku("app/dashboard/editor/page.tsx");
    assert.match(ozet, /\{secili && gorunum\.bireysel \? \(\s*<DanismanaGonder /);
  });
});

describe("veri modeli ve sorgular", () => {
  test("yeni tablo ya da RPC okunmuyor; kaldırılan kartların sorguları da yok", () => {
    const tablolar = new Set([...sayfa.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]));
    const izinli = ["project_manuscripts", "literature_sources", "citation_checks", "consultancy_requests", "app_support_requests", "profiles", "manuscript_comments", "document_uploads", "tablo"];
    for (const t of tablolar) assert.ok(izinli.includes(t), `beklenmeyen tablo: ${t}`);
    const rpc = new Set([...sayfa.matchAll(/\.rpc\("([a-z_]+)"/g)].map((m) => m[1]));
    assert.deepEqual([...rpc].sort(), ["calisma_hareketlerim", "yazim_ritmi"]);
  });
  test("sunucu eylemi çağrısı eklenmedi", () => {
    assert.doesNotMatch(sayfa, /from "@\/app\/actions\/(?!projects|profile|geri-bildirim)/);
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
