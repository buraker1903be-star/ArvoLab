import assert from "node:assert/strict";
import test from "node:test";
import { danismanMesaji, epostaAdresi, whatsappAdresi } from "@/lib/danismana-gonder";

test("bağlantılı mesaj bağlantıyı ve süreyi taşır", () => {
  const m = danismanMesaji({ baslik: "Ekonometri", url: "https://arvolab.app/share/abc", gun: 30 });
  assert.match(m, /"Ekonometri"/);
  assert.match(m, /30 gün geçerli/);
  assert.match(m, /https:\/\/arvolab\.app\/share\/abc/);
});

test("bağlantısız mesaj dosyaya gönderme yapar", () => {
  assert.match(danismanMesaji({ baslik: "Tez" }), /ekte gönderiyorum/);
});

test("WhatsApp ve e-posta adresleri kodlanır; boşluk '+' olmaz", () => {
  const metin = "Hocam merhaba & teşekkürler";
  assert.equal(whatsappAdresi(metin), `https://wa.me/?text=${encodeURIComponent(metin)}`);
  const posta = epostaAdresi("Tez taslağı", metin);
  assert.ok(posta.startsWith(`mailto:?subject=${encodeURIComponent("Tez taslağı")}&body=`));
  assert.ok(!posta.includes("+"));
});

test("İngilizce mesaj", () => {
  const m = danismanMesaji({ baslik: "Econometrics", url: "https://arvolab.app/share/abc", gun: 30 }, "en");
  assert.match(m, /^Hello,/);
  assert.match(m, /"Econometrics"/);
  assert.match(m, /\(valid for 30 days\):\nhttps:\/\/arvolab\.app\/share\/abc/);
  assert.match(danismanMesaji({ baslik: "Thesis" }, "en"), /I've attached the file\./);
});
