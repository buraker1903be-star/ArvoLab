"use server";

import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, requireRole, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/project-labels";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";
import { korunanBirimPuan, paylasimKatsayisi, puanHesapla } from "@/lib/docentlik-puan";
import { pdfMi } from "@/lib/kaynak-pdf";
import type { Hedef } from "@/lib/docentlik-ozeti";

const PAGE_PATH = "/dashboard/associate-professorship";

export interface ScoringCriterion {
  id: string;
  code: string;
  label: string;
  category_group: string | null;
  points_per_unit: number;
  notes: string | null;
  is_active: boolean;
  /** NULL = genel liste (herkes okur, yalnızca iç ekip düzenler). */
  organization_id: string | null;
  /** Ortak yazarlık katsayıları; NULL = paylaşım tanımsız, tam puan (20261027081037). */
  baslica_yazar_katsayisi: number | null;
  diger_yazar_katsayisi: number | null;
  /** ÜAK temel alanı; NULL = bütün alanlar (20261027083309). */
  temel_alan: string | null;
  /** Çok yazarlıda puan yazar sayısına eşit bölünür (20261027122336). */
  esit_bolusum: boolean;
  /** Temel alanın alt alanı; NULL = temel alanın tamamı (20261027142035). */
  alt_alan: string | null;
}

export interface ScoreEntry {
  id: string;
  criteria_id: string;
  title: string;
  unit_count: number;
  computed_points: number;
  notes: string | null;
  created_at: string;
  yazar_sayisi: number;
  baslica_yazar: boolean;
  paylasim_katsayisi: number;
  faaliyet_tarihi: string | null;
  belge_yolu: string | null;
}

const KRITER_SUTUNLARI =
  "id, code, label, category_group, points_per_unit, notes, is_active, organization_id, baslica_yazar_katsayisi, diger_yazar_katsayisi, temel_alan, esit_bolusum, alt_alan";
const KOVA = "project-files";

function parseDecimal(raw: string) {
  return Number(raw.trim().replace(",", "."));
}

/* Boş = tanımsız (null). Doluysa 0'dan büyük, en fazla 1. */
function katsayiOku(raw: FormDataEntryValue | null): { deger: number | null } | { hata: string } {
  const metin = String(raw ?? "").trim();
  if (!metin) return { deger: null };
  const sayi = parseDecimal(metin);
  if (!Number.isFinite(sayi) || sayi <= 0 || sayi > 1) return { hata: "Yazar katsayısı 0 ile 1 arasında olmalı (örn. 0,8); paylaşım yoksa boş bırakın." };
  return { deger: sayi };
}

