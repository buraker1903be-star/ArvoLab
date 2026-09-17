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
 * panel içi bildirim gönderir. Hatalar sayfayı durdurmaz (en iyi çaba) ama sessiz kalmaz.
 *
 * Sayaç veritabanında tek atomik artırmayla yükseliyor (bump_share_view). Eskiden iki ayrı
 * yazma vardı: "0 ise 1 yap" koşullu güncellemesi ve ardından uygulamada "oku, 1 ekle, yaz".
 * İkincisi eşzamanlı görüntülemelerde sayıyı kaybediyordu. Artık dönen değer 1 ise bu ilk
 * görüntülemedir; bildirim tam olarak bir kez gider.
 */
export async function recordShareView(
  admin: SupabaseClient,
  link: ShareViewLink,
  projectTitle: string,
  now = new Date()
): Promise<{ firstView: boolean }> {
  const { data: viewCount, error: bumpError } = await admin.rpc("bump_share_view", {
    p_link_id: link.id,
    p_viewed_at: now.toISOString(),
  });
  if (bumpError) {
    console.error("[share] görüntüleme sayacı güncellenemedi", { code: bumpError.code, message: bumpError.message });
    return { firstView: false };
  }

  if (Number(viewCount) !== 1) return { firstView: false };

  const { error } = await admin.from("notifications").insert({
    user_id: link.created_by,
    project_id: link.project_id,
    kind: "share_view",
    title: "Paylaşım bağlantınız açıldı",
    body: `${link.label ?? "Adsız bağlantı"} · ${projectTitle}`.slice(0, 500),
    link: `/dashboard/editor/${link.project_id}/write`,
  });
  // Bildirim migration'ı çalıştırılmadıysa tür kısıtı reddeder: sayfa yine gösterilir.
  if (error) console.error("[share] görüntüleme bildirimi yazılamadı", { code: error.code, message: error.message });
  return { firstView: true };
}
