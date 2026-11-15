import type { SupabaseClient } from "@supabase/supabase-js";
import { yedekAl } from "@/lib/manuscript-versions";
import { damgaAyniMi } from "@/lib/metin-damgasi";

/*
  Metni ÜZERİNE YAZAN üç yolun veritabanı dizisi (P52a2): otomatik/elle
  kayıt, "benim sürümümü kaydet" (zorla kayıt) ve sürüm geri yükleme.
  Sunucu eylemleri (app/actions/manuscript.ts, manuscript-versions.ts) ince
  bir kabuk: oturum, abonelik, mesaj çevirisi orada; hangi yazının hangi
  koşulla yapılacağı burada. Ayrılma sebebi test: eylemler next/headers'a
  bağlı, bu dizi ise gerçek bir PostgREST'e karşı AYNI kodla koşturulabiliyor
  (scripts/yerel-yigin/kayit-butunlugu.mjs).

  Tek kural: üzerine yazma her zaman bir `updated_at` damgasına KOŞULLU.
  Eskiden iki yol koşulsuzdu:
  - Zorla kayıt `upsert` ile yazıyordu ve önceki yedeğin sonucunu okumuyordu:
    yedek düşse de öteki sekmenin metni eziliyordu. Yedek alınsa bile yedek
    ile yazma arasında kaydedilen metin ne yedekte ne belgede kalıyordu.
  - Sürüm geri yükleme yedekten sonra `project_id` ile koşulsuz güncelliyordu;
    aynı boşluk.
  Artık ikisi de YEDEKLENEN satırın damgasına koşullu yazıyor: arada biri
  kaydettiyse yazma hiçbir satıra değmez ve çakışma döner; ezilen her metin
  ya belgede ya sürüm geçmişinde kalır.
*/

type PostgrestHatasi = { code?: string; message?: string; details?: string; hint?: string };

export type KosulluYazimSonucu =
  | { tur: "basarili"; updatedAt: string }
  /** Sonradan eklenen bir sütun bu veritabanında yok (migration uygulanmamış). */
  | { tur: "eksik-sutun"; hata: PostgrestHatasi }
  /** Satır, beklenen damgadan sonra başka biri tarafından değiştirildi. */
  | { tur: "cakisma" }
  /** RLS (ya da abonelik tetikleyicisi) yazmayı reddetti; yeniden denemek başarmaz. */
  | { tur: "reddedildi"; hata: PostgrestHatasi | null }
  | { tur: "hata"; hata: unknown };

const eksikSutunMu = (error: PostgrestHatasi | null) => error?.code === "PGRST204" || error?.code === "42703";
const rlsReddiMi = (error: PostgrestHatasi | null) => error?.code === "42501";

/**
 * `beklenen` null: satır henüz yok, EKLENİR (varsa 23505 → çakışma).
 * `beklenen` dolu: yalnızca damga hâlâ bu değerdeyse güncellenir.
 */
export async function kosulluYaz(
  supabase: SupabaseClient,
  projectId: string,
  row: Record<string, unknown>,
  beklenen: string | null,
): Promise<KosulluYazimSonucu> {
  if (beklenen === null) {
    const { data, error } = await supabase
      .from("project_manuscripts")
      .insert({ project_id: projectId, ...row })
      .select("updated_at")
      .single();
    if (eksikSutunMu(error)) return { tur: "eksik-sutun", hata: error! };
    if (rlsReddiMi(error)) return { tur: "reddedildi", hata: error };
    if (error?.code === "23505") return { tur: "cakisma" };
    if (error || !data) return { tur: "hata", hata: error };
    return { tur: "basarili", updatedAt: data.updated_at as string };
  }

  const { data, error } = await supabase
    .from("project_manuscripts")
    .update(row)
    .eq("project_id", projectId)
    .eq("updated_at", beklenen)
    .select("updated_at");
  if (eksikSutunMu(error)) return { tur: "eksik-sutun", hata: error! };
  if (rlsReddiMi(error)) return { tur: "reddedildi", hata: error };
  if (error) return { tur: "hata", hata: error };
  if (data?.length) return { tur: "basarili", updatedAt: data[0].updated_at as string };

  /*
    Hiçbir satıra değmedi: ya satır ARADA değişti (çakışma) ya da RLS satırı
    yazmaya kapalı (yetki) — PostgREST ikisini aynı döndürüyor. Okuma açık
    olduğu için satırı yeniden okumak ayrımı kesin yapıyor: damga hâlâ aynıysa
    kimse değiştirmemiş, demek ki yetki. Ayırt etmeden "başka biri değiştirdi"
    demek denetim rollerinin kaydedemediğini haftalarca gizlemişti (23.09.2026).
  */
  const { data: simdiki } = await supabase
    .from("project_manuscripts")
    .select("updated_at")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!simdiki) return { tur: "cakisma" }; // satır silinmiş ya da okunamıyor
  return damgaAyniMi(simdiki.updated_at as string, beklenen) ? { tur: "reddedildi", hata: null } : { tur: "cakisma" };
}

