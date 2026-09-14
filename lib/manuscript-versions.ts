import type { SupabaseClient } from "@supabase/supabase-js";

// Metnin anlık görüntüsünü sürüm geçmişine yazar (sunucu tarafı yardımcı).
// Sürüm tablosu yoksa (migration çalıştırılmadıysa) sessizce false döner:
// sürüm geçmişi yardımcı bir özelliktir, kaydı asla engellememeli.
export type VersionKind = "auto" | "manual" | "restore";

export const AUTO_VERSION_INTERVAL_MS = 10 * 60 * 1000;

export async function snapshotManuscript(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  options: { kind: VersionKind; label?: string | null; onlyIfOlderThanMs?: number }
): Promise<boolean> {
  try {
    if (options.onlyIfOlderThanMs) {
      const { data: last, error } = await supabase
        .from("project_manuscript_versions")
        .select("created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return false;
      if (last && Date.now() - new Date(last.created_at).getTime() < options.onlyIfOlderThanMs) return false;
    }

    const { data: manuscript, error: readError } = await supabase
      .from("project_manuscripts")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (readError || !manuscript) return false;

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
      },
      kind: options.kind,
      label: options.label?.trim().slice(0, 120) || null,
      created_by: userId,
    });
    if (error) {
      console.error(error);
      return false;
    }
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
