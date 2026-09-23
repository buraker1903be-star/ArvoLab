"use server";

import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { CROSSREF_USER_AGENT, crossrefWorkUrl, normalizeDoi, parseCrossrefWork, type DoiMetadata } from "@/lib/doi";
import { isSubscriptionBlocked, SUBSCRIPTION_BLOCKED_MESSAGE } from "@/lib/access";

const PAGE_PATH = "/dashboard/literature";
const STATUSES = ["to_review", "read", "used"];
const SOURCE_TYPES = ["article", "book", "chapter", "thesis", "report", "website", "other"];

export interface LiteratureSource {
  id: string;
  project_id: string | null;
  title: string;
  authors: string | null;
  year: string | null;
  source_type: string;
  doi_or_url: string | null;
  status: "to_review" | "read" | "used";
  notes: string | null;
  created_at: string;
  /** Yayın bilgileri (migration 20260917090000 ile) */
  container_title?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  publisher?: string | null;
}

/*
  Okuma başarısızsa BOŞ LİSTE değil "okunamadı" dönüyor. Eskiden hata
  konsola gidiyor, kullanıcıya "Henüz kaynak yok" ekranı çıkıyordu —
  yani topladığı literatürü kaybettiğini sanıyordu (lib/liste-sonucu.ts).
*/
export async function getLiteratureSources(): Promise<ListeSonucu<LiteratureSource>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return listeBasarili([]);

  // "*": yayın bilgisi kolonları henüz eklenmemiş veritabanlarında da çalışır.
  const { data, error } = await supabase
    .from("literature_sources")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

const text = (value: unknown, max: number) => {
  const result = String(value ?? "").trim().slice(0, max);
  return result || null;
};

/** Yayın bilgisi alanları (formdan ya da atıf penceresinden) */
function publicationFields(get: (name: string) => unknown) {
  return {
    container_title: text(get("containerTitle"), 500),
    volume: text(get("volume"), 40),
    issue: text(get("issue"), 40),
    pages: text(get("pages"), 40),
    publisher: text(get("publisher"), 300),
  };
}

const isMissingColumn = (error: { code?: string } | null) => error?.code === "PGRST204" || error?.code === "42703";

