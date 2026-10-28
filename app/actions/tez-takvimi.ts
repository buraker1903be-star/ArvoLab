"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { taslakTakvim, tasGirdisi, type TakvimTasi } from "@/lib/tez-takvimi";
import { trGunAnahtari } from "@/lib/tr-time";

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
  if (!ctx) return SESSION_MISSING;
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };
  if (!UUID.test(projectId)) return { error: "Çalışma bulunamadı." };
  const girdi = tasGirdisi(formData.get("baslik"), formData.get("hedefTarih"));
  if ("hata" in girdi) return { error: girdi.hata };
  const { error } = await ctx.supabase.from("calisma_takvimi").insert({ project_id: projectId, olusturan: ctx.user.id, ...girdi });
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) return { error: "Bu adla açık bir kilometre taşı zaten var." };
    if (/row-level security/i.test(error.message)) return { error: "Bu çalışmaya yazma yetkiniz yok." };
    console.error("[takvim] eklenemedi:", error.message);
    return { error: "Kilometre taşı eklenemedi." };
  }
  yenile();
  return { success: true };
}

export async function tasGuncelle(tasId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  if (!UUID.test(tasId)) return { error: "Kilometre taşı bulunamadı." };
  const girdi = tasGirdisi(formData.get("baslik"), formData.get("hedefTarih"));
  if ("hata" in girdi) return { error: girdi.hata };
  const { data, error } = await ctx.supabase.from("calisma_takvimi").update(girdi).eq("id", tasId).select("id");
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) return { error: "Bu adla açık bir kilometre taşı zaten var." };
    console.error("[takvim] güncellenemedi:", error.message);
    return { error: "Kilometre taşı güncellenemedi." };
  }
  if (!data?.length) return { error: "Kilometre taşı bulunamadı ya da yetkiniz yok." };
  yenile();
  return { success: true };
}

export async function tasTamamla(tasId: string, tamam: boolean): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  if (!UUID.test(tasId)) return { error: "Kilometre taşı bulunamadı." };
  const { data, error } = await ctx.supabase
    .from("calisma_takvimi")
    .update({ tamamlandi: tamam ? new Date().toISOString() : null })
    .eq("id", tasId)
    .select("id");
  if (error) {
    /* Geri alınan taşla aynı adlı açık bir taş varsa benzersizlik düşer. */
    if (/duplicate key|unique/i.test(error.message)) return { error: "Aynı adla açık bir kilometre taşı var; önce onu düzenleyin." };
    console.error("[takvim] tamamlanamadı:", error.message);
    return { error: "Kilometre taşı güncellenemedi." };
  }
  if (!data?.length) return { error: "Kilometre taşı bulunamadı ya da yetkiniz yok." };
  yenile();
  return { success: true };
}

export async function tasSil(tasId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  if (!UUID.test(tasId)) return { error: "Kilometre taşı bulunamadı." };
  const { data, error } = await ctx.supabase.from("calisma_takvimi").delete().eq("id", tasId).select("id");
  if (error) {
    console.error("[takvim] silinemedi:", error.message);
    return { error: "Kilometre taşı silinemedi." };
  }
  if (!data?.length) return { error: "Kilometre taşı bulunamadı ya da yetkiniz yok." };
  yenile();
  return { success: true };
}

/**
 * Teslim tarihinden taslak takvim. Aynı adlı taş (açık ya da tamamlanmış)
 * varsa atlanır; takvimi silip yeniden oluşturmak gerekmesin.
 */
export async function taslakTakvimOlustur(projectId: string): Promise<{ error?: string; eklenen?: number }> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };
  if (!UUID.test(projectId)) return { error: "Çalışma bulunamadı." };
  const { data: proje, error } = await ctx.supabase
    .from("academic_projects")
    .select("project_type, due_date")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !proje) return { error: "Çalışma okunamadı." };
  if (!proje.due_date) return { error: "Önce teslim tarihini girin; takvim ona göre kurulur." };
  const taslak = taslakTakvim(proje.project_type, trGunAnahtari(), proje.due_date);
  if (!taslak.length) return { error: "Teslime 14 günden az kaldığı için taslak takvim oluşturulmadı; taşları elle ekleyin." };
  const mevcut = await takvimiGetir(projectId);
  if (mevcut === null) return { error: "Mevcut takviminiz okunamadı; tekrarları ayıklayamadığımız için ekleme yapılmadı." };
  /*
    Tamamlanmış taşlar da sayılır. Eskiden yalnızca açıklara bakılıyordu ve
    düğme açık taş kalmayınca yeniden çıktığı için, bütün adımları bitiren
    öğrenci ona bastığında planın tamamı yeniden (ve gecikmiş görünerek)
    ekleniyordu.
  */
  const mevcutAdlar = new Set(mevcut.map((t) => t.baslik.trim().toLocaleLowerCase("tr-TR")));
  const yeni = taslak.filter((t) => !mevcutAdlar.has(t.baslik.toLocaleLowerCase("tr-TR")));
  if (!yeni.length) return { eklenen: 0 };
  const { error: ekleme } = await ctx.supabase
    .from("calisma_takvimi")
    .insert(yeni.map((t) => ({ ...t, project_id: projectId, olusturan: ctx.user.id })));
  if (ekleme) {
    if (/row-level security/i.test(ekleme.message)) return { error: "Bu çalışmaya yazma yetkiniz yok." };
    console.error("[takvim] taslak eklenemedi:", ekleme.message);
    return { error: "Taslak takvim eklenemedi." };
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
  if (!ctx) return SESSION_MISSING;
  if (!UUID.test(projectId)) return { error: "Çalışma bulunamadı." };
  const tarih = String(formData.get("teslimTarihi") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { error: "Teslim tarihini seçin." };
  if (tarih < trGunAnahtari()) return { error: "Teslim tarihi bugünden önce olamaz." };
  const { data, error } = await ctx.supabase
    .from("academic_projects")
    .update({ due_date: tarih, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select("id");
  if (error) {
    console.error("[teslim tarihi] kaydedilemedi:", error.message);
    return { error: "Teslim tarihi kaydedilemedi." };
  }
  if (!data?.length) return { error: "Çalışma bulunamadı ya da düzenleme yetkiniz yok." };
  yenile();
  return { success: true };
}
