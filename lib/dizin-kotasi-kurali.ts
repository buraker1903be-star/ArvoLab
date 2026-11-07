import { dagitimOrtamiCoz } from "@/lib/supabase/ortam-guvenligi";
import type { Metin } from "@/lib/dil";

/*
  ORTAK DİZİN KOTASI — KURAL (DOI kotası, 07.11.2026). Saf; sunucu tarafı
  lib/dizin-kotasi.ts.

  Kaynaklar araması (literaturAramasiYap), editörde DOI ile künye getirme
  (lookupDoi) ve toplu DOI ekleme (doiIleEkle) KULLANICI başına AYNI
  saatlik 60 hakkı paylaşır. Hak yalnızca gerçekten dış dizine (Crossref,
  OpenAlex) gidecek istek için düşer; geçersiz DOI, yetkisiz istek ve
  kullanıcının kütüphanesinden karşılanan sorgu hak düşürmez. Dışarı
  gönderilmiş ama başarısız olan istek (404, 429, 5xx, zaman aşımı) hak
  düşürür: hak istekten ÖNCE düşer — kesintide arka arkaya denemeler de
  böylece sınırlı kalır. AI kredisine dokunulmaz.

  Anahtar BİLEREK eski adıyla (literatur-arama:<kullanıcı>): Kaynaklar
  araması bu anahtarla 60/saat sayıyordu; adı değişseydi devreye alındığı
  saatteki sayımlar sıfırlanırdı.

  SAYAÇ YOKSA ya da HATA VERİRSE (servis anahtarı tanımsız, RPC hatası):
    • Üretim: FAIL-CLOSED — dış istek GÖNDERİLMEZ, kullanıcıya "hak
      denetlenemedi" denir. Kota bir güvenlik ve nezaket sınırı; sayaç
      olmadan sınırsız dış istek açmak sessiz bir gevşetme olurdu.
      (Eskiden Kaynaklar araması üretimde de açık bırakıyordu.)
    • Üretim dışı (Vercel Preview, yerel geliştirme, sahte önizleme):
      istek GİDER, günlüğe uyarı yazılır. Sahte önizlemede servis anahtarı
      hiç yok; kapalı olsaydı önizlemede hiçbir dizin akışı denenemezdi.
      Test Preview'da servis anahtarı tanımlı olduğundan sayaç orada
      gerçekten çalışır.
    • Ortam çelişkili (derleme ile çalışma anı farklı): ÜRETİM sayılır.
*/

export const DIZIN_SAATLIK_HAK = 60;
export const DIZIN_KOTA_PENCERESI = "1 hour";
export const dizinKotaAnahtari = (kullaniciId: string) => `literatur-arama:${kullaniciId}`;

/** Sayaç çağrısının ham sonucu. */
export type SayacSonucu = "izin" | "doldu" | "sayac_yok" | "sayac_hatasi";

export type KotaKarari =
  | { tur: "izin"; uyari?: string }
  | { tur: "doldu" }
  /** Üretimde sayaç yok ya da hata verdi: dış istek gönderilmez. */
  | { tur: "denetlenemedi" };

/** Çalışma anı ve derleme anı VERCEL_ENV'inden: üretim mi. Çelişki üretim sayılır (güvenli taraf). */
export function uretimMi(calisma: string | null | undefined, derleme: string | null | undefined): boolean {
  const cozum = dagitimOrtamiCoz(calisma, derleme);
  return cozum.tur === "celiski" ? true : cozum.ortam === "uretim";
}

export function kotaKarari(sayac: SayacSonucu, uretim: boolean): KotaKarari {
  if (sayac === "izin") return { tur: "izin" };
  if (sayac === "doldu") return { tur: "doldu" };
  if (uretim) return { tur: "denetlenemedi" };
  return { tur: "izin", uyari: sayac === "sayac_yok" ? "sayaç yok (servis anahtarı tanımsız)" : "sayaç hata verdi" };
}

/** rate_limit_hit cevabı: yalnızca açık true/false geçerli; başka her şey sayaç hatası. */
export function sayacCevabi(data: unknown, hata: unknown): SayacSonucu {
  if (hata) return "sayac_hatasi";
  if (data === true) return "izin";
  if (data === false) return "doldu";
  return "sayac_hatasi";
}

export const KOTA_DOLDU: Metin = {
  tr: `Saatlik dizin arama hakkınız doldu (${DIZIN_SAATLIK_HAK}). Kaynaklar araması, DOI ile künye getirme ve toplu DOI ekleme aynı hakkı kullanır; bir süre sonra tekrar deneyin.`,
  en: `You've used up your hourly index search limit (${DIZIN_SAATLIK_HAK}). Source search, fetching details by DOI and adding DOIs in bulk share this limit; please try again later.`,
};

export const KOTA_DENETLENEMEDI: Metin = {
  tr: "Arama hakkınız şu an denetlenemediği için dış dizine sorgu gönderilmedi. Birazdan tekrar deneyin.",
  en: "Your search limit couldn't be checked right now, so no query was sent to the external index. Please try again shortly.",
};
