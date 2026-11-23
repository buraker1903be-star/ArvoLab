import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSignificant, pHukmu } from "@/lib/apa-format";
import { tekrarliOlcumlerAnova } from "@/lib/stats-anova-ek";

/*
  KARMA ANOVA — GRUP İÇİ ZAMAN ETKİSİNİN RAPORLANMASI (23.11.2026).

  Etkileşim anlamlıysa her grup için ayrı bir tekrarlı ölçümler ANOVA'sı
  çalışıyor. İki kusur buradaydı:

  1. Küresellik gerektiğinde düzeltilmiş p yazılıyor ama F satırındaki
     PAY/PAYDA serbestlik dereceleri düzeltilmemiş kalıyordu: okuyan kişi
     "F(2, 14) = …, p(GG) = …" diye tutarsız bir satır raporluyordu.
  2. Düzeltme üretilemediğinde (tekil kovaryans) p yine de "anlamlı
     değil" tarafına düşüyordu — hiç hesaplanmamış bir test hakkında
     hüküm.

  BEKLENEN DEĞERLER ARVOLAB'IN KODUNDAN ÜRETİLMEDİ. pingouin ile ayrıca
  hesaplandı; üreten betik ve sürümler fixture'ın içinde:

    scripts/referans/grup-ici-zaman-referans.py
    tests/fixtures/grup-ici-zaman-referans.json

  Burada sınanan şey hesabın kendisi değil, EKRANA yazılan sayıların
  kuralı: df × ε ve aile içi Bonferroni (p × grup sayısı). Aynı kural
  gerçek arayüzde de sınanıyor (scripts/yerel-yigin/analiz-alani-kabul.mjs,
  S14f–S14h); burası CI'da koşan tarafı.
*/

type RefGrup = {
  grup: string;
  F: number;
  ddof1: number;
  ddof2: number;
  eps: number;
  p_GG: number;
  kuresellik_bozuk: boolean;
  beklenen_df1: number;
  beklenen_df2: number;
  beklenen_p_bonferroni: number;
};
type RefSet = { ad: string; olcumler: string[]; gruplar: string[]; grupSayisi: number; gruptaZaman: RefGrup[] };
const REFERANS = JSON.parse(readFileSync("tests/fixtures/grup-ici-zaman-referans.json", "utf8")) as {
  veriSetleri: RefSet[];
};
const referans = (ad: string) => {
  const s = REFERANS.veriSetleri.find((v) => v.ad === ad);
  assert.ok(s, `referans veri seti yok: ${ad}`);
  return s;
};

/* Kabul betiğindeki .tmp-s14uyg dosyasının sütunları (BİREBİR aynı olmalı). */
const GG_ON = [51, 58, 46, 47, 50, 52, 47, 49, 48, 59, 51, 51, 48, 51, 55, 53, 53, 54, 47, 44, 53, 46, 58, 43];
const GG_ARA = [58, 65, 51, 54, 54, 59, 53, 57, 55, 63, 55, 59, 50, 50, 56, 53, 52, 57, 49, 46, 54, 49, 59, 41];
const GG_SON = [73, 58, 51, 54, 56, 56, 68, 56, 70, 67, 67, 62, 54, 46, 56, 43, 55, 57, 47, 43, 53, 47, 57, 42];
const dilim = (d: number[], grup: string) => (grup === "deney" ? d.slice(0, 12) : d.slice(12));

/* Kabul betiğindeki .tmp-s14kismi dosyası: kontrolde "ara" ölçümü ön testle birebir aynı. */
const KISMI_ON_D = [51, 58, 46, 47, 50, 52, 47, 49, 48, 59, 51, 51];
const KISMI_ARA_D = [58, 65, 51, 54, 54, 59, 53, 57, 55, 63, 55, 59];
const KISMI_SON_D = [66, 70, 58, 61, 63, 64, 60, 65, 62, 72, 64, 67];
const KISMI_ON_K = [48, 51, 55, 53, 53, 54, 47, 44, 53, 46, 58, 43];

