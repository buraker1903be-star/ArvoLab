import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { baskaCihazdanKapatildiMi, oturumCereziMi } from "@/lib/tek-oturum";

export const dynamic = "force-dynamic";

/*
  OTURUM GÖZCÜSÜ UCU (02.11.2026, lib/tek-oturum.ts). Panel açık bekleyen
  bir sekme sayfa değiştirmeden de "başka bir cihazdan giriş yapıldı"
  uyarısını görmeli; panel bu uca dakikada bir ve sekmeye dönüldüğünde
  sorar (dashboard/_components/oturum-gozcusu.tsx).

  Sunucu işlemi DEĞİL, GET ucu: api/ proxy'nin dışında (proxy.ts matcher).
  Kapatılmış bir oturumla gelen sunucu işlemi proxy'de yönlendirmeye
  takılır ve gözcüye cevap dönemezdi. Yalnızca evet/hayır döner; kimlik
  ya da hesap bilgisi yok.
*/
export async function GET() {
  // getUser reddedilen oturumun çerezini siler; "çerez vardı mı" ondan ÖNCE okunur.
  const oturumCereziVardi = (await cookies()).getAll().some((c) => oturumCereziMi(c.name));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const kapatildi = !data.user && baskaCihazdanKapatildiMi(error, oturumCereziVardi);
  if (kapatildi) await supabase.auth.signOut({ scope: "local" });
  return Response.json({ kapatildi }, { headers: { "Cache-Control": "no-store" } });
}
