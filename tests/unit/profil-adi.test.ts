import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { adiBol, adlarGecerliMi, formAdlari, tamAdiKur } from "@/lib/profil-adi";

describe("adiBol: öneri, karar değil", () => {
  test("iki kelimelik ad kesin bölünür", () => {
    assert.deepEqual(adiBol("Ayşe Demir"), { ad: "Ayşe", soyad: "Demir", belirsiz: false });
  });

  test("üç kelimelik ad bölünür ama BELİRSİZ işaretlenir", () => {
    /* "Ayşe Nur" göbek adı mı, "Nur Demir" çift soyad mı bilinmiyor:
       ekran kullanıcıya doğrulatacak. */
    assert.deepEqual(adiBol("Ayşe Nur Demir"), { ad: "Ayşe Nur", soyad: "Demir", belirsiz: true });
  });

  test("dört kelimelik ad da belirsiz", () => {
    assert.deepEqual(adiBol("Ayşe Nur Demir Kaya"), { ad: "Ayşe Nur Demir", soyad: "Kaya", belirsiz: true });
  });

  test("tek kelimelik adda soyad UYDURULMAZ", () => {
    assert.deepEqual(adiBol("Madonna"), { ad: "Madonna", soyad: "", belirsiz: true });
  });

  test("fazla boşluk ve kenar boşlukları temizlenir", () => {
    assert.deepEqual(adiBol("  Ayşe   Demir  "), { ad: "Ayşe", soyad: "Demir", belirsiz: false });
  });

  test("boş ad boş döner ve belirsiz değildir", () => {
    assert.deepEqual(adiBol(""), { ad: "", soyad: "", belirsiz: false });
    assert.deepEqual(adiBol(null), { ad: "", soyad: "", belirsiz: false });
  });
});

describe("formAdlari: kayıtlı değer öneriyi ezer", () => {
  test("ad ve soyad kayıtlıysa full_name'e bakılmaz", () => {
    assert.deepEqual(
      formAdlari({ ad: "Ayşe Nur", soyad: "Demir Kaya", full_name: "Bambaşka Bir Ad" }),
      { ad: "Ayşe Nur", soyad: "Demir Kaya", belirsiz: false },
    );
  });

  test("yalnızca biri kayıtlıysa da öneriye DÖNÜLMEZ", () => {
    /* Soyadını bilerek boş bırakmış olabilir; full_name'den tahmin
       üretmek onun kararını geri alırdı. */
    assert.deepEqual(formAdlari({ ad: "Madonna", soyad: null, full_name: "Madonna Louise" }), {
      ad: "Madonna",
      soyad: "",
      belirsiz: false,
    });
  });

  test("ikisi de boşsa full_name'den öneri gelir", () => {
    assert.deepEqual(formAdlari({ ad: null, soyad: null, full_name: "Ayşe Nur Demir" }), {
      ad: "Ayşe Nur",
      soyad: "Demir",
      belirsiz: true,
    });
  });
});

describe("tamAdiKur", () => {
  test("ad ve soyadı tek boşlukla birleştirir", () => {
    assert.equal(tamAdiKur("  Ayşe Nur ", " Demir "), "Ayşe Nur Demir");
  });
  test("soyad boşsa yalnızca ad kalır", () => {
    assert.equal(tamAdiKur("Madonna", ""), "Madonna");
  });
});

describe("adlarGecerliMi", () => {
  test("ikisi de doluysa geçerli", () => {
    assert.equal(adlarGecerliMi("Ayşe", "Demir"), true);
  });
  test("soyad boşsa geçersiz: iki alan da isteniyor", () => {
    assert.equal(adlarGecerliMi("Ayşe", ""), false);
  });
  test("tek harfli ad ve soyad birlikte 2 karakteri bulduğu için geçerli", () => {
    assert.equal(adlarGecerliMi("A", "B"), true);
  });
  test("80 karakteri aşan alan geçersiz", () => {
    assert.equal(adlarGecerliMi("a".repeat(81), "Demir"), false);
    assert.equal(adlarGecerliMi("Ayşe", "b".repeat(81)), false);
  });
});
