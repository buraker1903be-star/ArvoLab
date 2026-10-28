"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { taslakTakvim, tasGirdisi, type TakvimTasi } from "@/lib/tez-takvimi";
import { trGunAnahtari } from "@/lib/tr-time";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";

/*
  TEZ TAKVİMİ VE TESLİM TARİHİ (28.10.2026).

  Takvim calisma_takvimi'nde (migration 20261028035441). Yetki RLS'te
  (okuma çalışmayı görebilen, yazma can_write_project); buradaki
  denetim kullanıcıya anlaşılır mesaj için.

  Abonelik kapısı yalnızca YENİ taş eklemede (tasEkle, taslakTakvimOlustur).
  Tamamlamak, tarih değiştirmek, silmek ve teslim tarihini girmek mevcut
  kaydın güncellenmesi: engellenen kullanıcı kendi planını yönetebilmeli
  (lib/access.ts).
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const yenile = () => {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/editor");
};

/** Çalışmanın takvimi; okunamazsa null (boş liste "plan yok" demek olurdu). */
export async function takvimiGetir(projectId: string): Promise<TakvimTasi[] | null> {
  if (!UUID.test(projectId)) return [];
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const { data, error } = await ctx.supabase
    .from("calisma_takvimi")
    .select("id, baslik, hedef_tarih, tamamlandi")
    .eq("project_id", projectId)
    .order("hedef_tarih", { ascending: true });
  if (error) {
    console.error("[takvim] okunamadı:", error.message);
    return null;
  }
  return data ?? [];
}

export async function tasEkle(projectId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  if (!UUID.test(projectId)) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };
  const girdi = tasGirdisi(formData.get("baslik"), formData.get("hedefTarih"), await aktifDil());
  if ("hata" in girdi) return { error: girdi.hata };
  const { error } = await ctx.supabase.from("calisma_takvimi").insert({ project_id: projectId, olusturan: ctx.user.id, ...girdi });
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) return { error: t({ tr: "Bu adla açık bir kilometre taşı zaten var.", en: "An open milestone with this name already exists." }) };
    if (/row-level security/i.test(error.message)) return { error: t({ tr: "Bu çalışmaya yazma yetkiniz yok.", en: "You don't have write permission for this work." }) };
    console.error("[takvim] eklenemedi:", error.message);
    return { error: t({ tr: "Kilometre taşı eklenemedi.", en: "The milestone could not be added." }) };
  }
  yenile();
  return { success: true };
}

export async function tasGuncelle(tasId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  if (!UUID.test(tasId)) return { error: t({ tr: "Kilometre taşı bulunamadı.", en: "Milestone not found." }) };
  const girdi = tasGirdisi(formData.get("baslik"), formData.get("hedefTarih"), await aktifDil());
  if ("hata" in girdi) return { error: girdi.hata };
  const { data, error } = await ctx.supabase.from("calisma_takvimi").update(girdi).eq("id", tasId).select("id");
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) return { error: t({ tr: "Bu adla açık bir kilometre taşı zaten var.", en: "An open milestone with this name already exists." }) };
    console.error("[takvim] güncellenemedi:", error.message);
    return { error: t({ tr: "Kilometre taşı güncellenemedi.", en: "The milestone could not be updated." }) };
  }
  if (!data?.length) return { error: t({ tr: "Kilometre taşı bulunamadı ya da yetkiniz yok.", en: "Milestone not found or you don't have permission." }) };
  yenile();
  return { success: true };
}

export async function tasTamamla(tasId: string, tamam: boolean): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  if (!UUID.test(tasId)) return { error: t({ tr: "Kilometre taşı bulunamadı.", en: "Milestone not found." }) };
  const { data, error } = await ctx.supabase
    .from("calisma_takvimi")
    .update({ tamamlandi: tamam ? new Date().toISOString() : null })
    .eq("id", tasId)
    .select("id");
  if (error) {
    /* Geri alınan taşla aynı adlı açık bir taş varsa benzersizlik düşer. */
    if (/duplicate key|unique/i.test(error.message)) return { error: t({ tr: "Aynı adla açık bir kilometre taşı var; önce onu düzenleyin.", en: "There is an open milestone with the same name; edit that one first." }) };
    console.error("[takvim] tamamlanamadı:", error.message);
    return { error: t({ tr: "Kilometre taşı güncellenemedi.", en: "The milestone could not be updated." }) };
  }
  if (!data?.length) return { error: t({ tr: "Kilometre taşı bulunamadı ya da yetkiniz yok.", en: "Milestone not found or you don't have permission." }) };
  yenile();
  return { success: true };
}

