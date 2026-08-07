"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { detectDocType, extractTextFromBuffer, splitBodyAndReferences } from "@/lib/document-extract";
import { checkGuidelineCompliance, type GuidelineComplianceResult } from "@/lib/guideline-check";
import {
  parseReferenceList,
  extractInTextCitations,
  crossCheck,
  computeComplianceScore,
} from "@/lib/apa7";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB — Supabase Storage tarafındaki gerçek sınır

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
    guidelineCompliance?: GuidelineComplianceResult | null;
  };
}

/**
 * ÖNEMLİ MİMARİ NOT:
 * Dosyanın kendisi bu server action'a GÖNDERİLMEZ. Vercel'in
 * sunucu fonksiyonlarında platform seviyesinde, next.config.ts
 * ile aşılamayan sabit bir istek boyutu sınırı (~4.5 MB) vardır;
 * gerçek bir tez/makale dosyası bunu kolayca aşar ve
 * "413 FUNCTION_PAYLOAD_TOO_LARGE" hatasına yol açar.
 *
 * Bunun yerine: dosya, TARAYICIDAN DOĞRUDAN Supabase Storage'a
 * yüklenir (bkz. document-upload-form.tsx — browser Supabase
 * istemcisi kullanır). Bu server action'a yalnızca depolama
 * yolu (storagePath) gibi küçük metin verileri gelir; dosyanın
 * kendisini bu fonksiyon Supabase'ten SUNUCU TARAFINDA indirir
 * (bu, gelen istek boyutu sınırına tabi değildir).
 */
export async function analyzeUploadedDocument(params: {
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  projectId: string | null;
  projectTitle: string | null;
}): Promise<UploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
  }

  if (params.fileSize > MAX_FILE_SIZE) {
    return { error: "Dosya boyutu 20 MB sınırını aşıyor." };
  }

  const docType = detectDocType(params.fileName, params.mimeType);
  if (!docType) {
    return { error: "Yalnızca .docx ve .pdf dosyaları desteklenir." };
  }

  // Dosyayı Supabase Storage'dan SUNUCU TARAFINDA indir
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("project-files")
    .download(params.storagePath);

  if (downloadError || !fileBlob) {
    console.error(downloadError);
    return { error: "Yüklenen dosya depodan okunamadı." };
  }

  const arrayBuffer = await fileBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let extractedText = "";
  let status: "analyzed" | "failed" = "analyzed";
  let errorMessage: string | null = null;
  let analysis: Record<string, unknown> | null = null;
  let referenceText = "";

  try {
    extractedText = await extractTextFromBuffer(buffer, docType);
    const split = splitBodyAndReferences(extractedText);
    referenceText = split.referenceText;

    let guidelineCompliance: GuidelineComplianceResult | null = null;
    if (params.projectId) {
      const { data: project } = await supabase
        .from("academic_projects")
        .select("guideline_id, citation_style")
        .eq("id", params.projectId)
        .single();

      if (project?.guideline_id) {
        const { data: guideline } = await supabase
          .from("thesis_guidelines")
          .select("required_sections, citation_style")
          .eq("id", project.guideline_id)
          .single();

        if (guideline) {
          guidelineCompliance = checkGuidelineCompliance(
            split.bodyText,
            guideline.required_sections ?? [],
            guideline.citation_style,
            project.citation_style ?? null
          );
        }
      }
    }

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
        guidelineCompliance,
      };
    } else {
      analysis = {
        references: [],
        citations: [],
        crossCheck: { citationsWithoutReference: [], referencesWithoutCitation: [] },
        complianceScore: null,
        referenceSectionFound: false,
        guidelineCompliance,
      };
    }
  } catch (err) {
    console.error(err);
    status = "failed";
    errorMessage = "Dosyadan metin çıkarılırken bir hata oluştu.";
  }

  const { data: inserted, error: insertError } = await supabase
    .from("document_uploads")
    .insert({
      project_id: params.projectId,
      project_title: params.projectTitle,
      uploaded_by: user.id,
      file_name: params.fileName,
      storage_path: params.storagePath,
      mime_type: params.mimeType || null,
      file_size: params.fileSize,
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
    guidelineCompliance?: GuidelineComplianceResult | null;
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
