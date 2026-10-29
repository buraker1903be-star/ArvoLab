"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { ceviri } from "@/lib/dil-sunucu";
import { dilMi, type Dil } from "@/lib/dil";
import { oturumYokMesaji } from "@/lib/auth-guards";
import { kullanimSozlesmesi, sozlesmeDuzMetni, SOZLESME_SURUMU } from "@/lib/sozlesme/kullanim-sozlesmesi";
import { sendEmail } from "@/lib/email/resend";
import { sozlesmeOnayEmail } from "@/lib/email/auth-emails";

/*
  KULLANIM SÖZLEŞMESİ ONAYI (29.10.2026).

  Delil değeri sunucunun okuduklarından gelir: IP, cihaz/tarayıcı ve dil
  istek BAŞLIKLARINDAN, zaman veritabanının saatinden (onaylandi default
  now()), metin özeti sunucudaki metinden. İstemciden gelen tek bilgi hangi
  dilde okuduğu ve sonuna kadar kaydırdığıdır — kaydırma yapılmadıysa onay
  hiç yazılmaz. Kayıt service_role ile yazılır; kullanıcı tabloya yazamaz
  (20261029153742).

  Abonelik kapısı YOK: onay bir yasal adım, içerik üretmiyor; aboneliği
  bitmiş kullanıcı da onaylayıp ödeme sayfasına ulaşabilmeli.
*/

/** İstemcinin IP'si: Vercel x-forwarded-for'un ilk girdisini istemci olarak yazar. */
function istemciIp(h: Headers): string | null {
  const ileri = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (ileri || h.get("x-real-ip") || "").slice(0, 100) || null;
}

/*
  Ödemeden dönüşte onayı ödemeye bağlayan referans: kartla ödeme
  başlatılınca kullanıcıya özel bir çerez yazılıyor (lib/kart-oturumu.ts,
  arvolab_kart_<sipariş>). Sipariş kimlikleri oradan okunur; ödemenin
  kendisi ArvoOS'ta, bu kimlikle eşleştirilebilir.
*/
async function odemeReferansi(): Promise<string | null> {
  const siparisler = (await cookies())
    .getAll()
    .map((c) => c.name)
    .filter((ad) => ad.startsWith("arvolab_kart_"))
    .map((ad) => ad.slice("arvolab_kart_".length))
    .filter((oid) => /^[A-Za-z0-9_-]{1,64}$/.test(oid));
  return siparisler.length ? `paytr:${siparisler.join(",")}`.slice(0, 300) : null;
}

