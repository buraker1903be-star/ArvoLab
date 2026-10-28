"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext, oturumYokMesaji, type ActionResult } from "@/lib/auth-guards";
import { isSubscriptionBlocked, abonelikKapaliMesaji } from "@/lib/access";
import { makaleTuruMu } from "@/lib/makale/sablonlar";
import type { MakaleProfili } from "@/lib/makale/gonderim-kontrolu";

/*
  Makale çalışma alanının profili (migration 20261026065320). Tez çalışma
  merkeziyle aynı academic_projects satırına bağlı: literatür, kaynakça,
  analiz ve kanıt matrisi ortak; makaleye özgü olan tür, hedef dergi,
  sınırlar ve araştırma sorusu burada.

  Kayıt yeni içerik yazdığı için abonelik kapısından geçer (lib/access.ts).
*/

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DILLER = ["tr", "en", "diger"];
const VERI = ["yok", "toplaniyor", "toplandi", "analiz_edildi", "gerekmiyor"];
const TARIH = /^\d{4}-\d{2}-\d{2}$/;

const metin = (formData: FormData, ad: string, sinir: number) => {
  const deger = String(formData.get(ad) ?? "").trim();
  return deger ? deger.slice(0, sinir) : null;
};

/** Boş ya da aralık dışı sayı null olur; veritabanı kısıtı yerine anlaşılır mesaj. */
const tamSayi = (formData: FormData, ad: string, enAz: number, enCok: number): number | null | "hatali" => {
  const ham = String(formData.get(ad) ?? "").trim();
  if (!ham) return null;
  const sayi = Number(ham);
  return Number.isInteger(sayi) && sayi >= enAz && sayi <= enCok ? sayi : "hatali";
};

export type MakaleProfiliSatiri = MakaleProfili & {
  arastirma_tasarimi: string | null;
  disiplin: string | null;
  dergi_kurallari_notu: string | null;
};

export async function makaleProfiliOku(projectId: string): Promise<{ profil: MakaleProfiliSatiri | null; okunamadi: boolean }> {
  const ctx = await getAuthContext();
  if (!ctx || !UUID.test(projectId)) return { profil: null, okunamadi: false };
  const { data, error } = await ctx.supabase.from("makale_profili").select("*").eq("project_id", projectId).maybeSingle();
  if (error) {
    console.error("[makale] profil okunamadı:", error.message);
    return { profil: null, okunamadi: true };
  }
  return { profil: (data as MakaleProfiliSatiri | null) ?? null, okunamadi: false };
}

export async function makaleProfiliKaydet(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: await oturumYokMesaji() };
  if (await isSubscriptionBlocked()) return { error: (await abonelikKapaliMesaji()) };

  const projectId = String(formData.get("project_id") ?? "");
  if (!UUID.test(projectId)) return { error: "Çalışma bulunamadı." };

  const tur = String(formData.get("makale_turu") ?? "");
  if (!makaleTuruMu(tur)) return { error: "Makale türünü seçin." };

  const kelime = tamSayi(formData, "kelime_siniri", 100, 100000);
  const ozetSiniri = tamSayi(formData, "ozet_siniri", 30, 2000);
  const anahtarEnAz = tamSayi(formData, "anahtar_en_az", 1, 20);
  const anahtarEnCok = tamSayi(formData, "anahtar_en_cok", 1, 20);
  if (kelime === "hatali") return { error: "Kelime sınırı 100 ile 100.000 arasında bir tam sayı olmalı." };
  if (ozetSiniri === "hatali") return { error: "Özet sınırı 30 ile 2.000 arasında bir tam sayı olmalı." };
  if (anahtarEnAz === "hatali" || anahtarEnCok === "hatali") return { error: "Anahtar kelime sayıları 1 ile 20 arasında olmalı." };
  if (anahtarEnAz && anahtarEnCok && anahtarEnAz > anahtarEnCok) return { error: "En az anahtar kelime sayısı en çoktan büyük olamaz." };

  const kontrol = String(formData.get("dergi_kurallari_kontrol") ?? "").trim();
  if (kontrol && !TARIH.test(kontrol)) return { error: "Kontrol tarihi okunamadı." };

  const anahtarKelimeler = String(formData.get("anahtar_kelimeler") ?? "")
    .split(/[;,\n]/)
    .map((k) => k.trim().slice(0, 100))
    .filter(Boolean)
    .slice(0, 20);

  const dil = String(formData.get("dil") ?? "tr");
  const veri = String(formData.get("veri_durumu") ?? "yok");

  const { error } = await ctx.supabase.from("makale_profili").upsert(
    {
      project_id: projectId,
      makale_turu: tur,
      arastirma_problemi: metin(formData, "arastirma_problemi", 2000),
      arastirma_sorusu: metin(formData, "arastirma_sorusu", 1000),
      arastirma_tasarimi: metin(formData, "arastirma_tasarimi", 500),
      disiplin: metin(formData, "disiplin", 200),
      hedef_dergi: metin(formData, "hedef_dergi", 300),
      dergi_kurallari_adresi: metin(formData, "dergi_kurallari_adresi", 1000),
      dergi_kurallari_kontrol: kontrol || null,
      dergi_kurallari_notu: metin(formData, "dergi_kurallari_notu", 4000),
      dil: DILLER.includes(dil) ? dil : "tr",
      kelime_siniri: kelime,
      ozet_siniri: ozetSiniri,
      anahtar_en_az: anahtarEnAz,
      anahtar_en_cok: anahtarEnCok,
      ozet: metin(formData, "ozet", 8000),
      anahtar_kelimeler: anahtarKelimeler,
      veri_durumu: VERI.includes(veri) ? veri : "yok",
      raporlama_standardi: metin(formData, "raporlama_standardi", 100),
      guncelleyen: ctx.user.id,
      guncellendi: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );
  if (error) {
    // Ekleme politikası yalnızca makale türündeki çalışmaya izin veriyor.
    if (error.code === "42501") return { error: "Makale bilgileri yalnızca makale türündeki ve yazma yetkiniz olan çalışmaya kaydedilebilir." };
    console.error("[makale] profil kaydedilemedi:", error.code, error.message);
    return { error: "Makale bilgileri kaydedilemedi." };
  }

  revalidatePath(`/dashboard/editor/${projectId}/makale`);
  revalidatePath(`/dashboard/editor/${projectId}`);
  return { success: true, message: "Makale bilgileri kaydedildi." };
}
