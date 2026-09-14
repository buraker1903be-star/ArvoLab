import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { getCurrentProfile } from "@/app/actions/profile";
import { ADMIN_ROLES, ROLE_LABELS } from "@/lib/project-labels";
import ThemeToggle from "@/app/_components/theme-toggle";
import SidebarNav from "./_components/sidebar-nav";
import HeaderTitle from "./_components/header-title";
import MobileNav from "./_components/mobile-nav";
import Toaster from "./_components/toaster";
import NotificationBell from "./_components/notification-bell";
import { NAV_COOKIE } from "./_components/navigation";

function initialsOf(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
  return letters.toLocaleUpperCase("tr") || "A";
}

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [profile, cookieStore] = await Promise.all([getCurrentProfile(), cookies()]);
  const isAdmin = !!profile && ADMIN_ROLES.includes(profile.role);
  const userName = profile?.full_name?.trim() || "Kullanıcı";
  const roleLabel = profile ? ROLE_LABELS[profile.role] : "";
  const initials = initialsOf(userName);
  // Daraltma tercihi ilk çizimde uygulanır: sayfa açılırken menü genişleyip daralmaz
  const navCollapsed = cookieStore.get(NAV_COOKIE)?.value === "collapsed";

  return (
    <div className={navCollapsed ? "dashboard-shell is-nav-collapsed" : "dashboard-shell"}>
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <div className="brand-mark" aria-hidden="true">
            A
          </div>
          <div>
            <strong>ArvoLab</strong>
            <span lang="en">Research OS</span>
          </div>
        </div>
        <SidebarNav isAdmin={isAdmin} collapsed={navCollapsed} />
      </aside>

      <div className="dashboard-content-shell">
        <header className="dashboard-header">
          <HeaderTitle />
          <div className="dashboard-header-actions">
            <NotificationBell />
            <ThemeToggle />
            <div className="dashboard-user">
              <span className="dashboard-user-avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="dashboard-user-text">
                <strong>{userName}</strong>
                <span>{roleLabel}</span>
              </span>
            </div>
            <form action={logout} className="dashboard-logout-form">
              <button type="submit" className="dashboard-logout-button">
                <LogOut size={16} aria-hidden="true" />
                Çıkış yap
              </button>
            </form>
          </div>
        </header>

        <div className="dashboard-main-content">{children}</div>
      </div>

      <MobileNav isAdmin={isAdmin} userName={userName} roleLabel={roleLabel} initials={initials} />
      <Toaster />
    </div>
  );
}
