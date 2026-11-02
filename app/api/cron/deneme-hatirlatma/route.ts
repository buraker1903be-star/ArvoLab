import { cronYetkiliMi } from "@/lib/cron-yetki";
import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { denemeBittiEmail, denemeBitiyorEmail } from "@/lib/email/auth-emails";
import { dilMi, YEREL, type Dil } from "@/lib/dil";
import { bitenler, bitisPenceresi, hatirlatilacaklar, hatirlatmaPenceresi, TEK_SEFERDE } from "@/lib/deneme-hatirlatma";
import { ensureSubscription } from "@/lib/subscription";
import { siteOrigin } from "@/lib/site-url";

export const runtime = "nodejs";
// Her aboneye ArvoOS'a bir soru + bir e-posta: yavaş ama saatte birkaç kişi.
export const maxDuration = 60;

/*
  DENEME SÜRESİ BİLDİRİMLERİ (migration 20260924100027, 20261102102456).

  İki olay, ikisi de e-posta VE panel bildirimi (zil):
   1. Son gün: bitişe 24 saat kala "deneme süreniz <tarih saat>'te bitiyor".
   2. Bitiş: "deneme süreniz sona erdi, erişiminiz durduruldu".
  02.11.2026'ya kadar yalnızca 1. vardı, 3 gün kala ve yalnızca e-postayla;
  deneme 3 güne inince (kurum sahibinin kararı) kayıttan hemen sonra
  gidiyordu. İş artık saatte bir çalışıyor (vercel.json): bitiş bildirimi
  en fazla bir saat gecikir.

  Erişimin kendisini bu iş DURDURMAZ: kapı her istekte ArvoOS'un kararına
  bakıyor (lib/access.ts). Bu iş yalnızca haber verir.

  Neden ArvoLab'da: aboneliğin kendisi ArvoOS'ta ama e-posta altyapısı,
  kullanıcının adresi, dili ve zili burada.

  Gönderim öncesi abonelik ArvoOS'a YENİDEN SORULUYOR. Yerel ayna yalnızca
  kullanıcı ürüne girdiğinde tazeleniyor; parasını ödeyip bir daha
  uğramamış birine "denemeniz bitiyor" ya da "erişiminiz durdu" demek, en
  kötü yanlış bilgidir. Soru aynı zamanda aynayı da güncelliyor.

  İşaretler GÖNDERİMDEN SONRA yazılıyor: gönderim başarısız olursa kişi
  bildirimi almadan "bildirildi" sayılmaz, bir sonraki turda yeniden
  denenir. E-posta ya da zil ikisinden biri gittiyse işaret yazılır —
  ikisini birden beklemek, e-posta anahtarı olmayan bir kurulumda zile
  her saat yeni bir satır yazdırırdı.
*/

type Admin = NonNullable<ReturnType<typeof adminIstemcisiVarsa>>;

const bitisYazisi = (iso: string, dil: Dil) =>
  new Date(iso).toLocaleString(YEREL[dil], { timeZone: "Europe/Istanbul", dateStyle: "long", timeStyle: "short" })
  + (dil === "en" ? " (Turkey time)" : "");

async function kisi(admin: Admin, userId: string): Promise<{ eposta: string; dil: Dil } | null> {
  const { data: kullanici } = await admin.auth.admin.getUserById(userId);
  const eposta = kullanici?.user?.email;
  if (!eposta) return null;
  /* Kullanıcının seçtiği dil (profiles.arayuz_dili); okunamazsa ya da tercih yoksa Türkçe. */
  const { data: profil } = await admin.from("profiles").select("arayuz_dili").eq("id", userId).maybeSingle();
  return { eposta, dil: dilMi(profil?.arayuz_dili) ? profil.arayuz_dili : "tr" };
}

/* Zil bildirimi: 'billing' türü yalnızca service_role'a açık (20261028174054). */
async function zileYaz(admin: Admin, userId: string, baslik: string, govde: string): Promise<boolean> {
  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    kind: "billing",
    title: baslik.slice(0, 200),
    body: govde.slice(0, 500),
    link: "/dashboard/abonelik",
  });
  if (error) console.error("[deneme] panel bildirimi yazılamadı", userId, error.message);
  return !error;
}

async function epostaGonder(eposta: string, posta: { subject: string; html: string }, userId: string): Promise<boolean> {
  try {
    const sonuc = await sendEmail({ to: eposta, ...posta });
    if (!sonuc.ok) console.error("[deneme] e-posta gönderilemedi", userId, sonuc.reason);
    return sonuc.ok;
  } catch (sorun) {
    // Bir kişiye gönderilememesi, kalanları da göndermemek demek olmamalı.
    console.error("[deneme] e-posta gönderilemedi", userId, sorun instanceof Error ? sorun.message : sorun);
    return false;
  }
}

