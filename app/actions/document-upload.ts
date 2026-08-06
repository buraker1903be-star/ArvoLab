"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { detectDocType, extractTextFromBuffer, splitBodyAndReferences } from "@/lib/document-extract";
import {
  parseReferenceList,
  extractInTextCitations,
  crossCheck,
  computeComplianceScore,
} from "@/lib/apa7";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export interface UploadResult {
  error?: string;
  documentId?: string;
  analysis?: {
    complianceScore: number | null;
    referenceSectionFound: boolean;
    references: unknown[];
    crossCheck: {
      citationsWithoutReference: unknown[];
      referencesWithoutCitation: unknown[];
    };
  };
}

export async function uploadAndAnalyzeDocument(formData: FormData): Promise<UploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Lütfen bir dosya seçin." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "Dosya boyutu 20 MB sınırını aşıyor." };
  }

  const docType = detectDocType(file.name, file.type);
  if (!docType) {
    return { error: "Yalnızca .docx ve .pdf dosyaları desteklenir." };
  }

  const projectId = String(formData.get("projectId") ?? "").trim() || null;
  const projectTitle = String(formData.get("projectTitle") ?? "").trim() || null;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 1) Storage'a yükle
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${user.id}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("project-files")
    .upload(storagePath, buffer, {
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    console.error(uploadError);
    return { error: "Dosya depolamaya yüklenirken hata oluştu." };
  }

  // 2) Metni çıkar ve analiz et
  let extractedText = "";
  let status: "analyzed" | "failed" = "analyzed";
  let errorMessage: string | null = null;
  let analysis: Record<string, unknown> | null = null;
  let referenceText = "";

  try {
    extractedText = await extractTextFromBuffer(buffer, docType);
    const split = splitBodyAndReferences(extractedText);
    referenceText = split.referenceText;

    if (referenceText.trim().length > 0) {
      const references = parseReferenceList(referenceText);
      const citations = extractInTextCitations(split.bodyText);
      const cross = crossCheck(citations, references);
      const score = computeComplianceScore(references, cross);
      analysis = {
        references,
        citations,
        crossCheck: cross,
        complianceScore: score,
        referenceSectionFound: true,
      };
    } else {
      analysis = {
        references: [],
        citations: [],
        crossCheck: { citationsWithoutReference: [], referencesWithoutCitation: [] },
        complianceScore: null,
        referenceSectionFound: false,
      };
    }
  } catch (err) {
    console.error(err);
    status = "failed";
    errorMessage = "Dosyadan metin çıkarılırken bir hata oluştu.";
  }

  // 3) Kayıt oluştur
  const { data: inserted, error: insertError } = await supabase
    .from("document_uploads")
    .insert({
      project_id: projectId,
      project_title: projectTitle,
      uploaded_by: user.id,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size: file.size,
      extracted_text: extractedText || null,
      reference_text: referenceText || null,
      analysis,
      status,
      error_message: errorMessage,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error(insertError);
    return { error: "Analiz sonucu kaydedilirken hata oluştu." };
  }

  revalidatePath("/dashboard/documents");
  return {
    documentId: inserted?.id,
    analysis: analysis as UploadResult["analysis"],
  };
}

export interface DocumentUploadRecord {
  id: string;
  project_title: string | null;
  file_name: string;
  status: "processing" | "analyzed" | "failed";
  error_message: string | null;
  analysis: {
    complianceScore: number | null;
    referenceSectionFound: boolean;
    references: { raw: string; issues: { field: string; message: string; severity: string }[] }[];
    crossCheck: {
      citationsWithoutReference: { raw: string }[];
      referencesWithoutCitation: { raw: string }[];
    };
  } | null;
  created_at: string;
}

export async function getMyDocumentUploads(): Promise<DocumentUploadRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("document_uploads")
    .select("id, project_title, file_name, status, error_message, analysis, created_at")
    .eq("uploaded_by", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error(error);
    return [];
  }
  return (data ?? []) as DocumentUploadRecord[];
}
