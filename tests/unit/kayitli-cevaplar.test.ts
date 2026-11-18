import assert from "node:assert/strict";
import { test } from "node:test";
import { kayitliCevapOku } from "@/lib/ai/kayitli-cevaplar";

/*
  Kayıtlı AI cevapları (19.11.2026): satır, asistanın kendi çözümleyicisiyle
  okunur; okunamayan satır listeye girmez, görev ve istek yalnızca güvenli
  biçimdeyse alınır.
*/
const satir = (output: string | null, findings: unknown = { gorev: "paragraf", istek: "Giriş için paragraf" }) => ({
  id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-11-19T10:00:00Z",
  output,
  findings,
});

test("geçerli çıktı: yanıt, metin, görev ve istek", () => {
  const c = kayitliCevapOku(satir(JSON.stringify({ yanit: "Bir paragraf yazdım.", metin: "Uzaktan öğrenme yalnızlığı artırdı." })));
  assert.deepEqual(c && { yanit: c.yanit, metin: c.metin, gorev: c.gorev, istek: c.istek }, {
    yanit: "Bir paragraf yazdım.",
    metin: "Uzaktan öğrenme yalnızlığı artırdı.",
    gorev: "paragraf",
    istek: "Giriş için paragraf",
  });
});

test("okunamayan ya da boş çıktı listeye girmez", () => {
  assert.equal(kayitliCevapOku(satir(null)), null);
  assert.equal(kayitliCevapOku(satir("düz metin, JSON değil")), null);
  assert.equal(kayitliCevapOku(satir(JSON.stringify({ yanit: "", metin: "" }))), null);
});

test("eski kayıt: istek yok, bilinmeyen görev yok sayılır", () => {
  const c = kayitliCevapOku(satir(JSON.stringify({ yanit: "Tamam.", metin: "Metin." }), { gorev: "uydurma" }));
  assert.equal(c?.gorev, null);
  assert.equal(c?.istek, null);
  assert.equal(kayitliCevapOku(satir(JSON.stringify({ yanit: "Tamam.", metin: "" }), null))?.metin, "");
});
