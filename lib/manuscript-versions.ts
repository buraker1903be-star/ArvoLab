import type { SupabaseClient } from "@supabase/supabase-js";

// Metnin anlık görüntüsünü sürüm geçmişine yazar (sunucu tarafı yardımcı).
// Sürüm tablosu yoksa (migration çalıştırılmadıysa) sessizce false döner:
// sürüm geçmişi yardımcı bir özelliktir, kaydı asla engellememeli.
export type VersionKind = "auto" | "manual" | "restore";

export const AUTO_VERSION_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Yedeğin sonucu. "alindi" yedeklenen satırın `updated_at`'ini taşır: üzerine
 * yazan akış (zorla kayıt, sürüm geri yükleme) yazmayı bu damgaya KOŞULLU
 * yapar. Eskiden yalnızca true/false dönüyordu ve iki açık vardı (P52a2):
 * zorla kayıt sonucu hiç okumuyordu (yedek düşse de üzerine yazıyordu), geri
 * yükleme de yedekten SONRA arada kaydedilen metni koşulsuz eziyordu — o
 * metin ne yedekte ne belgede kalıyordu.
 */
export type YedekSonucu =
  | { durum: "alindi"; kaynakUpdatedAt: string }
  /** Henüz metin satırı yok: üzerine yazılacak bir şey de yok. */
  | { durum: "satir-yok" }
  /** onlyIfOlderThanMs: son sürüm yeterince yeni, yedek gerekmedi. */
  | { durum: "atlandi" }
  | { durum: "hata" };

/** Sürüm geçmişine yazan tek yol; snapshotManuscript bunun boolean hâli. */
export async function yedekAl(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  options: { kind: VersionKind; label?: string | null; onlyIfOlderThanMs?: number }
): Promise<YedekSonucu> {
  try {
    if (options.onlyIfOlderThanMs) {
      const { data: last, error } = await supabase
        .from("project_manuscript_versions")
        .select("created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return { durum: "hata" };
      if (last && Date.now() - new Date(last.created_at).getTime() < options.onlyIfOlderThanMs) return { durum: "atlandi" };
    }

    const { data: manuscript, error: readError } = await supabase
      .from("project_manuscripts")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (readError) {
      console.error(readError);
      return { durum: "hata" };
    }
    if (!manuscript) return { durum: "satir-yok" };

    const { error } = await supabase.from("project_manuscript_versions").insert({
      project_id: projectId,
      content: manuscript.content,
      plain_text: manuscript.plain_text,
      word_count: manuscript.word_count ?? 0,
      settings: {
        margin_top_cm: manuscript.margin_top_cm,
        margin_bottom_cm: manuscript.margin_bottom_cm,
        margin_left_cm: manuscript.margin_left_cm,
        margin_right_cm: manuscript.margin_right_cm,
        show_page_numbers: manuscript.show_page_numbers,
        cover_page: manuscript.cover_page ?? null,
        include_toc: manuscript.include_toc ?? false,
        // Migration çalıştırılmadıysa kolon yok: geri yüklemede olmayan kolona yazılmasın.
        ...(manuscript.heading_numbering !== undefined ? { heading_numbering: manuscript.heading_numbering } : {}),
        ...(manuscript.page_size !== undefined ? { page_size: manuscript.page_size } : {}),
      },
      kind: options.kind,
      label: options.label?.trim().slice(0, 120) || null,
      created_by: userId,
    });
    if (error) {
      console.error(error);
      return { durum: "hata" };
    }
    return { durum: "alindi", kaynakUpdatedAt: manuscript.updated_at as string };
  } catch (error) {
    console.error(error);
    return { durum: "hata" };
  }
}

export async function snapshotManuscript(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  options: { kind: VersionKind; label?: string | null; onlyIfOlderThanMs?: number }
): Promise<boolean> {
  return (await yedekAl(supabase, projectId, userId, options)).durum === "alindi";
}
