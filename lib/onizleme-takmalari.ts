/*
  YEREL ÖNİZLEMENİN MODÜL TAKMALARI (next.config.ts) — saf ve testli
  (tests/unit/onizleme-takmalari.test.ts).

  ARVOLAB_ONIZLEME=1: Supabase istemcileri örnek veri döndüren sahteleriyle
  değişir (04.11.2026, scripts/onizleme/).

  ONIZLEME_AI=1 (Signature OS 4.3, 05.11.2026): ek olarak yapay zekâ
  sağlayıcısı (lib/ai/saglayici.ts) SABİT cevaplı bir test asistanıyla
  değişir (scripts/onizleme/saglayici.ts): yazım asistanının kabul, ret,
  geri al ve sürüm akışları dış AI sunucusu olmadan uçtan uca sınanabilsin.
  Asistanın DOĞRULAMASI (atıf yalnızca kütüphaneden, sayı yalnızca
  bağlamdan) takılmaz; sahte cevaplar da ondan geçer.

  ONIZLEME_ABONELIK=aktif|bitti (Signature OS 4.4, 05.11.2026): ArvoOS
  abonelik köprüsü (lib/subscription.ts) ÖRNEK cevaplarla değişir
  (scripts/onizleme/abonelik.ts): Abonelik ve Kredi ekranının plan kartı,
  paketleri, proforma ve ödeme listesi köprü olmadan hiç görülemiyordu,
  önizlemede yalnızca "okunamadı" hâli vardı. Gerçek köprüye dokunulmaz.

  ÜRETİMDE HİÇBİRİ OLAMAZ: bayrak üretim derlemesinde açıksa bu işlev
  hata fırlatır ve derleme DURUR. Sahte sağlayıcının canlıya çıkması,
  öğrenciye uydurma metnin "asistan cevabı" diye gösterilmesi demek.
  Gerçek AI gateway'e (lib/ai/saglayici.ts) dokunulmaz; yalnızca önizlemede
  modül çözümlemesi başka dosyayı gösterir.
*/
export function onizlemeTakmalari(ortam: Record<string, string | undefined>): Record<string, string> | null {
  const onizleme = ortam.ARVOLAB_ONIZLEME === "1";
  const ai = ortam.ONIZLEME_AI === "1";
  const abonelik = Boolean(ortam.ONIZLEME_ABONELIK);
  const uretim = ortam.NODE_ENV === "production";
  if (uretim && onizleme) throw new Error("ARVOLAB_ONIZLEME üretim derlemesinde açık olamaz.");
  if (uretim && ai) throw new Error("ONIZLEME_AI üretim derlemesinde açık olamaz.");
  if (uretim && abonelik) throw new Error("ONIZLEME_ABONELIK üretim derlemesinde açık olamaz.");
  if (!onizleme) {
    if (ai) throw new Error("ONIZLEME_AI yalnızca ARVOLAB_ONIZLEME=1 ile birlikte kullanılabilir.");
    if (abonelik) throw new Error("ONIZLEME_ABONELIK yalnızca ARVOLAB_ONIZLEME=1 ile birlikte kullanılabilir.");
    return null;
  }
  return {
    "@/lib/supabase/server": "./scripts/onizleme/server.ts",
    "@/lib/supabase/client": "./scripts/onizleme/client.ts",
    "@/lib/supabase/admin": "./scripts/onizleme/admin.ts",
    ...(ai ? { "@/lib/ai/saglayici": "./scripts/onizleme/saglayici.ts" } : {}),
    ...(abonelik ? { "@/lib/subscription": "./scripts/onizleme/abonelik.ts" } : {}),
  };
}

/*
  ÖNİZLEME BAYRAKLARININ BEYANI (G1 Aşama 5, 10.11.2026). Kabul betikleri
  sunucuya dışarıdan bakıyor ve hangi bayraklarla başlatıldığını bilmiyordu:
  yazma kipi kapalı bir sunucuya karşı koşulan otomatik kayıt kabulü
  "çakışma gösterilmedi" diye düştü ve bu bir gün boyunca ürün hatası
  sanıldı (sahte istemci yazmayı uygulamadığı için sürüm hiç ilerlemiyordu).
  Bayrakları davranıştan tahmin etmek her betikte ayrı ve kırılgan bir
  yoklama demekti. next.config.ts bu değeri YALNIZCA önizlemede bir yanıt
  başlığına (x-arvolab-onizleme) yazar; betikler oradan okur
  (scripts/onizleme/onkosul.mjs).
  Yalnızca gizli olmayan, önizlemeye özgü bayraklar: anahtar, adres ya da
  kimlik buraya girmez. Önizleme kapalıysa (üretim dahil) null: başlık
  hiç yazılmaz, yani üretimdeki yanıtlar değişmez.
*/
export const ONIZLEME_BASLIGI = "x-arvolab-onizleme";

export function onizlemeBayraklari(ortam: Record<string, string | undefined>): string | null {
  if (ortam.ARVOLAB_ONIZLEME !== "1" || ortam.NODE_ENV === "production") return null;
  /* Değerler süzülür: başlığa yalnızca [a-z0-9_-] girer, beklenmeyen metin başlığı bozmasın. */
  const temiz = (d: string | undefined) => (d ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
  const ciftler: [string, string][] = [
    ["yaz", ortam.ONIZLEME_YAZ === "1" ? "1" : "0"],
    ["ai", ortam.ONIZLEME_AI === "1" ? "1" : "0"],
    ["senaryo", temiz(ortam.ONIZLEME_SENARYO) || "varsayilan"],
    ["oturum", ortam.ONIZLEME_OTURUM === "yok" ? "yok" : "var"],
    ["abonelik", temiz(ortam.ONIZLEME_ABONELIK) || "yok"],
    ["hak", ortam.ONIZLEME_HAK === "bitti" ? "bitti" : "var"],
    ["bos", ortam.ONIZLEME_BOS === "1" ? "1" : "0"],
    ["rol", temiz(ortam.ONIZLEME_ROL) || "varsayilan"],
  ];
  return ciftler.map(([a, d]) => `${a}=${d}`).join(";");
}
