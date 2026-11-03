import assert from "node:assert/strict";
import test from "node:test";
import { anaHattiCozumle, oneriTemizle } from "@/lib/ai/yazim-metni";
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
