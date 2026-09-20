/*
  Asistanın dil modeliyle tek temas noktası.

  Neden ayrı bir katman: lib/ai-feedback.ts OpenAI'yi doğrudan çağırıyor,
  istek gövdesi, model adı, zaman aşımı ve hata metni oraya gömülü. İkinci
  yetenek (analiz denetimi) aynı kodu kopyalamak zorunda kalacaktı; sağlayıcı
  değişirse iki yerde düzeltme gerekirdi. Buradan sonra her yetenek `sor()`
  çağırır, sağlayıcıyı yalnızca bu dosya bilir.

  Zaman aşımı şart: fetch varsayılanda süresiz bekler. Vercel isteği kendi
  sınırında keser ve kullanıcı "hiçbir şey olmadı" görür; burada kesersek
  nedenini söyleyebiliyoruz.
*/

export type Rol = "sistem" | "kullanici";
export type Mesaj = { rol: Rol; metin: string };

export type SorSecenek = {
  model?: string;
  enFazlaJeton?: number;
  /** 0 = en kararlı. Denetim işi yaratıcılık istemez; varsayılan düşük. */
  sicaklik?: number;
  zamanAsimiMs?: number;
  /** Modelden JSON isteniyorsa true; sağlayıcı biçimi zorlar. */
  jsonBekle?: boolean;
};

export type Yanit = { metin: string; model: string };

export const VARSAYILAN_MODEL = "gpt-4o-mini";
const VARSAYILAN_ZAMAN_ASIMI = 45_000;

/** Anahtar yoksa özellik kapalı gösterilir; düğme boşuna tıklanmasın. */
export const aiYapilandirildi = () => Boolean(process.env.OPENAI_API_KEY);

/**
 * Sağlayıcı hatasını kullanıcının okuyabileceği Türkçeye çevirir. Saf
 * fonksiyon: testi tests/unit/ai-saglayici.test.ts. Gövde kullanıcıya
 * gösterilmez — sağlayıcı mesajları İngilizce ve zaman zaman anahtar
 * parçası, kuruluş kimliği gibi ayrıntılar içeriyor.
 */
export function saglayiciHatasi(durum: number, govde: string): string {
  if (durum === 401 || durum === 403)
    return "Yapay zeka anahtarı reddedildi. Anahtar silinmiş ya da başka bir hesaba ait olabilir.";
  if (durum === 429)
    return "Yapay zeka sağlayıcısı isteği sınırladı (kota ya da eşzamanlılık). Birkaç dakika sonra tekrar deneyin.";
  if (durum === 400 && /context length|maximum context/i.test(govde))
    return "Gönderilen metin modelin sınırını aştı. Daha kısa bir bölüm seçip tekrar deneyin.";
  if (durum >= 500)
    return "Yapay zeka sağlayıcısına ulaşılamıyor. Sorun sağlayıcı tarafında; birkaç dakika sonra tekrar deneyin.";
  return `Yapay zeka isteği başarısız oldu (HTTP ${durum}).`;
}

/** Sağlayıcıya sorar. Hata durumunda Türkçe mesajla Error fırlatır. */
export async function sor(mesajlar: Mesaj[], secenek: SorSecenek = {}): Promise<Yanit> {
  const anahtar = process.env.OPENAI_API_KEY;
  if (!anahtar)
    throw new Error("Yapay zeka anahtarı tanımlı değil (OPENAI_API_KEY). Yönetici ortam değişkenini eklemeli.");

  const model = secenek.model ?? process.env.OPENAI_MODEL ?? VARSAYILAN_MODEL;
  const kontrol = AbortSignal.timeout(secenek.zamanAsimiMs ?? VARSAYILAN_ZAMAN_ASIMI);

  let yanit: Response;
  try {
    yanit = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: kontrol,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anahtar}` },
      body: JSON.stringify({
        model,
        messages: mesajlar.map((m) => ({ role: m.rol === "sistem" ? "system" : "user", content: m.metin })),
        temperature: secenek.sicaklik ?? 0.2,
        max_tokens: secenek.enFazlaJeton ?? 900,
        ...(secenek.jsonBekle ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (hata) {
    // AbortSignal.timeout TimeoutError fırlatır; ağ hatası TypeError.
    if (hata instanceof Error && hata.name === "TimeoutError")
      throw new Error("Yapay zeka zamanında yanıt vermedi. Daha kısa bir metinle tekrar deneyin.");
    throw new Error("Yapay zeka sağlayıcısına bağlanılamadı.");
  }

  if (!yanit.ok) {
    const govde = await yanit.text().catch(() => "");
    console.error("[ai] sağlayıcı hatası", yanit.status, govde.slice(0, 500));
    throw new Error(saglayiciHatasi(yanit.status, govde));
  }

  const veri = await yanit.json().catch(() => null);
  const metin = veri?.choices?.[0]?.message?.content;
  if (typeof metin !== "string" || !metin.trim())
    throw new Error("Yapay zeka boş yanıt verdi. Tekrar deneyin.");

  return { metin, model };
}
