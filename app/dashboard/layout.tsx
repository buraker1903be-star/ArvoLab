import Link from "next/link";
import {
  Bell,
  BookMarked,
  BookOpenCheck,
  ChartNoAxesCombined,
  FileCheck2,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { logout } from "@/app/actions/auth";

const navigation = [
  { label: "Ana Sayfa", href: "/dashboard", icon: LayoutDashboard },
  { label: "Çalışmalar", href: "/dashboard/projects", icon: FolderKanban },
  { label: "Literatür", href: "/dashboard/literature", icon: BookOpenCheck },
  { label: "Belge Kontrolü", href: "/dashboard/documents", icon: FileCheck2 },
  { label: "Kılavuzlar", href: "/dashboard/guidelines", icon: BookMarked },
  { label: "Uzman Desteği", href: "/dashboard/expert-requests", icon: Users },
  { label: "Analiz Merkezi", href: "/dashboard/analysis", icon: ChartNoAxesCombined },
  { label: "Doçentlik", href: "/dashboard/associate-professorship", icon: GraduationCap },
];

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <div className="brand-mark">A</div>
          <div>
            <strong className="brand-type">ArvoLab</strong>
            <span>Research OS</span>
          </div>
        </div>

        <nav className="dashboard-nav" aria-label="Ana menü">
          {navigation.map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} className="dashboard-nav-link">
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <div className="dashboard-sidebar-footer">
          <Link href="/dashboard/settings" className="dashboard-nav-link">
            <Settings size={18} strokeWidth={1.8} />
            <span>Ayarlar</span>
          </Link>
          <div className="dashboard-security-card">
            <ShieldCheck size={18} />
            <div>
              <strong>Güvenli oturum</strong>
              <span>Kurumsal koruma aktif</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="dashboard-content-shell">
        <header className="dashboard-header">
          <div>
            <span className="dashboard-header-label">ArvoLab</span>
            <strong>Akademik Operasyon Paneli</strong>
          </div>
          <div className="dashboard-header-actions">
            <button type="button" className="dashboard-icon-button" aria-label="Bildirimler">
              <Bell size={18} />
            </button>
            <form action={logout}>
              <button type="submit" className="dashboard-logout-button">
                <LogOut size={17} />
                Çıkış yap
              </button>
            </form>
          </div>
        </header>

        <div className="dashboard-main-content">{children}</div>
      </div>
    </div>
  );
}
