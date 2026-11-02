import type { SupabaseClient } from "@supabase/supabase-js";
import type { EtikDurum, EtikKaydi } from "./durum";

/*
  Çalışmanın etik kurul kaydı (etik_kurul, 20261102134543): teslim kontrolü
  (editör, ana sayfa, çalışma özeti) aynı alanları okur. Okunamazsa null —
  teslim listesinde etik satırı görünmez; "onay yok" diye yanlış bir eksik
  çıkarmaktansa satırı hiç göstermemek doğru (kayıt bulunamadığında da
  satır yok: kullanıcı henüz belirlememiş).
*/
export async function etikKaydiOku(supabase: SupabaseClient, projectId: string): Promise<EtikKaydi | null> {
  const { data, error } = await supabase
    .from("etik_kurul")
    .select("durum, onay_tarihi, karar_no, veri_toplama_baslangic, gerekmeme_gerekcesi")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) {
    console.error("[etik] kayıt okunamadı", error.message);
    return null;
  }
  return data ? { ...data, durum: data.durum as EtikDurum } : null;
}
