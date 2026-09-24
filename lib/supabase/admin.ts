import { createClient } from "@supabase/supabase-js";

/** Yalnızca güvenilir sunucu görevlerinde ve doğrulanmış sunucu aksiyonlarında kullanılmalıdır. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secret) {
    throw new Error("Supabase sunucu anahtarı eksik.");
  }

  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Yönetim istemcisi; kurulu değilse hata yerine null.
 *
 * createAdminClient() anahtar yoksa HATA FIRLATIR ve çoğu yerde doğrusu
 * budur: köprü ve cron, anahtarsız çalışmamalı. Ama hız sayacı gibi
 * YARDIMCI yollarda niyet tersidir — sayaç kurulamıyorsa kullanıcı
 * engellenmemeli, kapı sert kapanmamalı.
 *
 * O niyet iki yerde `if (!admin) …` diye yazılmıştı ve o satırlar hiç
 * çalışmıyordu (fonksiyon null dönmüyor, fırlatıyor): anahtar eksik
 * olsaydı asistan ve literatür araması, sessizce sayacı atlamak yerine
 * tamamen düşerdi. Niyet artık burada karşılığını buluyor.
 */
export function adminIstemcisiVarsa() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}
