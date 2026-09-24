/*
  Kaydedilemeyen metnin nerede durduğunu söyleyen cümle. Yanlış söylemenin
  bedeli bir tez bölümü: kullanıcı "tarayıcıda saklanıyor" okuyup sekmeyi
  kapatıyor, oysa localStorage dolu ya da kapalıysa hiçbir şey yazılmamış.
*/
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { kayitHatasiMetni, TASLAK_GUVENDE, TASLAK_YAZILAMADI } from "@/lib/taslak-durumu";

describe("kayıt hatası metni", () => {
  test("taslak yazıldıysa güvence cümlesi eklenir", () => {
    const metin = kayitHatasiMetni("Bağlantı sorunu nedeniyle kaydedilemedi", true);
    assert.equal(metin, `Bağlantı sorunu nedeniyle kaydedilemedi. ${TASLAK_GUVENDE}`);
  });

  test("taslak YAZILAMADIYSA güvence cümlesi kurulmaz", () => {
    const metin = kayitHatasiMetni("Bağlantı sorunu nedeniyle kaydedilemedi", false);
    assert.equal(metin, `Bağlantı sorunu nedeniyle kaydedilemedi. ${TASLAK_YAZILAMADI}`);
    assert.equal(metin.includes("bu tarayıcıda saklanıyor"), false, "Tutulamayacak söz verilmemeli");
  });

  test("zaten noktayla biten mesaja ikinci nokta eklenmez", () => {
    assert.equal(kayitHatasiMetni("Oturumunuz sona erdi.", true), `Oturumunuz sona erdi. ${TASLAK_GUVENDE}`);
  });

  test("boş mesajda yalnızca durum cümlesi kalır", () => {
    assert.equal(kayitHatasiMetni("   ", false), TASLAK_YAZILAMADI);
  });
});
