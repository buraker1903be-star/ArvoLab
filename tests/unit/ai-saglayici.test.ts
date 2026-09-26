import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { aiKurulumSorunu, aiYapilandirildi, bicim, parametreDusur, yanitMetni, yetenekModeli } from "../../lib/ai/saglayici";

const KAYITLI = { ...process.env };
afterEach(() => {
  for (const ad of ["AI_TABAN_URL", "AI_BICIM", "OPENAI_TABAN_URL", "AI_MODEL_LITERATUR", "AI_MODEL_ANALIZ", "AI_ANAHTAR", "OPENAI_API_KEY"])
    delete process.env[ad];
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

  test("response_format bilinmiyorsa JSON biçimi düşer (openai)", () => {
    const govde = '{"error":{"message":"response_format is not supported"}}';
    assert.deepEqual(parametreDusur(400, govde, tam, "openai"), { json: false, sicaklik: true });
  });

  test("prefill desteklenmiyorsa JSON biçimi düşer (anthropic)", () => {
    // claude-sonnet-5: "conversation must end with a user message".
    const govde = '{"error":{"message":"This model does not support assistant message prefill. The conversation must end with a user message."}}';
    assert.deepEqual(parametreDusur(400, govde, { json: true, sicaklik: false }, "anthropic"), {
      json: false,
      sicaklik: false,
    });
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

describe("yeteneğe göre model", () => {
  test("tanımlıysa o yetenekte kullanılır", () => {
    // Riskler eşit değil: literatür arama dizesi üretmek daha kalıplı bir iş
    // ve en çok jetonu o harcıyor; analiz ve kaynakça ince çıkarım ister.
    process.env.AI_MODEL_LITERATUR = "claude-haiku-4-5-20251001";
    assert.equal(yetenekModeli("literatur"), "claude-haiku-4-5-20251001");
    assert.equal(yetenekModeli("analiz"), undefined, "tanımsız yetenek varsayılana düşer");
  });

  test("boş değer varsayılanı ezmez", () => {
    // Vercel'de değişkeni boş bırakmak silmekle aynı olmalı.
    process.env.AI_MODEL_ANALIZ = "   ";
    assert.equal(yetenekModeli("analiz"), undefined);
  });

  test("yetenek verilmezse seçim yapılmaz", () => {
    assert.equal(yetenekModeli(), undefined);
  });
});

describe("kurulum durumu", () => {
  const kurulum = (tabanUrl?: string, anahtar?: string) => {
    for (const ad of ["AI_TABAN_URL", "OPENAI_TABAN_URL", "AI_ANAHTAR", "OPENAI_API_KEY"]) delete process.env[ad];
    if (tabanUrl !== undefined) process.env.AI_TABAN_URL = tabanUrl;
    if (anahtar !== undefined) process.env.AI_ANAHTAR = anahtar;
  };

  test("kendi sunucusu anahtarsız çalışır", () => {
    // Yerel modeller genellikle anahtarsız; şart koşmak özelliği sebepsiz kapatırdı.
    kurulum("http://10.0.0.5:11434/v1");
    assert.equal(aiKurulumSorunu(), null);
    assert.equal(aiYapilandirildi(), true);
  });

  test("bulut sağlayıcı anahtar ister", () => {
    kurulum("https://api.anthropic.com/v1");
    assert.match(aiKurulumSorunu() ?? "", /AI_ANAHTAR/);
    assert.equal(aiYapilandirildi(), false);
    kurulum("https://api.anthropic.com/v1", "sk-test");
    assert.equal(aiKurulumSorunu(), null);
  });

  test("BOZUK adres çökertmiyor, sebebini söylüyor", () => {
    /*
      Gerileme: adres new URL ile ayrıştırılıyordu ve bozuk değerde
      FIRLATIYORDU. Kapı (aiYapilandirildi) ve tel biçimi seçimi (bicim)
      birlikte çöküyor, yani "özellik kapalı, sebebi şu" mesajı hiç
      görünmüyor ve kullanıcıya anlamsız bir sunucu hatası çıkıyordu.

      Gerçekten olan değerler: ortam değişkenine kaçan tek bir boşluk ve
      şemasız adres — ikincisi kendi sunucusunu tanımlayan yöneticinin en
      olası hatası.
    */
    for (const bozuk of [" ", "http://", "10.0.0.5:11434/v1", "api.openai.com/v1", "localhost:11434"]) {
      kurulum(bozuk, "sk-test");
      const sorun = aiKurulumSorunu();
      assert.match(sorun ?? "", /AI_TABAN_URL/, `${JSON.stringify(bozuk)} için sebep yazılmalı`);
      assert.match(sorun ?? "", /şema/i, `${JSON.stringify(bozuk)}: nasıl düzeltileceği yazılmalı`);
      assert.equal(aiYapilandirildi(), false, `${JSON.stringify(bozuk)} açık sayılmamalı`);
      // Biçim seçimi de çökmemeli: varsayılana düşer.
      assert.equal(bicim(), "openai", `${JSON.stringify(bozuk)}: bicim() çökmemeli`);
    }
  });

  test("adresin başındaki ve sonundaki boşluk sorun değil", () => {
    // new URL kırpıyor; bunu kaybetmek gereksiz bir arıza olurdu.
    kurulum("  https://api.anthropic.com/v1  ", "sk-test");
    assert.equal(aiKurulumSorunu(), null);
    assert.equal(bicim(), "anthropic");
  });

  test("adres hiç verilmezse bulut varsayılanı ve anahtar şartı", () => {
    kurulum();
    assert.match(aiKurulumSorunu() ?? "", /AI_ANAHTAR/);
    kurulum(undefined, "sk-test");
    assert.equal(aiKurulumSorunu(), null);
  });
});
