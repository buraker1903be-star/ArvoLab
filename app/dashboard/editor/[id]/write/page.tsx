import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getManuscript } from "@/app/actions/manuscript";
import { loadAppliedGuideline } from "@/lib/guideline-rules";
import { resolveGuidelineSync } from "@/lib/guideline-sync";
import ManuscriptEditor from "./manuscript-editor";

export default async function WriteManuscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("academic_projects")
    .select("id, title, guideline_id, university, institute, department, project_type")
    .eq("id", id)
    .maybeSingle();

  // Çalışma yoksa ya da kullanıcının erişimi yoksa (RLS) boş editör yerine 404.
  if (!project) notFound();

  const [guideline, manuscript, userResult] = await Promise.all([
    loadAppliedGuideline(supabase, project.guideline_id),
    getManuscript(id),
    supabase.auth.getUser(),
  ]);
  const sync = resolveGuidelineSync(guideline, manuscript);

  const user = userResult.data.user;
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
          <h1>{project.title ?? "Çalışma"}</h1>
          <p>
            Yazdıklarınız otomatik kaydedilir. ArvoLab içerik üretmez;
            &quot;Kontrol Et&quot; ile kılavuz uygunluğu ve kaynakça denetimi yapar.
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
        initialUpdatedAt={manuscript?.updatedAt ?? null}
        initialMargins={sync.margins}
        initialShowPageNumbers={sync.showPageNumbers}
        initialCoverPage={manuscript?.coverPage}
        guideline={guideline}
        guidelineSync={{ mode: sync.mode, source: sync.source }}
        editHref={`/dashboard/editor/${id}/edit`}
        projectDefaults={{
          title: project.title ?? "",
          university: project.university ?? "",
          institute: project.institute ?? "",
          department: project.department ?? "",
          authorName: authorFullName,
          projectType: project.project_type ?? "thesis",
        }}
      />
    </main>
  );
}
