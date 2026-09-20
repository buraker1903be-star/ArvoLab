/*
  Asistanın ortak kapısı: oturum, abonelik, kurulum ve hız sınırı.

  Bilerek "use server" DEĞİL (AGENTS.md): böyle bir dosyadaki her export
  dışarıdan çağrılabilir bir uç noktaya dönüşür, yardımcılar orada durmaz.

  Hız sınırı yetenek başına değil KULLANICI başına: maliyeti yeteneğin adı
  değil, model çağrısının kendisi üretiyor. Ayrı sayaçlar tutsaydık aynı
  kullanıcı her yetenekten ayrı hak kazanıp toplamda sınırın katını
  harcardı.
*/

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { aiYapilandirildi } from "./saglayici";

export const SAATLIK_HAK = 20;

export type KapiSonucu = { hata: string; kullaniciId?: undefined } | { hata: null; kullaniciId: string };

export async function asistanKapisi(): Promise<KapiSonucu> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: "Oturum bulunamadı." };
  if (await isSubscriptionBlocked()) return { hata: SUBSCRIPTION_BLOCKED_MESSAGE };
  if (!aiYapilandirildi())
    return { hata: "Asistan bu kurulumda kapalı. Yöneticinizin yapay zeka anahtarını tanımlaması gerekiyor." };

  /*
    Sayaç veritabanında: sunucu her istekte başka bir örnekte çalışabiliyor,
    bellekteki sayaç hiçbir şey korumaz. rate_limit_hit yalnızca service_role'a
    açık (migration 20260924100002).
  */
  const admin = createAdminClient();
  if (admin) {
    const { data: izin, error } = await admin.rpc("rate_limit_hit", {
      p_key: `ai-asistan:${user.id}`,
      p_limit: SAATLIK_HAK,
      p_window: "1 hour",
    });
    // Sayaç okunamadıysa (geçici arıza) akış durmaz; kapı sert kapanmamalı.
    if (error) console.error("[ai] hız sınırı okunamadı:", error.message);
    else if (izin === false)
      return { hata: `Saatlik asistan hakkınız doldu (${SAATLIK_HAK}). Bir süre sonra tekrar deneyin.` };
  }

  return { hata: null, kullaniciId: user.id };
}
