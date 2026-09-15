import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getManuscript } from "@/app/actions/manuscript";
import { loadAppliedGuideline } from "@/lib/guideline-rules";
import { refreshImageUrls } from "@/lib/manuscript-images";
import { buildPrintSheet } from "@/lib/print-sheet";
import ManuscriptSheet from "../manuscript-sheet";
import PrintActions from "./print-actions";

export const metadata: Metadata = { title: "Yazdır · ArvoLab", robots: { index: false } };

// Yazdırmaya hazır A4 görünümü: kılavuzun yazı tipi, boyutu, satır aralığı ve
// metnin kenar boşlukları; tarayıcının yazdır penceresinden "PDF olarak kaydet".
export default async function PrintManuscriptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const [{ id }, { auto }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("academic_projects")
    .select("id, title, guideline_id, owner_id, assignee_id")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const [manuscript, guideline] = await Promise.all([getManuscript(id), loadAppliedGuideline(supabase, project.guideline_id)]);
  // Resim bağlantıları depo yolundan tazelenir (süresi dolmuş imzalı bağlantılar çıktıda kaybolmasın).
  const doc = manuscript ? await refreshImageUrls(manuscript.content, [project.owner_id, project.assignee_id]) : null;
  const sheet = buildPrintSheet(manuscript, guideline, doc);

  return (
    <div className="print-page">
      <PrintActions backHref={`/dashboard/editor/${id}/write`} autoPrint={auto === "1"} />
      <ManuscriptSheet title={project.title ?? ""} sheet={sheet} />
    </div>
  );
}
