"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { loadCurrentProfile, type CurrentProfile } from "@/lib/current-profile";

export type { CurrentProfile } from "@/lib/current-profile";

/** Oturumdaki kullanıcının profili (istek başına bir kez okunur, lib/current-profile.ts) */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  return loadCurrentProfile();
}

// Kullanıcı yalnızca kendi ad soyadını değiştirebilir; rol ve kurum
// değişikliği prevent_self_role_escalation tetikleyicisiyle engellenir.
export async function updateMyProfile(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return SESSION_MISSING;

  const fullName = String(formData.get("fullName") ?? "").trim();
  if (fullName.length < 2 || fullName.length > 120) {
    return { error: "Ad soyad 2 ile 120 karakter arasında olmalı." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id)
    .select("id");

  if (error || !data?.length) {
    console.error(error);
    return { error: "Profil güncellenemedi." };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