export async function sozlesmeyiOnayla(girdi: {
  dil: string;
  kaydirmaTamamlandi: boolean;
  olay: "giris" | "odeme_sonrasi";
}): Promise<{ ok: true } | { error: string }> {
  const t = await ceviri();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: await oturumYokMesaji() };

  if (!girdi.kaydirmaTamamlandi) {
    return { error: t({ tr: "Onaylamadan önce sözleşmeyi sonuna kadar okuyun.", en: "Read the agreement to the end before approving." }) };
  }
  const dil: Dil = dilMi(girdi.dil) ? girdi.dil : "tr";
  const olay = girdi.olay === "odeme_sonrasi" ? "odeme_sonrasi" : "giris";

  const admin = adminIstemcisiVarsa();
  if (!admin) {
    return { error: t({ tr: "Onay şu anda kaydedilemiyor; birazdan yeniden deneyin.", en: "Your approval can't be recorded right now; try again shortly." }) };
  }

  const h = await headers();
  const { data: profil } = await supabase.from("profiles").select("full_name, organization_id").eq("id", user.id).maybeSingle();
  const ozet = createHash("sha256").update(sozlesmeDuzMetni(dil), "utf8").digest("hex");
  const ip = istemciIp(h);
  const cihaz = (h.get("user-agent") ?? "").slice(0, 1000) || null;
  const referans = olay === "odeme_sonrasi" ? await odemeReferansi() : null;

  const { data: kayit, error } = await admin
    .from("sozlesme_onaylari")
    .insert({
      user_id: user.id,
      belge: "kullanim_sozlesmesi",
      surum: SOZLESME_SURUMU,
      dil,
      metin_ozeti: ozet,
      olay,
      odeme_referansi: referans,
      kaydirma_tamamlandi: true,
      ip,
      kullanici_araci: cihaz,
      tarayici_dili: (h.get("accept-language") ?? "").slice(0, 200) || null,
      eposta: user.email ?? null,
      ad_soyad: profil?.full_name ?? null,
      organization_id: profil?.organization_id ?? null,
    })
    .select("onaylandi")
    .single();
  if (error || !kayit) {
    console.error("[sözleşme] onay yazılamadı", error?.code, error?.message);
    return { error: t({ tr: "Onay kaydedilemedi; lütfen yeniden deneyin.", en: "Your approval could not be saved; please try again." }) };
  }

  /* Kopya e-postası yanıtı bekletmez ve gönderilemezse akış düşmez (AGENTS.md). */
  if (user.email) {
    const eposta = user.email;
    after(() =>
      kopyayiGonder(eposta, dil, {
        onaylandi: kayit.onaylandi as string,
        surum: SOZLESME_SURUMU,
        ozet,
        ip,
        cihaz,
        odemeReferansi: referans,
      }),
    );
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

/*
  Kopyanın gönderimi ve SONUCUN günlüğe yazılması. Eskiden sendEmail'in
  dönüşü okunmuyordu: başarılı gönderim hiçbir iz bırakmıyordu, kullanıcı
  "e-posta gelmedi" dediğinde gönderimin denenip denenmediği, sağlayıcının
  kabul edip etmediği günlükten anlaşılamıyordu (29.10.2026). Şimdi her
  sonuç (Resend ileti kimliğiyle) günlükte.
*/
async function kopyayiGonder(
  eposta: string,
  dil: Dil,
  kayit: { onaylandi: string; surum: string; ozet: string; ip: string | null; cihaz: string | null; odemeReferansi: string | null },
): Promise<boolean> {
  try {
    const sonuc = await sendEmail({
      to: eposta,
      ...sozlesmeOnayEmail(
        {
          ...kullanimSozlesmesi(dil),
          surum: kayit.surum,
          ozet: kayit.ozet,
          zaman: new Date(kayit.onaylandi).toLocaleString(dil === "en" ? "en-GB" : "tr-TR", { timeZone: "Europe/Istanbul" }) + " (Europe/Istanbul)",
          ip: kayit.ip,
          cihaz: kayit.cihaz,
          odemeReferansi: kayit.odemeReferansi,
        },
        dil,
      ),
    });
    if (sonuc.ok) console.info("[sözleşme] kopya e-postası gönderildi", sonuc.id ?? "(kimlik yok)");
    else console.error("[sözleşme] kopya e-postası gönderilemedi", sonuc.reason);
    return sonuc.ok;
  } catch (sorun) {
    console.error("[sözleşme] kopya e-postası gönderilemedi", sorun instanceof Error ? sorun.message : sorun);
    return false;
  }
}

/*
  Ayarlar → Kullanım Sözleşmesi → "Kopyayı e-postama gönder". Kayıt
  kullanıcının KENDİ satırından okunur (RLS); e-posta yalnızca hesabın
  kendi adresine gider, başka adres girilemez. Kopya yalnızca YÜRÜRLÜKTEKİ
  sürümün onayı için gönderilir: metnin eski sürümü kodda tutulmuyor ve
  eski onaya bugünün metnini eklemek yanlış belge olurdu.
*/
export async function sozlesmeKopyasiniGonder(): Promise<{ ok: true } | { error: string }> {
  const t = await ceviri();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: await oturumYokMesaji() };
  if (!user.email) return { error: t({ tr: "Hesabınızda e-posta adresi yok.", en: "Your account has no email address." }) };

  const { data: kayit, error } = await supabase
    .from("sozlesme_onaylari")
    .select("onaylandi, surum, dil, metin_ozeti, ip, kullanici_araci, odeme_referansi")
    .eq("user_id", user.id)
    .eq("surum", SOZLESME_SURUMU)
    .order("onaylandi", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: t({ tr: "Onay kaydınız okunamadı; birazdan yeniden deneyin.", en: "Your approval record could not be read; try again shortly." }) };
  if (!kayit) return { error: t({ tr: "Yürürlükteki sözleşme için onay kaydınız yok.", en: "You have no approval record for the current agreement." }) };

  const dil: Dil = dilMi(kayit.dil) ? kayit.dil : "tr";
  const gitti = await kopyayiGonder(user.email, dil, {
    onaylandi: kayit.onaylandi as string,
    surum: kayit.surum as string,
    ozet: kayit.metin_ozeti as string,
    ip: kayit.ip as string | null,
    cihaz: kayit.kullanici_araci as string | null,
    odemeReferansi: kayit.odeme_referansi as string | null,
  });
  return gitti
    ? { ok: true }
    : { error: t({ tr: "E-posta şu anda gönderilemedi; birazdan yeniden deneyin.", en: "The email could not be sent right now; try again shortly." }) };
}
