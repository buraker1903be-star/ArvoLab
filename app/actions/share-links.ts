"use server";

import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { generateShareToken } from "@/lib/share-token";
import { siteOrigin } from "@/lib/site-url";
import { ceviri } from "@/lib/dil-sunucu";

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
const MISSING_TABLE_ERROR = {
  tr: "Paylaşım bağlantıları için veritabanı güncellemesi henüz yapılmadı.",
  en: "The database update for share links has not been applied yet.",
};
const GECERSIZ_CALISMA = { tr: "Geçersiz çalışma.", en: "Invalid work." };
const isMissingTable = (error: { code?: string } | null) => error?.code === "42P01" || error?.code === "PGRST205";

/** Çalışmanın paylaşım bağlantıları (RLS: yalnızca çalışmayı yazabilenler görür) */
export async function listShareLinks(projectId: string): Promise<{ links: ShareLink[]; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { links: [], error: (await oturumYokMesaji()) };
  const t = await ceviri();
  if (!UUID_PATTERN.test(projectId)) return { links: [], error: t(GECERSIZ_CALISMA) };
  const { data, error } = await ctx.supabase
    .from("manuscript_share_links")
    .select("id, label, created_at, expires_at, revoked_at, last_viewed_at, view_count")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error(error);
    return { links: [], error: isMissingTable(error) ? t(MISSING_TABLE_ERROR) : t({ tr: "Bağlantılar yüklenemedi.", en: "Links could not be loaded." }) };
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
  if (!ctx) return { error: (await oturumYokMesaji()) };
  /* Aboneliği bitmiş kullanıcı YENİ paylaşım bağlantısı üretemez. Mevcut
     bağlantılar süreleri dolana kadar çalışmaya devam eder: bağlantıyı alan
     danışmanın elindeki adresi geriye dönük kırmak doğru olmaz. */
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const t = await ceviri();
  if (!UUID_PATTERN.test(projectId)) return { error: t(GECERSIZ_CALISMA) };
  if (!DURATIONS_DAYS.includes(input.days)) return { error: t({ tr: "Geçerlilik süresi 7, 30 ya da 90 gün olabilir.", en: "The validity period can be 7, 30 or 90 days." }) };
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
    if (isMissingTable(error)) return { error: t(MISSING_TABLE_ERROR) };
    if (error.code === "42501") return { error: t({ tr: "Bu çalışma için paylaşım bağlantısı oluşturma yetkiniz yok.", en: "You do not have permission to create a share link for this work." }) };
    return { error: t({ tr: "Bağlantı oluşturulamadı.", en: "The link could not be created." }) };
  }
  return { url: `${await siteOrigin()}/share/${token}`, expiresAt };
}

/** Bağlantıyı iptal eder (geri alınamaz; RLS: yalnızca revoked_at yazılabilir) */
export async function revokeShareLink(linkId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  if (!UUID_PATTERN.test(linkId)) return { error: t({ tr: "Geçersiz bağlantı.", en: "Invalid link." }) };
  const { data, error } = await ctx.supabase
    .from("manuscript_share_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId)
    .is("revoked_at", null)
    .select("id");
  if (error) {
    console.error(error);
    return { error: t({ tr: "Bağlantı iptal edilemedi.", en: "The link could not be revoked." }) };
  }
  if (!data?.length) return { error: t({ tr: "Bağlantı bulunamadı ya da zaten iptal edilmiş.", en: "Link not found or already revoked." }) };
  return { success: true };
}
