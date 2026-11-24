"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { oturumYokMesaji, getAuthContext, type ActionResult } from "@/lib/auth-guards";
import { ceviri, aktifDil } from "@/lib/dil-sunucu";
import { getAccessState } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import { ADMIN_ROLES, ROLE_LABELS, type UserRole } from "@/lib/project-labels";
import { adlarGecerliMi, formAdlari, tamAdiKur } from "@/lib/profil-adi";
import { telefonGecerliMi, telefonuAyir, telefonuBirlestir } from "@/lib/telefon";
import { sozlesmeOnaylarim } from "@/lib/sozlesme/onay-durumu";
import { SOZLESME_SURUMU } from "@/lib/sozlesme/kullanim-sozlesmesi";
import { konumYazisi } from "@/lib/sozlesme/konum";
import { krediOzeti, type KrediSatiri } from "@/lib/ai/kredi-ozeti";
import { aiKurulumu, aiKurulumSorunu } from "@/lib/ai/saglayici";
import { personelRolu } from "@/lib/kisisel-calismalar";
import { tarihler } from "@/lib/dil-sunucu";

/*
  AYARLAR PENCERESİNİN VERİSİ VE YAZMA YOLLARI (24.11.2026).

  Ayarlar artık uygulamanın her yerinden açılan bir pencere. Pencere
  istemcide çiziliyor, bu yüzden içerik JSX olarak değil VERİ olarak
  geliyor: aynı veriyi /dashboard/settings sayfası da okuyup aynı bileşene
  veriyor, böylece iki yerde iki ayrı ayar ekranı oluşmuyor.

  Veri pencere AÇILINCA okunuyor; panelin her sayfasında peşinen okunsaydı
  kredi ve abonelik sorguları Ayarlar'a hiç bakmayan kullanıcıya da
  maliyet çıkarırdı.
*/

export type AyarlarVerisi = {
  eposta: string;
  /** Supabase'de onay bekleyen e-posta değişikliği; yoksa null. */
  bekleyenEposta: string | null;
  ad: string;
  soyad: string;
  /** Ad/soyad full_name'den TAHMİN edildi ve bölünüşü belirsiz. */
  adBolunusuBelirsiz: boolean;
  telefonUlkeKodu: string;
  telefonYerel: string;
  rolEtiketi: string;
  kurumAdi: string | null;
  abonelik: {
    tur: "organization" | "individual" | "staff";
    durum: string;
    denemeBitis: string | null;
    donemBitis: string | null;
    kurumAdi: string | null;
    /** Planı değiştirebilir mi? Sunucuda da aynı kural uygulanıyor. */
    planDegistirebilir: boolean;
  };
  icEkip: boolean;
  /** Onay kayıtları: tarihler sunucuda biçimlenmiş gelir (istemcide yerel ayar yok). */
  sozlesme: {
    okunamadi: boolean;
    sonOnay: { tarih: string; surum: string } | null;
    guncelSurumOnaylandi: boolean;
    kayitlar: {
      id: string;
      tarih: string;
      olay: string;
      surum: string;
      dil: string;
      ip: string | null;
      konum: string | null;
      cihaz: string | null;
      odeme: string | null;
      ozet: string;
    }[];
  };
  /** Asistan kredisi; okunamadıysa null ve satır hiç çizilmiyor. */
  kredi: { aylikKalan: number; aylikLimit: number; ekBakiye: number; toplam: number; oran: number; tukendi: boolean; bireysel: boolean } | null;
  /** Yalnızca iç ekip, personel görünümünde: etkin asistan sunucusu. ANAHTAR YOK. */
  asistanSunucusu: { sunucu: string; model: string; durum: string } | null;
};

/** Planı yalnızca kendi aboneliğini ödeyen bireysel kullanıcı değiştirir. */
function planDegistirmeYetkisi(tur: string, rol: UserRole | null): boolean {
  if (tur !== "individual") return false;
  /* İç ekip bireysel yola düşse de plan satın almıyor. */
  return !(rol !== null && ADMIN_ROLES.includes(rol));
}

