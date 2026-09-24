/**
 * Belge geri bildirimi (ArvoLab Asistanı)
 * ------------------------------------------------------------
 * Başlıkta bir zamanlar "ChatGPT/OpenAI" yazıyordu; çağrı ortak
 * katmana taşındıktan sonra da kalmıştı ve hem dosya hem düğme
 * yanlış sağlayıcıyı söylüyordu. Model ortam değişkeniyle seçilir
 * (lib/ai/saglayici.ts); arayüzde ve burada marka adı geçmez.
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

import { aiYapilandirildi, sor } from "@/lib/ai/saglayici";

const MAX_INPUT_CHARS = 12000; // ~3000 token civarı, maliyet/limit kontrolü için

export const SYSTEM_PROMPT = `Sen bir akademik yazım koçusun. Sana bir öğrencinin tez/makale taslağından bir alıntı verilecek.

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
  /*
    Modele GERÇEKTEN gönderilen metin. Asistan kaydına belgenin tamamı
    yazılırsa kayıt yalan söyler: model 12000 karakterden fazlasını hiç
    görmedi. Bu kayıt ArvoLab'ın eğitim verisi — girdisi yanlış yazılmış
    bir örnek, modele görmediği bir metinden sonuç çıkarmayı öğretir.
  */
  girdi: string;
}

/** Sunucu tanımlı değilse özellik kapalı gösterilir; düğme boşuna tıklanmasın. */
export const aiFeedbackConfigured = () => aiYapilandirildi();

export async function getDocumentFeedback(text: string): Promise<AiFeedbackResult> {
  const truncated = text.length > MAX_INPUT_CHARS;
  const inputText = truncated ? text.slice(0, MAX_INPUT_CHARS) : text;

  /*
    Eskiden burada doğrudan OpenAI çağrılıyordu: adres, model adı, zaman
    aşımı ve hata metni bu dosyaya gömülüydü. Artık ortak katman üzerinden
    gidiyor (lib/ai/saglayici.ts), böylece kendi sunucumuzdaki modele
    geçmek bu dosyada hiçbir değişiklik gerektirmiyor.
  */
  const yanit = await sor(
    [
      { rol: "sistem", metin: SYSTEM_PROMPT },
      { rol: "kullanici", metin: `İncelenecek metin:\n\n${inputText}` },
    ],
    { yetenek: "belge", sicaklik: 0.4, enFazlaJeton: 700 },
  );

  return { feedback: yanit.metin, model: yanit.model, truncated, girdi: inputText };
}
