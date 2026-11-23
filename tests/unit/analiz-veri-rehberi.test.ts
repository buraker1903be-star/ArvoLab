import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { ANALIZ_TURLERI, type AnalizTuru } from "@/lib/analiz-turleri";
import {
  REHBERLI_ANALIZLER,
  rehberBasliklari,
  rehberOrnekSatirlari,
  rehberSablonCsv,
  veriRehberi,
} from "@/lib/analiz-veri-rehberi";

/*
  VERİ HAZIRLAMA REHBERİ — KAPSAM ve SÖZLEŞME (23.11.2026).

  Kart güvenilirlikte işe yaradı ve bütün analizlere yayıldı. Buradaki
  ilk test KAPSAM testi: katalogdaki her analizin rehberi olmalı. Yeni
  bir analiz eklenip rehbersiz kalırsa derleme zaten geçmez
  (Record<AnalizTuru, …>), bu test de ikinci bir ağ.
*/
describe("veri rehberi kapsamı", () => {
  test("katalogdaki 25 analizin hepsinde rehber var", () => {
    assert.equal(ANALIZ_TURLERI.length, 25, "katalog büyüdüyse rehber de büyümeli");
    assert.deepEqual([...REHBERLI_ANALIZLER].sort(), [...ANALIZ_TURLERI].sort());
    for (const tur of ANALIZ_TURLERI) assert.ok(veriRehberi(tur), tur);
  });

  test("her rehber iki dilde eksiksiz ve analize özgü", () => {
    const hatalar = new Set<string>();
    for (const tur of ANALIZ_TURLERI) {
      const r = veriRehberi(tur);
      for (const dil of ["tr", "en"] as const) {
        assert.ok(r.satir[dil].length > 25, `${tur} satır ${dil}`);
        assert.ok(r.yayginHata[dil].length > 40, `${tur} yaygın hata ${dil}`);
        for (const x of r.ekranGirdileri) assert.ok(x[dil].length > 20, `${tur} ekran girdisi ${dil}`);
      }
      /* Yaygın hata analize ÖZGÜ olmalı: kopyalanmış bir cümle hiçbir şey öğretmez. */
      assert.ok(!hatalar.has(r.yayginHata.tr), `${tur}: yaygın hata başka analizle aynı`);
      hatalar.add(r.yayginHata.tr);
    }
  });

  test("her rehberde en az iki sütun, en az biri zorunlu ve başlıklar benzersiz", () => {
    for (const tur of ANALIZ_TURLERI) {
      const r = veriRehberi(tur);
      assert.ok(r.sutunlar.length >= 2, tur);
      assert.ok(r.sutunlar.some((x) => x.zorunlu), `${tur}: zorunlu sütun yok`);
      for (const dil of ["tr", "en"] as const) {
        const basliklar = rehberBasliklari(r, dil);
        assert.equal(new Set(basliklar).size, basliklar.length, `${tur} ${dil}: yinelenen başlık`);
        for (const b of basliklar) assert.ok(b.trim().length > 0 && !b.includes(","), `${tur} ${dil}: ${b}`);
      }
    }
  });

  test("katılımcı sütunu isteğe bağlı ve analize seçilmeyen etiket", () => {
    for (const tur of ANALIZ_TURLERI) {
      const ilk = veriRehberi(tur).sutunlar[0];
      assert.equal(ilk.tur, "etiket", tur);
      assert.equal(ilk.zorunlu, false, tur);
    }
  });

  /* Örnek tablo ile indirilen şablon AYNI tanımdan: ayrışamazlar. */
  test("örnek tablo ve boş şablon aynı sütunlardan üretiliyor", () => {
    for (const tur of ANALIZ_TURLERI) {
      for (const dil of ["tr", "en"] as const) {
        const r = veriRehberi(tur);
        const basliklar = rehberBasliklari(r, dil);
        const csv = rehberSablonCsv(r, dil).split("\n").filter((x) => x.trim() !== "");
        assert.equal(csv.length, 1, `${tur} ${dil}: boş şablonda veri satırı olmamalı`);
        assert.equal(csv[0], basliklar.join(","), `${tur} ${dil}`);
        const satirlar = rehberOrnekSatirlari(r, dil);
        assert.ok(satirlar.length >= 3, tur);
        for (const satir of satirlar) assert.equal(satir.length, basliklar.length, `${tur} ${dil}`);
      }
    }
  });

  test("sayısal sütunların örnek değerleri sayı, kategorik olanlarınki değil", () => {
    for (const tur of ANALIZ_TURLERI) {
      const r = veriRehberi(tur);
      const satirlar = rehberOrnekSatirlari(r, "tr");
      r.sutunlar.forEach((x, j) => {
        for (const satir of satirlar) {
          if (x.tur === "sayi") assert.ok(Number.isFinite(Number(satir[j])), `${tur} ${x.ad.tr}: ${satir[j]}`);
          else assert.ok(!Number.isFinite(Number(satir[j])), `${tur} ${x.ad.tr}: ${satir[j]} sayı olmamalı`);
        }
      });
      /* Sayısal sütunda değişkenlik olmalı: aynı değerle hiçbir analiz çalışmaz. */
      for (let j = 0; j < r.sutunlar.length; j += 1) {
        if (r.sutunlar[j].tur !== "sayi") continue;
        assert.ok(new Set(satirlar.map((x) => x[j])).size > 1, `${tur} ${r.sutunlar[j].ad.tr}: örnekte değişkenlik yok`);
      }
    }
  });

  test("kategorik örnekler dile göre çevriliyor", () => {
    const tr = rehberOrnekSatirlari(veriRehberi("ttest"), "tr");
    const en = rehberOrnekSatirlari(veriRehberi("ttest"), "en");
    assert.equal(tr[0][1], "deney");
    assert.equal(en[0][1], "treatment");
  });
});

