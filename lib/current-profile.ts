import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/project-labels";

// Oturumdaki kullanıcının profili. Aynı istekte panel düzeni, sayfa ve erişim
// kontrolü bunu ayrı ayrı soruyordu; cache() ile istek başına bir kez okunur.
//
// Mantık burada durur çünkü app/actions/profile.ts bir "use server" dosyası:
// oradan yalnızca async fonksiyon dışa aktarılabilir, cache() sarmalı geçmez.

export interface CurrentProfile {
  id: string;
  full_name: string | null;
  role: UserRole;
  organization_id: string | null;
}

export const loadCurrentProfile = cache(async function loadCurrentProfile(): Promise<CurrentProfile | null> {
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
});
