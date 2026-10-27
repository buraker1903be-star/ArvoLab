/*
  Kurum seçiminin sunucu tarafı (karar lib/kurum-secimi.ts'te).

  Bilerek "use server" DEĞİL (AGENTS.md): yardımcılar böyle dosyalarda durmaz.
*/
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loadCurrentProfile } from "@/lib/current-profile";
import { ADMIN_ROLES } from "@/lib/project-labels";
import { KURUM_CEREZI, kurumSecimi } from "./kurum-secimi";

export type SeciliKurum = { id: string; ad: string; kullanicilar: string[] };

/*
  Seçili kurum ve o kurumun kullanıcıları (talepler requested_by ile,
  çalışmaların bir kısmı organization_id'siz eski satırlar — sahibin
  kurumuyla süzülüyor). İstek başına bir kez okunur. Kurum listesi ya da
  kullanıcılar okunamazsa seçim YOK sayılır: yarım okunmuş bir süzgeç
  ekranı eksik gösterirdi, hepsini göstermek daha az yanıltıcı.
*/
export const seciliKurum = cache(async (): Promise<SeciliKurum | null> => {
  const profil = await loadCurrentProfile();
  const icEkip = Boolean(profil?.role && ADMIN_ROLES.includes(profil.role));
  const cerez = (await cookies()).get(KURUM_CEREZI)?.value;
  if (!icEkip || !cerez) return null;

  const supabase = await createClient();
  const { data: kurumlar, error } = await supabase.from("organizations").select("id, name");
  if (error) {
    console.error("[kurum seçimi] kurumlar okunamadı", error.message);
    return null;
  }
  const id = kurumSecimi(cerez, kurumlar ?? [], icEkip);
  if (!id) return null;

  const { data: uyeler, error: uyeHatasi } = await supabase.from("profiles").select("id").eq("organization_id", id);
  if (uyeHatasi) {
    console.error("[kurum seçimi] kurum kullanıcıları okunamadı", uyeHatasi.message);
    return null;
  }
  return { id, ad: (kurumlar ?? []).find((k) => k.id === id)?.name ?? "Kurum", kullanicilar: (uyeler ?? []).map((u) => u.id) };
});
