import { describe, test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  AiHatasi,
  aiHataMesaji,
  aiKurulumSorunu,
  aiYapilandirildi,
  bicim,
  bilinenBayraklar,
  parametreDusur,
  saglayiciHatasi,
  sor,
  yanitMetni,
  yetenekModeli,
} from "../../lib/ai/saglayici";

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

import { bitisSebebi, butceyeTakildi } from "../../lib/ai/saglayici";

describe("boş yanıtın sebebi", () => {
  test("iki biçimde sonlanma sebebi okunur; bütçeye takılma ayırt edilir", () => {
    assert.equal(bitisSebebi({ choices: [{ message: { content: "" }, finish_reason: "length" }] }, "openai"), "length");
    assert.equal(bitisSebebi({ content: [], stop_reason: "max_tokens" }, "anthropic"), "max_tokens");
    assert.equal(bitisSebebi(null, "openai"), null);
    assert.equal(butceyeTakildi("length"), true);
    assert.equal(butceyeTakildi("max_tokens"), true);
    assert.equal(butceyeTakildi("stop"), false);
    assert.equal(butceyeTakildi(null), false);
  });
});

describe("İngilizce hata metinleri", () => {
  test("sağlayıcı hatası iki dilde", () => {
    assert.equal(saglayiciHatasi(429, "", "en"), "The AI server rate-limited the request (quota or concurrency). Try again in a few minutes.");
    assert.match(saglayiciHatasi(429, ""), /^Yapay zeka sunucusu isteği sınırladı/);
  });

  test("AiHatasi: message Türkçe kalır, aiHataMesaji dili seçer", () => {
    const hata = new AiHatasi({ tr: "Türkçe", en: "English" });
    assert.equal(hata.message, "Türkçe");
    assert.equal(aiHataMesaji(hata, "en"), "English");
    assert.equal(aiHataMesaji(hata), "Türkçe");
    assert.equal(aiHataMesaji(new Error("düz"), "en"), "düz");
    assert.equal(aiHataMesaji("x", "en"), null);
  });
});

test("kurulum sorunu İngilizce", () => {
  process.env.AI_TABAN_URL = "10.0.0.5:11434/v1";
  assert.match(aiKurulumSorunu("en") ?? "", /^The AI server address could not be read \(AI_TABAN_URL\)/);
});

describe("bilinen modelin başlangıç bayrakları (RC06i, 17.11.2026)", () => {
  test("claude-sonnet-5: ne temperature ne prefill (canlıda ve RC06i'de ikisi de 400)", () => {
    assert.deepEqual(bilinenBayraklar("claude-sonnet-5", "anthropic"), { json: false, sicaklik: false });
  });

  test("5 ailesi ve 4.7/4.8: ikisi de kapalı; sağlayıcı öneki ve tarih eki model kimliğini değiştirmez", () => {
    for (const m of ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-2", "claude-mythos-5-1", "claude-opus-4-8", "claude-opus-4-7", "anthropic.claude-opus-5-5", "us.anthropic.claude-sonnet-5", "Claude-Sonnet-5"])
      assert.deepEqual(bilinenBayraklar(m, "anthropic"), { json: false, sicaklik: false }, m);
  });

  test("Opus/Sonnet 4.6: yalnız prefill kapalı, sıcaklık gönderilir", () => {
    assert.deepEqual(bilinenBayraklar("claude-opus-4-6", "anthropic"), { json: false, sicaklik: true });
    assert.deepEqual(bilinenBayraklar("claude-sonnet-4-6", "anthropic"), { json: false, sicaklik: true });
  });

  test("Haiku 4.5 ve eski modeller tabloda yok: eski davranış (öğrenme) sürer", () => {
    for (const m of ["claude-haiku-4-5-20251001", "claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5-20251101", "claude-sonnet-50", "qwen2.5:14b-instruct"])
      assert.equal(bilinenBayraklar(m, "anthropic"), undefined, m);
  });

  test("OpenAI tel biçiminde tablo uygulanmaz (ağ geçidi model adını kendisi çevirir)", () => {
    assert.equal(bilinenBayraklar("claude-sonnet-5", "openai"), undefined);
  });
});

describe("sor(): bilinen modelde ilk istek reddedilecek parametreyi taşımaz", () => {
  const gercekFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = gercekFetch;
  });

  async function ilkGovde(model: string, taban: string) {
    process.env.AI_TABAN_URL = taban;
    process.env.AI_BICIM = "anthropic";
    process.env.AI_ANAHTAR = "test-degil";
    const govdeler: Record<string, unknown>[] = [];
    globalThis.fetch = (async (_adres: string, secenek: { body: string }) => {
      govdeler.push(JSON.parse(secenek.body) as Record<string, unknown>);
      return new Response(JSON.stringify({ content: [{ type: "text", text: '{"tamam": true}' }], stop_reason: "end_turn" }), { status: 200 });
    }) as unknown as typeof fetch;
    await sor([{ rol: "sistem", metin: "s" }, { rol: "kullanici", metin: "k" }], { model, jsonBekle: true, sicaklik: 0 });
    return govdeler;
  }

  test("claude-sonnet-5: tek istek, temperature yok, son mesaj kullanıcının", async () => {
    // Eskiden: 400 (temperature) → 400 (prefill) → 200; soğuk örnek başına üç istek.
    const govdeler = await ilkGovde("claude-sonnet-5", "http://127.0.0.1:1/v1-sonnet5");
    assert.equal(govdeler.length, 1);
    assert.equal("temperature" in govdeler[0], false);
    const mesajlar = govdeler[0].messages as { role: string }[];
    assert.equal(mesajlar.at(-1)?.role, "user");
  });

  test("claude-haiku-4-5: davranış değişmedi (temperature ve prefill gönderilir)", async () => {
    const govdeler = await ilkGovde("claude-haiku-4-5-20251001", "http://127.0.0.1:1/v1-haiku45");
    assert.equal(govdeler.length, 1);
    assert.equal(govdeler[0].temperature, 0);
    const mesajlar = govdeler[0].messages as { role: string; content: string }[];
    assert.deepEqual(mesajlar.at(-1), { role: "assistant", content: "{" });
  });
});
