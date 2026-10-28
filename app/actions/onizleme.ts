"use server";

import { ceviri } from "@/lib/dil-sunucu";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { GORUNUM_ETIKETI, ONIZLEME_CEREZI, gorunumMu, onizleyebilir } from "@/lib/onizleme";

/*
  Görünüm önizlemesini seçer (lib/onizleme.ts). Yalnızca iç ekip; rol
  sunucuda yeniden okunuyor, istemciden gelen hiçbir şeye güvenilmiyor.
  Çerez yalnızca DÜZENİ seçiyor — yetkiler, RLS ve veriler değişmiyor.

  Abonelik kapısı yok: yeni içerik yazmıyor, dış maliyet üretmiyor ve
  iç ekip kapıdan zaten geçiyor (lib/access.ts).
*/
export async function gorunumSec(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  if (!onizleyebilir(ctx.role)) return { error: (await ceviri())({ tr: "Görünüm önizlemesi yalnızca sistem yöneticisi ve kurucuya açık.", en: "View preview is only available to system administrators and founders." }) };

  const secilen = String(formData.get("gorunum") ?? "");
  if (!gorunumMu(secilen)) return { error: (await ceviri())({ tr: "Görünüm tanınmadı.", en: "Unknown view." }) };

  const depo = await cookies();
  if (secilen === "personel") depo.delete(ONIZLEME_CEREZI);
  else
    depo.set(ONIZLEME_CEREZI, secilen, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      // Unutulan önizleme kalıcı olmasın: bir gün sonra gerçek görünüme döner.
      maxAge: 60 * 60 * 24,
    });

  revalidatePath("/dashboard", "layout");
  const t = await ceviri();
  return { success: true, message: `${t({ tr: "Görünüm", en: "View" })}: ${t(GORUNUM_ETIKETI[secilen])}` };
}
