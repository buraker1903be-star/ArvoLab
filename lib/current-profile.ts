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

  /*
    Kurumsuz profil: ArvoOS'un ittiği üye listesinde bu e-posta varsa
    kendiliğinden o kuruma bağlanıyor (arvoos_uyeligimi_bagla).

    Neden burada: bağlama tetikleyicisi yalnızca YENİ kayıtta çalışıyor,
    oysa bugün ArvoLab'da olan herkes listeden önce kaydoldu. Profil
    okumanın olduğu tek yer burası ve cache() sayesinde istek başına bir
    kez dönüyor.

    Kurumu olan profilde hiç çağrılmıyor: her istekte bir RPC, kurumsuz
    olmayan herkes için boşa gidip gelen bir çağrı olurdu.

    Bağlanamazsa akış düşmüyor — kişi kurumsuz da olsa ArvoLab'a girebilmeli
    (AGENTS.md: "Kapıyı yalnızca net bir hayır kapatır").
  */
  const profil = data as CurrentProfile;
  if (profil.organization_id) return profil;

  const { error: baglamaHatasi } = await supabase.rpc("arvoos_uyeligimi_bagla");
  if (baglamaHatasi) {
    console.error("[arvoos] üyelik bağlanamadı", baglamaHatasi.message);
    return profil;
  }

  const { data: yeni } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id")
    .eq("id", user.id)
    .single();
  return (yeni as CurrentProfile | null) ?? profil;
});
