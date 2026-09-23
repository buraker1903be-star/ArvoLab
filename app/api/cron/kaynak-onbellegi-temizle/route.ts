import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/*
  Doğrulama önbelleğinin bakımı (migration 20260924100021).

  Önbellek satırları süresi dolunca OKUNMUYOR ama silinmiyordu: doğrulama
  yolu `gecerlilik > now()` süzgeciyle çalışıyor, yani süresi geçmiş satır
  zararsız. Zararsız ama kalıcı — platform büyüdükçe tablo yalnızca
  büyürdü ve kimse fark etmezdi.

  Silme eşiği süre dolumundan 30 gün SONRA: süresi yeni dolmuş bir satırın
  üstüne yazılması (aynı künyeye tekrar bakıldığında) silinip yeniden
  eklenmesinden ucuz.
*/
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("kaynak_onbellegini_temizle");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ silinen: data ?? 0 });
}
