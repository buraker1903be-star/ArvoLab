"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";

const PAGE_PATH = "/dashboard/literature";
const STATUSES = ["to_review", "read", "used"];
const SOURCE_TYPES = ["article", "book", "chapter", "thesis", "report", "website", "other"];

export interface LiteratureSource {
  id: string;
  project_id: string | null;
  title: string;
  authors: string | null;
  year: string | null;
  source_type: string;
  doi_or_url: string | null;
  status: "to_review" | "read" | "used";
  notes: string | null;
  created_at: string;
}

export async function getLiteratureSources(): Promise<LiteratureSource[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("literature_sources")
    .select("id, project_id, title, authors, year, source_type, doi_or_url, status, notes, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export async function createLiteratureSource(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    redirect(`${PAGE_PATH}?error=missing-title`);
  }

  const sourceType = String(formData.get("sourceType") ?? "article");
  const status = String(formData.get("status") ?? "to_review");

  const { error } = await supabase.from("literature_sources").insert({
    owner_id: user.id,
    project_id: String(formData.get("projectId") ?? "").trim() || null,
    title,
    authors: String(formData.get("authors") ?? "").trim() || null,
    year: String(formData.get("year") ?? "").trim() || null,
    source_type: SOURCE_TYPES.includes(sourceType) ? sourceType : "other",
    doi_or_url: String(formData.get("doiOrUrl") ?? "").trim() || null,
    status: STATUSES.includes(status) ? status : "to_review",
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    console.error(error);
    redirect(`${PAGE_PATH}?error=save-failed`);
  }

  revalidatePath(PAGE_PATH);
  redirect(PAGE_PATH);
}

export async function updateLiteratureStatus(sourceId: string, status: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  if (!STATUSES.includes(status)) return { error: "Geçersiz durum." };

  const { data, error } = await ctx.supabase
    .from("literature_sources")
    .update({ status })
    .eq("id", sourceId)
    .eq("owner_id", ctx.user.id)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Güncellenirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kaynak bulunamadı ya da size ait değil." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function deleteLiteratureSource(sourceId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const { data, error } = await ctx.supabase
    .from("literature_sources")
    .delete()
    .eq("id", sourceId)
    .eq("owner_id", ctx.user.id)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kaynak bulunamadı ya da size ait değil." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}