export type ZorlaKayitHazirligi =
  /** Yazma bu damgaya koşullu yapılacak (null: satır yok, eklenecek). */
  | { tur: "hazir"; beklenen: string | null }
  | { tur: "yedek-alinamadi" };

/**
 * "Benim sürümümü kaydet": önce ezilecek metin sürüm geçmişine yedeklenir,
 * yazma o yedeğin damgasına koşullu yapılır. Yedek alınamazsa YAZILMAZ —
 * eskiden sonuç hiç okunmuyordu ve öteki sürüm hiçbir yerde kalmıyordu.
 */
export async function zorlaKayitIcinYedekle(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  etiket: string,
): Promise<ZorlaKayitHazirligi> {
  const yedek = await yedekAl(supabase, projectId, userId, { kind: "manual", label: etiket });
  if (yedek.durum === "alindi") return { tur: "hazir", beklenen: yedek.kaynakUpdatedAt };
  if (yedek.durum === "satir-yok") return { tur: "hazir", beklenen: null };
  return { tur: "yedek-alinamadi" };
}

export type GeriYuklemeSonucu =
  | { tur: "basarili"; updatedAt: string }
  | { tur: "surum-yok" }
  | { tur: "yedek-alinamadi" }
  | { tur: "cakisma" }
  | { tur: "reddedildi"; hata: PostgrestHatasi | null }
  | { tur: "hata"; hata: unknown };

const GERI_YUKLENEN_AYARLAR = [
  "margin_top_cm",
  "margin_bottom_cm",
  "margin_left_cm",
  "margin_right_cm",
  "show_page_numbers",
  "cover_page",
  "include_toc",
  "heading_numbering",
  "page_size",
] as const;

/**
 * Sürüm geri yükleme: mevcut hâl "restore" sürümü olarak yedeklenir, sürüm
 * o yedeğin damgasına KOŞULLU yazılır. Yedek alınamazsa ya da arada metin
 * değiştiyse hiçbir şey yazılmaz.
 */
export async function surumuGeriYukle(
  supabase: SupabaseClient,
  girdi: { projectId: string; userId: string; versionId: string; yedekEtiketi: string },
): Promise<GeriYuklemeSonucu> {
  const { projectId, userId, versionId, yedekEtiketi } = girdi;
  const { data: version, error: versionError } = await supabase
    .from("project_manuscript_versions")
    .select("project_id, content, plain_text, word_count, settings, created_at")
    .eq("id", versionId)
    .maybeSingle();
  if (versionError || !version || version.project_id !== projectId) return { tur: "surum-yok" };

  const yedek = await yedekAl(supabase, projectId, userId, { kind: "restore", label: yedekEtiketi });
  // Satır yoksa geri yüklenecek bir metin de yok; "yedek alınamadı" ile aynı sonuç: yazılmaz.
  if (yedek.durum !== "alindi") return { tur: "yedek-alinamadi" };

  const settings = (version.settings ?? {}) as Record<string, unknown>;
  const ayarlar = Object.fromEntries(GERI_YUKLENEN_AYARLAR.filter((k) => settings[k] !== undefined).map((k) => [k, settings[k]]));
  const sonuc = await kosulluYaz(
    supabase,
    projectId,
    {
      content: version.content,
      plain_text: version.plain_text,
      word_count: version.word_count ?? 0,
      ...ayarlar,
      updated_by: userId,
      // Veritabanında damga tetikleyicisi varsa (20261115…) bu değer yok sayılır.
      updated_at: new Date().toISOString(),
    },
    yedek.kaynakUpdatedAt,
  );
  if (sonuc.tur === "eksik-sutun") return { tur: "hata", hata: sonuc.hata };
  return sonuc;
}
