"use server";

import { createClient } from "@/lib/supabase/server";
import { gecmisSorgular } from "@/lib/ai/gecmis";
import type { GecmisKaydi } from "@/lib/ai/gecmis";
import type { YetenekAdi } from "@/lib/ai/kayit-gorunum";

/*
  Kullanıcının kendi asistan geçmişi. Aynı soruyu ikinci kez sormasın diye
  panelde gösteriliyor: eski cevabı açıp okuyabiliyor, yeni bir çağrıya
  gerek kalmıyor.

  Abonelik kapısı bilerek YOK (lib/access.ts): okuma işlemi, dış maliyet
  üretmiyor ve kullanıcı kendi verisini her zaman görebilmeli.
*/

export async function asistanGecmisim(yetenek: YetenekAdi, limit = 5): Promise<GecmisKaydi[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return gecmisSorgular(user.id, yetenek, limit);
}
