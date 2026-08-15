import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// Resim yükleme büyük dosyalarda zaman alabilir.
export const maxDuration = 60;
import { getManuscript } from "@/app/actions/manuscript";
import ManuscriptEditor from "./manuscript-editor";
import { normalizeGuidelineEditorSettings } from "@/lib/guideline-editor-settings";

export default async function WriteManuscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("academic_projects")
    .select("id, title, guideline_id, university, institute, department, project_type")
    .eq("id", id)
    .single();

  let requiredSections: string[] = [];
  let guidelineLabel: string | null = null;
  let guidelineCitationStyle: string | null = null;
  let guidelineSettings = normalizeGuidelineEditorSettings(null);
  if (project?.guideline_id) {
    const { data: guideline } = await supabase
      .from("thesis_guidelines")
      .select("university_name, institute_name, document_title, version_label, citation_style, required_sections, extracted_rules, analysis_status")
      .eq("id", project.guideline_id)
      .single();
    if (guideline?.analysis_status === "approved") {
      requiredSections = guideline.required_sections ?? [];
      guidelineCitationStyle = guideline.citation_style;
      guidelineSettings = normalizeGuidelineEditorSettings(guideline.extracted_rules);
      guidelineLabel = guideline.document_title ?? `${guideline.university_name}${guideline.institute_name ? ` — ${guideline.institute_name}` : ""}${guideline.version_label ? ` (${guideline.version_label})` : ""}`;
    }
  }

  const manuscript = await getManuscript(id);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let authorFullName = "";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    authorFullName = profile?.full_name ?? "";
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Panelde yazma</span>
          <h1 className="brand-type">{project?.title ?? "Çalışma"}</h1>
          <p>
            Çalışmanızı burada kendiniz yazın. ArvoLab içerik üretmez;
            yalnızca &quot;Kontrol Et&quot; butonuna bastığınızda kılavuz
            uygunluğu ve kaynakça denetimi yapar.
          </p>
        </div>
        <Link href="/dashboard/editor" className="projects-filter-button">
          <ArrowLeft size={17} />
          Çalışmalara dön
        </Link>
      </section>

      <ManuscriptEditor
        projectId={id}
        initialContent={manuscript?.content ?? null}
        requiredSections={requiredSections}
        initialMargins={manuscript?.margins ?? guidelineSettings.margins}
        initialShowPageNumbers={manuscript?.showPageNumbers ?? guidelineSettings.showPageNumbers}
        initialCoverPage={manuscript?.coverPage}
        appliedGuideline={guidelineLabel ? {
          label: guidelineLabel,
          citationStyle: guidelineCitationStyle ?? "",
          settings: guidelineSettings,
          usedAsDefaults: !manuscript,
        } : null}
        projectDefaults={{
          title: project?.title ?? "",
          university: project?.university ?? "",
          institute: project?.institute ?? "",
          department: project?.department ?? "",
          authorName: authorFullName,
          projectType: project?.project_type ?? "thesis",
        }}
      />
    </main>
  );
}
