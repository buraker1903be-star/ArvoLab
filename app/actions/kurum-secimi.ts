"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireRole, type ActionResult } from "@/lib/auth-guards";
import { ADMIN_ROLES } from "@/lib/project-labels";
import { KURUM_CEREZI, kurumKimligiMi } from "@/lib/kurum-secimi";

/*
  İç ekibin kurum seçimi (lib/kurum-secimi.ts). Rol sunucuda yeniden
  okunuyor; çerez yalnızca GÖRÜNÜMÜ süzüyor, yetki değişmiyor. Abonelik
  kapısı yok: iç ekip kapıdan geçiyor ve yeni içerik yazılmıyor.
*/
export async function kurumSec(formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(ADMIN_ROLES, "Kurum seçimi yalnızca Arvo ekibine açık.");
  if ("error" in auth) return { error: auth.error };

  const secilen = String(formData.get("kurum") ?? "");
  const depo = await cookies();
  if (!secilen) {
    depo.delete(KURUM_CEREZI);
  } else {
    if (!kurumKimligiMi(secilen)) return { error: "Kurum tanınmadı." };
    depo.set(KURUM_CEREZI, secilen, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  revalidatePath("/dashboard", "layout");
  return { success: true, message: secilen ? "Kurum seçildi." : "Bütün kurumlar gösteriliyor." };
}
