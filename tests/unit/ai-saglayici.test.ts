import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { bicim, parametreDusur, yanitMetni } from "../../lib/ai/saglayici";

const KAYITLI = { ...process.env };
afterEach(() => {
  for (const ad of ["AI_TABAN_URL", "AI_BICIM", "OPENAI_TABAN_URL"]) delete process.env[ad];
  Object.assign(process.env, KAYITLI);
});

describe("tel biçimi", () => {
  test("adresten çıkarılır", () => {
    process.env.AI_TABAN_URL = "https://api.anthropic.com/v1";
    assert.equal(bicim(), "anthropic");
    process.env.AI_TABAN_URL = "http://10.0.0.5:11434/v1";
    assert.equal(bicim(), "openai");
  });

  test("elle verilen biçim adresi ezer", () => {
    // Vekil sunucu arkasındaki kurulumda adres ipucu vermeyebilir.
    process.env.AI_TABAN_URL = "https://vekil.arvolab.local/v1";
    process.env.AI_BICIM = "anthropic";
    assert.equal(bicim(), "anthropic");
  });

  test("benzer görünen alan adı Anthropic sayılmaz", () => {
    process.env.AI_TABAN_URL = "https://anthropic.com.saldirgan.net/v1";
    assert.equal(bicim(), "openai");
  });
});

describe("yanıt metni", () => {
  test("openai biçimi", () => {
    assert.equal(yanitMetni({ choices: [{ message: { content: "merhaba" } }] }, "openai", false), "merhaba");
  });

  test("anthropic metin parçaları birleşir", () => {
    const veri = { content: [{ type: "text", text: "bir" }, { type: "thinking", text: "yok" }, { type: "text", text: " iki" }] };
    assert.equal(yanitMetni(veri, "anthropic", false), "bir iki");
  });

  test("prefill ile başlatılan JSON tamamlanır", () => {
    // Anthropic'te response_format yok; yanıt "{" ile başlatılıyor ve o
    // karakter yanıtta dönmüyor. Başa konmazsa JSON hiç çözümlenemez.
    const veri = { content: [{ type: "text", text: '"bulgular":[]}' }] };
    assert.equal(yanitMetni(veri, "anthropic", true), '{"bulgular":[]}');
  });

  test("boş yanıt null döner", () => {
    assert.equal(yanitMetni({ content: [] }, "anthropic", true), null);
    assert.equal(yanitMetni({ choices: [] }, "openai", false), null);
  });
});

describe("reddedilen parametreyi düşürme", () => {
  const tam = { json: true, sicaklik: true };

  test("temperature deprecated ise sıcaklık düşer", () => {
    // 20.09.2026 canlı hatası: claude-sonnet-5 temperature kabul etmiyor ve
    // isteği tümden reddediyordu; asistan hiçbir yetenekte çalışmadı.
    const govde = '{"error":{"message":"`temperature` is deprecated for this model."}}';
    assert.deepEqual(parametreDusur(400, govde, tam, "anthropic"), { json: true, sicaklik: false });
  });

  test("response_format bilinmiyorsa JSON biçimi düşer (yalnızca openai)", () => {
    const govde = '{"error":{"message":"response_format is not supported"}}';
    assert.deepEqual(parametreDusur(400, govde, tam, "openai"), { json: false, sicaklik: true });
    // Anthropic'te JSON prefill ile isteniyor; düşürülecek parametre yok.
    assert.equal(parametreDusur(400, govde, { json: true, sicaklik: false }, "anthropic"), null);
  });

  test("zaten düşürülmüş parametre ikinci kez düşürülmez", () => {
    const govde = '{"error":{"message":"`temperature` is deprecated for this model."}}';
    assert.equal(parametreDusur(400, govde, { json: false, sicaklik: false }, "anthropic"), null);
  });

  test("400 dışındaki hatalarda ve ilgisiz gövdede dokunulmaz", () => {
    assert.equal(parametreDusur(401, "`temperature` is deprecated", tam, "anthropic"), null);
    assert.equal(parametreDusur(400, "credit balance is too low", tam, "anthropic"), null);
  });
});
