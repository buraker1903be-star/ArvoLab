import { test } from "node:test";
import assert from "node:assert/strict";
import { baskaCihazdanKapatildiMi, oturumCereziMi } from "@/lib/tek-oturum";

/*
  auth-js "session_not_found" cevabını AuthSessionMissingError'a çeviriyor;
  ilk sürüm yalnızca kodu tanıyordu ve gerçek istemcide uyarı hiç çıkmadı.
*/
test("oturum çerezi varken sunucunun tanımadığı oturum: başka cihaz", () => {
  assert.equal(baskaCihazdanKapatildiMi({ name: "AuthSessionMissingError" }, true), true);
  assert.equal(baskaCihazdanKapatildiMi({ name: "AuthApiError", code: "refresh_token_not_found" }, true), true);
  assert.equal(baskaCihazdanKapatildiMi({ code: "session_not_found" }, true), true);
});

test("hiç giriş yapmamış ziyaretçi uyarı görmez", () => {
  assert.equal(baskaCihazdanKapatildiMi({ name: "AuthSessionMissingError" }, false), false);
  assert.equal(baskaCihazdanKapatildiMi({ code: "refresh_token_not_found" }, false), false);
});

/* Geçici arıza çalışan kişiyi dışarı atmamalı; süre sınırı da "başka cihaz" değil. */
test("öteki hatalar ve hatasızlık oturumu kapatmaz", () => {
  for (const hata of [null, undefined, {}, { code: null }, { name: "AuthRetryableFetchError" }, { code: "request_timeout" }, { code: "session_expired" }, { name: "AuthApiError", code: "unexpected_failure" }]) {
    assert.equal(baskaCihazdanKapatildiMi(hata, true), false, JSON.stringify(hata));
  }
});

test("oturum çerezi adı tanınır, parçalı çerez dahil", () => {
  assert.equal(oturumCereziMi("sb-zpfpocyajnxcketdjbxm-auth-token"), true);
  assert.equal(oturumCereziMi("sb-zpfpocyajnxcketdjbxm-auth-token.0"), true);
  assert.equal(oturumCereziMi("arvolab_dil"), false);
});
