import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { denemeBitiyorEmail } from "@/lib/email/auth-emails";
import { hatirlatilacaklar, hatirlatmaPenceresi, TEK_SEFERDE } from "@/lib/deneme-hatirlatma";
import { ensureSubscription } from "@/lib/subscription";
import { siteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";
// Her aboneye ArvoOS'a bir soru + bir e-posta: yavaş ama günde birkaç kişi.
export const maxDuration = 60;

/*
  Deneme süresi bitmeden önceki tek hatırlatma (migration 20260924100027).

  Neden ArvoLab'da: aboneliğin kendisi ArvoOS'ta ama e-posta altyapısı
  burada (lib/email). Bir de adres ve ad burada: ArvoOS abonenin
  e-postasını biliyor, ArvoLab kullanıcısını tanıyor.

  Gönderim öncesi abonelik ArvoOS'a YENİDEN SORULUYOR. Yerel ayna yalnızca
  kullanıcı ürüne girdiğinde tazeleniyor; parasını ödeyip bir daha
  uğramamış birine "denemeniz bitiyor" demek, en kötü yanlış bilgidir.
  Soru aynı zamanda aynayı da güncelliyor.
*/
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = adminIstemcisiVarsa();
  if (!admin) return Response.json({ error: "Sunucu anahtarı yok." }, { status: 503 });

  // Pencerenin ALT sınırı da var; gerekçesi lib/deneme-hatirlatma.ts'te.
  const { altSinir, ustSinir } = hatirlatmaPenceresi();
  const { data, error } = await admin
    .from("individual_subscriptions")
    .select("user_id,status,trial_ends_at,deneme_hatirlatildi_at")
    .eq("status", "trialing")
    .is("deneme_hatirlatildi_at", null)
    .gt("trial_ends_at", altSinir)
    .lte("trial_ends_at", ustSinir)
    .order("trial_ends_at", { ascending: true })
    .limit(TEK_SEFERDE);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const adaylar = hatirlatilacaklar(data ?? []);
  if (adaylar.length === 0) return Response.json({ gonderilen: 0, aday: 0 });

  const panel = `${await siteOrigin()}/dashboard`;
  let gonderilen = 0;
  let vazgecilen = 0;

  for (const aday of adaylar) {
    const { data: kullanici } = await admin.auth.admin.getUserById(aday.userId);
    const eposta = kullanici?.user?.email;
    if (!eposta) continue;

    // ArvoOS'un son sözü: arada ödeme yapılmışsa uyarı gönderilmez.
    const guncel = await ensureSubscription({ id: aday.userId, email: eposta });
    if (guncel && guncel.status !== "trialing") {
      vazgecilen += 1;
      continue;
    }

    try {
      await sendEmail({ to: eposta, ...denemeBitiyorEmail(aday.kalanGun, panel) });
    } catch (sorun) {
      // Bir kişiye gönderilememesi, kalanları da göndermemek demek olmamalı.
      console.error("[deneme-hatirlatma] gönderilemedi", aday.userId, sorun instanceof Error ? sorun.message : sorun);
      continue;
    }

    /*
      İşaret GÖNDERİMDEN SONRA yazılıyor. Tersi olsaydı, gönderim
      başarısız olduğunda kişi hatırlatmayı hiç almadan "hatırlatıldı"
      sayılırdı — sessiz kayıp.
    */
    const { error: isaretHatasi } = await admin
      .from("individual_subscriptions")
      .update({ deneme_hatirlatildi_at: new Date().toISOString() })
      .eq("user_id", aday.userId);
    if (isaretHatasi) console.error("[deneme-hatirlatma] işaret yazılamadı", aday.userId, isaretHatasi.message);
    gonderilen += 1;
  }

  return Response.json({ aday: adaylar.length, gonderilen, vazgecilen });
}
