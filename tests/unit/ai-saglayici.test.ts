import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { bicim, yanitMetni } from "../../lib/ai/saglayici";

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
