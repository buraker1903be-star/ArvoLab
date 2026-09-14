"use server";

import { getAuthContext, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";

export type NotificationKind = "comment" | "assignment" | "status" | "approval" | "guideline_update";

export interface PanelNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Son 30 bildirim ve okunmamış sayısı (tablo yoksa boş döner) */
export async function listNotifications(): Promise<{ items: PanelNotification[]; unread: number }> {
  const ctx = await getAuthContext();
  if (!ctx) return { items: [], unread: 0 };

  const [list, unread] = await Promise.all([
    ctx.supabase
      .from("notifications")
      .select("id, kind, title, body, link, read_at, created_at")
      .eq("user_id", ctx.user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    ctx.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.user.id)
      .is("read_at", null),
  ]);
  if (list.error) {
    console.error(list.error);
    return { items: [], unread: 0 };
  }
  return {
    items: (list.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      // Yalnızca panel içi bağlantılar (veritabanı kısıtı da bunu zorunlu kılar)
      link: typeof row.link === "string" && row.link.startsWith("/dashboard/") ? row.link : null,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
    unread: unread.count ?? 0,
  };
}

/** Verilen bildirimleri (ya da hepsini) okundu işaretler */
export async function markNotificationsRead(ids?: string[]): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  let query = ctx.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", ctx.user.id)
    .is("read_at", null);
  if (ids) {
    const valid = ids.filter((id) => UUID_PATTERN.test(id));
    if (valid.length === 0) return { success: true };
    query = query.in("id", valid);
  }
  const { error } = await query;
  if (error) {
    console.error(error);
    return { error: "Bildirimler güncellenemedi." };
  }
  return { success: true };
}
