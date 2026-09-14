import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  MessageSquare,
  PenLine,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProjects, approveProject, revokeApproval, assignProject, getAssignableStaff } from "@/app/actions/projects";
import { projectTypeLabel, statusLabel, isOversightRole, ROLE_LABELS } from "@/lib/project-labels";
import { getCurrentProfile } from "@/app/actions/profile";
import DeleteProjectButton from "./delete-project-button";
import ActionForm from "../action-form";
import { statusTone } from "@/lib/status-tone";

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

function relativeTime(dateStr: string) {
  const minutes = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.round(hours / 24);
  if (days === 1) return "dün";
  if (days < 7) return `${days} gün önce`;
  return formatDateTime(dateStr);
}

interface WritingStats {
  words: number;
  updatedAt: string;
}

// Kartlarda yazım durumu: kelime sayısı, son düzenleme ve başkalarından gelen açık yorumlar.
async function getWritingStats(projectIds: string[], currentUserId: string | undefined) {
  const stats = new Map<string, WritingStats>();
  const openComments = new Map<string, number>();
  if (projectIds.length === 0) return { stats, openComments };

  const supabase = await createClient();
  const [manuscripts, comments] = await Promise.all([
    supabase.from("project_manuscripts").select("project_id, word_count, updated_at").in("project_id", projectIds),
    supabase.from("manuscript_comments").select("project_id, author_id").in("project_id", projectIds).is("resolved_at", null),
  ]);
  for (const row of manuscripts.data ?? []) stats.set(row.project_id, { words: row.word_count ?? 0, updatedAt: row.updated_at });
  for (const row of comments.data ?? []) {
    if (row.author_id === currentUserId) continue;
    openComments.set(row.project_id, (openComments.get(row.project_id) ?? 0) + 1);
  }
  return { stats, openComments };
}

