import assert from "node:assert/strict";
import test from "node:test";
import { ASISTANA_ULASILAMADI, ASISTANA_ULASILAMADI_METIN, asistanCagir } from "@/lib/asistan-istemci";

test("düşen çağrı kullanıcının dilinde hata döndürür", async () => {
  const dus = async (): Promise<{ hata?: string }> => {
    throw new Error("koptu");
  };
  const asil = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await asistanCagir(dus), { hata: ASISTANA_ULASILAMADI });
    assert.deepEqual(await asistanCagir(dus, "en"), { hata: ASISTANA_ULASILAMADI_METIN.en });
    assert.match(ASISTANA_ULASILAMADI_METIN.en, /^Could not reach the assistant/);
  } finally {
    console.error = asil;
  }
});
