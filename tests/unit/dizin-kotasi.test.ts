import assert from "node:assert/strict";
import test from "node:test";
import {
  DIZIN_KOTA_PENCERESI,
  DIZIN_SAATLIK_HAK,
  dizinKotaAnahtari,
  kotaKarari,
  sayacCevabi,
  uretimMi,
} from "@/lib/dizin-kotasi-kurali";

/*
  Ortak dizin kotası kuralı (DOI kotası, 07.11.2026). Sayaç çağrısı
  lib/dizin-kotasi.ts'te; burada ortam ve sayaç cevabından karar.
*/

test("anahtar Kaynaklar aramasının ESKİ anahtarı: devreye alındığı saatin sayımı sıfırlanmaz", () => {
  assert.equal(dizinKotaAnahtari("u1"), "literatur-arama:u1");
  assert.equal(DIZIN_SAATLIK_HAK, 60);
  assert.equal(DIZIN_KOTA_PENCERESI, "1 hour");
});

test("sayaç cevabı: yalnızca açık true/false geçerli", () => {
  assert.equal(sayacCevabi(true, null), "izin");
  assert.equal(sayacCevabi(false, null), "doldu");
  for (const tuhaf of [null, undefined, "true", 1, 0, {}]) assert.equal(sayacCevabi(tuhaf, null), "sayac_hatasi", String(tuhaf));
  // Hata varsa veri ne olursa olsun hata: hatalı cevaptaki "true"ya güvenilmez.
  assert.equal(sayacCevabi(true, { message: "rpc" }), "sayac_hatasi");
});

test("üretim: sayaç yok ya da hata → FAIL-CLOSED (denetlenemedi)", () => {
  assert.deepEqual(kotaKarari("sayac_yok", true), { tur: "denetlenemedi" });
  assert.deepEqual(kotaKarari("sayac_hatasi", true), { tur: "denetlenemedi" });
  assert.deepEqual(kotaKarari("izin", true), { tur: "izin" });
  assert.deepEqual(kotaKarari("doldu", true), { tur: "doldu" });
});

test("üretim dışı: sayaç yok/hata → istek gider ama UYARI taşır; doldu yine doldu", () => {
  const yok = kotaKarari("sayac_yok", false);
  assert.equal(yok.tur, "izin");
  assert.ok(yok.tur === "izin" && yok.uyari && /servis anahtarı/.test(yok.uyari));
  const hata = kotaKarari("sayac_hatasi", false);
  assert.ok(hata.tur === "izin" && hata.uyari);
  // Sayaç çalışıyorsa üretim dışında da sınır gerçek (Test Preview).
  assert.deepEqual(kotaKarari("doldu", false), { tur: "doldu" });
});

test("ortam: üretim, önizleme, yerel ve ÇELİŞKİ (üretim sayılır)", () => {
  assert.equal(uretimMi("production", undefined), true);
  assert.equal(uretimMi(undefined, "production"), true);
  assert.equal(uretimMi("preview", undefined), false);
  assert.equal(uretimMi(undefined, undefined), false); // yerel geliştirme
  assert.equal(uretimMi("development", undefined), false);
  // Derleme ile çalışma anı farklı: güvenli taraf.
  assert.equal(uretimMi("preview", "production"), true);
  assert.equal(uretimMi("production", "preview"), true);
});
