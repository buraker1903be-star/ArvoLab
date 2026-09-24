"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/app/actions/profile";
import { ADMIN_ROLES } from "@/lib/project-labels";
import {
  aktivasyonHesapla,
  huniHesapla,
  kayipHesapla,
  ortalamaPuan,
  type AktivasyonAdimi,
  type Huni,
  type KayipOzeti,
} from "@/lib/olcum";

/*
  Ürün ölçümü — okuma katmanı.

  Yalnızca İÇ EKİBE (system_admin, founder) açık. Sayılan kitle BİREYSEL
  aboneler: kurumun lisansı zaten ArvoOS tarafında ölçülüyor, burada
  cevaplanmak istenen soru "kendi kendine gelen kişi kalıyor mu".

  Buradaki rol denetimi RLS'in yerini tutmaz (AGENTS.md); yetkisiz isteğin
  sessizce boş sayı dönmesini engeller. individual_subscriptions okuması
  20260924100029'dan beri iç ekibe açık.

  Bir okuma başarısız olursa sayfa NE gösterdiğini bilerek söylüyor: eksik
  veriyle çizilmiş bir huni, olmayan bir dönüşüm sorunu icat eder.
*/

/** Bir kullanıcıyı "yazmaya başlamış" saymak için gereken en az kelime. */
const YAZMAYA_BASLADI_KELIME = 500;

export interface OlcumOzeti {
  yetkisiz: boolean;
  okunamadi: boolean;
  huni: Huni;
  aktivasyon: AktivasyonAdimi[];
  kayip: KayipOzeti;
  geriBildirim: { cevaplayan: number; ortalama: number | null };
}

const BOS: OlcumOzeti = {
  yetkisiz: true,
  okunamadi: false,
  huni: { kayit: 0, denemeBaslatan: 0, odemeyeGecen: 0, suAnErisimi: 0, donusumYuzdesi: null },
  aktivasyon: [],
  kayip: { denemedeBirakan: 0, yenilemeyen: 0 },
  geriBildirim: { cevaplayan: 0, ortalama: null },
};

export async function olcumOzeti(): Promise<OlcumOzeti> {
  const profile = await getCurrentProfile();
  if (!profile || !ADMIN_ROLES.includes(profile.role)) return BOS;

  const supabase = await createClient();

  /*
    Bireysel kitle: kurumu olmayan ve personel olmayan profiller. Rol
    süzgeci şart — iç ekibin kendi hesapları da kurumsuz ve onları "abone
    adayı" saymak dönüşüm oranını olduğundan kötü gösterirdi.
  */
  const [{ data: kisiler, error: kisiHatasi }, { data: abonelikler, error: abonelikHatasi }] = await Promise.all([
    supabase.from("profiles").select("id, created_at").is("organization_id", null).eq("role", "client"),
    supabase.from("individual_subscriptions").select("user_id, status, trial_ends_at, current_period_end"),
  ]);

  if (kisiHatasi || abonelikHatasi) {
    console.error("[ölçüm] temel okuma başarısız:", kisiHatasi?.message ?? abonelikHatasi?.message);
    return { ...BOS, yetkisiz: false, okunamadi: true };
  }

  const bireyseller = kisiler ?? [];
  const kimlikler = bireyseller.map((k) => k.id);

  // Kimse yoksa aktivasyon sorgularına hiç gitmeye gerek yok; boş "in ()"
  // filtresi PostgREST'te bütün satırları getirir, tam tersi sonuç verirdi.
  const [calismalar, metinler, asistan] = kimlikler.length
    ? await Promise.all([
        supabase.from("academic_projects").select("id, owner_id").in("owner_id", kimlikler),
        supabase.from("project_manuscripts").select("project_id, word_count").gte("word_count", YAZMAYA_BASLADI_KELIME),
        supabase.from("ai_assistant_runs").select("user_id").in("user_id", kimlikler),
      ])
    : [null, null, null];

  const calismaSatirlari = calismalar?.data ?? [];
  const sahipler = new Map(calismaSatirlari.map((c) => [c.id, c.owner_id]));
  const yazanlar = (metinler?.data ?? [])
    .map((m) => sahipler.get(m.project_id))
    .filter((id): id is string => !!id);

  const { data: geriBildirimler } = await supabase
    .from("product_feedback")
    .select("score")
    .eq("status", "answered");

  const okunamadi =
    !!calismalar?.error || !!metinler?.error || !!asistan?.error;
  if (okunamadi) {
    console.error(
      "[ölçüm] aktivasyon okuması başarısız:",
      calismalar?.error?.message ?? metinler?.error?.message ?? asistan?.error?.message,
    );
  }

  return {
    yetkisiz: false,
    okunamadi,
    huni: huniHesapla(bireyseller, abonelikler ?? []),
    aktivasyon: aktivasyonHesapla(bireyseller, [
      { etiket: "Çalışma açtı", kimlikler: calismaSatirlari.map((c) => c.owner_id) },
      { etiket: `En az ${YAZMAYA_BASLADI_KELIME} kelime yazdı`, kimlikler: yazanlar },
      { etiket: "Asistanı kullandı", kimlikler: (asistan?.data ?? []).map((a) => a.user_id) },
    ]),
    kayip: kayipHesapla(abonelikler ?? []),
    geriBildirim: {
      cevaplayan: (geriBildirimler ?? []).length,
      ortalama: ortalamaPuan((geriBildirimler ?? []).map((g) => g.score)),
    },
  };
}
