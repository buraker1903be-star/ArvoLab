import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  ChartNoAxesCombined,
  Clock3,
  FileCheck2,
  FileText,
  FolderKanban,
  MessageSquare,
  PenLine,
  Plus,
  Quote,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProjects } from "@/app/actions/projects";
import { projectTypeLabel, statusLabel } from "@/lib/project-labels";
import { statusTone } from "@/lib/status-tone";
import { dueInfo } from "@/lib/due-date";
import { editedAgo, getWritingStats } from "@/lib/writing-stats";
import { loadAppliedGuidelines } from "@/lib/guideline-rules";
import { writingPace } from "@/lib/writing-pace";

const workstreams = [
  {
    title: "Belge Editörü",
    description: "Tez, makale ve proje çalışmalarınızı panelde oluşturun ve yazın.",
    icon: PenLine,
    href: "/dashboard/editor",
  },
  {
    title: "Literatür Taraması",
    description: "Bulduğunuz kaynakları kaydedin, okuma durumunu izleyin.",
    icon: BookOpenCheck,
    href: "/dashboard/literature",
  },
  {
    title: "Kaynakça Doğrulama",
    description: "Kaynakça listenizi yapıştırıp APA 7 kurallarına göre denetleyin.",
    icon: Quote,
    href: "/dashboard/citations",
  },
  {
    title: "Belge Kontrol",
    description: "Tam belgenizi yükleyin; kılavuz uyumu ve orijinallik ön-kontrolü çalıştırın.",
    icon: FileCheck2,
    href: "/dashboard/documents",
  },
  {
    title: "Analiz Merkezi",
    description: "SPSS çıktısını APA biçimine çevirin, MAXQDA kod kitabınızı kontrol edin.",
    icon: ChartNoAxesCombined,
    href: "/dashboard/analysis",
  },
];