describe("analize özgü içerik", () => {
  test("bağımsız t-testi: her kişi tek satır, grup ayrı sütun", () => {
    const r = veriRehberi("ttest");
    assert.match(r.satir.tr, /Her satır BİR kişi/);
    assert.match(r.satir.tr, /ayrı bir sütunda/);
    assert.match(r.yayginHata.tr, /İKİ AYRI SÜTUNA yazmayın/);
    assert.match(r.satir.en, /Each row is ONE person/);
    const grup = r.sutunlar.find((x) => x.ad.tr === "Grup");
    assert.ok(grup && grup.tur === "kategori" && grup.zorunlu);
  });

  test("eşleştirilmiş t-testi: aynı kişinin önce ve sonrası AYNI satırda", () => {
    const r = veriRehberi("pairedttest");
    assert.match(r.satir.tr, /AYNI satırda/);
    assert.match(r.yayginHata.tr, /ALT ALTA tek sütuna yazmayın/);
    assert.match(r.satir.en, /SAME row/);
    assert.deepEqual(r.sutunlar.slice(1).map((x) => x.ad.tr), ["Ön test", "Son test"]);
  });

  test("ki-kare: ham satır ister, hazır çapraz tablo değil", () => {
    const r = veriRehberi("chisquare");
    assert.match(r.yayginHata.tr, /HAZIR ÇAPRAZ TABLO/);
    assert.equal(r.sutunlar.filter((x) => x.tur === "kategori").length, 2);
  });

  test("ekranda girilen değerler dosyada istenmiyor", () => {
    assert.match(veriRehberi("tekorneklem").ekranGirdileri[0].tr, /Karşılaştırılacak değer/);
    assert.match(veriRehberi("lojistik").ekranGirdileri[0].tr, /olay \(1\)/);
    assert.match(veriRehberi("faktor").ekranGirdileri[0].tr, /Faktör sayısı/);
    assert.match(veriRehberi("dfa").ekranGirdileri[0].tr, /Faktör yapısı/);
    /* Dosyadan okunan analizlerde ekran girdisi yok. */
    assert.equal(veriRehberi("ttest").ekranGirdileri.length, 0);
  });
});

describe("seçeneğe göre değişen düzen", () => {
  test("iki yönlü ANOVA: ikinci faktör seçilince sütun zorunlu olur", () => {
    const yok = veriRehberi("ikiyonluanova", { ikinciFaktor: false });
    const var_ = veriRehberi("ikiyonluanova", { ikinciFaktor: true });
    const ikinci = (r: ReturnType<typeof veriRehberi>) => r.sutunlar.find((x) => x.ad.tr === "2. faktör");
    assert.equal(ikinci(yok)?.zorunlu, false);
    assert.equal(ikinci(var_)?.zorunlu, true);
    assert.notEqual(yok.satir.tr, var_.satir.tr, "açıklama da seçeneğe göre değişmeli");
  });

  test("aracılık/düzenleyicilik: sonuç değişkeni seçilmemişse isteğe bağlı", () => {
    for (const tur of ["aracilik", "duzenleyicilik"] as AnalizTuru[]) {
      const y = (c: boolean) => veriRehberi(tur, { ciktiY: c }).sutunlar.find((x) => x.ad.tr.startsWith("Y "));
      assert.equal(y(true)?.zorunlu, true, tur);
      assert.equal(y(false)?.zorunlu, false, tur);
    }
  });

  test("çoklu alanların sayısı sütun sayısını belirliyor", () => {
    assert.equal(veriRehberi("reliability", { maddeSayisi: 5 }).sutunlar.length, 6);
    assert.equal(veriRehberi("tekrarlianova", { olcumSayisi: 4 }).sutunlar.length, 5);
    assert.equal(veriRehberi("karmaanova", { olcumSayisi: 2 }).sutunlar.length, 4);
    assert.equal(veriRehberi("regression", { yordayiciSayisi: 3 }).sutunlar.length, 5);
    /* Alt sınır: hiç seçim yokken bile örnek anlamlı kalmalı. */
    assert.ok(veriRehberi("tekrarlianova", { olcumSayisi: 0 }).sutunlar.length >= 4);
    assert.ok(veriRehberi("regression", { yordayiciSayisi: 0 }).sutunlar.length >= 4);
    /* Üst sınır: örnek tablo okunmaz hâle gelmesin. */
    assert.ok(veriRehberi("reliability", { maddeSayisi: 40 }).sutunlar.length <= 7);
  });

  test("aracılıkta tek aracı M, iki aracı M1/M2 diye adlanıyor", () => {
    assert.ok(veriRehberi("aracilik", { araciSayisi: 1 }).sutunlar.some((x) => x.ad.tr === "M (aracı)"));
    assert.ok(veriRehberi("aracilik", { araciSayisi: 2 }).sutunlar.some((x) => x.ad.tr === "M1 (aracı)"));
  });
});

