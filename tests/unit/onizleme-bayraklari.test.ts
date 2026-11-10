import { test } from "node:test";
import assert from "node:assert/strict";
import { onizlemeBayraklari } from "../../lib/onizleme-takmalari";

/*
  Önizleme bayrak beyanı (G1 Aşama 5): kabul betikleri ön koşulu buradan
  okuyor. Üretimde ve önizleme kapalıyken başlık HİÇ yazılmamalı.
*/
test("önizleme kapalıyken ya da üretimde beyan yok", () => {
  assert.equal(onizlemeBayraklari({}), null);
  assert.equal(onizlemeBayraklari({ ONIZLEME_YAZ: "1", ONIZLEME_AI: "1" }), null);
  assert.equal(onizlemeBayraklari({ ARVOLAB_ONIZLEME: "1", NODE_ENV: "production" }), null);
});

test("varsayılan önizleme: her bayrak açıkça yazılır", () => {
  assert.equal(
    onizlemeBayraklari({ ARVOLAB_ONIZLEME: "1" }),
    "yaz=0;ai=0;senaryo=varsayilan;oturum=var;abonelik=yok;hak=var;bos=0;rol=varsayilan",
  );
});

test("açık bayraklar beyana girer", () => {
  const b = onizlemeBayraklari({
    ARVOLAB_ONIZLEME: "1",
    ONIZLEME_YAZ: "1",
    ONIZLEME_AI: "1",
    ONIZLEME_SENARYO: "kilavuz-eski",
    ONIZLEME_OTURUM: "yok",
    ONIZLEME_ABONELIK: "bitti",
    ONIZLEME_HAK: "bitti",
  });
  assert.equal(b, "yaz=1;ai=1;senaryo=kilavuz-eski;oturum=yok;abonelik=bitti;hak=bitti;bos=0;rol=varsayilan");
});

test("başlığa yalnızca güvenli karakterler girer, anahtar sızmaz", () => {
  const b = onizlemeBayraklari({ ARVOLAB_ONIZLEME: "1", ONIZLEME_SENARYO: "x;yaz=1\r\nSet-Cookie: a", AI_ANAHTAR: "gizli-deger", ONIZLEME_ROL: "System_Admin" }) ?? "";
  assert.match(b, /^[a-z0-9_=;-]+$/);
  assert.equal(b.includes("gizli"), false);
  assert.match(b, /senaryo=xyaz1set-cookiea;/);
  assert.match(b, /rol=system_admin$/);
  /* Süzülmüş senaryo değeri ikinci bir "yaz=" çifti üretemez. */
  assert.equal((b.match(/(^|;)yaz=/g) ?? []).length, 1);
});
