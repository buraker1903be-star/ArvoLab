/*
  BELGENİN DİLİ (28.10.2026), arayüz dilinden AYRI.

  Şekil/tablo etiketi, içindekiler başlığı, kapaktaki "Danışman:" ve atıf
  biçimindeki "vd./et al." öğrencinin ÇALIŞMASINA giriyor; arayüzü
  İngilizce kullanan öğrenci Türkçe tez yazabilir.

  ÇALIŞMA BAŞINA DİL (19.11.2026, K1-A; migration 20261118122556). Sıra:
    1. Çalışmada seçilmiş dil (academic_projects.belge_dili),
    2. yoksa makale profilindeki dil,
    3. yoksa arayüz dili (eski davranış).
  Eskiden alan yoktu ve 2–3 her açılışta yeniden türetiliyordu: arayüz
  dilini değiştiren öğrencinin tezinin etiketleri de değişiyordu. Seçim
  yapılmamış (NULL) eski çalışmalar bilerek aynı kuralla davranmaya devam
  ediyor; toplu doldurma yapılmadı.

  Okunamayan kaynak bir alt basamağa düşer: yanlış dilde bir etiket,
  çıktıyı hiç vermemekten iyidir. Profildeki "diger" de aynı yola gider.
  Karar saf fonksiyonda (belgeDiliKarari), tests/unit/belge-dili.test.ts.
*/
import type { SupabaseClient } from "@supabase/supabase-js";
import { dilMi, type Dil } from "@/lib/dil";

/** Belge için desteklenen diller: etiket metinleri yalnızca bu ikisinde var. Çeviri yapılmaz. */
export const BELGE_DILLERI = ["tr", "en"] as const satisfies readonly Dil[];

export function belgeDiliKarari(girdi: { calisma: unknown; profil: unknown; arayuz: Dil }): Dil {
  if (dilMi(girdi.calisma)) return girdi.calisma;
  if (dilMi(girdi.profil)) return girdi.profil;
  return girdi.arayuz;
}

/** Çalışmada seçilmiş dil, yoksa null (seçilmedi). Form ve sunucu işlemi aynı kuralı kullanır. */
export function secilenBelgeDili(deger: unknown): Dil | null {
  return dilMi(deger) ? deger : null;
}

export async function belgeDili(supabase: SupabaseClient, projectId: string, arayuzDili: Dil): Promise<Dil> {
  const [calisma, profil] = await Promise.all([
    supabase.from("academic_projects").select("belge_dili").eq("id", projectId).maybeSingle(),
    supabase.from("makale_profili").select("dil").eq("project_id", projectId).maybeSingle(),
  ]);
  if (calisma.error) console.error("[belge-dili] çalışmanın dili okunamadı:", calisma.error.message);
  if (profil.error) console.error("[belge-dili] makale profili okunamadı:", profil.error.message);
  return belgeDiliKarari({
    calisma: calisma.error ? null : calisma.data?.belge_dili,
    profil: profil.error ? null : profil.data?.dil,
    arayuz: arayuzDili,
  });
}
