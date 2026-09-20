"use server";

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

/** Son kayıtlar. Yetkisizse boş liste — sayfa kendi uyarısını gösterir. */
export async function asistanKayitlari(limit = 50): Promise<AsistanKayitSatiri[]> {
  if (!(await yetkiliMi())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_assistant_runs")
    .select("id, created_at, capability, status, reject_reason, model, rating, duration_ms, prompt_chars, output_chars, context, output")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));

  if (error) {
    console.error("[ai] kayıtlar okunamadı:", error.message);
    return [];
  }
  return (data ?? []) as AsistanKayitSatiri[];
}

/**
 * Model karşılaştırması. Hangi modelin daha iyi denetlediğine tahminle değil
 * kullanıcı puanıyla karar verilsin diye: pahalı modeli ucuzuyla değiştirmek
 * ancak bu tablo elde varken savunulabilir.
 */
export async function modelOzetleri(): Promise<ModelOzeti[]> {
  if (!(await yetkiliMi())) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_assistant_runs")
    .select("model, status, rating, duration_ms, prompt_chars, output_chars")
    .limit(5000);

  if (error) {
    console.error("[ai] model özeti okunamadı:", error.message);
    return [];
  }

  const kovalar = new Map<string, ModelOzeti & { sureToplam: number; sureAdet: number }>();
  for (const satir of data ?? []) {
    const ad = satir.model ?? "bilinmiyor";
    const kova =
      kovalar.get(ad) ??
      { model: ad, toplam: 0, tamamlanan: 0, reddedilen: 0, basarisiz: 0, faydali: 0, kismen: 0, faydasiz: 0, puanlanan: 0, ortSure: 0, toplamKarakter: 0, sureToplam: 0, sureAdet: 0 };

    kova.toplam += 1;
    if (satir.status === "completed") kova.tamamlanan += 1;
    if (satir.status === "rejected") kova.reddedilen += 1;
    if (satir.status === "failed") kova.basarisiz += 1;
    if (satir.rating === "faydali") kova.faydali += 1;
    if (satir.rating === "kismen") kova.kismen += 1;
    if (satir.rating === "faydasiz") kova.faydasiz += 1;
    if (satir.rating) kova.puanlanan += 1;
    if (satir.duration_ms) {
      kova.sureToplam += Number(satir.duration_ms);
      kova.sureAdet += 1;
    }
    kova.toplamKarakter += Number(satir.prompt_chars ?? 0) + Number(satir.output_chars ?? 0);
    kovalar.set(ad, kova);
  }

  return [...kovalar.values()]
    .map(({ sureToplam, sureAdet, ...ozet }) => ({ ...ozet, ortSure: sureAdet ? Math.round(sureToplam / sureAdet) : 0 }))
    .sort((a, b) => b.toplam - a.toplam);
}
