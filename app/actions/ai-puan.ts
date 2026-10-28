"use server";

import { createClient } from "@/lib/supabase/server";
import { ceviri } from "@/lib/dil-sunucu";

/*
  Kullanıcının asistan çalışmasına verdiği not. İnce ayarda "iyi örnek"
  etiketi bu: modelin ne dediği kadar, kullanıcının onu faydalı bulup
  bulmadığı da eğitim verisinin parçası.

  Abonelik kapısı bilerek YOK: bu işlem dış maliyet üretmiyor ve yeni içerik
  yazmıyor, var olan kendi kaydına not düşüyor (lib/access.ts). Aboneliği
  biten kullanıcının geri bildirim verememesi için bir sebep yok.

  Yalnızca puanlama sütunlarının yazılabildiğini veritabanı garanti ediyor
  (guard_ai_run_update, migration 20260924100005): RLS "kim yazabilir"i
  söyler, "neyi"yi söylemez.
*/

export type Puan = "faydali" | "kismen" | "faydasiz";

const PUANLAR = new Set<Puan>(["faydali", "kismen", "faydasiz"]);

export async function asistanPuanla(kayitId: string, puan: Puan, not?: string): Promise<{ hata?: string; tamam?: true }> {
  const t = await ceviri();
  if (!PUANLAR.has(puan)) return { hata: t({ tr: "Geçersiz değerlendirme.", en: "Invalid rating." }) };
  if (!kayitId) return { hata: t({ tr: "Değerlendirilecek kayıt bulunamadı.", en: "The record to rate was not found." }) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: t({ tr: "Oturum bulunamadı.", en: "No active session." }) };

  /*
    select("id") şart: RLS engellediğinde güncelleme hata değil SIFIR SATIR
    döndürür. Okumasaydık başkasının kaydını puanlama denemesi "kaydedildi"
    görünürdü.
  */
  const { data, error } = await supabase
    .from("ai_assistant_runs")
    .update({ rating: puan, rating_note: not?.slice(0, 500) || null })
    .eq("id", kayitId)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    console.error("[ai] değerlendirme kaydedilemedi:", error.message);
    return { hata: t({ tr: "Değerlendirmeniz kaydedilemedi.", en: "Your rating could not be saved." }) };
  }
  if (!data?.length) return { hata: t({ tr: "Bu kaydı değerlendiremezsiniz.", en: "You cannot rate this record." }) };
  return { tamam: true };
}
