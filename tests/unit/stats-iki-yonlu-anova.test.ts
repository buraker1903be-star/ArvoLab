import assert from "node:assert/strict";
import test from "node:test";
import { basitEtkiler, ikiYonluAnova, type IkiYonluAnovaSonucu, type IkiYonluGozlem } from "@/lib/stats-iki-yonlu-anova";

const VERI: Record<string, Record<string, number[]>> = {
  Kadın: { "1. sınıf": [12, 14, 13, 15], "2. sınıf": [18, 17, 19, 20], "3. sınıf": [22, 24, 23, 21] },
  Erkek: { "1. sınıf": [10, 11, 13, 12], "2. sınıf": [15, 14, 16, 17], "3. sınıf": [25, 27, 24, 26] },
};

function gozlemler(veri = VERI): IkiYonluGozlem[] {
  const liste: IkiYonluGozlem[] = [];
  for (const [a, satir] of Object.entries(veri)) {
    for (const [b, degerler] of Object.entries(satir)) {
      for (const deger of degerler) liste.push({ a, b, deger });
    }
  }
  return liste;
}

const sonuc = (g: IkiYonluGozlem[]) => {
  const r = ikiYonluAnova(g, "Cinsiyet", "Sınıf");
  assert.ok(typeof r !== "string", `hesaplanamadı: ${r}`);
  return r as IkiYonluAnovaSonucu;
};

test("iki yönlü ANOVA", async (t) => {
  await t.test("dengeli veride ders kitabı formülleriyle birebir", () => {
    /*
      Beklenen değerler ELDE hesaplandı (klasik kapalı formüller,
      dengeli 2×3, hücre başına n=4). Program kareler toplamını MODEL
      KARŞILAŞTIRMASIYLA buluyor — bambaşka bir yol. İki yolun
      buluşması, tek bir uygulamayı yeniden okumaktan güçlü bir kanıt.
    */
    const r = sonuc(gozlemler());
    assert.ok(Math.abs(r.faktorA.ss - 2.6667) < 1e-3, String(r.faktorA.ss));
    assert.ok(Math.abs(r.faktorB.ss - 537.3333) < 1e-3, String(r.faktorB.ss));
    assert.ok(Math.abs(r.etkilesim.ss - 41.3333) < 1e-3, String(r.etkilesim.ss));
    assert.ok(Math.abs(r.hata.ss - 30) < 1e-6, String(r.hata.ss));
    assert.deepEqual([r.faktorA.df, r.faktorB.df, r.etkilesim.df, r.hata.df], [1, 2, 2, 18]);
    assert.ok(Math.abs(r.faktorA.f - 1.6) < 1e-6, String(r.faktorA.f));
    assert.ok(Math.abs(r.faktorB.f - 161.2) < 1e-6, String(r.faktorB.f));
    assert.ok(Math.abs(r.etkilesim.f - 12.4) < 1e-6, String(r.etkilesim.f));
    assert.ok(Math.abs(r.etkilesim.kismiEtaKare - 0.579439) < 1e-6, String(r.etkilesim.kismiEtaKare));
  });

  await t.test("dengeli veride kareler toplamı toplama kuralını sağlıyor", () => {
    // SSA + SSB + SSAB + SSE = SST yalnızca dengeli veride geçerlidir.
    const r = sonuc(gozlemler());
    const toplam = r.faktorA.ss + r.faktorB.ss + r.etkilesim.ss + r.hata.ss;
    assert.ok(Math.abs(toplam - r.toplam.ss) < 1e-6, `${toplam} ≠ ${r.toplam.ss}`);
    assert.equal(r.dengeli, true);
  });

  await t.test("etkileşim gerçekten yoksa kareler toplamı sıfıra gidiyor", () => {
    /*
      YAPISAL DENETİM: her hücre "A etkisi + B etkisi" ile tam olarak
      kuruluyor, yani etkileşim tanım gereği sıfır. Dengesiz hücre
      büyüklükleriyle kuruldu — III. tip kareler toplamının asıl
      sınandığı yer burası, klasik formüller burada sapar.
    */
    const temel: Record<string, number> = { Kadın: 0, Erkek: 5 };
    const adim: Record<string, number> = { "1. sınıf": 0, "2. sınıf": 10, "3. sınıf": 20 };
    const boyut: Record<string, number> = { "Kadın|1. sınıf": 7, "Kadın|2. sınıf": 3, "Kadın|3. sınıf": 9,
      "Erkek|1. sınıf": 4, "Erkek|2. sınıf": 11, "Erkek|3. sınıf": 5 };
    const liste: IkiYonluGozlem[] = [];
    for (const a of Object.keys(temel)) {
      for (const b of Object.keys(adim)) {
        const n = boyut[`${a}|${b}`];
        /*
          Sapmalar TAM OLARAK sıfırlanmalı, yoksa hücre ortalaması
          kayar ve yapay bir etkileşim doğar: ilk kurgum ±1 dizisiydi
          ve tek sayılı hücrelerde (n=7) sıfırlanmıyordu — ölçülen
          etkileşim 0,164 çıktı, kodun değil testin hatasıydı.
          (i − (n−1)/2) her n için sıfır toplar.
        */
        for (let i = 0; i < n; i += 1) liste.push({ a, b, deger: temel[a] + adim[b] + (i - (n - 1) / 2) });
      }
    }
    const r = sonuc(liste);
    assert.equal(r.dengeli, false);
    assert.ok(r.etkilesim.ss < 1e-9, `etkileşim sıfır olmalıydı: ${r.etkilesim.ss}`);
    assert.ok(r.faktorA.ss > 1, String(r.faktorA.ss));
    assert.ok(r.faktorB.ss > 1, String(r.faktorB.ss));
  });

  await t.test("bir faktörün hiç etkisi yoksa kareler toplamı sıfıra gidiyor", () => {
    const liste: IkiYonluGozlem[] = [];
    for (const a of ["Kadın", "Erkek"]) {
      for (const b of ["1. sınıf", "2. sınıf"]) {
        // Cinsiyet değeri hiç değiştirmiyor; yalnızca sınıf değiştiriyor.
        for (let i = 0; i < 6; i += 1) liste.push({ a, b, deger: (b === "1. sınıf" ? 10 : 20) + (i % 2 === 0 ? 1 : -1) });
      }
    }
    const r = sonuc(liste);
    assert.ok(r.faktorA.ss < 1e-9, String(r.faktorA.ss));
    assert.ok(r.faktorB.ss > 100, String(r.faktorB.ss));
  });

  await t.test("boş hücre sayı uydurmuyor", () => {
    // Etkileşim o hücrede TANIMSIZ; model karşılaştırması tekil matris verir.
    const liste = gozlemler().filter((g) => !(g.a === "Erkek" && g.b === "3. sınıf"));
    assert.equal(ikiYonluAnova(liste, "Cinsiyet", "Sınıf"), "bos-hucre");
  });

  await t.test("tek düzeyli faktör ve yetersiz gözlem reddediliyor", () => {
    const tek = gozlemler().filter((g) => g.a === "Kadın");
    assert.equal(ikiYonluAnova(tek, "Cinsiyet", "Sınıf"), "az-duzey");
    // 2×2 tasarımda her hücrede bir gözlem: hata serbestlik derecesi 0.
    const az: IkiYonluGozlem[] = [
      { a: "K", b: "1", deger: 1 }, { a: "K", b: "2", deger: 2 },
      { a: "E", b: "1", deger: 3 }, { a: "E", b: "2", deger: 4 },
    ];
    assert.equal(ikiYonluAnova(az, "A", "B"), "az-gozlem");
  });

  await t.test("hücre tablosu bütün kesişimleri taşıyor", () => {
    const r = sonuc(gozlemler());
    assert.equal(r.hucreler.length, 6);
    assert.deepEqual(r.duzeyA, ["Kadın", "Erkek"]);
    assert.deepEqual(r.duzeyB, ["1. sınıf", "2. sınıf", "3. sınıf"]);
    const kadin3 = r.hucreler.find((h) => h.a === "Kadın" && h.b === "3. sınıf");
    assert.equal(kadin3?.n, 4);
    assert.equal(kadin3?.ortalama, 22.5);
  });
});

