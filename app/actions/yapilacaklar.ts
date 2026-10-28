"use server";

import { revalidatePath } from "next/cache";
import { ceviri } from "@/lib/dil-sunucu";
import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
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
  if (!ctx) return { error: await oturumYokMesaji() };
  // Yeni içerik yazıyor: kapı burada da (panel kapısı yalnızca ekranı kapatıyor).
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };
  const t = await ceviri();
  if (!UUID.test(girdi.projectId)) return { error: t({ tr: "Çalışma bulunamadı.", en: "Work not found." }) };

  const kayit = yapilacakGirdisi(girdi);
  if (!kayit) return { error: t({ tr: "Eklenecek bir başlık yok.", en: "There is no title to add." }) };

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
    if (error.code === "23505") return { error: t({ tr: "Bu madde zaten yapılacaklarınızda.", en: "This item is already in your to-dos." }) };
    console.error("[yapılacaklar] eklenemedi:", error.message);
    return {
      error:
        error.code === "42501"
          ? t({ tr: "Bu çalışmaya ekleme yetkiniz yok.", en: "You don't have permission to add to this work." })
          : t({ tr: "Eklenemedi; tekrar deneyin.", en: "Could not add; try again." }),
    };
  }
  yenile();
  return {};
}

/** "Yaptım": mevcut kaydın güncellenmesi, abonelik kapısı bilerek yok (lib/access.ts). */
export async function yapilacakTamamla(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  const t = await ceviri();
  if (!UUID.test(id)) return { error: t({ tr: "Madde bulunamadı.", en: "Item not found." }) };
  const { data, error } = await ctx.supabase
    .from("calisma_yapilacaklari")
    .update({ tamamlandi: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) {
    console.error("[yapılacaklar] tamamlanamadı:", error.message);
    return { error: t({ tr: "Kaydedilemedi; tekrar deneyin.", en: "Could not save; try again." }) };
  }
  // RLS yetkisiz güncellemeyi sessizce sıfır satıra çeviriyor; başarı sanılmasın.
  if (!data?.length) return { error: t({ tr: "Bu maddeyi güncelleme yetkiniz yok.", en: "You don't have permission to update this item." }) };
  yenile();
  return {};
}