export async function GET(request: Request) {
  if (!cronYetkiliMi(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = adminIstemcisiVarsa();
  if (!admin) return Response.json({ error: "Sunucu anahtarı yok." }, { status: 503 });

  const aboneligim = `${await siteOrigin()}/dashboard/abonelik`;

  /*
    tuzak-tamam: aşağıdaki sayaçlar bir NÜFUS ölçmüyor, BU TURDA ne
    yapıldığını raporluyor. TEK_SEFERDE bilinçli parti büyüklüğü; sıraya
    girmeyen aday kaybolmuyor, işareti hâlâ boş olduğu için bir sonraki
    turda yeniden aday oluyor.
  */

  // ---- 1. Son gün hatırlatması ----
  // Pencerenin ALT sınırı da var; gerekçesi lib/deneme-hatirlatma.ts'te.
  const pencere = hatirlatmaPenceresi();
  const { data: yakinlar, error: yakinHatasi } = await admin
    .from("individual_subscriptions")
    .select("user_id,status,trial_ends_at,deneme_hatirlatildi_at")
    .eq("status", "trialing")
    .is("deneme_hatirlatildi_at", null)
    .gt("trial_ends_at", pencere.altSinir)
    .lte("trial_ends_at", pencere.ustSinir)
    .order("trial_ends_at", { ascending: true })
    .limit(TEK_SEFERDE);
  if (yakinHatasi) return Response.json({ error: yakinHatasi.message }, { status: 500 });

  let hatirlatilan = 0;
  let vazgecilen = 0;
  for (const aday of hatirlatilacaklar(yakinlar ?? [])) {
    const k = await kisi(admin, aday.userId);
    if (!k) continue;
    // ArvoOS'un son sözü: arada ödeme yapılmışsa uyarı gönderilmez.
    const guncel = await ensureSubscription({ id: aday.userId, email: k.eposta });
    if (guncel && guncel.status !== "trialing") {
      vazgecilen += 1;
      continue;
    }
    const bitis = bitisYazisi(guncel?.trialEndsAt ?? aday.bitis, k.dil);
    const gitti = await epostaGonder(k.eposta, denemeBitiyorEmail(bitis, aboneligim, k.dil), aday.userId);
    const zil = await zileYaz(
      admin,
      aday.userId,
      k.dil === "en" ? "Your trial ends soon" : "Deneme süreniz bitmek üzere",
      k.dil === "en"
        ? `Your trial ends on ${bitis}. Start your subscription to keep working without interruption.`
        : `Deneme süreniz ${bitis} tarihinde bitiyor. Kesintisiz devam etmek için aboneliğinizi başlatın.`,
    );
    if (!gitti && !zil) continue;
    const { error } = await admin
      .from("individual_subscriptions")
      .update({ deneme_hatirlatildi_at: new Date().toISOString() })
      .eq("user_id", aday.userId);
    if (error) console.error("[deneme] hatırlatma işareti yazılamadı", aday.userId, error.message);
    hatirlatilan += 1;
  }

  // ---- 2. Deneme bitti bildirimi ----
  const bp = bitisPenceresi();
  const { data: bitmisler, error: bitisHatasi } = await admin
    .from("individual_subscriptions")
    .select("user_id,status,trial_ends_at,deneme_hatirlatildi_at,deneme_bitti_bildirildi_at")
    .eq("status", "trialing")
    .is("deneme_bitti_bildirildi_at", null)
    .gt("trial_ends_at", bp.altSinir)
    .lte("trial_ends_at", bp.ustSinir)
    .order("trial_ends_at", { ascending: true })
    .limit(TEK_SEFERDE);
  if (bitisHatasi) {
    // Sütun henüz yoksa (migration uygulanmadı) 1. aşamanın sonucu kaybolmasın.
    console.error("[deneme] bitenler okunamadı", bitisHatasi.message);
    return Response.json({ hatirlatilan, vazgecilen, bitisHatasi: bitisHatasi.message }, { status: 500 });
  }

  let bitisBildirilen = 0;
  for (const aday of bitenler(bitmisler ?? [])) {
    const k = await kisi(admin, aday.userId);
    if (!k) continue;
    /*
      ArvoOS'a sorulur: arada ödeme yaptıysa ya da ArvoOS'a ulaşılamıyorsa
      (null) "erişiminiz durdu" denmez. Ulaşılamazsa işaret de yazılmaz;
      bir sonraki turda yeniden denenir.
    */
    const guncel = await ensureSubscription({ id: aday.userId, email: k.eposta });
    if (!guncel) continue;
    if (guncel.access) {
      vazgecilen += 1;
      // Ödeme yapmış: bu deneme için bildirim artık hiç gerekmeyecek.
      await admin.from("individual_subscriptions").update({ deneme_bitti_bildirildi_at: new Date().toISOString() }).eq("user_id", aday.userId);
      continue;
    }
    const gitti = await epostaGonder(k.eposta, denemeBittiEmail(aboneligim, k.dil), aday.userId);
    const zil = await zileYaz(
      admin,
      aday.userId,
      k.dil === "en" ? "Your trial has ended" : "Deneme süreniz sona erdi",
      k.dil === "en"
        ? "Access to the working screens has been paused; nothing has been deleted. Start your subscription to continue where you left off."
        : "Çalışma ekranlarına erişiminiz durduruldu; hiçbir şey silinmedi. Aboneliğinizi başlattığınızda kaldığınız yerden devam edersiniz.",
    );
    if (!gitti && !zil) continue;
    const { error } = await admin
      .from("individual_subscriptions")
      .update({ deneme_bitti_bildirildi_at: new Date().toISOString() })
      .eq("user_id", aday.userId);
    if (error) console.error("[deneme] bitiş işareti yazılamadı", aday.userId, error.message);
    bitisBildirilen += 1;
  }

  return Response.json({ hatirlatilan, bitisBildirilen, vazgecilen });
}
