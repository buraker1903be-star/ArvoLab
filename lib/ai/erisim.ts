/*
  Asistanın ortak kapısı: oturum, abonelik, kurulum ve hız sınırı.

  Bilerek "use server" DEĞİL (AGENTS.md): böyle bir dosyadaki her export
  dışarıdan çağrılabilir bir uç noktaya dönüşür, yardımcılar orada durmaz.

  Hız sınırı yetenek başına değil KULLANICI başına: maliyeti yeteneğin adı
  değil, model çağrısının kendisi üretiyor. Ayrı sayaçlar tutsaydık aynı
  kullanıcı her yetenekten ayrı hak kazanıp toplamda sınırın katını
  harcardı. Sayaç kapıdan ayrı (asistanHakkiVar): kayıtlı cevap
  gösterilirken model çağrılmadığı için hak da yanmamalı.
*/

import type { Dil } from "@/lib/dil";
import { createClient } from "@/lib/supabase/server";
import { adminIstemcisiVarsa } from "@/lib/supabase/admin";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { aiKurulumSorunu } from "./saglayici";
import { krediKarari, type KrediKarari } from "./kredi-karari";
import { SAATLIK_HAK } from "./sinirlar";

export { SAATLIK_HAK };

export type KapiSonucu =
  | { ok: false; hata: string }
  /** uyari doluysa çalışma sürer, kullanıcıya not gösterilir. */
  | { ok: true; kullaniciId: string; uyari: string | null };

/**
 * Kurumun bu ayki AI kredisi. Karar saf modülde (kredi-karari.ts).
 *
 * Okunamazsa engel YOK: geçici bir veritabanı arızası bütün kullanıcıları
 * asistandan mahrum bırakmamalı — hız sınırındaki kuralın aynısı.
 */
async function krediDurumu(dil: Dil): Promise<KrediKarari> {
  const bos: KrediKarari = { engel: null, uyari: null, oran: null, kullanilanKredi: 0 };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ai_kredi_durumum").maybeSingle();
  if (error || !data) {
    if (error) console.error("[ai] kredi durumu okunamadı:", error.message);
    return bos;
  }
  const satir = data as {
    kullanilan_karakter: number; limit_kredi: number | null;
    aylik_kalan: number; ek_bakiye: number; bildirildi: boolean; ic_ekip: boolean; bireysel?: boolean | null;
  };
  return krediKarari({
    kullanilanKarakter: Number(satir.kullanilan_karakter ?? 0),
    limitKredi: satir.limit_kredi === null ? null : Number(satir.limit_kredi),
    aylikKalan: Number(satir.aylik_kalan ?? 0),
    ekBakiye: Number(satir.ek_bakiye ?? 0),
    bildirildi: Boolean(satir.bildirildi),
    icEkip: Boolean(satir.ic_ekip),
    bireysel: Boolean(satir.bireysel),
  }, dil);
}

/**
 * Saatlik hak ayrı tutuluyor: kayıtlı bir cevap gösterilirken model
 * çağrılmıyor, dolayısıyla hak da yanmamalı. Aksi halde kullanıcı kendi
 * geçmişine bakarken hakkını tüketirdi.
 */
export async function asistanHakkiVar(kullaniciId: string, dil: Dil = "tr"): Promise<string | null> {
  // Sayaç kurulamıyorsa kullanıcı engellenmiyor (bkz. adminIstemcisiVarsa).
  const admin = adminIstemcisiVarsa();
  if (!admin) return null;
  const { data: izin, error } = await admin.rpc("rate_limit_hit", {
    p_key: `ai-asistan:${kullaniciId}`,
    p_limit: SAATLIK_HAK,
    p_window: "1 hour",
  });
  // Sayaç okunamadıysa (geçici arıza) akış durmaz; kapı sert kapanmamalı.
  if (error) {
    console.error("[ai] hız sınırı okunamadı:", error.message);
    return null;
  }
  if (izin !== false) return null;
  return dil === "en"
    ? `You've reached your hourly assistant limit (${SAATLIK_HAK}). Try again a little later.`
    : `Saatlik asistan hakkınız doldu (${SAATLIK_HAK}). Bir süre sonra tekrar deneyin.`;
}

/**
 * Oturum, abonelik ve kurulum. Sayaç burada işlemez (bkz. asistanHakkiVar).
 * `dil` bu dosyanın, kurulumun ve kredi kapısının mesajlarına uygulanır;
 * abonelik mesajı lib/access.ts'ten geldiği gibi geçer.
 */
export async function asistanKapisi(dil: Dil = "tr"): Promise<KapiSonucu> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, hata: dil === "en" ? "No session found." : "Oturum bulunamadı." };
  if (await isSubscriptionBlocked()) return { ok: false, hata: (await abonelikKapaliMesaji()) };
  /* Sebep kurulumdan geliyor: bozuk adresle "anahtar tanımlayın" demek
     yöneticiyi yanlış değişkene bakmaya gönderiyordu. */
  const kurulumSorunu = aiKurulumSorunu(dil);
  if (kurulumSorunu) return { ok: false, hata: kurulumSorunu };

  /*
    Kredi kapısı EN SONDA: önce oturum, abonelik ve kurulum. Kredi
    mesajı ("hakkınız doldu") kuruluma hiç bakmamış bir kullanıcıya
    gösterilirse yanlış yere bakmasına yol açar.
  */
  const kredi = await krediDurumu(dil);
  if (kredi.engel) return { ok: false, hata: kredi.engel };

  return { ok: true, kullaniciId: user.id, uyari: kredi.uyari };
}