export async function createLiteratureSource(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  /* Abonelik kapısı: Yeni kaynak eklemek içerik üretir. Okuma, güncelleme ve silme
     açık kalır: mevcut kaynaklarını yönetebilmeli. */
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Kaynak başlığı zorunludur." };

  const sourceType = String(formData.get("sourceType") ?? "article");
  const status = String(formData.get("status") ?? "to_review");

  const row = {
    owner_id: ctx.user.id,
    project_id: String(formData.get("projectId") ?? "").trim() || null,
    title,
    authors: String(formData.get("authors") ?? "").trim() || null,
    year: String(formData.get("year") ?? "").trim() || null,
    source_type: SOURCE_TYPES.includes(sourceType) ? sourceType : "other",
    doi_or_url: String(formData.get("doiOrUrl") ?? "").trim() || null,
    status: STATUSES.includes(status) ? status : "to_review",
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
  let { error } = await ctx.supabase.from("literature_sources").insert({ ...row, ...publicationFields((name) => formData.get(name)) });
  // Migration öncesi veritabanı: yayın bilgileri olmadan kaydet.
  if (isMissingColumn(error)) ({ error } = await ctx.supabase.from("literature_sources").insert(row));

  if (error) {
    console.error(error);
    return { error: "Kaydedilirken bir hata oluştu." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function updateLiteratureStatus(sourceId: string, status: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  if (!STATUSES.includes(status)) return { error: "Geçersiz durum." };

  const { data, error } = await ctx.supabase
    .from("literature_sources")
    .update({ status })
    .eq("id", sourceId)
    .eq("owner_id", ctx.user.id)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Güncellenirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kaynak bulunamadı ya da size ait değil." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function updateLiteratureSource(sourceId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Kaynak başlığı zorunludur." };
  const sourceType = String(formData.get("sourceType") ?? "article");

  const row = {
    title,
    authors: String(formData.get("authors") ?? "").trim() || null,
    year: String(formData.get("year") ?? "").trim() || null,
    source_type: SOURCE_TYPES.includes(sourceType) ? sourceType : "other",
    doi_or_url: String(formData.get("doiOrUrl") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  };
  const update = (values: Record<string, unknown>) =>
    ctx.supabase.from("literature_sources").update(values).eq("id", sourceId).eq("owner_id", ctx.user.id).select("id");

  let { data, error } = await update({ ...row, ...publicationFields((name) => formData.get(name)) });
  if (isMissingColumn(error)) ({ data, error } = await update(row));

  if (error) {
    console.error(error);
    return { error: "Güncellenirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kaynak bulunamadı ya da size ait değil." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function deleteLiteratureSource(sourceId: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const { data, error } = await ctx.supabase
    .from("literature_sources")
    .delete()
    .eq("id", sourceId)
    .eq("owner_id", ctx.user.id)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Silinirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Kaynak bulunamadı ya da size ait değil." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}

/**
 * DOI ile kaynak bilgilerini Crossref'ten getirir. Sunucu yalnızca sabit Crossref adresine
 * istek atar (kullanıcı adresi değil, yalnızca doğrulanmış DOI gönderilir).
 */
export async function lookupDoi(input: string): Promise<{ error?: string; metadata?: DoiMetadata }> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const doi = normalizeDoi(input);
  if (!doi) return { error: "Geçerli bir DOI girin (ör. 10.1000/xyz123 ya da https://doi.org/…)." };

  try {
    const response = await fetch(crossrefWorkUrl(doi), {
      headers: { "User-Agent": CROSSREF_USER_AGENT },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (response.status === 404) return { error: "Bu DOI Crossref kayıtlarında bulunamadı." };
    if (!response.ok) return { error: "Kaynak bilgileri şu an alınamadı; birazdan yeniden deneyin." };
    const body = (await response.json()) as { message?: unknown };
    const metadata = parseCrossrefWork(body.message as Parameters<typeof parseCrossrefWork>[0], doi);
    return metadata ? { metadata } : { error: "Bu DOI için başlık bilgisi bulunamadı." };
  } catch (error) {
    console.error(error);
    return { error: "Kaynak bilgileri alınamadı (bağlantı zaman aşımı). Bilgileri elle de girebilirsiniz." };
  }
}

export interface CitationSourceInput {
  title: string;
  authors?: string | null;
  year?: string | null;
  sourceType?: string;
  doiOrUrl?: string | null;
  containerTitle?: string | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  publisher?: string | null;
  projectId?: string | null;
}

/** Atıf penceresinden yeni kaynak: literatür listesine "kullanıldı" olarak eklenir ve döner */
export async function createCitationSource(input: CitationSourceInput): Promise<{ error?: string; source?: LiteratureSource }> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;
  /* Abonelik kapısı: Atıf kaynağı da yeni içeriktir. */
  if (await isSubscriptionBlocked()) return { error: SUBSCRIPTION_BLOCKED_MESSAGE };

  const title = text(input.title, 500);
  if (!title) return { error: "Kaynak başlığı zorunludur." };
  const sourceType = SOURCE_TYPES.includes(input.sourceType ?? "") ? input.sourceType! : "article";
  const fields = input as unknown as Record<string, unknown>;

  const row = {
    owner_id: ctx.user.id,
    project_id: text(input.projectId, 64),
    title,
    authors: text(input.authors, 1000),
    year: text(input.year, 20),
    source_type: sourceType,
    doi_or_url: text(input.doiOrUrl, 500),
    status: "used",
    notes: null,
  };
  let { data, error } = await ctx.supabase
    .from("literature_sources")
    .insert({ ...row, ...publicationFields((name) => fields[name]) })
    .select("*")
    .single();
  if (isMissingColumn(error)) ({ data, error } = await ctx.supabase.from("literature_sources").insert(row).select("*").single());

  if (error || !data) {
    console.error(error);
    return { error: "Kaynak kaydedilemedi." };
  }
  revalidatePath(PAGE_PATH);
  return { source: data as LiteratureSource };
}
