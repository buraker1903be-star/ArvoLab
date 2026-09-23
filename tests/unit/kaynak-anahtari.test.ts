import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { dogrulamaAnahtari } from "@/lib/kaynak-anahtari";

const kunye = (title: string | null, year: string | null = "2020", raw = "") =>
  ({ title, year, raw: raw || (title ?? "") });

describe("doğrulama önbelleği anahtarı", () => {
  test("aynı künye aynı anahtarı verir", () => {
    const a = dogrulamaAnahtari(kunye("Örgütsel bağlılık ve iş doyumu"));
    const b = dogrulamaAnahtari(kunye("Örgütsel bağlılık ve iş doyumu"));
    assert.equal(a, b);
    assert.ok(a);
  });

  /*
    Önbelleğin asıl kazancı bu: aynı makaleyi iki öğrenci biraz farklı
    yazdığında da aynı kutuya düşüyorlar, dizine ikinci kez gidilmiyor.
  */
  test("noktalama ve büyük-küçük harf farkı anahtarı değiştirmez", () => {
    assert.equal(
      dogrulamaAnahtari(kunye("Örgütsel Bağlılık ve İş Doyumu.")),
      dogrulamaAnahtari(kunye("örgütsel bağlılık ve iş doyumu")),
    );
  });

  /*
    Türkçe küçültme: genel toLowerCase "I"yı "i" yapar ve "IŞIK" ile
    "ışık" ayrı anahtarlara düşerdi.
  */
  test("Türkçe büyük I ayrı anahtar üretmez", () => {
    assert.equal(dogrulamaAnahtari(kunye("IŞIK VE GÖLGE")), dogrulamaAnahtari(kunye("ışık ve gölge")));
  });

  test("durak kelimeler elenir", () => {
    assert.equal(
      dogrulamaAnahtari(kunye("The effect of the training")),
      dogrulamaAnahtari(kunye("Effect of training")),
    );
  });

  /*
    Yıl puanlamaya giriyor: aynı başlığın iki baskısı farklı sonuç verir,
    dolayısıyla aynı kutuyu paylaşamazlar.
  */
  test("yıl anahtarın parçasıdır", () => {
    assert.notEqual(
      dogrulamaAnahtari(kunye("Örgütsel bağlılık", "2019")),
      dogrulamaAnahtari(kunye("Örgütsel bağlılık", "2020")),
    );
  });

  test("yıl yoksa kendi kutusuna düşer", () => {
    const yilsiz = dogrulamaAnahtari(kunye("Örgütsel bağlılık", null));
    assert.ok(yilsiz?.endsWith("|"));
    assert.notEqual(yilsiz, dogrulamaAnahtari(kunye("Örgütsel bağlılık", "2020")));
  });

  test("geçersiz yıl yok sayılır", () => {
    assert.equal(
      dogrulamaAnahtari(kunye("Örgütsel bağlılık", "n.d.")),
      dogrulamaAnahtari(kunye("Örgütsel bağlılık", null)),
    );
  });

  test("başlık yoksa ham metinden türetilir", () => {
    const a = dogrulamaAnahtari({ title: null, year: "2020", raw: "Yılmaz, A. (2020). Örgütsel bağlılık." });
    assert.ok(a);
    /* "ı" harfinin NFKD ayrışması yok, olduğu gibi kalıyor; "ğ" ve "ö"
       ayrışıp sadeleşiyor. Tutarlı olduğu sürece sorun değil. */
    assert.match(a!, /yılmaz/);
    assert.match(a!, /orgutsel/);
  });

  /*
    Tek kelimelik "başlık" ayrıştırma hatasıdır; onu anahtarlamak binlerce
    ayrı künyeyi aynı kutuda toplar ve hepsine yanlış sonuç dağıtırdı.
  */
  test("anlamlı sorgu üretilemiyorsa null döner", () => {
    assert.equal(dogrulamaAnahtari(kunye("Bir", null, "Bir")), null);
    assert.equal(dogrulamaAnahtari({ title: null, year: null, raw: "" }), null);
    assert.equal(dogrulamaAnahtari({ title: null, year: null, raw: "..." }), null);
  });

  test("çok uzun künye anahtarı şişirmez", () => {
    const uzun = Array.from({ length: 80 }, (_, i) => `kelime${i}`).join(" ");
    const anahtar = dogrulamaAnahtari(kunye(uzun));
    assert.ok(anahtar);
    assert.equal(anahtar!.split("|")[0].split(" ").length, 24);
  });
});
