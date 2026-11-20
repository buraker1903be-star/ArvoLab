import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/app/actions/profile";
import { yonetimeGirebilir } from "@/lib/yonetim";

/*
  Yönetim alanının kapısı. Yalnızca ekranı açar ya da kapatır: içerideki
  satırları yine RLS seçiyor ve her yönetim işlemi (onay, sorumlu atama,
  silme) kendi sunucu denetimini yapıyor. Rolü yetmeyen kişi için alan
  "yok" (404): Üye/Öğrenci menüsünde zaten görünmüyor, adresi elle yazan
  kişiye var olduğunu söylemenin bir yararı yok.

  Bilerek "use server" DEĞİL (AGENTS.md): dışarıdan çağrılabilir bir uç
  noktaya dönüşmesin.
*/
export async function yonetimKapisi() {
  const profile = await getCurrentProfile();
  if (!yonetimeGirebilir(profile?.role)) notFound();
  return profile;
}