/* Faaliyetin yazar bilgisi ve tarihi formdan. Tarih boş olabilir. */
function faaliyetAyrintisi(formData: FormData): { yazarSayisi: number; baslica: boolean; tarih: string | null } | { hata: string } {
  const yazarRaw = String(formData.get("yazarSayisi") ?? "1").trim() || "1";
  const yazarSayisi = Number(yazarRaw);
  if (!Number.isInteger(yazarSayisi) || yazarSayisi < 1 || yazarSayisi > 500) return { hata: "Yazar sayısı 1 ile 500 arasında bir tam sayı olmalı." };
  const tarih = String(formData.get("faaliyetTarihi") ?? "").trim() || null;
  if (tarih && !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { hata: "Tarih geçersiz." };
  return { yazarSayisi, baslica: yazarSayisi === 1 || String(formData.get("baslicaYazar") ?? "evet") === "evet", tarih };
}

export async function getCriteria(): Promise<ListeSonucu<ScoringCriterion>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scoring_criteria")
    .select(KRITER_SUTUNLARI)
    .eq("is_active", true)
    .order("category_group", { ascending: true });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

/*
  Kriterin KAPSAMI (migration 20260924100032): tablo eskiden tekti ve
  herhangi bir kurumun Yöneticisi herkesin puanlarını
  değiştirebiliyordu.

  Kurum yöneticisi yalnızca kendi kurumuna ekler — seçenek sunulmuyor,
  çünkü başka bir seçenek yok. İç ekip genel listeyi de yönetebildiği için
  açıkça soruluyor: varsayılan GENEL, çünkü genel satır herkese görünür;
  yanlışlıkla kuruma yazılmış bir kriter diğer kullanıcılardan sessizce
  gizlenirdi.
*/
export async function createCriterion(formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kriter eklemek için Yönetici veya üzeri bir rol gerekir.");
  if ("error" in auth) return { error: auth.error };

  const code = String(formData.get("code") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const pointsRaw = String(formData.get("pointsPerUnit") ?? "").trim();

  if (!code || !label || !pointsRaw) return { error: "Kod, etiket ve puan alanları zorunludur." };

  const points = parseDecimal(pointsRaw);
  if (!Number.isFinite(points) || points < 0) {
    return { error: "Birim başına puan 0 veya daha büyük bir sayı olmalıdır." };
  }

  const baslicaK = katsayiOku(formData.get("baslicaKatsayi"));
  const digerK = katsayiOku(formData.get("digerKatsayi"));
  if ("hata" in baslicaK) return { error: baslicaK.hata };
  if ("hata" in digerK) return { error: digerK.hata };

  const icEkip = auth.role !== null && ADMIN_ROLES.includes(auth.role);
  const kurumaYaz = icEkip ? String(formData.get("kapsam") ?? "genel") === "kurum" : true;
  const { data: profil } = await auth.supabase
    .from("profiles").select("organization_id").eq("id", auth.user.id).maybeSingle();
  const kurum = kurumaYaz ? profil?.organization_id ?? null : null;

  if (kurumaYaz && !kurum) {
    return {
      error: icEkip
        ? "Kuruma özel kriter için önce bir kuruma bağlı olmalısınız; genel listeye eklemek için kapsamı “Genel” seçin."
        : "Kurumunuz tanımlı değil. Kriter ekleyebilmek için Sistem Yöneticisi'nden kurum ataması isteyin.",
    };
  }

  const { error } = await auth.supabase.from("scoring_criteria").insert({
    code,
    label,
    category_group: String(formData.get("categoryGroup") ?? "").trim() || null,
    points_per_unit: points,
    notes: String(formData.get("notes") ?? "").trim() || null,
    organization_id: kurum,
    temel_alan: String(formData.get("temelAlan") ?? "").trim().slice(0, 120) || null,
    alt_alan: String(formData.get("altAlan") ?? "").trim().slice(0, 160) || null,
    esit_bolusum: formData.get("esitBolusum") === "1",
    baslica_yazar_katsayisi: baslicaK.deger,
    diger_yazar_katsayisi: digerK.deger,
    updated_by: auth.user.id,
  });

  if (error) {
    console.error(error);
    return { error: error.code === "23505" ? "Bu kriter kodu zaten kullanılıyor." : "Kriter kaydedilirken bir hata oluştu." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

// Kriter kodu değiştirilemez (kayıtlar ona bağlı). Puan değişikliği yalnızca
// bundan sonra eklenen faaliyetlere uygulanır; mevcut kayıtların puanı,
// eklendiği andaki değerle saklanır.
export async function updateCriterion(criterionId: string, formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kriterleri yalnızca Yönetici ve üzeri roller düzenleyebilir.");
  if ("error" in auth) return { error: auth.error };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Etiket zorunludur." };

  const points = parseDecimal(String(formData.get("pointsPerUnit") ?? ""));
  if (!Number.isFinite(points) || points < 0) return { error: "Birim başına puan 0 veya daha büyük bir sayı olmalıdır." };
  const baslicaK = katsayiOku(formData.get("baslicaKatsayi"));
  const digerK = katsayiOku(formData.get("digerKatsayi"));
  if ("hata" in baslicaK) return { error: baslicaK.hata };
  if ("hata" in digerK) return { error: digerK.hata };

  const { data, error } = await auth.supabase
    .from("scoring_criteria")
    .update({
      label,
      category_group: String(formData.get("categoryGroup") ?? "").trim() || null,
      points_per_unit: points,
      // Katsayı değişikliği de puan gibi yalnızca bundan sonraki kayıtlara uygulanır.
      esit_bolusum: formData.get("esitBolusum") === "1",
      baslica_yazar_katsayisi: baslicaK.deger,
      diger_yazar_katsayisi: digerK.deger,
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", criterionId)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Kriter güncellenirken bir hata oluştu." };
  }
  /* Sıfır satır iki şey olabilir: kriter yok ya da GENEL listeye ait ve
     kullanıcı bir kurumun yöneticisi. İkisini ayırt edemediğimiz için
     ikisini de söylüyoruz — "bulunamadı" demek, duran bir kriteri
     silinmiş göstermekti. */
  if (!data?.length) {
    return { error: "Kriter bulunamadı ya da düzenleme yetkiniz yok (genel listeyi yalnızca Sistem Yöneticisi düzenler)." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function deleteCriterion(criterionId: string): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Kriterleri yalnızca Yönetici ve üzeri roller silebilir.");
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase.from("scoring_criteria").delete().eq("id", criterionId);

  if (error?.code === "23503") {
    // Kritere bağlı kullanıcı kayıtları var: kayıtları bozmamak için
    // kriteri silmek yerine pasife alıyoruz (listeden kalkar, geçmiş puanlar korunur).
    const { error: deactivateError } = await auth.supabase
      .from("scoring_criteria")
      .update({ is_active: false, updated_by: auth.user.id })
      .eq("id", criterionId);
    if (deactivateError) {
      console.error(deactivateError);
      return { error: "Kriter pasife alınırken bir hata oluştu." };
    }
  } else if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function getMyScoreEntries(): Promise<ListeSonucu<ScoreEntry & { criteria: ScoringCriterion | null }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return listeBasarili([]);

  const { data, error } = await supabase
    .from("academic_score_entries")
    .select(
      `id, criteria_id, title, unit_count, computed_points, notes, created_at, yazar_sayisi, baslica_yazar, paylasim_katsayisi, faaliyet_tarihi, belge_yolu, scoring_criteria(${KRITER_SUTUNLARI})`
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }

  return listeBasarili((data ?? []).map((row) => {
    const { scoring_criteria, ...rest } = row as typeof row & {
      scoring_criteria: ScoringCriterion | ScoringCriterion[] | null;
    };
    const criteria = Array.isArray(scoring_criteria) ? scoring_criteria[0] ?? null : scoring_criteria;
    return { ...rest, criteria };
  }));
}

export async function addScoreEntry(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  /* Abonelik kapısı: Doçentlik puanlama ücretli bir özellik; yeni kayıt üretir. */
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };
  const { supabase, user } = ctx;

  const criteriaId = String(formData.get("criteriaId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const unitCountRaw = String(formData.get("unitCount") ?? "1").trim() || "1";

  if (!criteriaId || !title) return { error: "Kriter ve başlık alanları zorunludur." };

  const unitCount = parseDecimal(unitCountRaw);
  if (!Number.isFinite(unitCount) || unitCount <= 0) {
    return { error: "Adet / birim sayısı 0'dan büyük bir sayı olmalıdır." };
  }
  const ayrinti = faaliyetAyrintisi(formData);
  if ("hata" in ayrinti) return { error: ayrinti.hata };

  const { data: criterion, error: criterionError } = await supabase
    .from("scoring_criteria")
    .select("points_per_unit, baslica_yazar_katsayisi, diger_yazar_katsayisi, esit_bolusum")
    .eq("id", criteriaId)
    .eq("is_active", true)
    .single();

  if (criterionError || !criterion) return { error: "Seçilen kriter bulunamadı." };
  const katsayi = paylasimKatsayisi(criterion, ayrinti.yazarSayisi, ayrinti.baslica);

  const { error } = await supabase.from("academic_score_entries").insert({
    owner_id: user.id,
    criteria_id: criteriaId,
    title,
    unit_count: unitCount,
    computed_points: puanHesapla(unitCount, Number(criterion.points_per_unit), katsayi),
    notes: String(formData.get("notes") ?? "").trim() || null,
    yazar_sayisi: ayrinti.yazarSayisi,
    baslica_yazar: ayrinti.baslica,
    paylasim_katsayisi: katsayi,
    faaliyet_tarihi: ayrinti.tarih,
  });

  if (error) {
    console.error(error);
    return { error: "Kayıt eklenirken bir hata oluştu." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

/*
  Kayıt düzenleme. Eskiden yoktu: yanlış girilen adet ya da başlık için tek
  yol kaydı silip yeniden girmekti — tabloda UPDATE ne grant'lenmişti ne de
  politikası vardı (20260924100023).

  Birim puanın nereden geldiği lib/docentlik-puan.ts'te anlatılıyor: kriter
  aynı kaldığı sürece kaydın kendi puanı korunur, yoksa başlıktaki bir yazım
  hatasını düzelten kullanıcının toplam puanı sessizce değişirdi.
*/
export async function updateScoreEntry(entryId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  /* Abonelik kapısı: ücretli özelliğin ürettiği kaydı değiştirmek de o
     özelliği kullanmaktır. Silme bilerek kapının dışında. */
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };
  const { supabase, user } = ctx;

  const criteriaId = String(formData.get("criteriaId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!criteriaId || !title) return { error: "Kriter ve başlık alanları zorunludur." };

  const unitCount = parseDecimal(String(formData.get("unitCount") ?? "1").trim() || "1");
  if (!Number.isFinite(unitCount) || unitCount <= 0) {
    return { error: "Adet / birim sayısı 0'dan büyük bir sayı olmalıdır." };
  }
  const ayrinti = faaliyetAyrintisi(formData);
  if ("hata" in ayrinti) return { error: ayrinti.hata };

  const { data: mevcut, error: okumaHatasi } = await supabase
    .from("academic_score_entries")
    .select("criteria_id, unit_count, computed_points, paylasim_katsayisi, yazar_sayisi, baslica_yazar")
    .eq("id", entryId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (okumaHatasi) {
    console.error(okumaHatasi);
    // Okunamayan kaydın üzerine yazmak, birim puanı kritere göre yeniden
    // fiyatlandırırdı: hata "kaydedildi" görünürken puan değişirdi.
    return { error: "Kayıt okunamadı; değişiklik kaydedilmedi, tekrar deneyin." };
  }
  if (!mevcut) return { error: "Kayıt bulunamadı ya da size ait değil." };

  /*
    Katsayı da birim puan gibi korunuyor: kriter ve yazar bilgisi aynı
    kaldıkça kaydın kendi katsayısı. Yazar bilgisi değiştiyse kullanıcı
    yeni bir beyanda bulunuyor; kriterin GÜNCEL katsayısı uygulanır.
  */
  let birimPuan = korunanBirimPuan(mevcut, criteriaId);
  const yazarAyni =
    Number(mevcut.yazar_sayisi ?? 1) === ayrinti.yazarSayisi && Boolean(mevcut.baslica_yazar ?? true) === ayrinti.baslica;
  let katsayi = birimPuan !== null && yazarAyni ? Number(mevcut.paylasim_katsayisi ?? 1) : null;
  if (birimPuan === null || katsayi === null) {
    // Kriter ya da yazar bilgisi değişti (ya da kaydın puanı türetilemedi): kriterin güncel değerleri.
    const { data: criterion, error: kriterHatasi } = await supabase
      .from("scoring_criteria")
      .select("points_per_unit, baslica_yazar_katsayisi, diger_yazar_katsayisi, esit_bolusum")
      .eq("id", criteriaId)
      .single();
    if (kriterHatasi || !criterion) return { error: "Seçilen kriter bulunamadı." };
    if (birimPuan === null) birimPuan = Number(criterion.points_per_unit);
    katsayi = paylasimKatsayisi(criterion, ayrinti.yazarSayisi, ayrinti.baslica);
  }

  const { data, error } = await supabase
    .from("academic_score_entries")
    .update({
      criteria_id: criteriaId,
      title,
      unit_count: unitCount,
      computed_points: puanHesapla(unitCount, birimPuan, katsayi),
      notes: String(formData.get("notes") ?? "").trim() || null,
      yazar_sayisi: ayrinti.yazarSayisi,
      baslica_yazar: ayrinti.baslica,
      paylasim_katsayisi: katsayi,
      faaliyet_tarihi: ayrinti.tarih,
    })
    .eq("id", entryId)
    .eq("owner_id", user.id)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Kayıt güncellenirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kayıt bulunamadı ya da size ait değil." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function deleteScoreEntry(entryId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const { data, error } = await ctx.supabase
    .from("academic_score_entries")
    .delete()
    .eq("id", entryId)
    .eq("owner_id", ctx.user.id)
    .select("id, belge_yolu");

  if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kayıt bulunamadı ya da size ait değil." };
  // Kaydın belgesi de gider; kalırsa kimsenin göremediği bir dosya olarak yer kaplardı.
  const belge = data[0].belge_yolu as string | null;
  if (belge) {
    const { error: silmeHatasi } = await ctx.supabase.storage.from(KOVA).remove([belge]);
    if (silmeHatasi) console.error("[doçentlik] silinen kaydın belgesi kaldırılamadı", silmeHatasi.message);
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

/* ============================================================
   HEDEFLER, DOKTORA TARİHİ, BELGE (20261027081037)
   ============================================================ */

export async function getHedefler(): Promise<ListeSonucu<Hedef & { id: string; notlar: string | null }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("docentlik_hedefleri")
    .select("id, organization_id, temel_alan, alt_alan, grup, asgari_puan, azami_puan, doktora_sonrasi, notlar");
  if (error) {
    console.error("[doçentlik] hedefler okunamadı", error.message);
    return listeOkunamadi();
  }
  return listeBasarili(
    (data ?? []).map((h) => ({
      ...h,
      asgari_puan: h.asgari_puan === null ? null : Number(h.asgari_puan),
      azami_puan: h.azami_puan === null ? null : Number(h.azami_puan),
    })),
  );
}

/*
  Hedef ekler ya da aynı kapsam+gruptakini günceller. Kapsam kuralı
  kriterlerinkiyle aynı (createCriterion): kurum yöneticisi yalnızca kendi
  kurumuna, iç ekip genel listeye de. Abonelik kapısı yok: personel akışı
  (lib/access.ts).
*/
export async function hedefKaydet(formData: FormData): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Hedef tanımlamak için Yönetici veya üzeri bir rol gerekir.");
  if ("error" in auth) return { error: auth.error };

  const grup = String(formData.get("grup") ?? "").trim() || null;
  const temelAlan = String(formData.get("temelAlan") ?? "").trim().slice(0, 120) || null;
  const altAlan = temelAlan ? String(formData.get("altAlan") ?? "").trim().slice(0, 160) || null : null;
  /* Asgari, azami ya da ikisi. Tavan dönemden bağımsız: doktora sonrası satırına yazılmaz. */
  const doktoraSonrasi = formData.get("doktoraSonrasi") === "1";
  const oku = (ad: string) => {
    const ham = String(formData.get(ad) ?? "").trim();
    if (!ham) return { deger: null as number | null };
    const n = parseDecimal(ham);
    return Number.isFinite(n) && n > 0 ? { deger: n } : { hata: true as const };
  };
  const asgari = oku("asgariPuan");
  const azami = doktoraSonrasi ? { deger: null } : oku("azamiPuan");
  if ("hata" in asgari || "hata" in azami) return { error: "Puanlar 0'dan büyük sayı olmalı." };
  if (asgari.deger === null && azami.deger === null) return { error: "Asgari ya da azami puandan en az birini girin." };

  const icEkip = auth.role !== null && ADMIN_ROLES.includes(auth.role);
  const kurumaYaz = icEkip ? String(formData.get("kapsam") ?? "genel") === "kurum" : true;
  const { data: profil } = await auth.supabase.from("profiles").select("organization_id").eq("id", auth.user.id).maybeSingle();
  const kurum = kurumaYaz ? profil?.organization_id ?? null : null;
  if (kurumaYaz && !kurum) return { error: "Kuruma özel hedef için önce bir kuruma bağlı olmalısınız." };

  /* Aynı kapsamda aynı grup için tek hedef (benzersiz dizin): varsa
     güncellenir. upsert, NULL içeren bir çakışma anahtarını eşleştiremediği
     için önce aranıyor. */
  let sorgu = auth.supabase.from("docentlik_hedefleri").select("id");
  sorgu = kurum ? sorgu.eq("organization_id", kurum) : sorgu.is("organization_id", null);
  sorgu = grup ? sorgu.eq("grup", grup) : sorgu.is("grup", null);
  sorgu = temelAlan ? sorgu.eq("temel_alan", temelAlan) : sorgu.is("temel_alan", null);
  sorgu = altAlan ? sorgu.eq("alt_alan", altAlan) : sorgu.is("alt_alan", null);
  sorgu = sorgu.eq("doktora_sonrasi", doktoraSonrasi);
  const { data: mevcut, error: aramaHatasi } = await sorgu.maybeSingle();
  if (aramaHatasi) {
    console.error("[doçentlik] hedef aranamadı", aramaHatasi.message);
    return { error: "Hedef kaydedilemedi; tekrar deneyin." };
  }

  const satir = {
    organization_id: kurum,
    grup,
    temel_alan: temelAlan,
    alt_alan: altAlan,
    asgari_puan: asgari.deger,
    azami_puan: azami.deger,
    doktora_sonrasi: doktoraSonrasi,
    notlar: String(formData.get("notlar") ?? "").trim() || null,
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  };
  const { error } = mevcut
    ? await auth.supabase.from("docentlik_hedefleri").update(satir).eq("id", mevcut.id)
    : await auth.supabase.from("docentlik_hedefleri").insert(satir);
  if (error) {
    console.error("[doçentlik] hedef yazılamadı", error.message);
    return { error: error.code === "42501" ? "Bu hedefi düzenleme yetkiniz yok." : "Hedef kaydedilemedi." };
  }
  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function hedefSil(hedefId: string): Promise<ActionResult> {
  const auth = await requireRole(MANAGER_ROLES, "Hedefleri yalnızca Yönetici ve üzeri roller silebilir.");
  if ("error" in auth) return { error: auth.error };
  const { data, error } = await auth.supabase.from("docentlik_hedefleri").delete().eq("id", hedefId).select("id");
  if (error) {
    console.error("[doçentlik] hedef silinemedi", error.message);
    return { error: "Hedef silinemedi." };
  }
  if (!data?.length) return { error: "Hedef bulunamadı ya da silme yetkiniz yok." };
  revalidatePath(PAGE_PATH);
  return { success: true };
}

/** Okunamazsa okunamadi: "tarih girilmemiş" demek, girilmiş tarihi silinmiş göstermek olurdu. */
export async function getDoktoraTarihi(): Promise<{ tarih: string | null; temelAlan: string | null; altAlan: string | null; okunamadi: boolean }> {
  const ctx = await getAuthContext();
  if (!ctx) return { tarih: null, temelAlan: null, altAlan: null, okunamadi: false };
  const { data, error } = await ctx.supabase
    .from("docentlik_profili").select("doktora_tarihi, temel_alan, alt_alan").eq("owner_id", ctx.user.id).maybeSingle();
  if (error) {
    console.error("[doçentlik] doktora bilgileri okunamadı", error.message);
    return { tarih: null, temelAlan: null, altAlan: null, okunamadi: true };
  }
  return { tarih: data?.doktora_tarihi ?? null, temelAlan: data?.temel_alan ?? null, altAlan: data?.alt_alan ?? null, okunamadi: false };
}

export async function doktoraTarihiKaydet(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };
  const tarih = String(formData.get("doktoraTarihi") ?? "").trim() || null;
  if (tarih && !/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return { error: "Tarih geçersiz." };
  const { error } = await ctx.supabase
    .from("docentlik_profili")
    .upsert(
      {
        owner_id: ctx.user.id,
        doktora_tarihi: tarih,
        temel_alan: String(formData.get("temelAlan") ?? "").trim().slice(0, 120) || null,
        // Alt alan temel alansız anlamsız: temel alan boşsa alt alan da boşalır.
        alt_alan: String(formData.get("temelAlan") ?? "").trim() ? String(formData.get("altAlan") ?? "").trim().slice(0, 160) || null : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_id" },
    );
  if (error) {
    console.error("[doçentlik] doktora bilgileri yazılamadı", error.message);
    return { error: "Bilgileriniz kaydedilemedi." };
  }
  revalidatePath(PAGE_PATH);
  return { success: true };
}

/*
  BELGE. Dosya tarayıcıdan doğrudan kullanıcının klasörüne yükleniyor
  (project-files/<sahip>/docentlik/…; depo politikası zaten "kendi
  klasörü"). Burada yalnızca yolun o klasörde olduğu ve dosyanın
  gerçekten PDF olduğu doğrulanıyor; eski belge silinir. Kaynak PDF'leriyle
  aynı akış (app/actions/kaynak-pdf.ts).
*/
export async function belgeYuklendi(entryId: string, yol: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };
  const { supabase, user } = ctx;
  if (!yol.startsWith(`${user.id}/docentlik/`) || yol.includes("..")) return { error: "Dosya yolu geçersiz." };

  const { data: dosya, error: indirmeHatasi } = await supabase.storage.from(KOVA).download(yol);
  if (indirmeHatasi || !dosya) {
    console.error("[doçentlik] yüklenen belge okunamadı", indirmeHatasi?.message);
    return { error: "Yüklenen dosya okunamadı; tekrar deneyin." };
  }
  if (!pdfMi(new Uint8Array(await dosya.arrayBuffer()))) {
    await supabase.storage.from(KOVA).remove([yol]);
    return { error: "Dosya PDF değil. Belgenin PDF'ini yükleyin." };
  }

  const { data: eski } = await supabase.from("academic_score_entries").select("belge_yolu").eq("id", entryId).eq("owner_id", user.id).maybeSingle();
  const { data, error } = await supabase
    .from("academic_score_entries")
    .update({ belge_yolu: yol })
    .eq("id", entryId)
    .eq("owner_id", user.id)
    .select("id");
  if (error || !data?.length) {
    console.error("[doçentlik] belge kaydedilemedi", error?.message);
    await supabase.storage.from(KOVA).remove([yol]);
    return { error: "Belge kaydedilemedi; tekrar deneyin." };
  }
  // Eski dosya artık hiçbir kayda bağlı değil. Silinemezse yalnızca yer kaplar; akış düşmez.
  if (eski?.belge_yolu && eski.belge_yolu !== yol) {
    const { error: silmeHatasi } = await supabase.storage.from(KOVA).remove([eski.belge_yolu]);
    if (silmeHatasi) console.error("[doçentlik] eski belge silinemedi", silmeHatasi.message);
  }
  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function belgeKaldir(entryId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  const { supabase, user } = ctx;
  const { data: kayit, error: okumaHatasi } = await supabase
    .from("academic_score_entries").select("belge_yolu").eq("id", entryId).eq("owner_id", user.id).maybeSingle();
  if (okumaHatasi || !kayit) return { error: "Kayıt bulunamadı." };
  const { error } = await supabase.from("academic_score_entries").update({ belge_yolu: null }).eq("id", entryId).eq("owner_id", user.id);
  if (error) {
    console.error("[doçentlik] belge kaldırılamadı", error.message);
    return { error: "Belge kaldırılamadı." };
  }
  if (kayit.belge_yolu) {
    const { error: silmeHatasi } = await supabase.storage.from(KOVA).remove([kayit.belge_yolu]);
    if (silmeHatasi) console.error("[doçentlik] belge dosyası silinemedi", silmeHatasi.message);
  }
  revalidatePath(PAGE_PATH);
  return { success: true };
}