test("basit etkiler", async (t) => {
  await t.test("elde hesaplananla birebir", () => {
    /*
      Beklenen değerler elle hesaplandı: her cinsiyetin İÇİNDE sınıf
      düzeyinin kareler toplamı, payda iki yönlü modelin ORTAK hata
      kare ortalaması (30/18). Alt grubun kendi varyansını kullanmak
      modelin topladığı bilgiyi atmak olurdu.
    */
    const g = gozlemler();
    const r = sonuc(g);
    const etkiler = basitEtkiler(g, r, "a", "Cinsiyet", "Sınıf");
    const kadin = etkiler.find((e) => e.duzey === "Kadın");
    const erkek = etkiler.find((e) => e.duzey === "Erkek");
    assert.ok(Math.abs(kadin!.ss - 162.6667) < 1e-3, String(kadin!.ss));
    assert.ok(Math.abs(kadin!.f - 48.8) < 1e-6, String(kadin!.f));
    assert.ok(Math.abs(erkek!.ss - 416) < 1e-6, String(erkek!.ss));
    assert.ok(Math.abs(erkek!.f - 124.8) < 1e-6, String(erkek!.f));
    assert.equal(kadin!.df, 2);
  });

  await t.test("p değerleri Bonferroni ile düzeltiliyor", () => {
    const g = gozlemler();
    const etkiler = basitEtkiler(g, sonuc(g), "a", "Cinsiyet", "Sınıf");
    // İki düzey → iki karşılaştırma; düzeltilmiş p, ham p'nin iki katı (1'de kırpılır).
    for (const etki of etkiler) {
      assert.ok(etki.p >= etki.pHam, `${etki.p} < ${etki.pHam}`);
      assert.ok(etki.p <= 1);
      assert.ok(Math.abs(etki.p - Math.min(1, etki.pHam * 2)) < 1e-12);
    }
  });

  await t.test("etkisi olmayan düzeyde kareler toplamı sıfıra gidiyor", () => {
    /*
      Kadınlarda sınıf düzeyi hiç fark yaratmıyor, erkeklerde yaratıyor:
      basit etki tam da bunu ayırt edebilmeli. Ana etki bu veride
      ortalamayı aldığı için "sınıf fark yaratıyor" der ve kadınlar
      için YANLIŞ olur — etkileşimin okunma sebebi budur.
    */
    const liste: IkiYonluGozlem[] = [];
    for (const b of ["1. sınıf", "2. sınıf"]) {
      for (let i = 0; i < 6; i += 1) {
        liste.push({ a: "Kadın", b, deger: 10 + (i - 2.5) });
        liste.push({ a: "Erkek", b, deger: (b === "1. sınıf" ? 5 : 25) + (i - 2.5) });
      }
    }
    const r = sonuc(liste);
    const etkiler = basitEtkiler(liste, r, "a", "Cinsiyet", "Sınıf");
    const kadin = etkiler.find((e) => e.duzey === "Kadın");
    const erkek = etkiler.find((e) => e.duzey === "Erkek");
    assert.ok(kadin!.ss < 1e-9, String(kadin!.ss));
    assert.equal(kadin!.anlamli, false);
    assert.ok(erkek!.ss > 100, String(erkek!.ss));
    assert.equal(erkek!.anlamli, true);
  });
});
