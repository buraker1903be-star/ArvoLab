import { createClient } from "@/lib/supabase/server";
import { trTarihSaat } from "./tr-time";

/** "3 saat önce", "dün", "12 Eylül 14:05" */
export function editedAgo(dateStr: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(dateStr).getTime()) / 60000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.round(hours / 24);
  if (days === 1) return "dün";
  if (days < 7) return `${days} gün önce`;
  return trTarihSaat(dateStr);
}

export interface WritingStats {
  words: number;
  updatedAt: string;
}

// Çalışma kartları ve ana sayfa için yazım durumu: kelime sayısı, son düzenleme ve
// başkalarından gelen açık yorumlar (RLS: yalnızca görülebilen çalışmalar döner).
export async function getWritingStats(projectIds: string[], currentUserId: string | undefined) {
  const stats = new Map<string, WritingStats>();
  const openComments = new Map<string, number>();
  if (projectIds.length === 0) return { stats, openComments };

  const supabase = await createClient();
  const [manuscripts, comments] = await Promise.all([
    supabase.from("project_manuscripts").select("project_id, word_count, updated_at").in("project_id", projectIds),
    supabase.from("manuscript_comments").select("project_id, author_id").in("project_id", projectIds).is("resolved_at", null),
  ]);
  for (const row of manuscripts.data ?? []) stats.set(row.project_id, { words: row.word_count ?? 0, updatedAt: row.updated_at });
  for (const row of comments.data ?? []) {
    if (row.author_id === currentUserId) continue;
    openComments.set(row.project_id, (openComments.get(row.project_id) ?? 0) + 1);
  }
  return { stats, openComments };
}
