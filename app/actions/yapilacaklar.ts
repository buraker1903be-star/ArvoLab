"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { yapilacakGirdisi, type Yapilacak } from "@/lib/yapilacaklar";

/*
  Çalışmanın yapılacakları (calisma_yapilacaklari, migration
  20261026101921). Kaynakça asistanının bulgusu "Yapılacaklara ekle" ile
  buraya yazılıyor; Çalışmalarım kartı "Yaptım" diyene kadar gösteriyor.

  Yetki RLS'te (can_write_project); buradaki denetim kullanıcıya anlaşılır
  mesaj vermek için.
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const yenile = () => {
  revalidatePath("/dashboard/editor");
  revalidatePath("/dashboard");
};

/** Açık (tamamlanmamış) yapılacaklar; okunamazsa boş liste ve log. */
export async function acikYapilacaklar(projectId: string): Promise<Yapilacak[]> {
  if (!UUID.test(projectId)) return [];
  const ctx = await getAuthContext();
  if (!ctx) return [];
  const { data, error } = await ctx.supabase
    .from("calisma_yapilacaklari")
    .select("id, baslik, aciklama, olusturuldu")
    .eq("project_id", projectId)
    .is("tamamlandi", null)
    /* Sınırsız: liste karttaki sayıyı da veriyor; .limit() ile kesilen
       listeden sayı çıkarmak sessizce eksik sayardı (check:rakamlar). */
    .order("olusturuldu", { ascending: true });
  if (error) {
    console.error("[yapılacaklar] okunamadı:", error.message);
    return [];
  }
  return data ?? [];
}

export async function yapilacaklaraEkle(girdi: {
  projectId: string;
  baslik: string;
  aciklama?: string | null;
  asistanKaydi?: string | null;
}): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  // Yeni içerik yazıyor: kapı burada da (panel kapısı yalnızca ekranı kapatıyor).
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };
  if (!UUID.test(girdi.projectId)) return { error: "Çalışma bulunamadı." };

  const kayit = yapilacakGirdisi(girdi);
  if (!kayit) return { error: "Eklenecek bir başlık yok." };

  const { error } = await ctx.supabase.from("calisma_yapilacaklari").insert({
    project_id: girdi.projectId,
    olusturan: ctx.user.id,
    baslik: kayit.baslik,
    aciklama: kayit.aciklama,
    kaynak: "kaynakca_asistani",
    asistan_kaydi: girdi.asistanKaydi && UUID.test(girdi.asistanKaydi) ? girdi.asistanKaydi : null,
  });
  if (error) {
    // Aynı açık madde zaten var: hata değil, kullanıcıya söylenecek bir durum.
    if (error.code === "23505") return { error: "Bu madde zaten yapılacaklarınızda." };
    console.error("[yapılacaklar] eklenemedi:", error.message);
    return { error: error.code === "42501" ? "Bu çalışmaya ekleme yetkiniz yok." : "Eklenemedi; tekrar deneyin." };
  }
  yenile();
  return {};
}

/** "Yaptım": mevcut kaydın güncellenmesi, abonelik kapısı bilerek yok (lib/access.ts). */
export async function yapilacakTamamla(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  if (!UUID.test(id)) return { error: "Madde bulunamadı." };
  const { data, error } = await ctx.supabase
    .from("calisma_yapilacaklari")
    .update({ tamamlandi: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("[yapılacaklar] tamamlanamadı:", error.message);
    return { error: "Kaydedilemedi; tekrar deneyin." };
  }
  // RLS yetkisiz güncellemeyi sessizce sıfır satıra çeviriyor; başarı sanılmasın.
  if (!data?.length) return { error: "Bu maddeyi güncelleme yetkiniz yok." };
  yenile();
  return {};
}
