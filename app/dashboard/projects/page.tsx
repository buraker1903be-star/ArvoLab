import Link from "next/link";
import { CalendarDays, CheckCircle2, PenLine, Plus, RotateCcw, ShieldCheck, Upload, UserRound } from "lucide-react";
import { getProjects, approveProject, revokeApproval } from "@/app/actions/projects";
import { projectTypeLabel, statusLabel, isOversightRole } from "@/lib/project-labels";
import { getCurrentProfile } from "@/app/actions/profile";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Teslim tarihi belirtilmedi";
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("tr-TR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ProjectsPage() {
  const [projects, profile] = await Promise.all([getProjects(), getCurrentProfile()]);
  const canApprove = isOversightRole(profile?.role);

  async function handleApprove(projectId: string) {
    "use server";
    await approveProject(projectId);
  }

  async function handleRevoke(projectId: string) {
    "use server";
    await revokeApproval(projectId);
  }

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
          {projects.map((project) => {
            const isApproved = !!project.controller_approved_at;
            return (
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

                  {isApproved ? (
                    <span style={{ color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <ShieldCheck size={15} />
                      Kontrolör onayı verildi{project.controller_approved_at ? ` · ${formatDateTime(project.controller_approved_at)}` : ""}
                    </span>
                  ) : null}
                </div>

                {canApprove ? (
                  <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {isApproved ? (
                      <form action={handleRevoke.bind(null, project.id)}>
                        <button type="submit" className="projects-filter-button">
                          <RotateCcw size={15} />
                          Onayı geri al
                        </button>
                      </form>
                    ) : (
                      <form action={handleApprove.bind(null, project.id)}>
                        <button type="submit" className="projects-primary-button">
                          <CheckCircle2 size={15} />
                          Kontrolör olarak onayla
                        </button>
                      </form>
                    )}
                  </div>
                ) : null}

                <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link href={`/dashboard/projects/${project.id}/write`} className="projects-primary-button">
                    <PenLine size={15} />
                    Panelde Yaz
                  </Link>
                  <Link href="/dashboard/documents" className="projects-filter-button">
                    <Upload size={15} />
                    Hazır Belge Yükle
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