describe("kart ve panel rehberi tek kaynaktan okuyor", () => {
  const kart = readFileSync("app/dashboard/analysis/veri-rehberi-karti.tsx", "utf8");
  const analizci = readFileSync("app/dashboard/analysis/data-analyzer.tsx", "utf8");

  test("kart örnek tabloyu ve şablonu aynı tanımdan üretiyor", () => {
    assert.match(kart, /rehberBasliklari\(rehber, dil\)/);
    assert.match(kart, /rehberOrnekSatirlari\(rehber, dil\)/);
    assert.match(kart, /rehberSablonCsv\(rehber, dil\)/);
  });

  test("rehber veri yüklenmeden önce ve yüklendikten sonra katlanmış", () => {
    assert.match(analizci, /\{!dataset && !loading \? <VeriRehberiKarti tur=\{analysisType\} secenek=\{rehberSecenekleri\} \/> : null\}/);
    assert.match(analizci, /\{dataset \? <VeriRehberiKarti tur=\{analysisType\} secenek=\{rehberSecenekleri\} katlanir \/> : null\}/);
    assert.match(kart, /tr: "Veri gereksinimlerini gör", en: "See the data requirements"/);
  });

  test("seçenekler ekranın durumundan geliyor: analiz değişince rehber de değişir", () => {
    assert.match(analizci, /ikinciFaktor: Boolean\(groupVar2\)/);
    assert.match(analizci, /ciktiY: Boolean\(varY\)/);
    assert.match(analizci, /olcumSayisi: olcumler\.length/);
    assert.match(analizci, /maddeSayisi: reliabilityItems\.length/);
  });

  /* Güvenilirliğin şablonu için AYRI bir modül vardı
     (lib/analiz-veri-sablonu.ts); rehber genele yayılınca kaldırıldı.
     Tek tanım kalsın: iki modül aynı tabloyu ayrı ayrı yazarsa
     sessizce ayrışırlar. */
  test("güvenilirlik şablonu için ikinci bir tanım yok", () => {
    assert.equal(existsSync("lib/analiz-veri-sablonu.ts"), false);
    assert.match(kart, /rehberSablonCsv\(rehber, dil\)/);
  });
});

/* Ekran, hiçbir sütun seçilmemişken sayıları 0 gönderiyor: rehber
   varsayılandan KÜÇÜLMEMELİ. Eskiden güvenilirlik şablonu dosya
   yüklenmeden önce 2 madde sütunuyla iniyordu (ω için en az 3 gerekir). */
test("sıfır ve eksik sayı seçenekleri rehberi küçültmez", () => {
  const sifir = veriRehberi("reliability", { maddeSayisi: 0 });
  assert.deepEqual(rehberBasliklari(sifir, "tr"), ["Katılımcı", "Madde 1", "Madde 2", "Madde 3"]);
  assert.deepEqual(rehberBasliklari(veriRehberi("reliability"), "tr"), rehberBasliklari(sifir, "tr"));
  const bes = veriRehberi("reliability", { maddeSayisi: 5 });
  assert.equal(rehberBasliklari(bes, "tr").length, 6);
  const olcum = veriRehberi("friedman", { olcumSayisi: 0 });
  assert.equal(olcum.sutunlar.length, veriRehberi("friedman").sutunlar.length);
  const yordayici = veriRehberi("regression", { yordayiciSayisi: 1 });
  assert.equal(yordayici.sutunlar.length, veriRehberi("regression").sutunlar.length);
});
