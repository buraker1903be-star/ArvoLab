import Link from "next/link";
import { CalendarDays, Plus, UserRound } from "lucide-react";
import { getProjects } from "@/app/actions/projects";
import { projectTypeLabel, statusLabel } from "@/lib/project-labels";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Teslim tarihi belirtilmedi";
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ProjectsPage() {
  const projects = await getProjects();

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Akademik operasyon</span>
          <h1 className="brand-type">Akademik Çalışmalar</h1>
          <p>Tez, makale, proje ve analiz çalışmalarını tek merkezden yönetin.</p>
        </div>
        <Link href="/dashboard/projects/new" className="projects-primary-button">
          <Plus size={18} />
          Yeni çalışma
        </Link>
      </section>

      {projects.length === 0 ? (
        <section className="project-form-card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <p style={{ margin: 0, color: "var(--muted-foreground)" }}>
            Henüz kayıtlı bir çalışma yok.
          </p>
          <Link
            href="/dashboard/projects/new"
            className="projects-primary-button"
            style={{ display: "inline-flex", marginTop: 16 }}
          >
            <Plus size={18} />
            İlk çalışmayı oluştur
          </Link>
        </section>
      ) : (
        <section className="projects-list" aria-label="Akademik çalışma listesi">
          {projects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-main">
                <div>
                  <span className="project-status">{statusLabel(project.status)}</span>
                  <h2>{project.title}</h2>
                  <p>
                    {projectTypeLabel(project.project_type)}
                    {project.university ? ` · ${project.university}` : ""}
                  </p>
                </div>
                <div className="project-progress" aria-label={`İlerleme yüzde ${project.progress}`}>
                  <strong>%{project.progress}</strong>
                  <div className="project-progress-track">
                    <span style={{ width: `${project.progress}%` }} />
                  </div>
                </div>
              </div>

              <div className="project-card-meta">
                <span>
                  <UserRound size={15} />
                  {project.assignee_name || "Sorumlu atanmadı"}
                </span>
                <span>
                  <CalendarDays size={15} />
                  {formatDate(project.due_date)}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
