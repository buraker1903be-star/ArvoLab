"use server";

import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { ceviri } from "@/lib/dil-sunucu";
import { dilMi, type Dil } from "@/lib/dil";
import { oturumYokMesaji } from "@/lib/auth-guards";
import { SOZLESME_SURUMU } from "@/lib/sozlesme/kullanim-sozlesmesi";
import { konumYazisi } from "@/lib/sozlesme/konum";
import { onayKaydiYaz, onayKopyasiGonder } from "@/lib/sozlesme/onay-yaz";

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
  const yazim = await onayKaydiYaz(admin, h, {
    userId: user.id,
    eposta: user.email ?? null,
    adSoyad: profil?.full_name ?? null,
    organizationId: profil?.organization_id ?? null,
    dil,
    olay,
    odemeReferansi: olay === "odeme_sonrasi" ? await odemeReferansi() : null,
  });
  if (!yazim.ok) {
    return { error: t({ tr: "Onay kaydedilemedi; lütfen yeniden deneyin.", en: "Your approval could not be saved; please try again." }) };
  }

  /* Kopya e-postası yanıtı bekletmez ve gönderilemezse akış düşmez (AGENTS.md). */
  if (user.email) {
    const eposta = user.email;
    after(() => onayKopyasiGonder(eposta, dil, yazim.kopya));
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true };
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
    // "*": konum sütunları (20261029163058) henüz uygulanmamış bir veritabanında da okunabilsin; yoksa konum boş kalır.
    .select("*")
    .eq("user_id", user.id)
    .eq("surum", SOZLESME_SURUMU)
    .order("onaylandi", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { error: t({ tr: "Onay kaydınız okunamadı; birazdan yeniden deneyin.", en: "Your approval record could not be read; try again shortly." }) };
  if (!kayit) return { error: t({ tr: "Yürürlükteki sözleşme için onay kaydınız yok.", en: "You have no approval record for the current agreement." }) };

  const dil: Dil = dilMi(kayit.dil) ? kayit.dil : "tr";
  const gitti = await onayKopyasiGonder(user.email, dil, {
    onaylandi: kayit.onaylandi as string,
    surum: kayit.surum as string,
    ozet: kayit.metin_ozeti as string,
    ip: kayit.ip as string | null,
    konum: konumYazisi(kayit),
    cihaz: kayit.kullanici_araci as string | null,
    odemeReferansi: kayit.odeme_referansi as string | null,
  });
  return gitti
    ? { ok: true }
    : { error: t({ tr: "E-posta şu anda gönderilemedi; birazdan yeniden deneyin.", en: "The email could not be sent right now; try again shortly." }) };
}
