"use server";

import { createClient } from "@/lib/supabase/server";
import { extractPlainText, extractHeadings, countWords, type TiptapDoc } from "@/lib/tiptap-text";
import { splitBodyAndReferences } from "@/lib/text-split";
import {
  parseReferenceList,
  extractInTextCitations,
  crossCheck,
  computeComplianceScore,
} from "@/lib/apa7";
import { checkGuidelineCompliance } from "@/lib/guideline-check";

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ManuscriptData {
  content: TiptapDoc;
  wordCount: number;
  updatedAt: string;
  margins: PageMargins;
}

export async function getManuscript(projectId: string): Promise<ManuscriptData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_manuscripts")
    .select("content, word_count, updated_at, margin_top_cm, margin_bottom_cm, margin_left_cm, margin_right_cm")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }
  if (!data) return null;

  return {
    content: data.content as TiptapDoc,
    wordCount: data.word_count,
    updatedAt: data.updated_at,
    margins: {
      top: data.margin_top_cm ?? 2.5,
      bottom: data.margin_bottom_cm ?? 2.5,
      left: data.margin_left_cm ?? 2.5,
      right: data.margin_right_cm ?? 2.5,
    },
  };
}

export async function saveManuscript(projectId: string, content: TiptapDoc, margins?: PageMargins) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const plainText = extractPlainText(content);
  const wordCount = countWords(content);

  const { error } = await supabase.from("project_manuscripts").upsert(
    {
      project_id: projectId,
      content,
      plain_text: plainText,
      word_count: wordCount,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
      ...(margins
        ? {
            margin_top_cm: margins.top,
            margin_bottom_cm: margins.bottom,
            margin_left_cm: margins.left,
            margin_right_cm: margins.right,
          }
        : {}),
    },
    { onConflict: "project_id" }
  );

  if (error) {
    console.error(error);
    return { error: "Kaydedilirken bir hata oluştu." };
  }

  return { success: true, wordCount };
}

// NOT: Resim yükleme artık burada değil, doğrudan tarayıcıda
// (manuscript-editor.tsx) yapılıyor — Vercel'in sunucu fonksiyonu
// istek boyutu sınırını (~4.5 MB, aşılamaz) atlamak için. Bkz.
// document-upload.ts'teki aynı mimari not.

export interface ManuscriptCheckResult {
  wordCount: number;
  guidelineCompliance: ReturnType<typeof checkGuidelineCompliance> | null;
  apa7: {
    referenceSectionFound: boolean;
    complianceScore: number | null;
    references: ReturnType<typeof parseReferenceList>;
    crossCheck: ReturnType<typeof crossCheck>;
  };
}

export async function runManuscriptCheck(projectId: string): Promise<{ error?: string; result?: ManuscriptCheckResult }> {
  const supabase = await createClient();

  const { data: manuscript, error: manuscriptError } = await supabase
    .from("project_manuscripts")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle();

  if (manuscriptError || !manuscript) {
    return { error: "Önce çalışmayı kaydedin, sonra kontrol edin." };
  }

  const { data: project } = await supabase
    .from("academic_projects")
    .select("guideline_id, citation_style")
    .eq("id", projectId)
    .single();

  const content = manuscript.content as TiptapDoc;
  const fullText = extractPlainText(content);
  const split = splitBodyAndReferences(fullText);

  let guidelineCompliance: ReturnType<typeof checkGuidelineCompliance> | null = null;
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

  let apa7Result: ManuscriptCheckResult["apa7"];
  if (split.referenceText.trim().length > 0) {
    const references = parseReferenceList(split.referenceText);
    const citations = extractInTextCitations(split.bodyText);
    const cross = crossCheck(citations, references);
    const score = computeComplianceScore(references, cross);
    apa7Result = { referenceSectionFound: true, complianceScore: score, references, crossCheck: cross };
  } else {
    apa7Result = {
      referenceSectionFound: false,
      complianceScore: null,
      references: [],
      crossCheck: { citationsWithoutReference: [], referencesWithoutCitation: [] },
    };
  }

  return {
    result: {
      wordCount: countWords(content),
      guidelineCompliance,
      apa7: apa7Result,
    },
  };
}

export async function getManuscriptHeadings(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("project_manuscripts")
    .select("content")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!data) return [];
  return extractHeadings(data.content as TiptapDoc);
}
