/*
  Asistanın dil modeliyle tek temas noktası.

  ArvoLab hiçbir yapay zeka markasına bağımlı değildir: model, ortam
  değişkenleriyle seçilir ve kendi sunucunuzdaki açık ağırlıklı bir model de
  olabilir. Ollama, vLLM, LM Studio ve TGI aynı "chat/completions" arayüzünü
  konuştuğu için kod tarafında hiçbir fark yoktur — yalnızca AI_TABAN_URL
  değişir. Ürün arayüzünde sağlayıcının adı hiç geçmez; kullanıcı "ArvoLab
  Asistanı" görür.

  İki tel biçimi destekleniyor: "openai" (chat/completions — OpenAI, Ollama,
  vLLM, LM Studio, TGI hepsi bunu konuşur) ve "anthropic" (/v1/messages).
  Biçim adresten anlaşılır, AI_BICIM ile elle de verilebilir.

  AI_TABAN_URL   Sunucu adresi. Örn. http://10.0.0.5:11434/v1 (Ollama),
                 http://sunucu:8000/v1 (vLLM), https://api.anthropic.com/v1.
                 Verilmezse OPENAI_TABAN_URL, o da yoksa OpenAI'nin adresi
                 kullanılır (geçiş dönemi).
  AI_MODEL       Model adı. Örn. "qwen2.5:14b-instruct", "claude-sonnet-5".
  AI_ANAHTAR     Varsa gönderilir. Kendi sunucunuzda genellikle gerekmez;
                 eski kurulumlar için OPENAI_API_KEY de okunur.
  AI_BICIM       "openai" | "anthropic". Verilmezse adresten çıkarılır.

  Zaman aşımı şart: fetch varsayılanda süresiz bekler. Vercel isteği kendi
  sınırında keser ve kullanıcı "hiçbir şey olmadı" görür; burada kesersek
  nedenini söyleyebiliyoruz. Kendi sunucunuz soğuk başlangıçta yavaş
  olabildiği için sınır AI_ZAMAN_ASIMI_MS ile uzatılabilir.
*/

export type Rol = "sistem" | "kullanici";
export type Mesaj = { rol: Rol; metin: string };

export type SorSecenek = {
  model?: string;
  enFazlaJeton?: number;
  /** 0 = en kararlı. Denetim işi yaratıcılık istemez; varsayılan düşük. */
  sicaklik?: number;
  zamanAsimiMs?: number;
  /** Modelden JSON isteniyorsa true; destekleyen sunucu biçimi zorlar. */
  jsonBekle?: boolean;
};

export type Yanit = { metin: string; model: string };

const VARSAYILAN_TABAN_URL = "https://api.openai.com/v1";
export const VARSAYILAN_MODEL = "gpt-4o-mini";
const VARSAYILAN_ZAMAN_ASIMI = 45_000;

const tabanUrl = () =>
  (process.env.AI_TABAN_URL || process.env.OPENAI_TABAN_URL || VARSAYILAN_TABAN_URL).replace(/\/+$/, "");

const anahtar = () => process.env.AI_ANAHTAR || process.env.OPENAI_API_KEY || "";

export type Bicim = "openai" | "anthropic";

/** Tel biçimi: elle verilmemişse adresten çıkarılır. */
export function bicim(): Bicim {
  const secilen = (process.env.AI_BICIM || "").toLowerCase();
  if (secilen === "anthropic" || secilen === "openai") return secilen;
  // Son çapa şart: "anthropic.com.baskasi.net" Anthropic değildir ve
  // anahtarı onun başlık biçiminde göndermek yanlış sunucuya güven demekti.
  return /(^|\.)anthropic\.com$/.test(new URL(tabanUrl()).hostname) ? "anthropic" : "openai";
}

/*
  Kendi sunucumuzda mıyız? Anahtar zorunluluğu buna göre değişir. Bilinen
  bulut sağlayıcıları anahtar ister; geri kalan her adres kendi sunucumuz
  sayılır.
*/
const kendiSunucu = () => {
  const makine = new URL(tabanUrl()).hostname;
  return !/(^|\.)(openai\.com|anthropic\.com)$/.test(makine);
};

/**
 * Asistan bu kurulumda çalışabilir mi? Kendi sunucunuz tanımlıysa anahtar
 * aranmaz: yerel modeller genellikle anahtarsız çalışır ve anahtar şartı
 * koşmak özelliği sebepsiz kapatırdı.
 */
export const aiYapilandirildi = () => kendiSunucu() || Boolean(anahtar());

/** Günlüklerde hangi kuruluma gittiğini görmek için; sır içermez. */
export const aiKurulumu = () => ({ tabanUrl: tabanUrl(), model: process.env.AI_MODEL || process.env.OPENAI_MODEL || VARSAYILAN_MODEL });

/**
 * Sağlayıcı hatasını kullanıcının okuyabileceği Türkçeye çevirir. Saf
 * fonksiyon: testi tests/unit/ai-analiz-yorumu.test.ts. Gövde kullanıcıya
 * gösterilmez — sunucu mesajları İngilizce ve zaman zaman anahtar parçası,
 * kuruluş kimliği gibi ayrıntılar içeriyor.
 */
