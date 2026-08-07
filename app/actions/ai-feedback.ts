"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDocumentFeedback } from "@/lib/ai-feedback";

export interface AiFeedbackResponse {
  error?: string;
  feedback?: string;
  truncated?: boolean;
}

export async function requestAiFeedback(documentId: string): Promise<AiFeedbackResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: doc, error: docError } = await supabase
    .from("document_uploads")
    .select("extracted_text")
    .eq("id", documentId)
    .single();

  if (docError || !doc?.extracted_text) {
    return { error: "Bu belge için çıkarılmış metin bulunamadı. Önce belgeyi yükleyip analiz ettirin." };
  }

  try {
    const result = await getDocumentFeedback(doc.extracted_text);

    await supabase.from("ai_feedback_requests").insert({
      document_id: documentId,
      requested_by: user.id,
      feedback_text: result.feedback,
      model: result.model,
      status: "completed",
    });

    revalidatePath("/dashboard/documents");
    return { feedback: result.feedback, truncated: result.truncated };
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "AI geri bildirimi alınırken bir hata oluştu.";

    await supabase.from("ai_feedback_requests").insert({
      document_id: documentId,
      requested_by: user.id,
      status: "failed",
      error_message: message,
    });

    return { error: message };
  }
}

export interface AiFeedbackRecord {
  id: string;
  feedback_text: string | null;
  status: "processing" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
}

export async function getLatestFeedback(documentId: string): Promise<AiFeedbackRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_feedback_requests")
    .select("id, feedback_text, status, error_message, created_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }
  return data;
}
