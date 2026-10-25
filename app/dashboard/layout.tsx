import { Suspense } from "react";
import { LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { getCurrentProfile } from "@/app/actions/profile";
import { ROLE_LABELS } from "@/lib/project-labels";
import { getAccessState } from "@/lib/access";
import { gorunenUygulamalar, labUygulamalari } from "@/lib/os/uygulamalar";
import SubscriptionNotice from "./_components/subscription-notice";
import SilmeBekliyor from "./_components/silme-bekliyor";
import ThemeToggle from "@/app/_components/theme-toggle";
import HeaderTitle from "./_components/header-title";
import Toaster from "./_components/toaster";
import NotificationBell from "./_components/notification-bell";
import ActionErrorToast from "./_components/action-error-toast";
import NavProgress from "./_components/nav-progress";
import { OsDock } from "./_components/os-dock";
import { OsBolumSeridi } from "./_components/os-bolum-seridi";

function initialsOf(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
  return letters.toLocaleUpperCase("tr") || "A";
}

/*
  DOCK KABUĞU (25.10.2026, kurum sahibinin isteği). Kenar çubuğu ve
  mobil sekme çubuğu kalktı; her iş alanı artık bir "uygulama" ve
  hepsi tek listeden besleniyor (lib/os/uygulamalar.ts) — ArvoOS ile
  ArvoARC'taki düzenin aynısı.

  Daraltma tercihi (NAV_COOKIE) da gitti: dock'un daraltılacak bir
  hâli yok. Çerez okunmuyor, yazan bileşen de kaldırıldı.
*/
export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await getCurrentProfile();
  const userName = profile?.full_name?.trim() || "Kullanıcı";
  const roleLabel = profile ? ROLE_LABELS[profile.role] : "";
  const initials = initialsOf(userName);
  // Kim girebilir: kurum lisansı ya da bireysel abonelik (lib/access.ts).
  const access = await getAccessState(profile);
  // Rolü yetmeyen uygulamalar dock'tan da başlatıcıdan da düşer.
  const uygulamalar = gorunenUygulamalar(labUygulamalari(), profile?.role);

  return (
    <div className="dashboard-shell os-root">
      {/* Klavye kullanıcısı her sayfada dock'taki bağlantıları geçmek
          zorunda kalmasın; bağlantı yalnızca odaklanınca görünür. */}
      <a href="#panel-icerik" className="skip-link">
        İçeriğe atla
      </a>

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

        <Suspense>
          <OsBolumSeridi uygulamalar={uygulamalar} />
        </Suspense>

        <div className="dashboard-main-content" id="panel-icerik" tabIndex={-1}>
          <Suspense>
            <ActionErrorToast />
            <NavProgress />
          </Suspense>
          {/*
            Sıra önemli: silme talebi aboneliğin ÖNÜNDE geliyor. Aboneliği de
            bitmiş bir kullanıcıya önce ödeme ekranını göstermek, "geri dön"
            düğmesini parasını ödemeden ulaşılamaz bir yere koyardı.
          */}
          {profile?.silme_talebi_at ? (
            <SilmeBekliyor talep={profile.silme_talebi_at} />
          ) : access.blocked ? (
            <SubscriptionNotice access={access} />
          ) : (
            children
          )}
        </div>
      </div>

      <Suspense>
        <OsDock uygulamalar={uygulamalar} />
      </Suspense>
      <Toaster />
    </div>
  );
}