export function saglayiciHatasi(durum: number, govde: string): string {
  if (durum === 401 || durum === 403)
    return "Yapay zeka sunucusu isteği reddetti. Erişim anahtarı silinmiş ya da yanlış olabilir.";
  if (durum === 429)
    return "Yapay zeka sunucusu isteği sınırladı (kota ya da eşzamanlılık). Birkaç dakika sonra tekrar deneyin.";
  if (durum === 404)
    return "Yapay zeka sunucusunda bu model bulunamadı. Model adını (AI_MODEL) kontrol edin.";
  if (durum === 400 && /context length|maximum context|too long/i.test(govde))
    return "Gönderilen metin modelin sınırını aştı. Daha kısa bir bölüm seçip tekrar deneyin.";
  if (durum >= 500)
    return "Yapay zeka sunucusuna ulaşılamıyor. Sunucu kapalı ya da aşırı yüklü olabilir; birkaç dakika sonra tekrar deneyin.";
  return `Yapay zeka isteği başarısız oldu (HTTP ${durum}).`;
}

export type IstekBayraklari = { json: boolean; sicaklik: boolean };

/*
  Sunucular istemediğimiz bir parametreyi hata sayıp isteği tümden
  reddedebiliyor. İkisini gördük:
  - Açık ağırlıklı model sunucularının bir kısmı response_format'ı bilmiyor.
  - claude-sonnet-5 "temperature is deprecated for this model" diyor (canlıda
    20.09.2026'da HTTP 400; asistan hiçbir yetenekte çalışmadı).
  - Aynı model prefill de kabul etmiyor: "conversation must end with a user
    message". Prefill JSON'u garantilemek içindi; olmayınca istemdeki biçim
    talimatı ve toleranslı çözümleyici yetiyor.
  İkisi de isteğin vazgeçilebilir parçası: biçimi istemde zaten anlatıyoruz
  ve çözümleyici toleranslı. Bu yüzden hatayı kullanıcıya göstermeden önce
  suçlu parametreyi düşürüp bir kez daha deniyoruz.

  Saf fonksiyon; testi tests/unit/ai-saglayici.test.ts.
*/
export function parametreDusur(
  durum: number,
  govde: string,
  bayraklar: IstekBayraklari,
  bicimi: Bicim,
): IstekBayraklari | null {
  if (durum !== 400) return null;
  if (bayraklar.sicaklik && /temperature/i.test(govde) && /deprecat|unsupport|not supported|invalid|unrecognized/i.test(govde))
    return { ...bayraklar, sicaklik: false };
  // Anthropic'te JSON prefill ile isteniyor; desteklenmiyorsa prefill düşer.
  if (bayraklar.json && bicimi === "anthropic" && /prefill|end with a user message/i.test(govde))
    return { ...bayraklar, json: false };
  if (bayraklar.json && bicimi === "openai" && /response_format|json_object|not supported|unrecognized/i.test(govde))
    return { ...bayraklar, json: false };
  return null;
}

/*
  Öğrenilen ayarlar sunucu+model başına hatırlanır. Aksi halde her istek aynı
  reddi baştan yaşar: üç tur ağ gidiş dönüşü ve kullanıcı beklerken boşa
  geçen saniyeler. Bellek içi ve süreç ömrüyle sınırlı; yanlış öğrenilse bile
  en fazla bir istek kaybedilir.
*/
const ogrenilen = new Map<string, IstekBayraklari>();
const ogrenmeAnahtari = (model: string) => `${tabanUrl()}|${model}`;

type Istek = { model: string; mesajlar: Mesaj[]; secenek: SorSecenek } & IstekBayraklari;

/*
  Anthropic'te sistem istemi bir mesaj değil, üst düzey "system" alanı; ve
  response_format yok. JSON'u garantilemek için yanıt "{" ile başlatılıyor
  (prefill): model devamını yazıyor, biz başa "{" ekliyoruz. Belgelenmiş,
  güvenli bir yöntem ve çözümleyiciyi kurtarıyor.
*/
function anthropicGovde({ model, mesajlar, secenek, json, sicaklik }: Istek) {
  const sistem = mesajlar.filter((m) => m.rol === "sistem").map((m) => m.metin).join("\n\n");
  const govde: Record<string, unknown> = {
    model,
    max_tokens: secenek.enFazlaJeton ?? 2200,
    ...(sicaklik ? { temperature: secenek.sicaklik ?? 0.2 } : {}),
    messages: [
      ...mesajlar.filter((m) => m.rol !== "sistem").map((m) => ({ role: "user", content: m.metin })),
      ...(json ? [{ role: "assistant", content: "{" }] : []),
    ],
  };
  if (sistem) govde.system = sistem;
  return govde;
}

