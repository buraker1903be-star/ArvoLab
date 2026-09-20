import Link from "next/link";
import { AlertTriangle, CalendarDays, CheckCircle2, FileText, LayoutDashboard, MessageSquare, PenLine, Pencil, Plus, RotateCcw, ShieldCheck, Upload, UserRound } from "lucide-react";
import { editedAgo, getWritingStats } from "@/lib/writing-stats";
import { createClient } from "@/lib/supabase/server";
import { loadAppliedGuidelines } from "@/lib/guideline-rules";
import { writingPace } from "@/lib/writing-pace";
import { dueInfo } from "@/lib/due-date";
import { getProjects, approveProject, revokeApproval, assignProject, getAssignableStaff } from "@/app/actions/projects";
import { projectTypeLabel, statusLabel, isOversightRole, ROLE_LABELS, PROJECT_STATUSES } from "@/lib/project-labels";
import { applyProjectFilters, isFiltered, parseProjectFilters } from "@/lib/project-filters";
import ProjectFilters from "./project-filters";
import { getCurrentProfile } from "@/app/actions/profile";
import DeleteProjectButton from "./delete-project-button";
import ActionForm from "../action-form";
import { statusTone } from "@/lib/status-tone";
import { topluTutarsizliklar } from "@/app/actions/calisma-merkezi";
import { taranacakCalismalar } from "@/lib/toplu-tutarsizlik";
import type { Tutarsizlik } from "@/lib/calisma-tutarlilik";
import { trTarihSaat, trUzunTarih } from "@/lib/tr-time";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Teslim tarihi belirtilmedi";
  return trUzunTarih(dateStr);
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "";
  return trTarihSaat(dateStr);
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ satirlar: projects, okunamadi }, profile, params] = await Promise.all([
    getProjects(),
    getCurrentProfile(),
    searchParams,
  ]);
  const [{ stats, openComments }, guidelines] = await Promise.all([
    getWritingStats(
      projects.map((project) => project.id),
      profile?.id
    ),
    // Kartlardaki yazım temposu için kılavuzlar tek sorguda
    createClient().then((supabase) => loadAppliedGuidelines(supabase, projects.map((project) => project.guideline_id))),
  ]);
  const canApprove = isOversightRole(profile?.role);
  // Arama, filtre ve sıralama (adres satırındaki ?q=…&durum=…&sirala=…&atanan=…)
  const filters = parseProjectFilters(params, PROJECT_STATUSES);
  const visible = applyProjectFilters(projects, filters, {
    lastEdited: (projectId) => stats.get(projectId)?.updatedAt,
    userId: profile?.id,
    canFilterAssignee: canApprove,
  });
  const staff = canApprove ? await getAssignableStaff() : [];

  /*
    Kontrolör onayı verirken metinle literatürün çelişip çelişmediğini
    ONAYDAN SONRA öğreniyordu (lib/onay-uyarisi.ts). Burada onaylamadan önce
    görsün. Tarama tam metin istediği için yalnızca onaysız ve yazılmış
    çalışmalarda, sınırlı sayıda yapılır (lib/toplu-tutarsizlik.ts); rozet
    çıkmaması "temiz" demek değil, kesin yargı çalışma merkezinde.
  */
  const tutarsizliklar: Map<string, Tutarsizlik[]> = canApprove
    ? await topluTutarsizliklar(
        taranacakCalismalar(
          visible.map((project) => ({
            id: project.id,
            onayli: !!project.controller_approved_at,
            kelime: stats.get(project.id)?.words ?? 0,
            guncellendi: stats.get(project.id)?.updatedAt ?? null,
          })),
        ),
      )
    : new Map();
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

      {okunamadi ? (
        /*
          Liste okunamadı. Eskiden burada da "henüz çalışmanız yok" yazıyordu;
          geçici bir arıza kullanıcıya tezini kaybettiğini düşündürüyordu.
        */
        <section className="alert" data-tone="danger" role="alert">
          <strong>Çalışmalarınız yüklenemedi.</strong>
          <p>
            Bu bir bağlantı ya da yetki arızası; kayıtlarınız yerinde duruyor. Sayfayı yenileyin, sorun
            sürerse Uygulama Destek&apos;ten bildirin.
          </p>
        </section>
      ) : projects.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            <FileText size={26} strokeWidth={1.6} />
          </span>
          <p>
            Henüz kayıtlı bir çalışma yok. Üniversitenizi seçerek başlayın; tez yazım kılavuzunuz editöre
            otomatik uygulanır, kaynakça sistemi ve sayfa düzeni sizin için hazırlanır.
          </p>
          <Link href="/dashboard/editor/new" className="projects-primary-button">
            <Plus size={18} aria-hidden="true" />
            İlk çalışmayı oluştur
          </Link>
        </section>
      ) : (
        <>
        <ProjectFilters
          key={JSON.stringify(filters)}
          filters={filters}
          statuses={PROJECT_STATUSES.map((status) => ({ value: status, label: statusLabel(status) }))}
          showAssignee={canApprove}
          total={projects.length}
          shown={visible.length}
          filtered={isFiltered(filters)}
        />
        {visible.length === 0 ? (
          <section className="empty-state">
            <p>Filtreye uyan çalışma yok.</p>
            <Link href="/dashboard/editor" className="projects-filter-button">
              Filtreyi temizle
            </Link>
          </section>
        ) : (
        <section className="projects-list" aria-label="Akademik çalışma listesi">
          {visible.map((project) => {
            const isApproved = !!project.controller_approved_at;
            const canEdit = canApprove || profile?.id === project.owner_id || profile?.id === project.assignee_id;
            // Eski kayıtlarda sorumlu yalnızca serbest metin olarak tutuluyordu (assignee_id boş).
            const legacyAssignee = !project.assignee_id && project.assignee_name;
            const due = dueInfo(project.due_date, project.status);
            const guideline = project.guideline_id ? guidelines.get(project.guideline_id) : undefined;
            const pace =
              guideline && stats.has(project.id)
                ? writingPace({
                    words: stats.get(project.id)!.words,
                    minPages: guideline.minPages,
                    maxPages: guideline.maxPages,
                    dueDate: project.due_date,
                    status: project.status,
                    settings: {
                      fontSizePt: guideline.settings.fontSizePt,
                      lineSpacing: guideline.settings.lineSpacing,
                      margins: guideline.settings.margins,
                    },
                  })
                : null;
            return (
              <article className="project-card" data-tone={statusTone(project.status)} key={project.id}>
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
                      <span style={{ "--w": `${project.progress}%` } as React.CSSProperties} />
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
                    {due ? (
                      <span className="chip" data-tone={due.tone}>
                        {due.label}
                      </span>
                    ) : null}
                  </span>
                  <span>
                    <FileText size={15} aria-hidden="true" />
                    {stats.has(project.id)
                      ? `${stats.get(project.id)!.words.toLocaleString("tr-TR")} kelime · ${editedAgo(stats.get(project.id)!.updatedAt)} düzenlendi`
                      : "Henüz yazılmadı"}
                    {pace?.perDay ? (
                      <span className="chip" data-tone={pace.tone} title={pace.detail}>
                        günde ~{pace.perDay.toLocaleString("tr-TR")} kelime
                      </span>
                    ) : pace && pace.remainingWords === 0 ? (
                      <span className="chip" data-tone="success">
                        Sayfa hedefine ulaşıldı
                      </span>
                    ) : null}
                  </span>
                  {openComments.get(project.id) ? (
                    <Link href={`/dashboard/editor/${project.id}/write`} className="tone-text" data-tone="warning">
                      <MessageSquare size={15} aria-hidden="true" />
                      {openComments.get(project.id)} açık yorum
                    </Link>
                  ) : null}

                  {tutarsizliklar.get(project.id)?.length ? (
                    <Link
                      href={`/dashboard/editor/${project.id}`}
                      className="tone-text"
                      data-tone="warning"
                      title={tutarsizliklar.get(project.id)!.map((t) => t.baslik).join(" · ")}
                    >
                      <AlertTriangle size={15} aria-hidden="true" />
                      {tutarsizliklar.get(project.id)!.length === 1
                        ? tutarsizliklar.get(project.id)![0].baslik
                        : `${tutarsizliklar.get(project.id)!.length} tutarsızlık`}
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
                      <ActionForm
                        action={handleRevoke.bind(null, project.id)}
                        /* Onayı iptal eden düğme, "onayla" ile aynı yerde
                           dönüşümlü çiziliyor: yanlış tıklama kolay, sonucu
                           ağır. */
                        confirmMessage={`"${project.title}" çalışmasının kontrolör onayını geri almak istediğinize emin misiniz? Çalışma yeniden inceleme bekler duruma döner.`}
                        successMessage="Kontrolör onayı geri alındı."
                      >
                        <button type="submit" className="projects-filter-button">
                          <RotateCcw size={15} aria-hidden="true" />
                          Onayı geri al
                        </button>
                      </ActionForm>
                    ) : (
                      <ActionForm action={handleApprove.bind(null, project.id)} successMessage="Çalışma kontrolör onayı aldı.">
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
                  {/* Çalışma merkezi: bu çalışmanın literatürü, kaynakçası ve
                      belgeleri tek sayfada (app/dashboard/editor/[id]). */}
                  <Link href={`/dashboard/editor/${project.id}`} className="projects-primary-button">
                    <LayoutDashboard size={15} aria-hidden="true" />
                    Çalışma Merkezi
                  </Link>
                  <Link href={`/dashboard/editor/${project.id}/write`} className="projects-filter-button">
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
        </>
      )}
    </main>
  );
}
