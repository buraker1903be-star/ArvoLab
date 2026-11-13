import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Bulgu } from "../../lib/ai/bulgu";
import {
  kaynakcaIstemi,
  metindekiKaynaklar,
  ulasilamadiHukmunuAyikla,
  yapisalKaynaklar,
  type KaynakSatiri,
} from "../../lib/ai/kaynakca-denetimi";

/*
  T1 (14.11.2026): kaynakça asistanının çıktısında, dizinine ulaşılamayan
  ("ulasilamadi") künyeler hakkında kurulan olumsuz hükmün deterministik
  ayıklanması. Eskiden yalnızca istem düzeyinde bir yasaktı. Testler iki
  yönü birlikte sınar: hüküm kuran bulgu düşer, geçerli bulgu (karışık
  atıf, olumsuzlama, atıf–kaynakça bulgusu, başka bir kayda yönelen hüküm)
  KALIR.
*/

const b = (aciklama: string, baslik = "Kaynak durumu", tur: Bulgu["tur"] = "uyari"): Bulgu => ({ tur, baslik, aciklama });

// 1 doğrulandı, 2 bulunamadı, 3 ulaşılamadı, 4 ulaşılamadı
const karisik: Pick<KaynakSatiri, "sira" | "durum">[] = [
  { sira: 1, durum: "verified" },
  { sira: 2, durum: "not_found" },
  { sira: 3, durum: "ulasilamadi" },
  { sira: 4, durum: "ulasilamadi" },
];
// Hükmün yönelebileceği başka kayıt yok: yalnızca doğrulanan + ulaşılamayan
const yalnizUlasilamayan: Pick<KaynakSatiri, "sira" | "durum">[] = [
  { sira: 1, durum: "verified" },
  { sira: 3, durum: "ulasilamadi" },
];

const kalanlar = (bulgular: Bulgu[], kaynaklar = karisik, yapisal?: Map<string, number[]>) =>
  ulasilamadiHukmunuAyikla(bulgular, kaynaklar, yapisal).gecerli.map((x) => x.aciklama);

describe("ulaşılamayan künye hakkında hüküm: ayıklanır", () => {
  test("[n] ile ulaşılamayan kaydı gösteren güçlü hüküm düşer", () => {
    const sonuc = ulasilamadiHukmunuAyikla([b("[3] numaralı kaynak uydurma olabilir, aslından kontrol edin.")], karisik);
    assert.equal(sonuc.gecerli.length, 0);
    assert.equal(sonuc.ayiklanan.length, 1);
  });

  test("birden çok ulaşılamayan kayda yönelen zayıf hüküm de düşer", () => {
    assert.deepEqual(kalanlar([b("[3] ve [4] dizinde bulunamadı.")]), []);
    assert.deepEqual(kalanlar([b("Kaynak 3 bulunamadı.")]), []);
  });

  test("yapısal 'kaynaklar' alanı metinde numara olmasa da hedefi belirler", () => {
    const ham = JSON.stringify({ bulgular: [{ tur: "uyari", baslik: "Dizin sonucu", aciklama: "Bu kayıt  dizinde bulunamadı.", kaynaklar: [3] }] });
    const yapisal = yapisalKaynaklar(ham);
    assert.deepEqual(kalanlar([b("Bu kayıt dizinde bulunamadı.", "Dizin sonucu")], karisik, yapisal), []);
  });

  test("numarasız güçlü hüküm, yönelebileceği başka kayıt yoksa düşer", () => {
    assert.deepEqual(kalanlar([b("Bu kaynak şüpheli görünüyor.")], yalnizUlasilamayan), []);
  });

  test("İngilizce hüküm de düşer", () => {
    assert.deepEqual(kalanlar([b("Reference [3] may be fabricated.")]), []);
    assert.deepEqual(kalanlar([b("Source 4 could not be verified in Crossref.")]), []);
  });
});

