import type { SupabaseClient } from "@supabase/supabase-js";

/*
  Oturumun şifre belirlemesi gerekiyor mu (public.ilk_sifre_gerekli,
  migration 20261107120542): şifre yok VE ArvoOS üyesi değil. null =
  okunamadı: çağıran kapıyı KAPATMAZ (lib/ilk-sifre.ts — geçici bir arıza
  kimseyi panelden atmamalı).
*/
export async function ilkSifreDurumu(supabase: SupabaseClient): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("ilk_sifre_gerekli");
  if (error) {
    console.error("[ilk-şifre] durum okunamadı:", error.message);
    return null;
  }
  return typeof data === "boolean" ? data : null;
}
