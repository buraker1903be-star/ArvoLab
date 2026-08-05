import { redirect } from "next/navigation";
import {
  BookOpenCheck,
  ChartNoAxesCombined,
  Clock3,
  FileCheck2,
  FolderKanban,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const stats = [
  { label: "Aktif çalışmalar", value: "17", icon: FolderKanban },
  { label: "Revizyon bekleyen", value: "4", icon: Clock3 },
  { label: "Kaynak doğrulama", value: "5", icon: BookOpenCheck },
  { label: "Analiz süreci", value: "2", icon: ChartNoAxesCombined },
];

const workstreams = [
  {
    title: "Akademik çalışmalar",
    description: "Tez, makale ve proje süreçlerini tek merkezden yönetin.",
    icon: FolderKanban,
  },
  {
    title: "Literatür merkezi",
    description: "Kaynak havuzlarını, DOI kayıtlarını ve doğrulama durumlarını izleyin.",
    icon: BookOpenCheck,
  },
  {
    title: "Belge kontrolü",
    description: "Üniversite kılavuzu, APA 7 ve biçim denetimlerini çalıştırın.",
    icon: FileCheck2,
  },
  {
    title: "Analiz merkezi",
    description: "Nicel ve nitel analiz taleplerini takip edin.",
    icon: ChartNoAxesCombined,
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
        {workstreams.map(({ title, description, icon: Icon }) => (
          <article className="dashboard-module-card" key={title}>
            <div className="dashboard-module-icon">
              <Icon size={22} strokeWidth={1.8} />
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
            <button type="button">Modülü aç</button>
          </article>
        ))}
      </section>
    </main>
  );
}
