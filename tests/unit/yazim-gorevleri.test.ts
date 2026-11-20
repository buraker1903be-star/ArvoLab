import assert from "node:assert/strict";
import test from "node:test";
import { anaHattiCozumle, bulguIddiasi, ilkCumle, oneriTemizle } from "@/lib/ai/yazim-metni";
import { yazimIstemi, yazimDenetle } from "@/lib/ai/yazim-asistani";

/* Ana hat ve satır içi tamamlama görevleri (03.11.2026). */

test("ana hat: başlık düzeyi, not, numara ayıklama", () => {
  const anaHat = anaHattiCozumle(
    ["# 1. Giriş", "- Bu bölümde araştırmanın problemi açıklanır.", "## 1.1. Amaç", "### Kapsam", "#### Derin", "- not", "serbest satır", "# **Sonuç**"].join("\n"),
  );
  assert.deepEqual(anaHat, [
    { duzey: 1, baslik: "Giriş", notlar: ["Bu bölümde araştırmanın problemi açıklanır."] },
    { duzey: 2, baslik: "Amaç", notlar: [] },
    // "#### Derin" dört düzey: başlık sayılmaz; altındaki not bir üstteki başlığa düşer.
    { duzey: 3, baslik: "Kapsam", notlar: ["not"] },
    { duzey: 1, baslik: "Sonuç", notlar: [] },
  ]);
  assert.deepEqual(anaHattiCozumle("- başlıksız not\nsade metin"), []);
});

test("ana hat isteminde kılavuzun zorunlu bölümleri var", () => {
  const { kaynak } = yazimIstemi({
    belgeDili: "tr",
    atifStili: "APA 7",
    kutuphane: [],
    gecmis: [],
    istek: "",
    gorev: "anahat",
    zorunluBolumler: ["Giriş", "Yöntem", "Bulgular"],
  });
  assert.match(kaynak, /KILAVUZUN ZORUNLU BÖLÜMLERİ: Giriş \| Yöntem \| Bulgular/);
  assert.match(kaynak, /ANA HAT/);
});

test("tamamlama: tekrar eden baş atılır, boşluk doğru", () => {
  const oncesi = "Enflasyon ile işsizlik arasındaki ilişki";
  assert.equal(oneriTemizle("arasındaki ilişki zayıflamıştır.", oncesi), " zayıflamıştır.");
  assert.equal(oneriTemizle("zayıflamıştır.", oncesi), " zayıflamıştır.");
  assert.equal(oneriTemizle("zayıflamıştır.", `${oncesi} `), "zayıflamıştır.");
  assert.equal(oneriTemizle(", ancak", oncesi), ", ancak");
  assert.equal(oneriTemizle("  çok\n satırlı   öneri ", "x "), "çok satırlı öneri");
  assert.equal(oneriTemizle("arasındaki ilişki", oncesi), "");
});

test("tamamlamada da uydurma atıf ve sayı düşer", () => {
  assert.equal(yazimDenetle("bu ilişki Friedman (1968) ile tutarlıdır.", [], ["öncesi"]).gecti, false);
  assert.equal(yazimDenetle("örneklem 412 kişidir.", [], ["öncesi metin"]).gecti, false);
});

test("kısaltma uyarıları: somut kayıplar, örtüşme oranı değil", async () => {
  const { kisaltmaUyarilari } = await import("@/lib/ai/yazim-metni");
  const secim = "Akran grupları yalnızlığı azaltmaktadır (Demir, 2019); ancak bu etki 3 ay sonra gözlenmemiştir ve kalıcı değildir.";
  assert.deepEqual(kisaltmaUyarilari(secim, "Akran grupları yalnızlığı azaltır (Demir, 2019); etki 3 ayda kaybolur ve kalıcı değildir."), []);
  // "değil" düştü: anlam tersine dönebilir — örtüşme yüksek olsa bile uyarılır.
  assert.ok(kisaltmaUyarilari(secim, "Akran grupları yalnızlığı azaltır (Demir, 2019); etki 3 ay sonra da kalıcıdır.").includes("olumsuzluk"));
  assert.ok(kisaltmaUyarilari(secim, "Akran grupları yalnızlığı azaltır; etki 3 ayda kaybolur, kalıcı değildir.").includes("atif"));
  assert.ok(kisaltmaUyarilari(secim, "Akran grupları yalnızlığı azaltır (Demir, 2019); etki kısa sürer, kalıcı değildir.").includes("sayi"));
  assert.ok(kisaltmaUyarilari("Kısa bir cümle.", "Kısa bir cümle, aslında.").includes("kisalmadi"));
  assert.ok(kisaltmaUyarilari("The effect was not significant in 2020 (Lee, 2021).", "The effect was significant (Lee, 2021).").includes("olumsuzluk"));
});

/*
  20.11.2026: öneri en çok bir kısa cümle. Eskiden istem iki cümleye izin
  veriyor, istemci 400 karaktere kadar gösteriyordu; gri metin paragrafı
  kaplıyordu.
*/
test("tamamlama: ilk cümle sonunda kesilir; kısaltma ve ondalık cümle sonu değil", () => {
  assert.equal(ilkCumle("zayıflamıştır. Bu durum ayrıca"), "zayıflamıştır.");
  assert.equal(ilkCumle("eğitim, sağlık vb. alanlarda görülür. Ayrıca"), "eğitim, sağlık vb. alanlarda görülür.");
  assert.equal(ilkCumle("as noted by Smith et al. in their review. Next"), "as noted by Smith et al. in their review.");
  assert.equal(ilkCumle("oran 3.5 katına çıkmıştır! Sonra"), "oran 3.5 katına çıkmıştır!");
  assert.equal(ilkCumle("E. Fisher bunu ilk tanımlayandır. Sonra"), "E. Fisher bunu ilk tanımlayandır.");
  assert.equal(ilkCumle("yarım kalan bir devam"), "yarım kalan bir devam");
  const oncesi = "Enflasyon ile işsizlik arasındaki ilişki";
  assert.equal(oneriTemizle("zayıflamıştır. İkinci cümle burada gelir.", oncesi), " zayıflamıştır.");
  assert.equal(oneriTemizle("which shapes study habits. A second sentence.", "This factor"), " which shapes study habits.");
});

test("tamamlama: dayanaksız bulgu iddiası yakalanır, öncesinde geçiyorsa geçer", () => {
  assert.match(bulguIddiasi("ve bulgular bu ilişkiyi açıkça göstermiştir.", "Öğrencilerin uyumu") ?? "", /göstermiştir/);
  assert.match(bulguIddiasi("gruplar arasında anlamlı bir fark vardır.", "İki grup karşılaştırıldığında") ?? "", /anlamlı bir fark/);
  assert.match(bulguIddiasi("and the results clearly show a strong effect.", "Peer support") ?? "", /results clearly show/);
  assert.match(bulguIddiasi("which was significantly higher.", "Loneliness") ?? "", /significantly/);
  assert.equal(bulguIddiasi("bu da öğrencilerin çalışma planlarını etkiler.", "Uyum süreci"), null);
  assert.equal(bulguIddiasi("which shapes how students plan their time.", "This factor"), null);
  // Öğrencinin kendi bulgusunu yazdığı yerde (öncesinde geçiyor) düşmez.
  assert.equal(bulguIddiasi("ve anlamlı bir fark bulundu.", "Analiz sonucunda gruplar arasında anlamlı"), null);
});
