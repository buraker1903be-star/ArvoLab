"use server";

import { getAuthContext, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";

export interface ManuscriptComment {
  id: string;
  quote: string | null;
  body: string;
  createdAt: string;
  resolvedAt: string | null;
  authorId: string;
  authorName: string | null;
  isMine: boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listManuscriptComments(projectId: string): Promise<{ comments: ManuscriptComment[]; error?: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { comments: [], error: SESSION_MISSING.error };

  const { data, error } = await ctx.supabase
    .from("manuscript_comments")
    .select("id, quote, body, created_at, resolved_at, author_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) {
    console.error(error);
    return { comments: [], error: "Yorumlar yüklenemedi." };
  }

  const authorIds = [...new Set((data ?? []).map((row) => row.author_id))];
  const names = new Map<string, string>();
  if (authorIds.length) {
    const { data: profiles } = await ctx.supabase.from("profiles").select("id, full_name").in("id", authorIds);
    for (const profile of profiles ?? []) if (profile.full_name) names.set(profile.id, profile.full_name);
  }

  return {
    comments: (data ?? []).map((row) => ({
      id: row.id,
      quote: row.quote,
      body: row.body,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      authorId: row.author_id,
      authorName: names.get(row.author_id) ?? null,
      isMine: row.author_id === ctx.user.id,
    })),
  };
}

export async function addManuscriptComment(projectId: string, body: string, quote: string | null): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  const text = body.trim();
  if (!text) return { error: "Yorum boş olamaz." };
  if (text.length > 2000) return { error: "Yorum en fazla 2000 karakter olabilir." };

  const { error } = await ctx.supabase.from("manuscript_comments").insert({
    project_id: projectId,
    author_id: ctx.user.id,
    quote: quote?.trim().slice(0, 500) || null,
    body: text,
  });
  if (error) {
    console.error(error);
    return { error: error.code === "42501" ? "Bu çalışmaya yorum yazma yetkiniz yok." : "Yorum kaydedilemedi." };
  }
  return { success: true };
}

export async function setManuscriptCommentResolved(commentId: string, resolved: boolean): Promise<ActionResult> {
  if (!UUID_PATTERN.test(commentId)) return { error: "Geçersiz yorum." };
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  const { data, error } = await ctx.supabase
    .from("manuscript_comments")
    .update(resolved ? { resolved_at: new Date().toISOString(), resolved_by: ctx.user.id } : { resolved_at: null, resolved_by: null })
    .eq("id", commentId)
    .select("id");
  if (error || !data?.length) {
    console.error(error);
    return { error: "Yorum güncellenemedi." };
  }
  return { success: true };
}

export async function deleteManuscriptComment(commentId: string): Promise<ActionResult> {
  if (!UUID_PATTERN.test(commentId)) return { error: "Geçersiz yorum." };
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  const { data, error } = await ctx.supabase.from("manuscript_comments").delete().eq("id", commentId).select("id");
  if (error || !data?.length) {
    if (error) console.error(error);
    return { error: "Yalnızca kendi yorumlarınızı silebilirsiniz." };
  }
  return { success: true };
}