async function gonder(istek: Istek) {
  const { model, mesajlar, secenek, json, sicaklik } = istek;
  const basliklar: Record<string, string> = { "Content-Type": "application/json" };
  const key = anahtar();
  const anthropic = bicim() === "anthropic";

  if (key) {
    if (anthropic) basliklar["x-api-key"] = key;
    else basliklar.Authorization = `Bearer ${key}`;
  }
  if (anthropic) basliklar["anthropic-version"] = "2023-06-01";

  return fetch(`${tabanUrl()}${anthropic ? "/messages" : "/chat/completions"}`, {
    method: "POST",
    signal: AbortSignal.timeout(
      secenek.zamanAsimiMs ?? (Number(process.env.AI_ZAMAN_ASIMI_MS) || VARSAYILAN_ZAMAN_ASIMI),
    ),
    headers: basliklar,
    body: JSON.stringify(
      anthropic
        ? anthropicGovde(istek)
        : {
            model,
            messages: mesajlar.map((m) => ({ role: m.rol === "sistem" ? "system" : "user", content: m.metin })),
            ...(sicaklik ? { temperature: secenek.sicaklik ?? 0.2 } : {}),
            max_tokens: secenek.enFazlaJeton ?? 2200,
            ...(json ? { response_format: { type: "json_object" } } : {}),
          },
    ),
  });
}

/** İki biçimin yanıtından metni çıkarır. */
export function yanitMetni(veri: unknown, bicimi: Bicim, prefill: boolean): string | null {
  const kok = veri as { choices?: { message?: { content?: unknown } }[]; content?: { type?: string; text?: unknown }[] };
  const ham =
    bicimi === "anthropic"
      ? (kok?.content ?? []).filter((p) => p?.type === "text").map((p) => String(p.text ?? "")).join("")
      : kok?.choices?.[0]?.message?.content;
  if (typeof ham !== "string" || !ham.trim()) return null;
  // Prefill ile başlattığımız "{" yanıtta dönmüyor; başa geri konur.
  return bicimi === "anthropic" && prefill ? `{${ham}` : ham;
}

/** Modele sorar. Hata durumunda Türkçe mesajla Error fırlatır. */
export async function sor(mesajlar: Mesaj[], secenek: SorSecenek = {}): Promise<Yanit> {
  if (!aiYapilandirildi())
    throw new Error("Yapay zeka sunucusu tanımlı değil (AI_TABAN_URL ya da AI_ANAHTAR). Yönetici ortam değişkenlerini eklemeli.");

  const model = secenek.model ?? process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? VARSAYILAN_MODEL;
  const bicimi = bicim();
  const bilinen = ogrenilen.get(ogrenmeAnahtari(model));
  let istek: Istek = {
    model,
    mesajlar,
    secenek,
    // Çağıran JSON istemiyorsa önbellek onu açamaz.
    json: Boolean(secenek.jsonBekle) && (bilinen?.json ?? true),
    sicaklik: bilinen?.sicaklik ?? true,
  };

  async function calis(denenen: Istek) {
    let cevap: Response;
    try {
      cevap = await gonder(denenen);
    } catch (hata) {
      // AbortSignal.timeout TimeoutError fırlatır; ağ hatası TypeError.
      if (hata instanceof Error && hata.name === "TimeoutError")
        throw new Error("Yapay zeka zamanında yanıt vermedi. Daha kısa bir metinle tekrar deneyin.");
      throw new Error("Yapay zeka sunucusuna bağlanılamadı.");
    }
    return { cevap, govde: cevap.ok ? "" : await cevap.text().catch(() => "") };
  }

  let { cevap: yanit, govde } = await calis(istek);
  for (let deneme = 0; deneme < 2 && !yanit.ok; deneme += 1) {
    // Yalnızca bayraklar geçilir: istek nesnesinin tamamını verince dönen
    // nesne mesajları da taşıyor ve aşağıdaki günlüğe kullanıcının akademik
    // metni düşüyordu (canlıda 20.09.2026).
    const sonraki = parametreDusur(yanit.status, govde, { json: istek.json, sicaklik: istek.sicaklik }, bicimi);
    if (!sonraki) break;
    // Yalnızca bayraklar basılır: istek gövdesi kullanıcının akademik
    // metnini taşıyor, günlüğe düşmemeli.
    console.warn("[ai] sunucu parametreyi reddetti, düşürülüp tekrar deneniyor", { ...aiKurulumu(), ...sonraki });
    istek = { ...istek, ...sonraki };
    ({ cevap: yanit, govde } = await calis(istek));
  }

  if (!yanit.ok) {
    console.error("[ai] sunucu hatası", { ...aiKurulumu(), durum: yanit.status, govde: govde.slice(0, 500) });
    throw new Error(saglayiciHatasi(yanit.status, govde));
  }

  ogrenilen.set(ogrenmeAnahtari(model), {
    sicaklik: istek.sicaklik,
    // Bu istekte JSON istenmediyse desteklenmediğine dair bilgi yok.
    json: secenek.jsonBekle ? istek.json : (bilinen?.json ?? true),
  });

  const veri = await yanit.json().catch(() => null);
  const metin = yanitMetni(veri, bicimi, istek.json);
  if (!metin) throw new Error("Yapay zeka boş yanıt verdi. Tekrar deneyin.");

  return { metin, model };
}
