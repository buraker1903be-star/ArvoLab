"use server";

import { getAuthContext, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { generateShareToken } from "@/lib/share-token";
import { siteOrigin } from "@/lib/site-url";

export interface ShareLink {
  id: string;
  label: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DURATIONS_DAYS = [7, 30, 90];
const MISSING_TABLE_ERROR = "Paylaşım bağlantıları için veritabanı güncellemesi henüz yapılmadı.";
const isMissingTable = (error: { code?: string } | null) => error?.code === "42P01" || error?.code === "PGRST205";

/** Çalışmanın paylaşım bağlantıları (RLS: yalnızca çalışmayı yazabilenler görür) */
export async function listShareLinks(projectId: string): Promise<{ links: ShareLink[]; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { links: [], error: SESSION_MISSING.error };
  if (!UUID_PATTERN.test(projectId)) return { links: [], error: "Geçersiz çalışma." };
  const { data, error } = await ctx.supabase
    .from("manuscript_share_links")
    .select("id, label, created_at, expires_at, revoked_at, last_viewed_at, view_count")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error(error);
    return { links: [], error: isMissingTable(error) ? MISSING_TABLE_ERROR : "Bağlantılar yüklenemedi." };
  }
  return {
    links: (data ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      lastViewedAt: row.last_viewed_at,
      viewCount: row.view_count ?? 0,
    })),
  };
}

/**
 * Süreli, salt okunur paylaşım bağlantısı. Belirteç yalnızca burada bir kez döner;
 * veritabanına özeti yazılır (RLS: çalışmayı yazabilen, kendi adına).
 */
export async function createShareLink(
  projectId: string,
  input: { days: number; label?: string }
): Promise<{ url?: string; expiresAt?: string; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: SESSION_MISSING.error };
  if (!UUID_PATTERN.test(projectId)) return { error: "Geçersiz çalışma." };
  if (!DURATIONS_DAYS.includes(input.days)) return { error: "Geçerlilik süresi 7, 30 ya da 90 gün olabilir." };
  const label = input.label?.trim().slice(0, 120) || null;

  const { token, hash } = generateShareToken();
  const expiresAt = new Date(Date.now() + input.days * 86_400_000).toISOString();
  const { error } = await ctx.supabase.from("manuscript_share_links").insert({
    project_id: projectId,
    token_hash: hash,
    label,
    created_by: ctx.user.id,
    expires_at: expiresAt,
  });
  if (error) {
    console.error(error);
    if (isMissingTable(error)) return { error: MISSING_TABLE_ERROR };
    if (error.code === "42501") return { error: "Bu çalışma için paylaşım bağlantısı oluşturma yetkiniz yok." };
    return { error: "Bağlantı oluşturulamadı." };
  }
  return { url: `${await siteOrigin()}/share/${token}`, expiresAt };
}

/** Bağlantıyı iptal eder (geri alınamaz; RLS: yalnızca revoked_at yazılabilir) */
export async function revokeShareLink(linkId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  if (!UUID_PATTERN.test(linkId)) return { error: "Geçersiz bağlantı." };
  const { data, error } = await ctx.supabase
    .from("manuscript_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .is("revoked_at", null)
    .select("id");
  if (error) {
    console.error(error);
    return { error: "Bağlantı iptal edilemedi." };
  }
  if (!data?.length) return { error: "Bağlantı bulunamadı ya da zaten iptal edilmiş." };
  return { success: true };
}