export default async function ProjectsPage() {
  const [projects, profile] = await Promise.all([getProjects(), getCurrentProfile()]);
  const { stats, openComments } = await getWritingStats(
    projects.map((project) => project.id),
    profile?.id
  );
  const canApprove = isOversightRole(profile?.role);
  const staff = canApprove ? await getAssignableStaff() : [];
  // Silme yetkisi RLS ile aynı: sahibi ya da Akademik Yönetici/Sistem
  // Yöneticisi/Kurucu (Kontrolör silme yetkisine sahip DEĞİL).
  const canDeleteAnyProject =
    profile?.role === "academic_manager" || profile?.role === "system_admin" || profile?.role === "founder";

  async function handleApprove(projectId: string) {
    "use server";
    return approveProject(projectId);
  }

  async function handleRevoke(projectId: string) {
    "use server";
    return revokeApproval(projectId);
  }

  async function handleAssign(projectId: string, formData: FormData) {
    "use server";
    const assigneeId = String(formData.get("assigneeId") ?? "");
    return assignProject(projectId, assigneeId);
  }

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">Belge editörü</span>
          <h1>Çalışmalarım</h1>
          <p>Tez, makale, proje ve analiz çalışmalarınızı buradan oluşturun, panelde yazın ve yönetin.</p>
        </div>
        <Link href="/dashboard/editor/new" className="projects-primary-button">
          <Plus size={18} aria-hidden="true" />
          Yeni çalışma
        </Link>
      </section>

      {projects.length === 0 ? (
        <section className="empty-state">
          <p>Henüz kayıtlı bir çalışma yok.</p>
          <Link href="/dashboard/editor/new" className="projects-primary-button">
            <Plus size={18} aria-hidden="true" />
            İlk çalışmayı oluştur
          </Link>
        </section>
      ) : (
        <section className="projects-list" aria-label="Akademik çalışma listesi">
          {projects.map((project) => {
            const isApproved = !!project.controller_approved_at;
            const canEdit = canApprove || profile?.id === project.owner_id || profile?.id === project.assignee_id;
            // Eski kayıtlarda sorumlu yalnızca serbest metin olarak tutuluyordu (assignee_id boş).
            const legacyAssignee = !project.assignee_id && project.assignee_name;
            return (
              <article className="project-card" key={project.id}>
                <div className="project-card-main">
                  <div>
                    <span className="status-pill" data-tone={statusTone(project.status)}>
                      {statusLabel(project.status)}
                    </span>
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
                    <UserRound size={15} aria-hidden="true" />
                    {project.assignee_name || "Sorumlu atanmadı"}
                  </span>
                  <span>
                    <CalendarDays size={15} aria-hidden="true" />
                    {formatDate(project.due_date)}
                  </span>
                  <span>
                    <FileText size={15} aria-hidden="true" />
                    {stats.has(project.id)
                      ? `${stats.get(project.id)!.words.toLocaleString("tr-TR")} kelime · ${relativeTime(stats.get(project.id)!.updatedAt)} düzenlendi`
                      : "Henüz yazılmadı"}
                  </span>
                  {openComments.get(project.id) ? (
                    <Link href={`/dashboard/editor/${project.id}/write`} className="tone-text" data-tone="warning">
                      <MessageSquare size={15} aria-hidden="true" />
                      {openComments.get(project.id)} açık yorum
                    </Link>
                  ) : null}

                  {isApproved ? (
                    <span className="tone-text" data-tone="success">
                      <ShieldCheck size={15} aria-hidden="true" />
                      Kontrolör onayı verildi{project.controller_approved_at ? ` · ${formatDateTime(project.controller_approved_at)}` : ""}
                    </span>
                  ) : null}
                </div>

                {canApprove ? (
                  <div className="cluster cluster-lg cluster-spaced">
                    {isApproved ? (
                      <ActionForm action={handleRevoke.bind(null, project.id)}>
                        <button type="submit" className="projects-filter-button">
                          <RotateCcw size={15} aria-hidden="true" />
                          Onayı geri al
                        </button>
                      </ActionForm>
                    ) : (
                      <ActionForm action={handleApprove.bind(null, project.id)}>
                        <button type="submit" className="projects-primary-button">
                          <CheckCircle2 size={15} aria-hidden="true" />
                          Kontrolör olarak onayla
                        </button>
                      </ActionForm>
                    )}
                  </div>
                ) : null}

                {canApprove ? (
                  <ActionForm
                    action={handleAssign.bind(null, project.id)}
                    className="cluster mt-sm"
                    successMessage="Sorumlu kaydedildi."
                  >
                    <select
                      name="assigneeId"
                      defaultValue={project.assignee_id ?? ""}
                      aria-label="Sorumlu personel"
                      className="compact-select grow-select"
                    >
                      <option value="">{legacyAssignee ? `${project.assignee_name} (listede değil)` : "Sorumlu atanmadı"}</option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.full_name || "İsimsiz personel"} · {ROLE_LABELS[member.role]}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="projects-filter-button button-compact">
                      <UserRound size={14} aria-hidden="true" />
                      Ata
                    </button>
                  </ActionForm>
                ) : null}

                <div className="cluster cluster-lg cluster-spaced">
                  <Link href={`/dashboard/editor/${project.id}/write`} className="projects-primary-button">
                    <PenLine size={15} aria-hidden="true" />
                    Panelde Yaz
                  </Link>
                  {canEdit ? (
                    <Link href={`/dashboard/editor/${project.id}/edit`} className="projects-filter-button">
                      <Pencil size={15} aria-hidden="true" />
                      Düzenle
                    </Link>
                  ) : null}
                  <Link href="/dashboard/documents" className="projects-filter-button">
                    <Upload size={15} aria-hidden="true" />
                    Hazır Belge Yükle
                  </Link>
                  {(profile?.id === project.owner_id || canDeleteAnyProject) && (
                    <DeleteProjectButton projectId={project.id} projectTitle={project.title} />
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
