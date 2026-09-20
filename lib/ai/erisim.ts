/*
  Asistanın ortak kapısı: oturum, abonelik, kurulum ve hız sınırı.

  Bilerek "use server" DEĞİL (AGENTS.md): böyle bir dosyadaki her export
  dışarıdan çağrılabilir bir uç noktaya dönüşür, yardımcılar orada durmaz.

  Hız sınırı yetenek başına değil KULLANICI başına: maliyeti yeteneğin adı
  değil, model çağrısının kendisi üretiyor. Ayrı sayaçlar tutsaydık aynı
  kullanıcı her yetenekten ayrı hak kazanıp toplamda sınırın katını
  harcardı. Sayaç kapıdan ayrı (asistanHakkiVar): kayıtlı cevap
  gösterilirken model çağrılmadığı için hak da yanmamalı.
*/

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { aiYapilandirildi } from "./saglayici";

export const SAATLIK_HAK = 20;

export type KapiSonucu = { ok: false; hata: string } | { ok: true; kullaniciId: string };

/**
 * Saatlik hak ayrı tutuluyor: kayıtlı bir cevap gösterilirken model
 * çağrılmıyor, dolayısıyla hak da yanmamalı. Aksi halde kullanıcı kendi
 * geçmişine bakarken hakkını tüketirdi.
 */
export async function asistanHakkiVar(kullaniciId: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: izin, error } = await admin.rpc("rate_limit_hit", {
    p_key: `ai-asistan:${kullaniciId}`,
    p_limit: SAATLIK_HAK,
    p_window: "1 hour",
  });
  // Sayaç okunamadıysa (geçici arıza) akış durmaz; kapı sert kapanmamalı.
  if (error) {
    console.error("[ai] hız sınırı okunamadı:", error.message);
    return null;
  }
  return izin === false ? `Saatlik asistan hakkınız doldu (${SAATLIK_HAK}). Bir süre sonra tekrar deneyin.` : null;
}

/** Oturum, abonelik ve kurulum. Sayaç burada işlemez (bkz. asistanHakkiVar). */
export async function asistanKapisi(): Promise<KapiSonucu> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, hata: "Oturum bulunamadı." };
  if (await isSubscriptionBlocked()) return { ok: false, hata: SUBSCRIPTION_BLOCKED_MESSAGE };
  if (!aiYapilandirildi())
    return { ok: false, hata: "Asistan bu kurulumda kapalı. Yöneticinizin yapay zeka anahtarını tanımlaması gerekiyor." };

  return { ok: true, kullaniciId: user.id };
}
