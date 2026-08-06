"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildShingles, computeSimilarity } from "@/lib/similarity-check";

export interface OriginalityMatch {
  documentId: string;
  fileName: string;
  similarity: number;
  sampleOverlap: string | null;
}

export interface OriginalityCheckResult {
  error?: string;
  overallSimilarity?: number;
  comparedDocumentCount?: number;
  matches?: OriginalityMatch[];
}

// Bu tarama, kullanıcının ERİŞİM YETKİSİ OLDUĞU belge havuzuyla
// sınırlıdır (RLS tarafından belirlenir): normal kullanıcılar
// yalnızca kendi belgeleriyle, denetim rolündeki kullanıcılar ise
// kurumdaki tüm belgelerle karşılaştırma yapabilir. Turnitin'in
// dünya çapındaki veritabanının yerini TUTMAZ.
export async function runOriginalityCheck(documentId: string): Promise<OriginalityCheckResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Oturum bulunamadı." };
  }

  const { data: targetDoc, error: targetError } = await supabase
    .from("document_uploads")
    .select("id, file_name, extracted_text")
    .eq("id", documentId)
    .single();

  if (targetError || !targetDoc?.extracted_text) {
    return { error: "Belge metni bulunamadı. Önce belgeyi yükleyip analiz ettirin." };
  }

  // Erişilebilir tüm diğer analiz edilmiş belgeleri getir (RLS otomatik filtreler)
  const { data: candidates, error: candidatesError } = await supabase
    .from("document_uploads")
    .select("id, file_name, extracted_text")
    .eq("status", "analyzed")
    .not("extracted_text", "is", null)
    .neq("id", documentId)
    .limit(200);

  if (candidatesError) {
    console.error(candidatesError);
    return { error: "Karşılaştırma havuzu getirilirken hata oluştu." };
  }

  const targetShingles = buildShingles(targetDoc.extracted_text);

  const matches: OriginalityMatch[] = (candidates ?? [])
    .map((c) => {
      const candidateShingles = buildShingles(c.extracted_text ?? "");
      const result = computeSimilarity(targetShingles, candidateShingles);
      return {
        documentId: c.id,
        fileName: c.file_name,
        similarity: result.score,
        sampleOverlap: result.sampleOverlap,
      };
    })
    .filter((m) => m.similarity >= 10) // yalnızca anlamlı örtüşmeleri göster
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10);

  const overallSimilarity = matches.length > 0 ? matches[0].similarity : 0;

  const { error: insertError } = await supabase.from("originality_checks").insert({
    document_id: documentId,
    requested_by: user.id,
    overall_similarity: overallSimilarity,
    compared_document_count: candidates?.length ?? 0,
    matches,
  });

  if (insertError) {
    console.error(insertError);
    return { error: "Sonuç kaydedilirken bir hata oluştu." };
  }

  revalidatePath("/dashboard/documents");
  return {
    overallSimilarity,
    comparedDocumentCount: candidates?.length ?? 0,
    matches,
  };
}

export interface OriginalityCheckRecord {
  id: string;
  document_id: string;
  overall_similarity: number;
  compared_document_count: number;
  matches: OriginalityMatch[];
  created_at: string;
}

export async function getOriginalityChecksForDocument(documentId: string): Promise<OriginalityCheckRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("originality_checks")
    .select("id, document_id, overall_similarity, compared_document_count, matches, created_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}
