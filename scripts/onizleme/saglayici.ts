/*
  ÖNİZLEME TEST ASİSTANI — SABİT CEVAPLI YAPAY ZEKÂ SAĞLAYICISI
  (Signature OS 4.3, 05.11.2026).

  YALNIZCA ARVOLAB_ONIZLEME=1 ve ONIZLEME_AI=1 iken, geliştirme
  sunucusunda, `@/lib/ai/saglayici` yerine bu dosya çözülür
  (lib/onizleme-takmalari.ts). Üretim derlemesinde takma hiç kurulmaz ve
  bayrak açıksa derleme durur; bu dosya yine de kendini korur: üretimde ya
  da bayraklar kapalıyken `sor` HATA fırlatır.

  Gerçek sağlayıcının her şeyi (kurulum denetimi, hata mesajları, model
  seçimi) aynen dışa aktarılır; yalnızca ağa giden `sor` yer değiştirir.
  Cevaplar istemden DETERMİNİSTİK üretilir ve uygulamanın doğrulamasından
  (lib/ai/yazim-asistani.ts yazimDenetle: atıf yalnızca kütüphaneden, sayı
  yalnızca bağlamdan) aynen geçer. Kabul senaryoları için üç tetik:
    istekte "UYDURMA_SAYI"  → bağlamda olmayan bir sayı yazar (cevap düşmeli)
    istekte "UZUN"          → 160 kelimelik paragraf (otomatik sürüm eşiği)
    istekte "YAVAS"         → 3 sn bekler (cevap beklerken düzenleme senaryosu);
                              belgede imleçten önceki metinde "YAVAS" da aynı
                              (satır içi önerinin isteği boş: geç cevap senaryosu, C2-5)
    istekte "PROFIL"        → makale profilinin istemde olup olmadığını söyler
                              (Makale Aşama 2; sayı yazmaz, yalnızca soruyu yankılar)
*/
import type { Mesaj, SorSecenek, Yanit } from "../../lib/ai/saglayici";

export * from "../../lib/ai/saglayici";

export const TEST_ASISTANI_MODELI = "onizleme-test-asistani";

export function testAsistaniAcik(ortam: Record<string, string | undefined> = process.env): boolean {
  return ortam.NODE_ENV !== "production" && ortam.ARVOLAB_ONIZLEME === "1" && ortam.ONIZLEME_AI === "1";
}

const bolum = (metin: string, ad: string) => {
  const m = new RegExp(`${ad}:\\n([\\s\\S]*?)(?:\\n\\n[A-ZÇĞİÖŞÜ ]+:|$)`).exec(metin);
  return m ? m[1].trim() : "";
};

const PARAGRAF =
  "Bu bölümde enflasyon ile işsizlik arasındaki ilişkinin kuramsal çerçevesi ele alınmaktadır. Kısa dönemde gözlenen ters yönlü ilişki, beklentilerin uyarlanmasıyla birlikte uzun dönemde zayıflayabilmektedir.";

/** İstemden sabit cevap üretir (ağ yok). Saf: testler doğrudan çağırır. */
export function testCevabi(mesajlar: Mesaj[]): { yanit: string; metin: string } {
  const baglam = mesajlar.filter((m) => m.rol === "sistem").map((m) => m.metin).join("\n\n");
  const istek = mesajlar.at(-1)?.metin ?? "";
  const gorev = /GÖREV: (.*)/.exec(baglam)?.[1] ?? "";
  const secim = bolum(baglam, "SEÇİLİ METİN");

  if (istek.includes("PROFIL")) {
    const soru = /Araştırma sorusu: (.*)/.exec(baglam)?.[1]?.trim();
    const sinir = mesajlar.some((m) => m.rol === "sistem" && m.metin.startsWith("DERGİ SINIRLARI"));
    return {
      /* İşaret bloğun BAŞLIĞI: sistem isteminin 9. kuralı da "MAKALE PROFİLİ" diyor. */
      yanit: baglam.includes("MAKALE PROFİLİ (öğrencinin girdiği bilgiler)")
        ? `Test: makale profili VAR · soru: ${soru ?? "yok"} · dergi sınırları: ${sinir ? "istemde" : "yok"}`
        : "Test: makale profili YOK",
      metin: "",
    };
  }
  if (istek.includes("UYDURMA_SAYI")) return { yanit: "Test: bağlamda olmayan sayı.", metin: "Katılımcıların yüzde 73'ü bu görüşe katılmaktadır." };
  if (istek.includes("UZUN")) {
    const kelimeler = "akademik yazım sürecinde kavramsal tutarlılık kaynak kullanımı ve yöntemsel açıklık birlikte değerlendirilmelidir".split(" ");
    return { yanit: "Test: uzun paragraf.", metin: Array.from({ length: 160 }, (_, i) => kelimeler[i % kelimeler.length]).join(" ") + "." };
  }
  if (gorev.startsWith("Çalışma için bir ANA HAT")) {
    return { yanit: "Test: ana hat.", metin: "# Giriş\n- Bu bölümde araştırma sorusu açıklanır.\n## Araştırmanın amacı\n- Bu bölümde amaç ve kapsam belirtilir.\n# Yöntem\n- Bu bölümde veri ve yöntem anlatılır." };
  }
  if (gorev.startsWith("İmleçten önceki metni kaldığı yerden sürdür")) return { yanit: "", metin: " ve bu ilişki uzun dönemde zayıflamaktadır." };
  if (secim && gorev.startsWith("Seçili metni anlamını değiştirmeden akademik")) {
    return { yanit: "Test: akademik üslup.", metin: secim.replace(/\bbu\b/gi, "söz konusu").replace(/\.$/, "") + " şeklinde ifade edilebilir." };
  }
  if (secim && gorev.startsWith("Seçili metni anlamını koruyarak kısalt")) {
    const k = secim.split(/\s+/);
    return { yanit: "Test: kısaltma.", metin: k.slice(0, Math.max(3, Math.ceil(k.length / 2))).join(" ").replace(/[.,;:]?$/, ".") };
  }
  if (secim && gorev.startsWith("Seçili metni anlamını değiştirmeden, mevcut bilgilerle derinleştirerek")) {
    return { yanit: "Test: genişletme.", metin: `${secim} Bu durum, değişkenler arasındaki ilişkinin bağlama duyarlı olduğunu göstermektedir.` };
  }
  if (secim) return { yanit: "Test: seçili metin üzerinde serbest istek.", metin: `${secim.replace(/\.$/, "")}; bu bulgu tartışma bölümünde yeniden ele alınmalıdır.` };
  return { yanit: "Test: paragraf.", metin: PARAGRAF };
}

export async function sor(mesajlar: Mesaj[], secenek: SorSecenek = {}): Promise<Yanit> {
  if (!testAsistaniAcik()) {
    throw new Error("Önizleme test asistanı yalnızca geliştirme önizlemesinde (ARVOLAB_ONIZLEME=1, ONIZLEME_AI=1) çalışır.");
  }
  void secenek;
  const oncesi = mesajlar.filter((m) => m.rol === "sistem").map((m) => bolum(m.metin, "BELGEDE İMLEÇTEN ÖNCEKİ METİN")).join("");
  if ((mesajlar.at(-1)?.metin ?? "").includes("YAVAS") || oncesi.includes("YAVAS")) await new Promise((coz) => setTimeout(coz, 3_000));
  return { metin: JSON.stringify(testCevabi(mesajlar)), model: TEST_ASISTANI_MODELI, bitis: "stop" };
}
