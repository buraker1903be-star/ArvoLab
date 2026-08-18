"use server";

import { createClient } from "@/lib/supabase/server";
import {
  parseReferenceList,
  extractInTextCitations,
  crossCheck,
  computeComplianceScore,
} from "@/lib/apa7";
import { verifyAcademicReferences } from "@/lib/academic-reference-verification";

export async function getMyProjects() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("academic_projects")
    .select("id, title, university")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}

export async function runCitationCheck(input: {
  projectId: string | null;
  projectTitle: string | null;
  referenceList: string;
  bodyText: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
  }

  const references = parseReferenceList(input.referenceList);
  if (references.length === 0) {
    return { error: "Doğrulanabilecek bir kaynakça girdisi bulunamadı." };
  }
  if (references.length > 25) {
    return { error: "Tek kontrolde en fazla 25 kaynak doğrulanabilir." };
  }

  const citations = input.bodyText ? extractInTextCitations(input.bodyText) : [];
  const cross = crossCheck(citations, references);
  const score = computeComplianceScore(references, cross);
  const academicVerification = await verifyAcademicReferences(references);
  const verificationSummary = {
    verified: academicVerification.filter((item) => item.status === "verified").length,
    possible: academicVerification.filter((item) => item.status === "possible_match").length,
    notFound: academicVerification.filter((item) => item.status === "not_found").length,
    insufficientData: academicVerification.filter((item) => item.status === "insufficient_data").length,
  };

  const { error } = await supabase.from("citation_checks").insert({
    project_id: input.projectId,
    project_title: input.projectTitle,
    raw_reference_list: input.referenceList,
    body_text: input.bodyText || null,
    parsed_references: references,
    in_text_citations: citations,
    cross_check: { ...cross, academicVerification, verificationSummary },
    compliance_score: score,
    created_by: user.id,
  });

  if (error) {
    console.error(error);
    return { error: "Sonuç kaydedilirken bir hata oluştu." };
  }

  return {
    references,
    citations,
    crossCheck: cross,
    complianceScore: score,
    academicVerification,
    verificationSummary,
  };
}

export async function getMyCitationChecks() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("citation_checks")
    .select("id, project_title, compliance_score, created_at, project_id")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return [];
  }
  return data ?? [];
}