const UPCOMING_WINDOW_DAYS = 30;
const UPCOMING_LIMIT = 5;
const isActive = (status: string) => status !== "delivered" && status !== "archived";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const displayName = user.user_metadata?.full_name || user.email || "Kullanıcı";
  const projects = await getProjects();
  const activeProjects = projects.filter((p) => isActive(p.status));
  const { stats: writing, openComments } = await getWritingStats(
    activeProjects.map((p) => p.id),
    user.id
  );

  // Kaldığınız yer: en son yazılan aktif çalışma; hiç yazılmadıysa en yeni aktif çalışma.
  const resume =
    [...activeProjects]
      .filter((p) => writing.has(p.id))
      .sort((a, b) => writing.get(b.id)!.updatedAt.localeCompare(writing.get(a.id)!.updatedAt))[0] ?? activeProjects[0];
  const resumeStats = resume ? writing.get(resume.id) : undefined;
  const resumeDue = resume ? dueInfo(resume.due_date, resume.status) : null;
  const resumeComments = resume ? openComments.get(resume.id) ?? 0 : 0;
  // Yazım temposu (editördekiyle aynı hesap): kılavuzun sayfa hedefi ve teslim tarihine göre
  const guidelines = await loadAppliedGuidelines(supabase, resume ? [resume.guideline_id] : []);
  const resumeGuideline = resume?.guideline_id ? guidelines.get(resume.guideline_id) : undefined;
  const resumePace =
    resume && resumeGuideline
      ? writingPace({
          words: resumeStats?.words ?? 0,
          minPages: resumeGuideline.minPages,
          maxPages: resumeGuideline.maxPages,
          dueDate: resume.due_date,
          status: resume.status,
          settings: {
            fontSizePt: resumeGuideline.settings.fontSizePt,
            lineSpacing: resumeGuideline.settings.lineSpacing,
            margins: resumeGuideline.settings.margins,
          },
        })
      : null;

  const upcoming = activeProjects
    .map((project) => ({ project, due: dueInfo(project.due_date, project.status) }))
    .filter((item): item is { project: (typeof activeProjects)[number]; due: NonNullable<ReturnType<typeof dueInfo>> } =>
      Boolean(item.due && item.due.days <= UPCOMING_WINDOW_DAYS)
    )
    .sort((a, b) => a.due.days - b.due.days)
    .slice(0, UPCOMING_LIMIT);

  const revisionCount = projects.filter((p) => p.status === "revision").length;
  const analysisCount = projects.filter((p) => p.status === "analysis").length;
  const referenceCount = projects.filter((p) => p.status === "review" || p.status === "turnitin").length;

  const stats = [
    { label: "Aktif çalışmalar", value: activeProjects.length, icon: FolderKanban },
    { label: "Revizyon bekleyen", value: revisionCount, icon: Clock3 },
    { label: "Kaynak/biçim incelemesinde", value: referenceCount, icon: BookOpenCheck },
    { label: "Analiz süreci", value: analysisCount, icon: ChartNoAxesCombined },
  ];

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-kicker">ArvoLab çalışma alanı</span>
          <h1>Hoş geldiniz, {displayName}</h1>
          <p>Kaldığınız yerden devam edin; teslim tarihleriniz ve gelen yorumlar burada.</p>
        </div>
        <div className="dashboard-security">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Güvenli oturum aktif</span>
        </div>
      </section>

      <section className="dashboard-focus" aria-label="Bugün">
        {resume ? (
          <article className="resume-card">
            <span className="dashboard-kicker">Kaldığınız yerden devam edin</span>
            <div className="resume-heading">
              <span className="status-pill" data-tone={statusTone(resume.status)}>
                {statusLabel(resume.status)}
              </span>
              <h2>{resume.title}</h2>
              <p>
                {projectTypeLabel(resume.project_type)}
                {resume.university ? ` · ${resume.university}` : ""}
              </p>
            </div>
            <div className="resume-meta">
              <span>
                <FileText size={15} aria-hidden="true" />
                {resumeStats
                  ? `${resumeStats.words.toLocaleString("tr-TR")} kelime · ${editedAgo(resumeStats.updatedAt)} düzenlendi`
                  : "Henüz yazmaya başlanmadı"}
              </span>
              {resumeDue ? (
                <span className="chip" data-tone={resumeDue.tone}>
                  <CalendarClock size={13} aria-hidden="true" />
                  {resumeDue.label}
                </span>
              ) : null}
              {resumeComments ? (
                <span className="tone-text" data-tone="warning">
                  <MessageSquare size={15} aria-hidden="true" />
                  {resumeComments} açık yorum
                </span>
              ) : null}
            </div>
            {resumePace && resumeStats ? (
              <p className="tone-text text-sm resume-pace" data-tone={resumePace.tone}>
                {resumePace.detail}
              </p>
            ) : null}
            <div className="cluster">
              <Link href={`/dashboard/editor/${resume.id}/write`} className="projects-primary-button">
                <PenLine size={16} aria-hidden="true" />
                {resumeStats ? "Yazmaya devam et" : "Yazmaya başla"}
              </Link>
              {activeProjects.length > 1 ? (
                <Link href="/dashboard/editor" className="projects-filter-button">
                  Tüm çalışmalar ({activeProjects.length})
                </Link>
              ) : null}
            </div>
          </article>
        ) : (
          <article className="resume-card">
            <span className="dashboard-kicker">Başlayalım</span>
            <div className="resume-heading">
              <h2>İlk çalışmanızı oluşturun</h2>
              <p>Üniversitenizi seçin; tez yazım kılavuzunuz editöre otomatik uygulanır.</p>
            </div>
            <div className="cluster">
              <Link href="/dashboard/editor/new" className="projects-primary-button">
                <Plus size={16} aria-hidden="true" />
                Yeni çalışma
              </Link>
            </div>
          </article>
        )}

        <article className="upcoming-card">
          <span className="dashboard-kicker">Yaklaşan teslimler</span>
          {upcoming.length === 0 ? (
            <p className="muted text-sm">Önümüzdeki {UPCOMING_WINDOW_DAYS} günde teslim tarihi olan çalışma yok.</p>
          ) : (
            <ul className="upcoming-list">
              {upcoming.map(({ project, due }) => (
                <li key={project.id}>
                  <Link href={`/dashboard/editor/${project.id}/write`}>
                    <span className="upcoming-title">{project.title}</span>
                    <span className="chip" data-tone={due.tone}>
                      {due.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="dashboard-stats" aria-label="Günlük özet">
        {stats.map(({ label, value, icon: Icon }) => (
          <article className="dashboard-stat-card" key={label}>
            <div className="dashboard-stat-icon" aria-hidden="true">
              <Icon size={20} strokeWidth={1.8} />
            </div>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-grid" aria-label="ArvoLab modülleri">
        {workstreams.map(({ title, description, icon: Icon, href }) => (
          <Link className="dashboard-module-card" href={href} key={title}>
            <div className="dashboard-module-icon" aria-hidden="true">
              <Icon size={22} strokeWidth={1.8} />
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="dashboard-module-link">
              Modülü aç
              <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
