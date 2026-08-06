import Link from "next/link";
import {
  Bell,
  BookMarked,
  BookOpenCheck,
  ChartNoAxesCombined,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  PenLine,
  Quote,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { logout } from "@/app/actions/auth";

const navigation = [
  { label: "Ana Sayfa", href: "/dashboard", icon: LayoutDashboard },
  { label: "Belge Editörü", href: "/dashboard/editor", icon: PenLine },
  { label: "Literatür Taraması", href: "/dashboard/literature", icon: BookOpenCheck },
  { label: "Kaynakça Doğrulama", href: "/dashboard/citations", icon: Quote },
  { label: "Analiz Merkezi", href: "/dashboard/analysis", icon: ChartNoAxesCombined },
  { label: "Belge Kontrol", href: "/dashboard/documents", icon: FileCheck2 },
  { label: "Kılavuzlar", href: "/dashboard/guidelines", icon: BookMarked },
  { label: "Doçentlik Puan Sorgulama", href: "/dashboard/associate-professorship", icon: GraduationCap },
  { label: "Uzman Desteği", href: "/dashboard/expert-requests", icon: Users },
  { label: "Uygulama Destek Talep", href: "/dashboard/support", icon: LifeBuoy },
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
