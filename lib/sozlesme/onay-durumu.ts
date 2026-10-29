/*
  Kullanıcının yürürlükteki Kullanım Sözleşmesi sürümünü onaylayıp
  onaylamadığı (sozlesme_onaylari, 20261029153742). İstek başına bir kez.

  OKUYAMAZSA KAPATMAZ: tablo henüz yoksa (migration uygulanmadan önceki
  dağıtım) ya da sorgu düşerse pencere gösterilmez ve log'a yazılır.
  Geçici bir arıza ya da sıralama hatası bütün kullanıcıları bir onay
  penceresine kilitlememeli; onay bir sonraki istekte istenir. Yönetim
  anahtarı yoksa da gösterilmez: onay yazılamayacağı için pencere
  kullanıcıyı hiç çıkamayacağı bir yere kapatırdı.

  İç ekip (system_admin, founder) muaf: müşteri değiller.

  Bilerek "use server" DEĞİL (AGENTS.md).
*/
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { ADMIN_ROLES } from "@/lib/project-labels";
import type { UserRole } from "@/lib/project-labels";
import { SOZLESME_SURUMU } from "./kullanim-sozlesmesi";

export type SozlesmeOnayi = {
  id: string;
  surum: string;
  dil: string;
  olay: string;
  onaylandi: string;
  ip: string | null;
  kullanici_araci: string | null;
  odeme_referansi: string | null;
  metin_ozeti: string;
};

export const sozlesmeOnayGerekli = cache(async (kullanici: { id: string; role: UserRole | string | null }): Promise<boolean> => {
  if (kullanici.role && (ADMIN_ROLES as readonly string[]).includes(kullanici.role)) return false;
  if (!adminIstemcisiVarsa()) return false;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sozlesme_onaylari")
    .select("id")
    .eq("user_id", kullanici.id)
    .eq("belge", "kullanim_sozlesmesi")
    .eq("surum", SOZLESME_SURUMU)
    .limit(1);
  if (error) {
    console.error("[sözleşme] onay durumu okunamadı; pencere gösterilmedi", error.code, error.message);
    return false;
  }
  return !data?.length;
});

/** Ödemeden dönüşte: son yarım saatte ödeme sonrası onay verilmiş mi (yenilemede pencere yeniden açılmasın). */
export async function odemeSonrasiOnayVar(kullaniciId: string): Promise<boolean> {
  // Onay yazılamayacaksa pencere açılmasın (yukarıdaki gerekçe).
  if (!adminIstemcisiVarsa()) return true;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sozlesme_onaylari")
    .select("id")
    .eq("user_id", kullaniciId)
    .eq("olay", "odeme_sonrasi")
    .eq("surum", SOZLESME_SURUMU)
    .gte("onaylandi", new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .limit(1);
  // Okunamazsa VAR sayılır: pencere ödeme dönüşünde kullanıcıyı kilitlemesin.
  if (error) return true;
  return Boolean(data?.length);
}

export async function sozlesmeOnaylarim(kullaniciId: string): Promise<{ satirlar: SozlesmeOnayi[]; okunamadi: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sozlesme_onaylari")
    .select("id, surum, dil, olay, onaylandi, ip, kullanici_araci, odeme_referansi, metin_ozeti")
    .eq("user_id", kullaniciId)
    .order("onaylandi", { ascending: false });
  if (error) {
    console.error("[sözleşme] onaylar okunamadı", error.message);
    return { satirlar: [], okunamadi: true };
  }
  return { satirlar: (data ?? []) as SozlesmeOnayi[], okunamadi: false };
}
