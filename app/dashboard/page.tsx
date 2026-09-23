import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BookOpenCheck,
  CalendarClock,
  ChartNoAxesCombined,
  Clock3,
  FileCheck2,
  FileText,
  FolderKanban,
  LayoutDashboard,
  MessageSquare,
  PenLine,
  Plus,
  Quote,
  ShieldCheck,
  ClipboardCheck,
  TriangleAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProjects } from "@/app/actions/projects";
import { projectTypeLabel, statusLabel, isOversightRole, STAFF_ROLES } from "@/lib/project-labels";
import { getCurrentProfile } from "@/app/actions/profile";
import { getAccessState } from "@/lib/access";
import LicenseCard from "./_components/license-card";
import GeriBildirimKarti from "./_components/geri-bildirim-karti";
import { geriBildirimSorusu } from "@/app/actions/geri-bildirim";
import { computeAttention } from "@/lib/attention";
import { manuscriptReadiness } from "@/lib/manuscript-readiness";
import { metinListeTutarsizliklari } from "@/lib/calisma-tutarlilik";
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
    description: "Kaynakça listenizi yapıştırın; APA 7, MLA, Chicago, IEEE ve Vancouver kurallarına göre denetlensin.",
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

  const [{ satirlar: projects, okunamadi: projelerOkunamadi }, profile] = await Promise.all([
    getProjects(),
    getCurrentProfile(),
  ]);
  // Ad profilden: Ayarlar'dan değiştirilen ad yalnızca profiles'a yazılıyor,
  // karşılama satırı kayıttaki eski adı (user_metadata) gösteriyordu.
  /*
    Ad yoksa E-POSTA YAZILMIYOR. Panel "Hoş geldiniz,
    uzman@akademikmerkez.com" diyordu: bir selamlama değil, kişinin
    kendi adresini okuması. Ad ArvoOS'tan geliyor (arvoos_members);
    gelmediyse selamlama adsız kalıyor — adsız bir "Hoş geldiniz",
    e-postalı olandan iyi.
  */
  const displayName = profile?.full_name?.trim() || null;
  // Panel düzeniyle aynı istekte paylaşılır (lib/access.ts cache'li).
  const access = await getAccessState(profile);
  const activeProjects = projects.filter((p) => isActive(p.status));
  const [{ stats: writing, openComments }, geriBildirim] = await Promise.all([
    getWritingStats(
      activeProjects.map((p) => p.id),
      user.id
    ),
    // Kullanım geri bildirimi: yalnızca sistemi gerçekten kullanmış kişiye,
    // yalnızca bir kez sorulur (lib/geri-bildirim.ts).
    geriBildirimSorusu(),
  ]);

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
  // Teslim hazırlığı: editördeki "Teslim kontrolü" ile aynı hesap, kaydedilmiş metinden (yalnızca bu çalışma)
  const { data: resumeManuscript } =
    resume && resumeStats
      ? await supabase.from("project_manuscripts").select("*").eq("project_id", resume.id).maybeSingle()
      : { data: null };
  const resumeReadiness =
    resume && resumeManuscript
      ? manuscriptReadiness({
          manuscript: resumeManuscript,
          guideline: resumeGuideline ?? null,
          projectType: resume.project_type,
          citationStyle: resume.citation_style ?? "apa7",
        })
      : null;
  /*
    Metin ile literatür listesi arasındaki tutarsızlıklar. Çalışma merkezinde
    ayrıntısıyla duruyor; burada yalnızca sayısı görünüyor ki kullanıcı
    ana sayfadan haberdar olsun. Müsvedde zaten okunmuş durumda, ek maliyet
    yalnızca kaynak listesi.
  */
  const { data: resumeKaynaklar } = resume
    ? await supabase
        .from("literature_sources")
        .select("id, title, authors, year, status")
        .eq("project_id", resume.id)
        .limit(500)
    : { data: null };
  const resumeTutarsizliklari = resume
    ? metinListeTutarsizliklari(resumeManuscript?.plain_text ?? null, resumeKaynaklar ?? [])
    : [];

  // Eksikler önce, bakılması gerekenler sonra
  const readinessGaps = (resumeReadiness?.items ?? [])
    .filter((item) => item.status !== "ok")
    .sort((a, b) => (a.status === "todo" ? 0 : 1) - (b.status === "todo" ? 0 : 1));

  const upcoming = activeProjects
    .map((project) => ({ project, due: dueInfo(project.due_date, project.status) }))
    .filter((item): item is { project: (typeof activeProjects)[number]; due: NonNullable<ReturnType<typeof dueInfo>> } =>
      Boolean(item.due && item.due.days <= UPCOMING_WINDOW_DAYS)
    )
    .sort((a, b) => a.due.days - b.due.days)
    .slice(0, UPCOMING_LIMIT);

  // Personel için "dikkat isteyenler" (öğrencinin ana sayfası değişmez); sorumlu ataması yalnızca denetim rollerinde
  const isStaff = profile?.role ? STAFF_ROLES.includes(profile.role) : false;
  const attention = isStaff ? computeAttention(projects, openComments, { includeUnassigned: isOversightRole(profile?.role) }) : null;

  const revisionCount = projects.filter((p) => p.status === "revision").length;
  const analysisCount = projects.filter((p) => p.status === "analysis").length;
  const referenceCount = projects.filter((p) => p.status === "review" || p.status === "turnitin").length;

  const teslimEdilen = projects.filter((p) => p.status === "delivered").length;
  const yaklasan = upcoming.length;
  /*
    Özet kartları: sayının yanında bir alt satır ve duruma göre ton. Kartlar
    aynı görünüp yalnızca sayı değiştiği için ekran ölüydü; sayının anlamı
    (yaklaşan teslim var mı, revizyon bekliyor mu) görünmüyordu.
  */
  const stats: { label: string; value: number; icon: typeof FolderKanban; tone: string; note: string }[] = [
    {
      label: "Aktif çalışmalar", value: activeProjects.length, icon: FolderKanban,
      tone: activeProjects.length ? "info" : "neutral",
      note: yaklasan ? `${yaklasan} tanesinin teslimi yaklaştı` : teslimEdilen ? `${teslimEdilen} çalışma teslim edildi` : "teslim tarihi yaklaşan yok",
    },
    {
      label: "Revizyon bekleyen", value: revisionCount, icon: Clock3,
      tone: revisionCount ? "warning" : "success",
      note: revisionCount ? "düzeltme bekliyor" : "revizyon bekleyen yok",
    },
    {
      label: "Kaynak/biçim incelemesinde", value: referenceCount, icon: BookOpenCheck,
      tone: referenceCount ? "info" : "neutral",
      note: referenceCount ? "kontrol sürüyor" : "incelemede çalışma yok",
    },
    {
      label: "Analiz süreci", value: analysisCount, icon: ChartNoAxesCombined,
      tone: analysisCount ? "info" : "neutral",
      note: analysisCount ? "veri analizi aşamasında" : "analizde çalışma yok",
    },
  ];

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-kicker">ArvoLab çalışma alanı</span>
          <h1>{displayName ? `Hoş geldiniz, ${displayName}` : "Hoş geldiniz"}</h1>
          <p>Kaldığınız yerden devam edin; teslim tarihleriniz ve gelen yorumlar burada.</p>
        </div>
        <div className="dashboard-security">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Güvenli oturum aktif</span>
        </div>
      </section>

      <LicenseCard access={access} />

      {geriBildirim.sorulsun ? <GeriBildirimKarti baglam={geriBildirim.baglam} /> : null}

      <section className="dashboard-stats" aria-label="Günlük özet">
        {stats.map(({ label, value, icon: Icon, tone, note }) => (
          <article className="dashboard-stat-card" data-tone={tone} key={label}>
            <div className="dashboard-stat-icon" aria-hidden="true">
              <Icon size={20} strokeWidth={1.8} />
            </div>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
              <em>{note}</em>
            </div>
          </article>
        ))}
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
            {resumeReadiness ? (
              <div
                className="readiness-bar"
                data-ready={readinessGaps.length === 0 ? "true" : undefined}
                role="progressbar"
                aria-valuenow={resumeReadiness.done}
                aria-valuemin={0}
                aria-valuemax={resumeReadiness.total}
                aria-label="Teslim hazırlığı"
              >
                <i style={{ "--w": `${Math.round((resumeReadiness.done / Math.max(1, resumeReadiness.total)) * 100)}%` } as React.CSSProperties} />
              </div>
            ) : null}
            {resumeReadiness ? (
              <p className="text-sm resume-readiness" data-ready={readinessGaps.length === 0 ? "true" : undefined}>
                <ClipboardCheck size={15} aria-hidden="true" />
                <span>
                  Teslim hazırlığı:{" "}
                  <strong>
                    {resumeReadiness.done}/{resumeReadiness.total}
                  </strong>{" "}
                  madde hazır
                  {readinessGaps.length === 0
                    ? " · teslime hazır görünüyor"
                    : ` · Bakılacak: ${readinessGaps
                        .slice(0, 2)
                        .map((item) => item.label)
                        .join(", ")}${readinessGaps.length > 2 ? ` ve ${readinessGaps.length - 2} madde daha` : ""}`}
                </span>
              </p>
            ) : null}
            {resumeTutarsizliklari.length > 0 ? (
              <p className="text-sm resume-readiness resume-tutarsizlik">
                <TriangleAlert size={15} aria-hidden="true" />
                <span>
                  {resumeTutarsizliklari[0].baslik}
                  {resumeTutarsizliklari.length > 1 ? ` (+${resumeTutarsizliklari.length - 1})` : ""} ·{" "}
                  <Link href={`/dashboard/editor/${resume.id}`}>çalışma merkezinde incele</Link>
                </span>
              </p>
            ) : null}
            <div className="cluster">
              <Link href={`/dashboard/editor/${resume.id}/write`} className="projects-primary-button">
                <PenLine size={16} aria-hidden="true" />
                {resumeStats ? "Yazmaya devam et" : "Yazmaya başla"}
              </Link>
              <Link href={`/dashboard/editor/${resume.id}`} className="projects-filter-button">
                <LayoutDashboard size={16} aria-hidden="true" />
                Çalışma merkezi
              </Link>
              {activeProjects.length > 1 ? (
                <Link href="/dashboard/editor" className="projects-filter-button">
                  Tüm çalışmalar ({activeProjects.length})
                </Link>
              ) : null}
            </div>
          </article>
        ) : projelerOkunamadi ? (
          /*
            Liste okunamadı. Eskiden burada da "ilk çalışmanızı oluşturun"
            yazıyordu; geçici bir arıza kullanıcıya tezini kaybettiğini
            düşündürüyordu (lib/liste-sonucu.ts).
          */
          <article className="resume-card" role="alert">
            <span className="dashboard-kicker">Bağlantı sorunu</span>
            <div className="resume-heading">
              <h2>Çalışmalarınız yüklenemedi</h2>
              <p>Kayıtlarınız yerinde duruyor. Sayfayı yenileyin; sorun sürerse destekten bildirin.</p>
            </div>
            <div className="cluster">
              <Link href="/dashboard/support" className="projects-filter-button">
                Uygulama Destek
              </Link>
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

        {/* Sağ sütun: kısa ve tarama amaçlı kartlar. Dikkat isteyenler
            eskiden tam genişlikte ayrı bir banttı; sağ sütun boş kalıyor,
            sayfa gereksiz uzuyordu. */}
        <div className="dashboard-yan">
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

        {attention ? (
          <section className="attention-card" aria-label="Dikkat isteyenler">
          <span className="dashboard-kicker">Dikkat isteyenler</span>
            {attention.length === 0 ? (
            <p className="tone-text text-sm" data-tone="success">
              ✓ Gecikmiş, sorumlusuz, onay ya da yanıt bekleyen çalışma yok.
            </p>
          ) : (
            <ul className="attention-list">
                {attention.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="attention-item" data-tone={item.tone}>
                    <strong>{item.count}</strong>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        ) : null}
        </div>
      </section>

      {/*
        Modüller kenar çubuğunun aynısını tekrarlıyor. Eskiden açıklamalı
        büyük kartlardı ve ana sayfanın en çok yer kaplayan bölümüydü;
        kullanıcının her gün gördüğü bir menüyü ikinci kez anlatmaya gerek
        yok. Kompakt kısayol şeridine indirildi.
      */}
      <section className="dashboard-kisayollar" aria-label="Modüller">
        <span className="dashboard-kicker">Hızlı erişim</span>
        <div className="dashboard-kisayol-liste">
          {workstreams.map(({ title, icon: Icon, href }) => (
            <Link className="dashboard-kisayol" href={href} key={title}>
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              {title}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
