import assert from "node:assert/strict";
import test from "node:test";
import { ekranTahmini } from "@/lib/os/kirilimlar";

/* Sunucudaki ilk çizimin ekran tahmini (Signature OS 4.2). */

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_TEL = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

test("Sec-CH-UA-Mobile ?1 telefondur, kullanıcı aracısından önce gelir", () => {
  assert.equal(ekranTahmini({ chMobile: "?1", ua: WINDOWS }), "telefon");
  assert.equal(ekranTahmini({ chMobile: "?0", ua: WINDOWS }), "masaustu");
});

test("kullanıcı aracısı: iPhone ve Android telefon telefon, Android tablet tablet", () => {
  assert.equal(ekranTahmini({ ua: IPHONE }), "telefon");
  assert.equal(ekranTahmini({ ua: ANDROID_TEL }), "telefon");
  assert.equal(ekranTahmini({ ua: ANDROID_TABLET }), "tablet");
});

test("masaüstü ve bilinmeyen: masaüstü (eski varsayılan)", () => {
  assert.equal(ekranTahmini({ ua: MAC }), "masaustu");
  assert.equal(ekranTahmini({ ua: WINDOWS }), "masaustu");
  assert.equal(ekranTahmini({}), "masaustu");
  assert.equal(ekranTahmini({ chMobile: null, ua: null }), "masaustu");
});
