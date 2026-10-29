import { createClient } from "@/lib/supabase/server";
import { tarihBicimleri, trTarihSaat } from "./tr-time";
import { VARSAYILAN_SAAT_DILIMI, type Dil } from "./dil";
import { kagitOku, type KagitBoyutu } from "./kagit-boyutu";

/**
 * "3 saat önce", "dün", "12 Eylül 14:05" — İngilizcede "3 hours ago", "yesterday".
 * saatDilimi yalnızca İngilizcede, bir haftadan eski tarihin biçimi için
 * (Türkçe her zaman Türkiye saati; lib/dil-sunucu.ts aktifSaatDilimi).
 */
export function editedAgo(dateStr: string, now = Date.now(), dil: Dil = "tr", saatDilimi: string = VARSAYILAN_SAAT_DILIMI) {
  const minutes = Math.round((now - new Date(dateStr).getTime()) / 60000);
  if (dil === "en") {
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    return tarihBicimleri("en", saatDilimi).tarihSaat(dateStr);
  }
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
  /*
    Metnin KENDİ sayfa düzeni. Kartlardaki hedef kelime eskiden kılavuzun
    kenar boşluklarıyla ve hep A4 sayılarak hesaplanıyordu; editör ise
    metnin ayarını kullanıyor. Letter ya da elle değiştirilmiş kenar
    boşluklu bir metinde kart ile editör iki ayrı hedef gösteriyordu.
  */
  margins: { top: number; bottom: number; left: number; right: number } | null;
  pageSize: KagitBoyutu;
}

// Çalışma kartları ve ana sayfa için yazım durumu: kelime sayısı, son düzenleme ve
// başkalarından gelen açık yorumlar (RLS: yalnızca görülebilen çalışmalar döner).
export async function getWritingStats(projectIds: string[], currentUserId: string | undefined) {
  const stats = new Map<string, WritingStats>();
  const openComments = new Map<string, number>();
  if (projectIds.length === 0) return { stats, openComments };

  const supabase = await createClient();
  const [manuscripts, comments] = await Promise.all([
    supabase
      .from("project_manuscripts")
      .select("project_id, word_count, updated_at, page_size, margin_top_cm, margin_bottom_cm, margin_left_cm, margin_right_cm")
      .in("project_id", projectIds),
    supabase.from("manuscript_comments").select("project_id, author_id").in("project_id", projectIds).is("resolved_at", null),
  ]);
  for (const row of manuscripts.data ?? []) {
    const kenar = [row.margin_top_cm, row.margin_bottom_cm, row.margin_left_cm, row.margin_right_cm];
    stats.set(row.project_id, {
      words: row.word_count ?? 0,
      updatedAt: row.updated_at,
      margins: kenar.every((d) => typeof d === "number")
        ? { top: row.margin_top_cm, bottom: row.margin_bottom_cm, left: row.margin_left_cm, right: row.margin_right_cm }
        : null,
      pageSize: kagitOku(row.page_size),
    });
  }
  for (const row of comments.data ?? []) {
    if (row.author_id === currentUserId) continue;
    openComments.set(row.project_id, (openComments.get(row.project_id) ?? 0) + 1);
  }
  return { stats, openComments };
}
