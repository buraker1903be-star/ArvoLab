"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AcademicProject {
  id: string;
  title: string;
  project_type: string;
  university: string | null;
  institute: string | null;
  department: string | null;
  citation_style: string;
  research_method: string | null;
  assignee_name: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  notes: string | null;
  progress: number;
  created_at: string;
}

const PROJECT_TYPES = ["thesis", "article", "project", "associate-professorship"];

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/?error=invalid-credentials");
  }

  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "");

  if (!title || title.length < 3) {
    redirect("/dashboard/projects/new?error=missing-title");
  }
  if (!PROJECT_TYPES.includes(type)) {
    redirect("/dashboard/projects/new?error=missing-type");
  }

  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();

  const { error } = await supabase.from("academic_projects").insert({
    owner_id: user.id,
    title,
    project_type: type,
    university: String(formData.get("university") ?? "").trim() || null,
    institute: String(formData.get("institute") ?? "").trim() || null,
    department: String(formData.get("department") ?? "").trim() || null,
    citation_style: String(formData.get("citationStyle") ?? "apa7"),
    research_method: String(formData.get("method") ?? "") || null,
    assignee_name: String(formData.get("assignee") ?? "").trim() || null,
    due_date: dueDateRaw || null,
    priority: String(formData.get("priority") ?? "normal"),
    notes: String(formData.get("notes") ?? "").trim() || null,
    status: "new",
  });

  if (error) {
    console.error(error);
    redirect("/dashboard/projects/new?error=save-failed");
  }

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard");
  redirect("/dashboard/projects");
}

export async function getProjects(): Promise<AcademicProject[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("academic_projects")
    .select(
      "id, title, project_type, university, institute, department, citation_style, research_method, assignee_name, due_date, priority, status, notes, progress, created_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}
