import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { ANALIZ_TURLERI, ANALIZ_ETIKETLERI_METIN, type AnalizTuru } from "@/lib/analiz-turleri";
import {
  ANALIZ_ESANLAMLILARI,
  ANALIZ_KATEGORILERI,
  KATEGORILI_TURLER,
  analizAra,
  kategorileriSuz,
  turunKategorisi,
} from "@/lib/analiz-kategorileri";

/*
  ANALİZ GEZGİNİ (22.11.2026).

  Gezgin yedi kategoriyi lib/analiz-kategorileri.ts'ten çiziyor. Buradaki
  testlerin işi: listenin analiz türleriyle AYNI listede kalmasını
  sabitlemek. Yeni bir tür eklenip kategoriye yazılmazsa gezginde hiç
  görünmez — kullanıcı için var olmayan bir yetenek olur, hiçbir derleme
  hatası vermez.
*/
describe("analiz kategorileri", () => {
  test("her analiz türü tam olarak bir kategoride", () => {
    const sayim = new Map<AnalizTuru, number>();
    for (const kategori of ANALIZ_KATEGORILERI) {
      for (const tur of kategori.turler) sayim.set(tur, (sayim.get(tur) ?? 0) + 1);
    }
    const eksik = ANALIZ_TURLERI.filter((t) => !sayim.has(t));
    const cokrarlanan = [...sayim].filter(([, n]) => n > 1).map(([t]) => t);
    assert.deepEqual(eksik, [], "kategorisiz tür gezginde görünmez");
    assert.deepEqual(cokrarlanan, [], "aynı tür iki kategoride olmamalı");
    assert.equal(KATEGORILI_TURLER.length, ANALIZ_TURLERI.length);
  });

  test("kategoriler mockup'taki yedi başlık ve sırası", () => {
    assert.deepEqual(
      ANALIZ_KATEGORILERI.map((k) => k.anahtar),
      ["betimsel", "ttest", "anova", "iliski", "parametrikOlmayan", "olcek", "model"],
    );
  });

  test("her kategorinin iki dilde adı var", () => {
    for (const k of ANALIZ_KATEGORILERI) {
      assert.ok(k.ad.tr.length > 0, `${k.anahtar}: tr`);
      assert.ok(k.ad.en.length > 0, `${k.anahtar}: en`);
    }
  });

  test("turunKategorisi her tür için kategori döndürür", () => {
    for (const tur of ANALIZ_TURLERI) assert.ok(turunKategorisi(tur), tur);
  });

  test("her türün eşanlamlı listesi var", () => {
    for (const tur of ANALIZ_TURLERI) {
      assert.ok((ANALIZ_ESANLAMLILARI[tur] ?? []).length > 0, tur);
    }
  });
});

