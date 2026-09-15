import type { SupabaseClient } from "@supabase/supabase-js";

export interface ShareViewLink {
  id: string;
  project_id: string;
  created_by: string;
  label: string | null;
  view_count: number | null;
}

/**
 * Paylaşım bağlantısının görüntülenmesini kaydeder; bağlantı İLK kez açıldığında oluşturana
 * panel içi bildirim gönderir. İlk görüntülenme koşullu güncellemeyle belirlenir ("0 ise 1 yap"):
 * aynı anda iki açılışta yalnızca biri bildirim üretir. Hatalar sayfayı durdurmaz (en iyi çaba).
 */
export async function recordShareView(
  admin: SupabaseClient,
  link: ShareViewLink,
  projectTitle: string,
  now = new Date()
): Promise<{ firstView: boolean }> {
  const viewedAt = now.toISOString();
  const { data: first } = await admin
    .from("manuscript_share_links")
    .update({ view_count: 1, last_viewed_at: viewedAt })
    .eq("id", link.id)
    .eq("view_count", 0)
    .select("id");

  if (first?.length) {
    const { error } = await admin.from("notifications").insert({
      user_id: link.created_by,
      project_id: link.project_id,
      kind: "share_view",
      title: "Paylaşım bağlantınız açıldı",
      body: `${link.label ?? "Adsız bağlantı"} · ${projectTitle}`.slice(0, 500),
      link: `/dashboard/editor/${link.project_id}/write`,
    });
    // Bildirim migration'ı çalıştırılmadıysa tür kısıtı reddeder: sayfa yine gösterilir.
    if (error) console.error(error);
    return { firstView: true };
  }

  await admin
    .from("manuscript_share_links")
    .update({ view_count: (link.view_count ?? 0) + 1, last_viewed_at: viewedAt })
    .eq("id", link.id);
  return { firstView: false };
}
