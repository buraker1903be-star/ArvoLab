"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/app/actions/profile";
import { ADMIN_ROLES } from "@/lib/project-labels";
import {
  aktivasyonAdimlari,
  BOS_SAYILAR,
  donusumYuzdesi,
  sayilariOku,
  type AktivasyonAdimi,
  type OlcumSayilari,
} from "@/lib/olcum";

/*
  Ürün ölçümü — okuma katmanı.

  Sayımın tamamı tek bir veritabanı çağrısında (public.olcum_ozeti,
  20260924100030). Satırları buraya çekip saymak bin kullanıcıda sessizce
  kırılıyordu: PostgREST varsayılan satır sınırı yüzünden bütün sayılar
  1000'de kalır, aktivasyon sorgularının "in (...)" listesi de URL sınırını
  aşardı. Ölçüm sayfasının yapabileceği en kötü şey yanlış bir sayıyı doğru
  gibi göstermektir.

  Buradaki rol denetimi RLS'in yerini tutmaz (AGENTS.md); fonksiyon kendi
  kapısını da tutuyor. Bu kontrol yetkisiz isteğin ham hata yerine anlaşılır
  bir ekran görmesi için.
*/
export interface OlcumOzeti {
  yetkisiz: boolean;
  okunamadi: boolean;
  sayilar: OlcumSayilari;
  donusum: number | null;
  aktivasyon: AktivasyonAdimi[];
}

const bos = (parca: Partial<OlcumOzeti>): OlcumOzeti => ({
  yetkisiz: false,
  okunamadi: false,
  sayilar: BOS_SAYILAR,
  donusum: null,
  aktivasyon: aktivasyonAdimlari(BOS_SAYILAR),
  ...parca,
});

export async function olcumOzeti(): Promise<OlcumOzeti> {
  const profile = await getCurrentProfile();
  if (!profile || !ADMIN_ROLES.includes(profile.role)) return bos({ yetkisiz: true });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("olcum_ozeti");

  if (error) {
    console.error("[ölçüm] sayılar okunamadı:", error.message);
    return bos({ okunamadi: true });
  }

  const sayilar = sayilariOku(data);
  return {
    yetkisiz: false,
    okunamadi: false,
    sayilar,
    donusum: donusumYuzdesi(sayilar),
    aktivasyon: aktivasyonAdimlari(sayilar),
  };
}