/*
  ARAMA. Öğrenci yöntemi duyduğu adla arıyor; ekrandaki uzun ad tek
  başına yetmiyor. Aşağıdaki her satır gerçek bir arama biçimi:
  kısaltma, İngilizce ad, tireli/tiresiz yazım, iki kelimelik tarif.
*/
describe("analiz arama", () => {
  const tekSonuc = (terim: string, beklenen: AnalizTuru) => {
    const sonuc = analizAra(terim);
    assert.ok(sonuc.includes(beklenen), `"${terim}" → ${beklenen} bekleniyordu, bulunan: ${sonuc.join(", ")}`);
  };

  test("boş terim bütün listeyi döndürür", () => {
    assert.equal(analizAra("").length, ANALIZ_TURLERI.length);
    assert.equal(analizAra("   ").length, ANALIZ_TURLERI.length);
  });

  test("kısaltmalar", () => {
    tekSonuc("anova", "anova");
    tekSonuc("ancova", "ancova");
    tekSonuc("rm anova", "tekrarlianova");
    tekSonuc("afa", "faktor");
    tekSonuc("efa", "faktor");
    tekSonuc("cfa", "dfa");
    tekSonuc("dfa", "dfa");
    tekSonuc("kmo", "faktor");
    tekSonuc("ols", "regression");
    tekSonuc("u testi", "mannwhitney");
    tekSonuc("h testi", "kruskalwallis");
  });

  test("İngilizce adlar", () => {
    tekSonuc("reliability", "reliability");
    tekSonuc("mediation", "aracilik");
    tekSonuc("moderation", "duzenleyicilik");
    tekSonuc("logistic", "lojistik");
    tekSonuc("partial", "kismikorelasyon");
    tekSonuc("repeated measures", "tekrarlianova");
  });

  test("tireli ve tiresiz yazım aynı sonucu verir", () => {
    assert.deepEqual(analizAra("ki-kare"), analizAra("ki kare"));
    assert.ok(analizAra("ki-kare").includes("chisquare"));
    assert.deepEqual(analizAra("mann-whitney"), analizAra("mann whitney"));
  });

  test("büyük/küçük harf ve Türkçe karakter ayrımı yapmaz", () => {
    assert.ok(analizAra("GÜVENİLİRLİK").includes("reliability"));
    assert.ok(analizAra("guvenilirlik").includes("reliability"));
    assert.ok(analizAra("faktör").includes("faktor"));
    assert.ok(analizAra("faktor").includes("faktor"));
  });

  /*
    Parçalar kelimenin BAŞINDA eşleşir, ortasında değil: "rm anova"
    araması "ka-RM-a ANOVA"yı da buluyordu ve kullanıcı RM ANOVA ile
    karma ANOVA arasında kalıyordu (22.11.2026 tarayıcı kabulünde
    yakalandı).
  */
  test("kısa terim kelimenin ortasında eşleşmiyor", () => {
    assert.deepEqual(analizAra("rm anova"), ["tekrarlianova"]);
    assert.ok(!analizAra("rm").includes("karmaanova"));
  });

  test("yazarken devam eden terim kelime başında eşleşir", () => {
    assert.ok(analizAra("korel").includes("correlation"));
    assert.ok(analizAra("guvenilir").includes("reliability"));
    assert.ok(analizAra("lojist").includes("lojistik"));
  });

  test("birden çok kelime: hepsi eşleşmeli", () => {
    const iki = analizAra("iki yönlü");
    assert.ok(iki.includes("ikiyonluanova"));
    assert.ok(!iki.includes("anova"), "tek yönlü ANOVA 'iki yönlü' aramasında çıkmamalı");
  });

  test("eşleşmeyen terim boş liste döndürür (sonuç yok durumu)", () => {
    assert.deepEqual(analizAra("manova"), []);
    assert.deepEqual(analizAra("hayatta kalma analizi"), []);
  });

  test("ekrandaki adın kendisi her zaman bulunur", () => {
    for (const tur of ANALIZ_TURLERI) {
      const ad = ANALIZ_ETIKETLERI_METIN[tur].tr;
      assert.ok(analizAra(ad).includes(tur), `"${ad}" → ${tur}`);
    }
  });

  test("kategorileriSuz boş kategorileri düşürür", () => {
    const suzulen = kategorileriSuz("wilcoxon");
    const anahtarlar = suzulen.map((s) => s.kategori.anahtar);
    assert.ok(anahtarlar.includes("parametrikOlmayan"));
    assert.ok(!anahtarlar.includes("olcek"));
    /* Mann-Whitney'nin eşanlamlısı "wilcoxon rank sum": ikisi de çıkar. */
    const turler = suzulen.flatMap((s) => s.turler);
    assert.ok(turler.includes("wilcoxon"));
    assert.ok(turler.includes("mannwhitney"));
  });

  test("süzme hiçbir zaman kategorilerin dışına tür katmaz", () => {
    for (const terim of ["", "anova", "faktor", "t"]) {
      const turler = kategorileriSuz(terim).flatMap((s) => s.turler);
      assert.deepEqual(turler, KATEGORILI_TURLER.filter((t) => turler.includes(t)), terim);
    }
  });
});
