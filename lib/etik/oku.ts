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

/*
  Birden çok çalışmanın etik kaydı tek sorguda (personelin listesi ve ana
  sayfası). Okunamazsa boş harita: işaret çıkmaması "temiz" demek değil,
  kesin durum çalışmanın etik penceresinde.
*/
export async function etikKayitlariOku(supabase: SupabaseClient, projectIds: string[]): Promise<Map<string, EtikKaydi>> {
  const harita = new Map<string, EtikKaydi>();
  if (!projectIds.length) return harita;
  const { data, error } = await supabase
    .from("etik_kurul")
    .select("project_id, durum, onay_tarihi, karar_no, veri_toplama_baslangic, gerekmeme_gerekcesi")
    .in("project_id", projectIds);
  if (error) {
    console.error("[etik] kayıtlar okunamadı", error.message);
    return harita;
  }
  for (const satir of data ?? []) {
    const { project_id, ...kayit } = satir as { project_id: string } & Omit<EtikKaydi, "durum"> & { durum: string };
    harita.set(project_id, { ...kayit, durum: kayit.durum as EtikDurum });
  }
  return harita;
}
