import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BookOpenCheck,
  ChartNoAxesCombined,
  Clock3,
  FileCheck2,
  FolderKanban,
  PenLine,
  Quote,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProjects } from "@/app/actions/projects";

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

  const activeCount = projects.filter((p) => p.status !== "delivered" && p.status !== "archived").length;
  const revisionCount = projects.filter((p) => p.status === "revision").length;
  const analysisCount = projects.filter((p) => p.status === "analysis").length;
  const referenceCount = projects.filter((p) => p.status === "review" || p.status === "turnitin").length;

  const stats = [
    { label: "Aktif çalışmalar", value: String(activeCount), icon: FolderKanban },
    { label: "Revizyon bekleyen", value: String(revisionCount), icon: Clock3 },
    { label: "Kaynak/biçim incelemesinde", value: String(referenceCount), icon: BookOpenCheck },
    { label: "Analiz süreci", value: String(analysisCount), icon: ChartNoAxesCombined },
  ];

  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-kicker">ArvoLab çalışma alanı</span>
          <h1 className="brand-type">Hoş geldiniz, {displayName}</h1>
          <p>Akademik operasyonlarınızın güncel durumunu buradan takip edin.</p>
        </div>
        <div className="dashboard-security">
          <ShieldCheck size={18} />
          <span>Güvenli oturum aktif</span>
        </div>
      </section>

      <section className="dashboard-stats" aria-label="Günlük özet">
        {stats.map(({ label, value, icon: Icon }) => (
          <article className="dashboard-stat-card" key={label}>
            <div className="dashboard-stat-icon">
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
          <article className="dashboard-module-card" key={title}>
            <div className="dashboard-module-icon">
              <Icon size={22} strokeWidth={1.8} />
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
            {href ? (
              <Link href={href}>
                <button type="button">Modülü aç</button>
              </Link>
            ) : (
              <button type="button" disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
                Yakında
              </button>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