export async function tasSil(tasId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  if (!UUID.test(tasId)) return { error: t({ tr: "Kilometre taşı bulunamadı.", en: "Milestone not found." }) };
  const { data, error } = await ctx.supabase.from("calisma_takvimi").delete().eq("id", tasId).select("id");
  if (error) {
    console.error("[takvim] silinemedi:", error.message);
    return { error: t({ tr: "Kilometre taşı silinemedi.", en: "The milestone could not be deleted." }) };
  }
  if (!data?.length) return { error: t({ tr: "Kilometre taşı bulunamadı ya da yetkiniz yok.", en: "Milestone not found or you don't have permission." }) };
  yenile();
  return { success: true };
}

/**
 * Teslim tarihinden taslak takvim. Aynı adlı taş (açık ya da tamamlanmış)
 * varsa atlanır; takvimi silip yeniden oluşturmak gerekmesin.
 */
export async function taslakTakvimOlustur(projectId: string): Promise<{ error?: string; eklenen?: number }> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  if (!UUID.test(projectId)) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };
  const { data: proje, error } = await ctx.supabase
    .from("academic_projects")
    .select("project_type, due_date")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !proje) return { error: t({ tr: "Çalışma okunamadı.", en: "The work could not be read." }) };
  if (!proje.due_date) return { error: t({ tr: "Önce teslim tarihini girin; takvim ona göre kurulur.", en: "Enter the due date first; the schedule is built from it." }) };
  const taslak = taslakTakvim(proje.project_type, trGunAnahtari(), proje.due_date, await aktifDil());
  if (!taslak.length) return { error: t({ tr: "Teslime 14 günden az kaldığı için taslak takvim oluşturulmadı; taşları elle ekleyin.", en: "No draft schedule was created because fewer than 14 days remain until the due date; add milestones manually." }) };
  const mevcut = await takvimiGetir(projectId);
  if (mevcut === null) return { error: t({ tr: "Mevcut takviminiz okunamadı; tekrarları ayıklayamadığımız için ekleme yapılmadı.", en: "Your current schedule could not be read; nothing was added because duplicates could not be filtered out." }) };
  /*
    Tamamlanmış taşlar da sayılır. Eskiden yalnızca açıklara bakılıyordu ve
    düğme açık taş kalmayınca yeniden çıktığı için, bütün adımları bitiren
    öğrenci ona bastığında planın tamamı yeniden (ve gecikmiş görünerek)
    ekleniyordu.
  */
  const mevcutAdlar = new Set(mevcut.map((tas) => tas.baslik.trim().toLocaleLowerCase("tr-TR")));
  const yeni = taslak.filter((tas) => !mevcutAdlar.has(tas.baslik.toLocaleLowerCase("tr-TR")));
  if (!yeni.length) return { eklenen: 0 };
  const { error: ekleme } = await ctx.supabase
    .from("calisma_takvimi")
    .insert(yeni.map((tas) => ({ ...tas, project_id: projectId, olusturan: ctx.user.id })));
  if (ekleme) {
    if (/row-level security/i.test(ekleme.message)) return { error: t({ tr: "Bu çalışmaya yazma yetkiniz yok.", en: "You don't have write permission for this work." }) };
    console.error("[takvim] taslak eklenemedi:", ekleme.message);
    return { error: t({ tr: "Taslak takvim eklenemedi.", en: "The draft schedule could not be added." }) };
  }
  yenile();
  return { eklenen: yeni.length };
}

/*
  TESLİM TARİHİ yerinde (ana sayfa ve Çalışmalarım kartı). Eskiden ana
  sayfa "Teslim tarihi girilmedi — çalışma ayarlarından ekleyin" diyor ve
  öğrenciyi ayrı bir forma gönderiyordu; öğrencilerin çoğu girmiyordu ve
  teslime kalan gün, tempo ve takvim hiç hesaplanmıyordu.
*/
export async function teslimTarihiKaydet(projectId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  if (!UUID.test(projectId)) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };
  const tarih = String(formData.get("teslimTarihi") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { error: t({ tr: "Teslim tarihini seçin.", en: "Choose the due date." }) };
  if (tarih < trGunAnahtari()) return { error: t({ tr: "Teslim tarihi bugünden önce olamaz.", en: "The due date cannot be before today." }) };
  const { data, error } = await ctx.supabase
    .from("academic_projects")
    .update({ due_date: tarih, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select("id");
  if (error) {
    console.error("[teslim tarihi] kaydedilemedi:", error.message);
    return { error: t({ tr: "Teslim tarihi kaydedilemedi.", en: "The due date could not be saved." }) };
  }
  if (!data?.length) return { error: t({ tr: "Çalışma bulunamadı ya da düzenleme yetkiniz yok.", en: "Work not found or you don't have permission to edit it." }) };
  yenile();
  return { success: true };
}
