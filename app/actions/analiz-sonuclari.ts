"use server";

import { revalidatePath } from "next/cache";
import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { getAuthContext, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { analizTuruMu } from "@/lib/analiz-turleri";

const PAGE_PATH = "/dashboard/analysis";
const EN_UZUN_BASLIK = 300;
const EN_UZUN_METIN = 20000;

export interface AnalizSonucu {
  id: string;
  project_id: string | null;
  analiz_turu: string;
  baslik: string;
  apa_metni: string;
  created_at: string;
}

/*
  Analiz merkezi bugüne kadar hiçbir şey biriktirmiyordu: hesap tarayıcıda
  yapılıyor, sekme kapanınca sonuç kayboluyordu.

  HAM VERİ KAYDEDİLMİYOR. Yüklenen dosya sunucuya hiç gitmiyor; buraya
  yalnızca kullanıcının ekranda gördüğü APA metni ve hangi testin hangi
  değişkenlerle çalıştırıldığı yazılıyor. Kaydetme de otomatik değil:
  katılımcı verisiyle çalışan bir araştırmacının sonucu sunucuya taşıyıp
  taşımayacağına kendisi karar vermeli.
*/
export async function analizSonucuKaydet(girdi: {
  analizTuru: string;
  baslik: string;
  apaMetni: string;
  projectId: string | null;
}): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };

  const baslik = girdi.baslik.trim();
  const apaMetni = girdi.apaMetni.trim();
  if (!baslik || !apaMetni) return { error: "Kaydedilecek bir sonuç yok." };
  if (!analizTuruMu(girdi.analizTuru)) return { error: "Tanınmayan analiz türü." };
  // Veritabanındaki check kısıtı ham hata mesajı verirdi; sınır burada anlaşılır söyleniyor.
  if (baslik.length > EN_UZUN_BASLIK) return { error: "Başlık fazla uzun." };
  if (apaMetni.length > EN_UZUN_METIN) {
    return { error: "Sonuç metni kaydedilemeyecek kadar uzun; daha dar bir analiz seçin." };
  }

  const { error } = await ctx.supabase.from("analiz_sonuclari").insert({
    owner_id: ctx.user.id,
    project_id: girdi.projectId || null,
    analiz_turu: girdi.analizTuru,
    baslik,
    apa_metni: apaMetni,
  });

  if (error) {
    console.error(error);
    if (error.code === "42501") return { error: SUBSCRIPTION_BLOCKED_MESSAGE };
    return { error: "Sonuç kaydedilemedi; metni kopyalayıp saklayabilirsiniz." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function getAnalizSonuclari(): Promise<ListeSonucu<AnalizSonucu>> {
  const ctx = await getAuthContext();
  if (!ctx) return listeBasarili([]);

  const { data, error } = await ctx.supabase
    .from("analiz_sonuclari")
    .select("id, project_id, analiz_turu, baslik, apa_metni, created_at")
    .eq("owner_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

/*
  Kayıt düzenlenemiyor (tabloda UPDATE yok): yapılmış bir hesabın tutanağı,
  sonradan değiştirilebilseydi iddiaya dönerdi. Yanlışsa silinir ve analiz
  yeniden çalıştırılır — silme de bu yüzden abonelik kapısının dışında.
*/
export async function analizSonucuSil(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const { data, error } = await ctx.supabase
    .from("analiz_sonuclari")
    .delete()
    .eq("id", id)
    .eq("owner_id", ctx.user.id)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kayıt bulunamadı ya da size ait değil." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}
