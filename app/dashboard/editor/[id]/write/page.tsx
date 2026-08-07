import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// Resim yükleme büyük dosyalarda zaman alabilir.
export const maxDuration = 60;
import { getManuscript } from "@/app/actions/manuscript";
import ManuscriptEditor from "./manuscript-editor";

export default async function WriteManuscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("academic_projects")
    .select("id, title, guideline_id")
    .eq("id", id)
    .single();

  let requiredSections: string[] = [];
  if (project?.guideline_id) {
    const { data: guideline } = await supabase
      .from("thesis_guidelines")
      .select("required_sections")
      .eq("id", project.guideline_id)
      .single();
    requiredSections = guideline?.required_sections ?? [];
  }

  const manuscript = await getManuscript(id);

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
        initialMargins={manuscript?.margins}
      />
    </main>
  );
}