describe("geçerli bulgu: korunur", () => {
  test("girdide ulaşılamayan kayıt yoksa hiçbir şey değişmez", () => {
    const bulgular = [b("[2] uydurma olabilir."), b("Bu kaynak şüpheli.")];
    const sonuc = ulasilamadiHukmunuAyikla(bulgular, [{ sira: 2, durum: "not_found" }]);
    assert.equal(sonuc.gecerli, bulgular);
    assert.equal(sonuc.ayiklanan.length, 0);
  });

  test("karışık atıf (bulunamadı + ulaşılamadı) silinmez", () => {
    assert.equal(kalanlar([b("[2] ve [3] şüpheli görünüyor.")]).length, 1);
  });

  test("bulunamadı kaydı hakkındaki hüküm silinmez", () => {
    assert.equal(kalanlar([b("[2] uluslararası bir dergi makalesi gibi görünüp dizinde bulunamadı; şüpheli.")]).length, 1);
  });

  test("hükmü reddeden ya da erişim sorununa bağlayan cümle silinmez", () => {
    assert.equal(kalanlar([b("[3] dizine ulaşılamadı; bu, kaynağın uydurma olduğu anlamına gelmez.")]).length, 1);
    assert.equal(kalanlar([b("[3] uydurma değildir; denetimi yeniden çalıştırın.")]).length, 1);
    assert.equal(kalanlar([b("Reference [3] could not be reached; this does not mean it was not found.")]).length, 1);
    assert.equal(kalanlar([b("[3] için dizin sonucu bilinmiyor, şüpheli sayılmaz.")]).length, 1);
  });

  test("atıf–kaynakça bulgusu ('kaynakçada bulunamadı') silinmez", () => {
    assert.equal(kalanlar([b("Demir (2020) atfı kaynakçada bulunamadı.", "Karşılıksız atıf")], yalnizUlasilamayan).length, 1);
    assert.equal(kalanlar([b("[3] kaynakçada bulunamadı gibi görünüyor.")]).length, 1);
  });

  test("numarasız hüküm, yönelebileceği başka kayıt varsa silinmez", () => {
    assert.equal(kalanlar([b("Bir kaynak şüpheli görünüyor.")]).length, 1);
  });

  test("numarasız ZAYIF ifade (yalnızca 'bulunamadı') hüküm sayılmaz; güçlü kalıp sayılır", () => {
    // Numara yok, güçlü kalıp yok: hedefi belirsiz, silinmez.
    assert.equal(kalanlar([b("Bazı kayıtlar dizinde aranırken eşleşme bulunamadı.")], yalnizUlasilamayan).length, 1);
    assert.equal(kalanlar([b("Bazı kayıtlarda eşleşme bulunamadı.")], yalnizUlasilamayan).length, 1);
    // "dizinde bulunamadı" güçlü kalıptır; yönelebileceği başka kayıt yoksa silinir.
    assert.equal(kalanlar([b("Bu kaynak dizinde bulunamadı.")], yalnizUlasilamayan).length, 0);
  });

  test("biçim ve öneri bulguları dokunulmadan kalır", () => {
    const bulgular = [
      b("[3] numaralı kayıtta yazar adlarının baş harfleri tutarsız.", "Biçim"),
      b("Denetimi dizinler yanıt verdiğinde yeniden çalıştırın.", "Öneri", "oneri"),
    ];
    assert.equal(kalanlar(bulgular).length, 2);
  });

  test("var olmayan sıra numarası hedef sayılmaz", () => {
    assert.equal(kalanlar([b("[99] uydurma olabilir.")]).length, 1);
  });

  test("ayıklama yalnızca hüküm kuran bulguyu düşürür, ötekiler sırasıyla kalır", () => {
    const bulgular = [b("İlk geçerli bulgu."), b("[3] uydurma olabilir."), b("Son geçerli bulgu.")];
    assert.deepEqual(kalanlar(bulgular), ["İlk geçerli bulgu.", "Son geçerli bulgu."]);
  });
});

describe("kaynak numarası okuma", () => {
  test("metindeki biçimler", () => {
    assert.deepEqual(metindekiKaynaklar("[3], kaynak 5, 7. kaynak, #9 ve source 11").sort((x, y) => x - y), [3, 5, 7, 9, 11]);
  });

  test("yapısal alan boşluk farkına rağmen bulguyla eşleşir; bozuk değer atılır", () => {
    const ham = JSON.stringify({ bulgular: [{ baslik: "A ", aciklama: "x   y", kaynaklar: [3, "4", -1, 2.5] }] });
    assert.deepEqual([...yapisalKaynaklar(ham).values()], [[3]]);
    assert.equal(yapisalKaynaklar("bozuk").size, 0);
  });
});

describe("istem ve eylem bağlantısı", () => {
  test("istem bulguyu kaynak numarasıyla ilişkilendirmeyi istiyor, yasak kuralı duruyor", () => {
    const { mesajlar } = kaynakcaIstemi({ kaynaklar: [{ sira: 1, ham: "Yazar, A. (2020). Başlık.", durum: "ulasilamadi" }] });
    const sistem = mesajlar[0].metin;
    assert.match(sistem, /"kaynaklar": \[3, 7\]/);
    assert.match(sistem, /dizine ulaşılamadı" bir sonuç DEĞİLDİR/);
  });

  const kaynak = readFileSync("app/actions/ai-kaynakca.ts", "utf8");
  const govde = kaynak.slice(kaynak.indexOf("export async function kaynakcaDenetle"));

  test("sayı denetimi bütün bulgular üzerinde ÖNCE, ayıklama SONRA", () => {
    const sayi = govde.indexOf("bulgulariDogrula(bulgular, kaynak");
    const ayikla = govde.indexOf("ulasilamadiHukmunuAyikla(bulgular, kaynaklar, yapisalKaynaklar(yanit.metin))");
    assert.ok(sayi > 0 && ayikla > sayi, `sıra bozuk: ${sayi} / ${ayikla}`);
  });

  test("kayda ham çıktı aynen, bulgu olarak doğrulanmış liste gider", () => {
    assert.match(govde, /durum: "completed", model: yanit\.model, baglam: kaynak, cikti: yanit\.metin, bulgular: ayiklama\.gecerli/);
  });

  test("bütün bulgular ayıklanırsa doğrulanmamış hüküm gösterilmez; red nedeni yeni bir değer değil", () => {
    assert.match(govde, /durum: "rejected", model: yanit\.model, baglam: kaynak, cikti: yanit\.metin, bulgular: \[\]/);
    assert.match(govde, /return \{ hata: hukumHatasi\(t\), kirpilanlar \}/);
    // reject_reason kısıtı (migration 20261026065320) yalnızca bilinen değerleri kabul ediyor.
    for (const neden of govde.matchAll(/redNedeni: "([a-z_]+)"/g)) assert.ok(["bos", "uydurma_sayi"].includes(neden[1]), neden[1]);
  });

  test("kayıtlı cevap da aynı son doğrulamadan geçer", () => {
    const blok = govde.slice(govde.indexOf("oncekiCevap("), govde.indexOf("asistanHakkiVar("));
    assert.match(blok, /ulasilamadiHukmunuAyikla\(onceki\.bulgular, kaynaklar\)/);
    assert.doesNotMatch(blok, /bulgular: onceki\.bulgular/);
  });
});
