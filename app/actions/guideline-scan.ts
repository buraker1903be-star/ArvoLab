"use server";

import { createClient } from "@/lib/supabase/server";
import { scanGuidelineUrl, type GuidelineScanResult } from "@/lib/guideline-scan";

export interface ScanResponse {
  error?: string;
  result?: GuidelineScanResult;
}

export async function runGuidelineScan(url: string): Promise<ScanResponse> {
  if (!url || !url.trim()) {
    return { error: "Lütfen bir URL girin." };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .single();

  const oversightRoles = ["academic_manager", "system_admin", "founder"];
  if (!profile || !oversightRoles.includes(profile.role)) {
    return { error: "Bu işlem için Akademik Yönetici veya üzeri bir role sahip olmalısınız." };
  }

  try {
    const result = await scanGuidelineUrl(url.trim());
    return { result };
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Tarama sırasında bir hata oluştu.";
    return { error: message };
  }
}