/*
  ARAYÜZDEKİ KURALIN BİREBİR KARŞILIĞI (data-analyzer.tsx, gruptaZaman).
  Kural tek yerde yazılı olmadığı için burada yeniden kuruluyor; sayılar
  ekranla aynı çıkmazsa ikisinden biri değişmiş demektir.
*/
function satir(olcumler: number[][], grupSayisi: number) {
  const ta = tekrarliOlcumlerAnova(olcumler);
  const cokOlcum = olcumler.length > 2;
  const ggGerekli = cokOlcum && (!ta.kuresellikDenetlendi || isSignificant(ta.mauchlyP));
  const ggVar = Number.isFinite(ta.ggEpsilon) && ta.ggEpsilon > 0 && Number.isFinite(ta.ggP);
  const ggUygulandi = ggGerekli && ggVar;
  const hamP = ggUygulandi ? ta.ggP : ggGerekli ? NaN : ta.p;
  return {
    f: ta.f,
    df1: ggUygulandi ? ta.df1 * ta.ggEpsilon : ta.df1,
    df2: ggUygulandi ? ta.df2 * ta.ggEpsilon : ta.df2,
    dfDuzeltildi: ggUygulandi,
    epsilon: ta.ggEpsilon,
    p: Number.isFinite(hamP) ? Math.min(1, hamP * grupSayisi) : NaN,
    ggUygulandi,
    duzeltmeBasarisiz: ggGerekli && !ggVar,
  };
}

