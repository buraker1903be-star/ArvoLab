/*
  BELGENİN DİLİ (28.10.2026), arayüz dilinden AYRI.

  Şekil/tablo etiketi, içindekiler başlığı, kapaktaki "Danışman:" ve atıf
  biçimindeki "vd./et al." öğrencinin ÇALIŞMASINA giriyor; arayüzü
  İngilizce kullanan öğrenci Türkçe tez yazabilir. Çalışma başına bir dil
  alanı henüz yok: makale profilinde seçilmiş bir dil varsa o, yoksa
  arayüz dili kullanılıyor. Alan eklenince karar burada değişir — tek
  yerde dursun diye ayrı dosya (editör, yazdırma, paylaşım, Word çıktısı).

  Profil okunamazsa arayüz diline düşülür: yanlış dilde bir etiket,
  çıktıyı hiç vermemekten iyidir. Profildeki "diger" de aynı yola gider.
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { dilMi, type Dil } from "@/lib/dil";

export async function belgeDili(supabase: SupabaseClient, projectId: string, arayuzDili: Dil): Promise<Dil> {
  const { data, error } = await supabase.from("makale_profili").select("dil").eq("project_id", projectId).maybeSingle();
  if (error) {
    console.error("[belge-dili] makale profili okunamadı:", error.message);
    return arayuzDili;
  }
  const dil: unknown = data?.dil;
  return dilMi(dil) ? dil : arayuzDili;
}
