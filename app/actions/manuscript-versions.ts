"use server";

import { getAuthContext, oturumYokMesaji } from "@/lib/auth-guards";
import { snapshotManuscript, type VersionKind } from "@/lib/manuscript-versions";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { ceviri } from "@/lib/dil-sunucu";

export interface ManuscriptVersion {
  id: string;
  createdAt: string;
  wordCount: number;
  kind: VersionKind;
  label: string | null;
  authorName: string | null;
}

const GECERSIZ_SURUM = { tr: "Geçersiz sürüm.", en: "Invalid version." };
const SURUM_YOK = { tr: "Sürüm bulunamadı.", en: "Version not found." };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listManuscriptVersions(projectId: string): Promise<{ versions: ManuscriptVersion[]; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { versions: [], error: (await oturumYokMesaji()) };
  const t = await ceviri();

  const { data, error } = await ctx.supabase
    .from("project_manuscript_versions")
    .select("id, created_at, word_count, kind, label, created_by")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) {
    console.error(error);
    return { versions: [], error: t({ tr: "Sürüm geçmişi yüklenemedi.", en: "Version history could not be loaded." }) };
  }

  const authorIds = [...new Set((data ?? []).map((row) => row.created_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (authorIds.length) {
    const { data: profiles } = await ctx.supabase.from("profiles").select("id, full_name").in("id", authorIds);
    for (const profile of profiles ?? []) if (profile.full_name) names.set(profile.id, profile.full_name);
  }

  return {
    versions: (data ?? []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      wordCount: row.word_count ?? 0,
      kind: row.kind,
      label: row.label,
      authorName: row.created_by ? (names.get(row.created_by) ?? null) : null,
    })),
  };
}

/** Kullanıcının adlandırdığı sürüm (ör. "Danışmana gönderilen"). Metin önce istemcide kaydedilir. */
export async function saveNamedVersion(projectId: string, label: string): Promise<{ error?: string; success?: boolean }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  /* Abonelik kapısı: Yeni sürüm yazmak saveManuscript ile aynı kapıya tabi.
     Listeleme ve önizleme açık: geçmişini görebilmeli. */
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const t = await ceviri();
  const ok = await snapshotManuscript(ctx.supabase, projectId, ctx.user.id, { kind: "manual", label });
  return ok ? { success: true } : {
        error: t({
          tr: "Sürüm kaydedilemedi. Önce metnin kaydedildiğinden emin olun.",
          en: "The version could not be saved. Make sure the text has been saved first.",
        }),
      };
}

export async function getVersionPreview(versionId: string): Promise<{ text?: string; wordCount?: number; error?: string }> {
  const t = await ceviri();
  if (!UUID_PATTERN.test(versionId)) return { error: t(GECERSIZ_SURUM) };
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const { data, error } = await ctx.supabase
    .from("project_manuscript_versions")
    .select("plain_text, word_count")
    .eq("id", versionId)
    .maybeSingle();
  if (error || !data) return { error: t(SURUM_YOK) };
  return { text: (data.plain_text ?? "").slice(0, 6000), wordCount: data.word_count ?? 0 };
}

/** Karşılaştırma için sürümün tam düz metni (RLS: yalnızca erişimi olanlar) */
export async function getVersionText(versionId: string): Promise<{ text?: string; createdAt?: string; label?: string | null; error?: string }> {
  const t = await ceviri();
  if (!UUID_PATTERN.test(versionId)) return { error: t(GECERSIZ_SURUM) };
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const { data, error } = await ctx.supabase
    .from("project_manuscript_versions")
    .select("plain_text, created_at, label")
    .eq("id", versionId)
    .maybeSingle();
  if (error || !data) return { error: t(SURUM_YOK) };
  return { text: (data.plain_text ?? "").slice(0, 3_000_000), createdAt: data.created_at, label: data.label };
}

// Geri yüklemeden önce mevcut hâl "restore" sürümü olarak saklanır; geri yükleme de geri alınabilir.
export async function restoreManuscriptVersion(
  projectId: string,
  versionId: string
): Promise<{ error?: string; success?: boolean; updatedAt?: string }> {
  const t = await ceviri();
  if (!UUID_PATTERN.test(versionId)) return { error: t(GECERSIZ_SURUM) };
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  /* Abonelik kapısı: Geri yükleme metnin üzerine yazar; saveManuscript ile aynı kapı. */
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };

  const { data: version, error: versionError } = await ctx.supabase
    .from("project_manuscript_versions")
    .select("project_id, content, plain_text, word_count, settings, created_at")
    .eq("id", versionId)
    .maybeSingle();
  if (versionError || !version || version.project_id !== projectId) return { error: t(SURUM_YOK) };

  const backedUp = await snapshotManuscript(ctx.supabase, projectId, ctx.user.id, {
    kind: "restore",
    label: t({ tr: "Geri yüklemeden önceki hâl", en: "Before restore" }),
  });
  if (!backedUp) return {
      error: t({
        tr: "Mevcut metin yedeklenemediği için geri yükleme yapılmadı.",
        en: "The restore was not performed because the current text could not be backed up.",
      }),
    };

  const settings = (version.settings ?? {}) as Record<string, unknown>;
  const pick = (key: string) => (settings[key] === undefined ? {} : { [key]: settings[key] });
  const { data, error } = await ctx.supabase
    .from("project_manuscripts")
    .update({
      content: version.content,
      plain_text: version.plain_text,
      word_count: version.word_count ?? 0,
      ...pick("margin_top_cm"),
      ...pick("margin_bottom_cm"),
      ...pick("margin_left_cm"),
      ...pick("margin_right_cm"),
      ...pick("show_page_numbers"),
      ...pick("cover_page"),
      ...pick("include_toc"),
      ...pick("heading_numbering"),
      ...pick("page_size"),
      updated_by: ctx.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId)
    .select("updated_at");
  if (error || !data?.length) {
    console.error(error);
    return { error: t({ tr: "Geri yükleme için bu metni düzenleme yetkiniz yok.", en: "You do not have permission to edit this text, so it cannot be restored." }) };
  }
  return { success: true, updatedAt: data[0].updated_at };
}