describe("karma ANOVA: grup içi zaman etkisi", () => {
  test("GG uygulanınca serbestlik dereceleri de düzeltiliyor (referansla aynı)", () => {
    const set = referans("ggUygulanan");
    for (const ref of set.gruptaZaman) {
      const b = satir([dilim(GG_ON, ref.grup), dilim(GG_ARA, ref.grup), dilim(GG_SON, ref.grup)], set.grupSayisi);
      assert.ok(ref.kuresellik_bozuk, `${ref.grup}: referansta küresellik bozuk olmalı`);
      assert.equal(b.ggUygulandi, true, `${ref.grup}: GG uygulanmalı`);
      assert.equal(b.dfDuzeltildi, true, `${ref.grup}: sd düzeltilmiş işaretlenmeli`);
      assert.ok(Math.abs(b.f - ref.F) < 0.01, `${ref.grup}: F ${b.f} ≠ ${ref.F}`);
      assert.ok(Math.abs(b.epsilon - ref.eps) < 1e-6, `${ref.grup}: ε ${b.epsilon} ≠ ${ref.eps}`);
      /* Ekranda iki ondalık yazılıyor: referans da öyle yuvarlandı. */
      assert.equal(Number(b.df1.toFixed(2)), ref.beklenen_df1, `${ref.grup}: pay sd`);
      assert.equal(Number(b.df2.toFixed(2)), ref.beklenen_df2, `${ref.grup}: payda sd`);
      /* Düzeltilmiş sd düzeltilmemişten KÜÇÜK olmalı, yoksa düzeltme yazıdan ibarettir. */
      assert.ok(b.df1 < ref.ddof1 && b.df2 < ref.ddof2, `${ref.grup}: düzeltilmiş sd küçülmeli`);
    }
  });

  test("aile içi Bonferroni korunuyor: p × grup sayısı, 1'de kesiliyor", () => {
    const set = referans("ggUygulanan");
    for (const ref of set.gruptaZaman) {
      const b = satir([dilim(GG_ON, ref.grup), dilim(GG_ARA, ref.grup), dilim(GG_SON, ref.grup)], set.grupSayisi);
      assert.ok(
        Math.abs(b.p - ref.beklenen_p_bonferroni) < 1e-9,
        `${ref.grup}: Bonferroni p ${b.p} ≠ ${ref.beklenen_p_bonferroni}`,
      );
      /* Düzeltmesiz p ile karıştırılmadığı görülsün: ikisi farklı olmalı. */
      assert.ok(Math.abs(b.p - ref.p_GG) > 1e-12, `${ref.grup}: Bonferroni uygulanmamış`);
      assert.ok(b.p <= 1, "p 1'i geçmemeli");
    }
    /* Bu veri setinde iki grup karşıt hüküm veriyor: kural gerçekten çalışıyor. */
    const hukumler = set.gruptaZaman.map((ref) =>
      pHukmu(satir([dilim(GG_ON, ref.grup), dilim(GG_ARA, ref.grup), dilim(GG_SON, ref.grup)], set.grupSayisi).p),
    );
    assert.deepEqual([...hukumler].sort(), ["anlamli", "anlamsiz"]);
  });

  test("tekil kovaryansta p küçük de olsa sd düzeltmesi yazıya uyuyor", () => {
    const set = referans("tekilKovaryans");
    const on = [10, 12, 11, 14, 13, 15, 9, 12, 13, 11, 10, 14, 11, 13, 12, 15];
    const son = [12, 15, 13, 16, 15, 18, 11, 14, 16, 13, 12, 17, 13, 16, 14, 18];
    const cift = (d: number[], grup: string) => d.filter((_, i) => (i % 2 === 0) === (grup === "deney"));
    for (const ref of set.gruptaZaman) {
      const b = satir(
        [cift(on, ref.grup), cift(son, ref.grup), cift(on, ref.grup).map((v) => v + 3)],
        set.grupSayisi,
      );
      assert.equal(b.ggUygulandi, true, `${ref.grup}: Mauchly denetlenemedi, GG uygulanmalı`);
      assert.equal(Number(b.df1.toFixed(2)), ref.beklenen_df1);
      assert.equal(Number(b.df2.toFixed(2)), ref.beklenen_df2);
      assert.ok(Math.abs(b.p - ref.beklenen_p_bonferroni) < 1e-9);
    }
  });

  /*
    GG ÜRETİLEMEYEN GRUP. Eskiden isSignificant(NaN) false döndüğü için
    o satırda DÜZELTMESİZ p raporlanıyordu; şimdi hiç p üretilmiyor ve
    hüküm "hesaplanamadi" oluyor.
  */
  test("bir grupta GG üretilemezse p yok, hüküm yok; öteki grup bozulmuyor", () => {
    const kontrol = satir([KISMI_ON_K, KISMI_ON_K.slice(), KISMI_ON_K.map((v) => v + 2)], 2);
    assert.equal(kontrol.ggUygulandi, false);
    assert.equal(kontrol.duzeltmeBasarisiz, true, "üretilemediği işaretlenmeli");
    assert.equal(Number.isFinite(kontrol.p), false, "p üretilmemeli");
    assert.equal(pHukmu(kontrol.p), "hesaplanamadi");
    assert.equal(kontrol.dfDuzeltildi, false, "düzeltilmemiş sd düzeltilmiş gibi yazılmamalı");

    const deney = satir([KISMI_ON_D, KISMI_ARA_D, KISMI_SON_D], 2);
    assert.equal(deney.ggUygulandi, false, "küresellik sağlanıyorsa düzeltme uygulanmaz");
    assert.equal(deney.duzeltmeBasarisiz, false, "burada üretilemedi mesajı çıkmamalı");
    assert.equal(deney.df1, 2, "düzeltmesiz pay sd tam sayı kalmalı");
    assert.equal(deney.df2, 22, "düzeltmesiz payda sd tam sayı kalmalı");
    assert.equal(pHukmu(deney.p), "anlamli");
  });

  /*
    İKİ ÖLÇÜMDE DÜZELTME YOK. Küresellik tanım gereği sağlanır; GG'ye
    gerek olmadığı için sd de düzeltilmez.
  */
  test("iki ölçümde düzeltme aranmıyor, sd tam sayı kalıyor", () => {
    const b = satir([KISMI_ON_D, KISMI_ARA_D], 2);
    assert.equal(b.ggUygulandi, false);
    assert.equal(b.duzeltmeBasarisiz, false);
    assert.equal(b.dfDuzeltildi, false);
    assert.equal(b.df1, 1);
    assert.ok(Number.isFinite(b.p));
  });
});
