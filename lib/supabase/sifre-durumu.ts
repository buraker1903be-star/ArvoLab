import type { SupabaseClient } from "@supabase/supabase-js";

/*
  Oturumun hesabında şifre var mı (public.sifre_durumum, migration
  20261107113542). null = okunamadı: çağıran kapıyı KAPATMAZ
  (lib/ilk-sifre.ts — geçici bir arıza kimseyi panelden atmamalı).
*/
export async function sifreDurumu(supabase: SupabaseClient): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("sifre_durumum");
  if (error) {
    console.error("[ilk-şifre] şifre durumu okunamadı:", error.message);
    return null;
  }
  return typeof data === "boolean" ? data : null;
}