/** Ayarlar penceresinin ve /dashboard/settings sayfasının ortak verisi. */
export async function ayarlariOku(): Promise<{ veri: AyarlarVerisi } | { error: string }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  const dil = await aktifDil();

  /*
    Bekleyen e-posta değişikliği getUser()'ın kendi alanlarından
    (new_email, email_change_sent_at). Ayrı bir tablo tutulmuyor: tek
    kaynak kimlik sağlayıcısı, yoksa iki yer birbirinden sapar.
  */
  const { data: oturum } = await ctx.supabase.auth.getUser();
  const bekleyenEposta = oturum.user?.new_email?.trim() || null;

  const { data: profil } = await ctx.supabase
    .from("profiles")
    .select("full_name, ad, soyad, telefon")
    .eq("id", ctx.user.id)
    .maybeSingle();

  let kurumAdi: string | null = null;
  if (ctx.organizationId) {
    const { data: kurum } = await ctx.supabase
      .from("organizations")
      .select("name")
      .eq("id", ctx.organizationId)
      .maybeSingle();
    kurumAdi = kurum?.name ?? null;
  }

  const access = await getAccessState(await getCurrentProfile());
  const adlar = formAdlari(profil ?? {});
  const telefon = telefonuAyir(profil?.telefon ?? null);
  const icEkip = ctx.role !== null && ADMIN_ROLES.includes(ctx.role);

  const [onaylar, { tarihSaat }] = await Promise.all([sozlesmeOnaylarim(ctx.user.id), tarihler()]);
  const sozlesme = {
    okunamadi: onaylar.okunamadi,
    sonOnay: onaylar.satirlar.length
      ? { tarih: tarihSaat(onaylar.satirlar[0].onaylandi), surum: onaylar.satirlar[0].surum }
      : null,
    guncelSurumOnaylandi: onaylar.satirlar.some((o) => o.surum === SOZLESME_SURUMU),
    kayitlar: onaylar.satirlar.map((o) => ({
      id: o.id,
      tarih: tarihSaat(o.onaylandi),
      olay: o.olay,
      surum: o.surum,
      dil: o.dil.toUpperCase(),
      ip: o.ip ?? null,
      konum:
        konumYazisi({ ulke: o.ulke ?? null, bolge: o.bolge ?? null, sehir: o.sehir ?? null, enlem: o.enlem ?? null, boylam: o.boylam ?? null }) || null,
      cihaz: o.kullanici_araci ?? null,
      odeme: o.odeme_referansi ?? null,
      ozet: o.metin_ozeti,
    })),
  };

  /* ai_kredi_durumum() okunamazsa satır HİÇ çizilmiyor: "0 kredi" yazmak,
     hakkı olmayanla ölçümü kopmuş olanı aynı göstermek olurdu. */
  const { data: krediSatiri, error: krediHatasi } = await ctx.supabase.rpc("ai_kredi_durumum").maybeSingle();
  if (krediHatasi) console.error("[ayarlar] kredi durumu okunamadı:", krediHatasi.message);
  const ozet = krediOzeti((krediSatiri as KrediSatiri | null) ?? null);
  const kredi = ozet.goster
    ? {
        aylikKalan: ozet.aylikKalan,
        aylikLimit: ozet.aylikLimit,
        ekBakiye: ozet.ekBakiye,
        toplam: ozet.toplam,
        oran: ozet.oran,
        tukendi: ozet.tukendi,
        bireysel: Boolean((krediSatiri as KrediSatiri | null)?.bireysel),
      }
    : null;

  /* Sağlayıcının ADI ürün arayüzünde geçmiyor; iç ekibe sunucu ve model. */
  const kurulum = icEkip && personelRolu(ctx.role) ? aiKurulumu() : null;
  const asistanSunucusu = kurulum
    ? {
        sunucu: (() => { try { return new URL(kurulum.tabanUrl).host; } catch { return kurulum.tabanUrl; } })(),
        model: kurulum.model,
        durum: aiKurulumSorunu(dil) ?? t({ tr: "asistan açık", en: "assistant enabled" }),
      }
    : null;

  return {
    veri: {
      eposta: ctx.user.email ?? "",
      bekleyenEposta,
      ad: adlar.ad,
      soyad: adlar.soyad,
      adBolunusuBelirsiz: adlar.belirsiz,
      telefonUlkeKodu: telefon.ulkeKodu,
      telefonYerel: telefon.yerel,
      rolEtiketi: ctx.role ? t(ROLE_LABELS[ctx.role]) : t({ tr: "Üye", en: "Member" }),
      kurumAdi,
      abonelik: {
        tur: access.kind,
        durum: access.status,
        denemeBitis: access.trialEndsAt,
        donemBitis: access.periodEnd,
        kurumAdi: access.organizationName ?? kurumAdi,
        planDegistirebilir: planDegistirmeYetkisi(access.kind, ctx.role),
      },
      icEkip,
      sozlesme,
      kredi,
      asistanSunucusu,
    },
  };
}

