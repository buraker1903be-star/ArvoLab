"use server";

import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/app/actions/profile";
import { KAYIT_ROLLERI, type AsistanKayitSatiri, type ModelOzeti } from "@/lib/ai/kayit-gorunum";

/*
  Asistan kayıtlarının iç ekip görünümü. Veri birikiyordu ama kimse
  göremiyordu: ne harcamanın nereye gittiği, ne hangi modelin daha iyi
  denetlediği, ne de ince ayar için hangi örneklerin kullanılabileceği.

  Okuma RLS'e tabi (migration 20260924100005): kontrolör, akademik yönetici,
  sistem yöneticisi ve kurucu bütün kayıtları görür. Buradaki rol denetimi
  RLS'in yerini tutmaz; yetkisiz isteğin sessizce boş liste dönmesini
  engeller ve kullanıcıya anlaşılır mesaj verir (AGENTS.md).
*/

async function yetkiliMi() {
  const profile = await getCurrentProfile();
  return profile ? KAYIT_ROLLERI.includes(profile.role) : false;
}

/*
  Son kayıtlar. Yetkisizse boş liste — sayfa kendi uyarısını gösterir; bu bir
  okuma hatası değil. Okuma GERÇEKTEN başarısız olduğunda ise eskiden yine boş
  liste dönüyordu ve ekran "Henüz asistan çalışması yok" diyordu: bu tablo
  ArvoLab'ın eğitim verisi, "hiç kayıt yok" iç ekip için yanlış bir haber.
*/
export async function asistanKayitlari(limit = 50): Promise<ListeSonucu<AsistanKayitSatiri>> {
  if (!(await yetkiliMi())) return listeBasarili([]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_assistant_runs")
    .select("id, created_at, capability, status, reject_reason, model, rating, duration_ms, prompt_chars, output_chars, context, output")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (error) {
    console.error("[ai] kayıtlar okunamadı:", error.message);
    return listeOkunamadi();
  }
  return listeBasarili((data ?? []) as AsistanKayitSatiri[]);
}

/**
 * Model karşılaştırması. Hangi modelin daha iyi denetlediğine tahminle değil
 * kullanıcı puanıyla karar verilsin diye: pahalı modeli ucuzuyla değiştirmek
 * ancak bu tablo elde varken savunulabilir.
 *
 * Sayım VERİTABANINDA (asistan_model_ozetleri, migration 20260926150217).
 * Eskiden .limit(5000) ile satır çekilip toplamlar burada tutuluyordu ve
 * sorgunun sıralaması yoktu: tablo sınırı aştığı gün özet rastgele bir alt
 * kümenin özeti olurdu ve ekran aynı görünürdü. Kararın ağırlığı düşünülürse
 * en kötü hata biçimi bu — yanlış sayı, eksik sayıdan sinsi.
 *
 * Fonksiyon security invoker: hangi satırların sayıldığına RLS karar veriyor.
 * Aşağıdaki rol denetimi onun yerini tutmaz, yetkisiz isteğin sessizce boş
 * liste dönmesini engeller (AGENTS.md).
 */
export async function modelOzetleri(): Promise<ListeSonucu<ModelOzeti>> {
  if (!(await yetkiliMi())) return listeBasarili([]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("asistan_model_ozetleri");

  if (error) {
    console.error("[ai] model özeti okunamadı:", error.message);
    // Eksik satırlardan çıkarılan karşılaştırma, pahalı modeli ucuzuyla
    // değiştirme kararını yanlış veriye dayandırırdı.
    return listeOkunamadi();
  }

  /* PostgREST bigint'i DİZGİ olarak döndürür; Number'a çevrilmezse sıralama
     sözlük sırasına döner ("9" > "10") ve toplamlar birleştirilir. */
  const sayi = (deger: unknown) => Number(deger ?? 0) || 0;
  const ozetler: ModelOzeti[] = ((data ?? []) as Record<string, unknown>[]).map((satir) => ({
    model: String(satir.model ?? "bilinmiyor"),
    toplam: sayi(satir.toplam),
    tamamlanan: sayi(satir.tamamlanan),
    reddedilen: sayi(satir.reddedilen),
    basarisiz: sayi(satir.basarisiz),
    faydali: sayi(satir.faydali),
    kismen: sayi(satir.kismen),
    faydasiz: sayi(satir.faydasiz),
    puanlanan: sayi(satir.puanlanan),
    ortSure: sayi(satir.ort_sure),
    toplamKarakter: sayi(satir.toplam_karakter),
  }));
  return listeBasarili(ozetler.sort((a, b) => b.toplam - a.toplam));
}
