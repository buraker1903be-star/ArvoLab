"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { ADMIN_ROLES } from "@/lib/project-labels";
import type { Taraf, YazismaMesaji } from "@/lib/destek-yazisma";

/*
  Destek yazışması (migration 20261027074716). Kim yazabilir ve okuyabilir
  RLS'te; burada yalnızca anlaşılır hata mesajı ve "çözüldü" işareti var.

  Abonelik kapısı YOK (lib/access.ts): destek yolu engellenen kullanıcıya
  da açık kalmalı, kilidini açmak için yardım isteyebilmeli.
*/

const SAYFA = "/dashboard/expert-requests";

type MesajSatiri = {
  id: string;
  uzman_talebi_id: string | null;
  destek_talebi_id: string | null;
  taraf: Taraf;
  yazan_adi: string | null;
  metin: string;
  created_at: string;
};

export async function destekMesajiGonder(tur: "uzman" | "destek", talepId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };

  const metin = String(formData.get("metin") ?? "").trim();
  if (!metin) return { error: "Boş mesaj gönderilemez." };
  if (metin.length > 4000) return { error: "Mesaj en fazla 4000 karakter olabilir." };

  const { error } = await ctx.supabase
    .from("destek_mesajlari")
    .insert(tur === "uzman" ? { uzman_talebi_id: talepId, metin } : { destek_talebi_id: talepId, metin });
  if (error) {
    console.error("[destek] mesaj yazılamadı", error.message);
    // RLS reddi: talep kapanmış ya da kişi taraf değil. Ekran bu durumda formu zaten göstermiyor.
    return { error: "Mesaj gönderilemedi. Talep kapanmış olabilir; sayfayı yenileyin." };
  }

  /*
    İç ekip yanıtla birlikte talebi "çözüldü" işaretleyebiliyor (eski
    "Yanıtla ve çözüldü işaretle" düğmesinin karşılığı). Mesaj yazıldı;
    işaret düşerse yalnızca uyarı verilir, mesaj geri alınmaz.
  */
  if (tur === "destek" && formData.get("coz") === "1" && ctx.role && ADMIN_ROLES.includes(ctx.role)) {
    const { error: durumHatasi } = await ctx.supabase
      .from("app_support_requests")
      .update({ status: "resolved", updated_at: new Date().toISOString() })
      .eq("id", talepId);
    if (durumHatasi) {
      console.error("[destek] çözüldü işaretlenemedi", durumHatasi.message);
      revalidatePath(SAYFA);
      return { success: true, warning: "Mesaj gönderildi ama talep çözüldü olarak işaretlenemedi." };
    }
  }

  revalidatePath(SAYFA);
  return { success: true };
}

/*
  Verilen taleplerin yazışmaları, talep kimliğine göre. RLS kişinin
  göremediği yazışmayı zaten döndürmüyor (ör. üstlenmemiş uzman).
  Okunamazsa null: ekran "yazışma yok" demesin, okunamadığını söylesin.
*/
export async function yazismalariOku(
  uzmanTalepleri: string[],
  destekTalepleri: string[],
): Promise<Map<string, YazismaMesaji[]> | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const sonuc = new Map<string, YazismaMesaji[]>();
  const sutunlar = "id, uzman_talebi_id, destek_talebi_id, taraf, yazan_adi, metin, created_at";

  const [uzman, destek] = await Promise.all([
    uzmanTalepleri.length
      ? ctx.supabase.from("destek_mesajlari").select(sutunlar).in("uzman_talebi_id", uzmanTalepleri).order("created_at")
      : Promise.resolve({ data: [] as MesajSatiri[], error: null }),
    destekTalepleri.length
      ? ctx.supabase.from("destek_mesajlari").select(sutunlar).in("destek_talebi_id", destekTalepleri).order("created_at")
      : Promise.resolve({ data: [] as MesajSatiri[], error: null }),
  ]);
  if (uzman.error || destek.error) {
    console.error("[destek] yazışmalar okunamadı", uzman.error?.message ?? destek.error?.message);
    return null;
  }

  for (const s of [...(uzman.data ?? []), ...(destek.data ?? [])] as MesajSatiri[]) {
    const anahtar = (s.uzman_talebi_id ?? s.destek_talebi_id)!;
    const liste = sonuc.get(anahtar) ?? [];
    liste.push({ id: s.id, taraf: s.taraf, yazanAdi: s.yazan_adi, metin: s.metin, zaman: s.created_at });
    sonuc.set(anahtar, liste);
  }
  return sonuc;
}