/*
  PROFİL KAYDI. Ad/soyad ve telefon AYRI AYRI yazılıyor: yalnızca telefonunu
  giren kullanıcının adı, full_name'den üretilmiş TAHMİNİ bölünüşle kalıcı
  hâle gelmesin. Ad alanlarına dokunulmadıysa `ad`/`soyad` sütunları NULL
  kalır ve full_name kaynak olmayı sürdürür (migration notuna bakın).
*/
export async function profilimiKaydet(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: await oturumYokMesaji() };
  const t = await ceviri();

  const adlariYaz = String(formData.get("adlariYaz") ?? "") === "1";
  const ad = String(formData.get("ad") ?? "").trim();
  const soyad = String(formData.get("soyad") ?? "").trim();
  const telefon = telefonuBirlestir(
    String(formData.get("ulkeKodu") ?? ""),
    String(formData.get("telefon") ?? ""),
  );

  if (adlariYaz && !adlarGecerliMi(ad, soyad)) {
    return { error: t({ tr: "Ad ve soyad 1 ile 80 karakter arasında olmalı; ikisi de gerekli.", en: "First and last name must be 1–80 characters; both are required." }) };
  }
  if (!telefonGecerliMi(telefon)) {
    return { error: t({ tr: "Telefon numarası geçersiz görünüyor. Ülke kodunu seçip numarayı rakamlarla yazın.", en: "That phone number does not look valid. Choose the country code and type the number in digits." }) };
  }

  const guncelleme: Record<string, string | null> = { telefon };
  if (adlariYaz) {
    guncelleme.ad = ad;
    guncelleme.soyad = soyad;
    /* full_name görünen ad olmayı sürdürüyor: gezinme, hesap menüsü ve
       paylaşım onu okuyor, hiçbiri değişmek zorunda kalmıyor. */
    guncelleme.full_name = tamAdiKur(ad, soyad);
  }

  const { data, error } = await supabase.from("profiles").update(guncelleme).eq("id", user.id).select("id");
  if (error || !data?.length) {
    console.error("[ayarlar] profil güncellenemedi:", error?.message);
    return { error: t({ tr: "Profil güncellenemedi.", en: "The profile could not be updated." }) };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

/*
  E-POSTA DEĞİŞİKLİĞİ AYRI BİR İŞLEM. Profil kaydıyla birlikte
  gönderilseydi, adını düzelten kullanıcı farkında olmadan bir doğrulama
  postası tetikleyebilirdi. Kimlik sağlayıcısının kendi akışı kullanılıyor:
  updateUser({ email }) yeni adrese bir bağlantı yolluyor, bağlantı
  /auth/confirm üzerinden /auth/dogrula'daki onay düğmesine gidiyor
  (type=email_change zaten tanınan türler arasında). Adres, kullanıcı o
  düğmeye basana kadar DEĞİŞMİYOR; ekran o sürede eski adresi gösterip
  yanında "Doğrulama bekleniyor" diyor.
*/
export async function epostaDegisikligiIste(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: await oturumYokMesaji() };
  const t = await ceviri();

  const yeni = String(formData.get("yeniEposta") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(yeni) || yeni.length > 254) {
    return { error: t({ tr: "Geçerli bir e-posta adresi yazın.", en: "Enter a valid email address." }) };
  }
  if (yeni === (user.email ?? "").trim().toLowerCase()) {
    return { error: t({ tr: "Bu zaten mevcut adresiniz.", en: "That is already your current address." }) };
  }

  const kokenHeaders = await import("next/headers").then((m) => m.headers());
  const koken = kokenHeaders.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { error } = await supabase.auth.updateUser(
    { email: yeni },
    { emailRedirectTo: koken ? `${koken}/auth/confirm?next=/dashboard/settings` : undefined },
  );
  if (error) {
    console.error("[ayarlar] e-posta değişikliği istenemedi:", error.message);
    /*
      Adresin başkasına ait olup olmadığı SÖYLENMİYOR: "bu adres kayıtlı"
      demek, kayıtlı adresleri sorgulanabilir yapardı (kayıt ve şifre
      sıfırlama akışlarında da aynı kural).
    */
    return { error: t({ tr: "Doğrulama bağlantısı gönderilemedi. Birazdan tekrar deneyin.", en: "The verification link could not be sent. Try again shortly." }) };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
