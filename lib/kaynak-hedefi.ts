/*
  KAYNAĞIN HEDEF ÇALIŞMASI (Signature OS 4.3.5, 05.11.2026).

  Bir kaynak satırı (literature_sources) bir çalışmaya bağlanırken çalışma
  kimliği İSTEMCİDEN geliyor. Veritabanı kuralı (RLS) yalnızca satırın
  sahibine bakıyor (owner_id = kullanıcı); çalışmanın kime ait olduğunu
  denetlemiyor, yabancı anahtar yalnızca çalışmanın VAR olduğunu söylüyor.

  ESKİ HATA: toplu aktarma ve DOI ile ekleme çalışmanın sahibini
  doğruluyordu (kaynak-aktarim.ts hazirlik), elle ekleme, atıf penceresi ve
  literatür araması doğrulamıyordu. Başka birinin çalışma kimliğiyle
  çağrılan bu yollar, sahibinin hiç göremeyeceği "öksüz" kaynaklar
  üretiyordu; atanmış kişinin atıf penceresinden eklediği kaynak tezin
  sahibine görünmüyordu.

  Kural (mevcut yetki modeli, genişletilmedi): kaynak yalnızca KULLANICININ
  SAHİBİ OLDUĞU çalışmaya bağlanır ya da hiçbir çalışmaya bağlanmaz.
  Atanmış kişinin kaynak ekleyebilmesi RLS kararı ister; ayrı karar
  listesinde (Phase 4.3.5 raporu). Bulunamayan ile yetkisiz AYNI cevabı
  alır: hata mesajı başkasının çalışmasının varlığını sızdırmaz.

  İstek başka bir çalışmaya ya da "çalışmasız"a sessizce YÖNLENDİRİLMEZ;
  reddedilir.
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type KaynakHedefi =
  | { durum: "bagsiz" }
  | { durum: "tamam"; projectId: string }
  | { durum: "yetkisiz" }
  | { durum: "okunamadi" };

/** İstemciden gelen değer: boş → çalışmasız; kimlik biçiminde değilse sorgu bile yapılmaz. */
export function hedefKimligi(ham: unknown): { tur: "bos" } | { tur: "gecersiz" } | { tur: "kimlik"; id: string } {
  const s = typeof ham === "string" ? ham.trim() : ham == null ? "" : String(ham).trim();
  if (!s) return { tur: "bos" };
  return UUID.test(s) ? { tur: "kimlik", id: s.toLowerCase() } : { tur: "gecersiz" };
}

/** Sahiplik sorgusunun sonucundan karar (saf; testi tests/unit/kaynak-hedefi.test.ts). */
export function hedefKarari(id: string, okuma: { data: { id: string } | null; error: unknown }): KaynakHedefi {
  if (okuma.error) return { durum: "okunamadi" };
  return okuma.data ? { durum: "tamam", projectId: id } : { durum: "yetkisiz" };
}

/* Supabase istemcisinin burada kullanılan dar yüzü: testte sahte istemci verilebilsin. */
type SorguIstemcisi = {
  from(tablo: "academic_projects"): {
    select(sutunlar: "id"): {
      eq(sutun: "id", deger: string): {
        eq(sutun: "owner_id", deger: string): { maybeSingle(): PromiseLike<{ data: { id: string } | null; error: unknown }> };
      };
    };
  };
};

/**
 * Kaynağın bağlanacağı çalışmayı sunucuda doğrular. Okuma RLS altında
 * kullanıcının kendi oturumuyla yapılır ve ek olarak owner_id süzülür:
 * gözetim rolleri ve atanmış kişi çalışmayı OKUYABİLİR ama kaynak
 * ekleyemez (kaynak satırı onların olur, sahibine görünmez).
 */
export async function kaynakHedefi(supabase: unknown, kullaniciId: string, ham: unknown): Promise<KaynakHedefi> {
  const k = hedefKimligi(ham);
  if (k.tur === "bos") return { durum: "bagsiz" };
  if (k.tur === "gecersiz") return { durum: "yetkisiz" };
  const okuma = await (supabase as SorguIstemcisi).from("academic_projects").select("id").eq("id", k.id).eq("owner_id", kullaniciId).maybeSingle();
  return hedefKarari(k.id, okuma);
}

export const HEDEF_MESAJI = {
  yetkisiz: {
    tr: "Bu çalışmaya kaynak eklenemiyor: çalışma bulunamadı ya da kaynaklarını yalnızca çalışmanın sahibi ekleyebilir.",
    en: "Sources can't be added to this work: it wasn't found, or only the work's owner can add its sources.",
  },
  okunamadi: {
    tr: "Çalışma doğrulanamadı; kaynak eklenmedi. Biraz sonra yeniden deneyin.",
    en: "The work couldn't be verified; the source wasn't added. Please try again shortly.",
  },
} as const;
