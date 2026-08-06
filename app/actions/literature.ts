"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  if (!user) redirect("/?error=invalid-credentials");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    redirect("/dashboard/literature?error=missing-title");
  }

  const { error } = await supabase.from("literature_sources").insert({
    owner_id: user.id,
    project_id: String(formData.get("projectId") ?? "").trim() || null,
    title,
    authors: String(formData.get("authors") ?? "").trim() || null,
    year: String(formData.get("year") ?? "").trim() || null,
    source_type: String(formData.get("sourceType") ?? "article"),
    doi_or_url: String(formData.get("doiOrUrl") ?? "").trim() || null,
    status: String(formData.get("status") ?? "to_review"),
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    console.error(error);
    redirect("/dashboard/literature?error=save-failed");
  }

  revalidatePath("/dashboard/literature");
  redirect("/dashboard/literature");
}

export async function updateLiteratureStatus(sourceId: string, status: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("literature_sources").update({ status }).eq("id", sourceId);
  if (error) {
    console.error(error);
    return { error: "Güncellenirken bir hata oluştu." };
  }
  revalidatePath("/dashboard/literature");
  return { success: true };
}

export async function deleteLiteratureSource(sourceId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("literature_sources").delete().eq("id", sourceId);
  if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }
  revalidatePath("/dashboard/literature");
  return { success: true };
}
