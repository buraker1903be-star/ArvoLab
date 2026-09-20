/*
  Asistanın dil modeliyle tek temas noktası.

  ArvoLab hiçbir yapay zeka markasına bağımlı değildir: model, ortam
  değişkenleriyle seçilir ve kendi sunucunuzdaki açık ağırlıklı bir model de
  olabilir. Ollama, vLLM, LM Studio ve TGI aynı "chat/completions" arayüzünü
  konuştuğu için kod tarafında hiçbir fark yoktur — yalnızca AI_TABAN_URL
  değişir. Ürün arayüzünde sağlayıcının adı hiç geçmez; kullanıcı "ArvoLab
  Asistanı" görür.

  AI_TABAN_URL   Sunucu adresi. Örn. http://10.0.0.5:11434/v1 (Ollama),
                 http://sunucu:8000/v1 (vLLM). Verilmezse OPENAI_TABAN_URL,
                 o da yoksa OpenAI'nin adresi kullanılır (geçiş dönemi).
  AI_MODEL       Model adı. Örn. "qwen2.5:14b-instruct".
  AI_ANAHTAR     Varsa gönderilir. Kendi sunucunuzda genellikle gerekmez;
                 eski kurulumlar için OPENAI_API_KEY de okunur.

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

/** Kendi sunucumuzda mıyız? Anahtar zorunluluğu buna göre değişir. */
const kendiSunucu = () => tabanUrl() !== VARSAYILAN_TABAN_URL;

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

/** response_format desteklemeyen sunucularda gelen hata mı? */
const jsonDesteklenmiyor = (durum: number, govde: string) =>
  durum === 400 && /response_format|json_object|not supported|unrecognized/i.test(govde);

type Istek = { model: string; mesajlar: Mesaj[]; secenek: SorSecenek; json: boolean };

async function gonder({ model, mesajlar, secenek, json }: Istek) {
  const basliklar: Record<string, string> = { "Content-Type": "application/json" };
  const key = anahtar();
  if (key) basliklar.Authorization = `Bearer ${key}`;

  return fetch(`${tabanUrl()}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(
      secenek.zamanAsimiMs ?? (Number(process.env.AI_ZAMAN_ASIMI_MS) || VARSAYILAN_ZAMAN_ASIMI),
    ),
    headers: basliklar,
    body: JSON.stringify({
      model,
      messages: mesajlar.map((m) => ({ role: m.rol === "sistem" ? "system" : "user", content: m.metin })),
      temperature: secenek.sicaklik ?? 0.2,
      max_tokens: secenek.enFazlaJeton ?? 900,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
}

/** Modele sorar. Hata durumunda Türkçe mesajla Error fırlatır. */
export async function sor(mesajlar: Mesaj[], secenek: SorSecenek = {}): Promise<Yanit> {
  if (!aiYapilandirildi())
    throw new Error("Yapay zeka sunucusu tanımlı değil (AI_TABAN_URL ya da AI_ANAHTAR). Yönetici ortam değişkenlerini eklemeli.");

  const model = secenek.model ?? process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? VARSAYILAN_MODEL;
  const istek: Istek = { model, mesajlar, secenek, json: Boolean(secenek.jsonBekle) };

  let yanit: Response;
  try {
    yanit = await gonder(istek);
  } catch (hata) {
    // AbortSignal.timeout TimeoutError fırlatır; ağ hatası TypeError.
    if (hata instanceof Error && hata.name === "TimeoutError")
      throw new Error("Yapay zeka zamanında yanıt vermedi. Daha kısa bir metinle tekrar deneyin.");
    throw new Error("Yapay zeka sunucusuna bağlanılamadı.");
  }

  if (!yanit.ok) {
    let govde = await yanit.text().catch(() => "");
    /*
      Açık ağırlıklı model sunucularının bir kısmı response_format'ı
      bilmiyor ve isteği tümden reddediyor. Biçimi istemde zaten
      anlatıyoruz (lib/ai/bulgu.ts), çözümleyici de toleranslı; bu yüzden
      bir kez de onsuz deniyoruz. Aksi halde kendi sunucusuna geçen kurulum
      hiçbir yetenekte çalışmazdı.
    */
    if (istek.json && jsonDesteklenmiyor(yanit.status, govde)) {
      yanit = await gonder({ ...istek, json: false }).catch(() => yanit);
      if (!yanit.ok) govde = await yanit.text().catch(() => "");
    }
    if (!yanit.ok) {
      console.error("[ai] sunucu hatası", { ...aiKurulumu(), durum: yanit.status, govde: govde.slice(0, 500) });
      throw new Error(saglayiciHatasi(yanit.status, govde));
    }
  }

  const veri = await yanit.json().catch(() => null);
  const metin = veri?.choices?.[0]?.message?.content;
  if (typeof metin !== "string" || !metin.trim())
    throw new Error("Yapay zeka boş yanıt verdi. Tekrar deneyin.");

  return { metin, model };
}
