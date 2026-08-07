/**
 * AI Geri Bildirimi (ChatGPT/OpenAI)
 * ------------------------------------------------------------
 * KRİTİK SINIR: Bu modül İÇERİK ÜRETMEZ. Yapay zeka yalnızca
 * yüklenen belgenin YAPISI ve RETORİĞİ hakkında öğretici geri
 * bildirim verir. Aşağıdaki sistem prompt'u özellikle:
 *   - Modelin yeniden yazım / alternatif cümle-paragraf önermesini,
 *   - Araştırma bulgularının anlamını yorumlamasını,
 *   - Doğrudan kopyalanabilir herhangi bir metin üretmesini
 * YASAKLAR. Yalnızca kısa, madde işaretli, "neyin eksik/zayıf
 * olduğunu ve NEDEN" açıklayan geri bildirim ister.
 *
 * Bu, prompt seviyesinde bir kısıtlamadır — modelin bu talimata
 * tam uyacağının garantisi yoktur, bu yüzden arayüz seviyesinde
 * de (belirgin "kopyalamayın" uyarısı, düz metin değil madde
 * işaretli görünüm) ek bir güvenlik katmanı uygulanır.
 */

const MAX_INPUT_CHARS = 12000; // ~3000 token civarı, maliyet/limit kontrolü için

const SYSTEM_PROMPT = `Sen bir akademik yazım koçusun. Sana bir öğrencinin tez/makale taslağından bir alıntı verilecek.

GÖREVİN: Metnin YAPISI ve RETORİĞİ hakkında öğretici geri bildirim vermek. Örnek geri bildirim türleri:
- Giriş bölümünde araştırmanın amacı/sorusu net ifade edilmemiş
- Bu paragrafta tek bir ana fikir yerine birden fazla fikir karışık veriliyor
- Yöntem bölümünde örneklem seçim gerekçesi eksik
- Bu iddia bir kaynakla desteklenmemiş görünüyor (metinde atıf yok)
- Tartışma bölümünde çalışmanın sınırlılıklarına değinilmemiş
- Paragraflar arası geçişler kopuk, akış zayıf

KESİNLİKLE YAPMAYACAKLARIN (çok önemli):
1. Metni yeniden yazma, alternatif cümle veya paragraf ÖNERME. Öğrencinin kendi çalışmasına doğrudan yapıştırabileceği HİÇBİR metin üretme.
2. Araştırma bulgularının ne anlama geldiğini YORUMLAMA (bu öğrencinin/danışmanının işidir) — sadece "bu bulgu nasıl sunulmuş" düzeyinde yapısal geri bildirim ver.
3. Uzun, akıcı paragraflar yazma. Yalnızca kısa madde işaretli (3-8 madde) geri bildirim listesi ver.
4. Her maddede NE eksik/zayıf olduğunu ve KISACA NEDEN önemli olduğunu belirt — ama nasıl düzeltileceğine dair hazır cümle verme, sadece yönlendirici bir soru veya ilke belirt.

Yanıtını yalnızca Türkçe, madde işaretli liste olarak ver. Genel giriş/kapanış cümlesi ekleme, doğrudan maddelerle başla.`;

export interface AiFeedbackResult {
  feedback: string;
  model: string;
  truncated: boolean;
}

export async function getDocumentFeedback(text: string): Promise<AiFeedbackResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY tanımlı değil. Vercel proje ayarlarına bu ortam değişkenini eklemeniz gerekiyor."
    );
  }

  const truncated = text.length > MAX_INPUT_CHARS;
  const inputText = truncated ? text.slice(0, MAX_INPUT_CHARS) : text;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `İncelenecek metin:\n\n${inputText}` },
      ],
      temperature: 0.4,
      max_tokens: 700,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`OpenAI API hatası (HTTP ${res.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await res.json();
  const feedback = data?.choices?.[0]?.message?.content;
  if (!feedback) {
    throw new Error("OpenAI API beklenen formatta yanıt vermedi.");
  }

  return { feedback, model, truncated };
}
