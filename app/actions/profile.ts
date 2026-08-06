"use server";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/project-labels";

export interface CurrentProfile {
  id: string;
  full_name: string | null;
  role: UserRole;
  organization_id: string | null;
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    console.error(error);
    return null;
  }
  return data as CurrentProfile;
}
