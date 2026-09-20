"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, LogOut, Menu, X } from "lucide-react";
import { logout } from "@/app/actions/auth";
import ThemeToggle from "@/app/_components/theme-toggle";
import { ACCOUNT_ITEMS, NAV_GROUPS, TAB_ITEMS, isActive, menudeGorunur } from "./navigation";

// Mobil (≤900px): alt sekme çubuğu + sağdan açılan menü çekmecesi.
// Masaüstünde CSS ile gizlidir (app/styles/shell.css).
export default function MobileNav({
  rol,
  userName,
  roleLabel,
  initials,
}: {
  rol: string | undefined;
  userName: string;
  roleLabel: string;
  initials: string;
}) {
  const pathname = usePathname();
  // Menü açıldığı sayfaya bağlı: başka sayfaya geçilince kendiliğinden kapanır.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("mobile-drawer-open", open);
    if (open) window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => document.documentElement.classList.remove("mobile-drawer-open");
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPath(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const close = () => setOpenPath(null);

  return (
    <>
      <nav className="mobile-tabbar" aria-label="Hızlı erişim">
        {TAB_ITEMS.map(({ href, short, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={isActive(pathname, href) && !open ? "page" : undefined}>
            <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
            <span>{short ?? label}</span>
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpenPath(open ? null : pathname)}
          aria-expanded={open}
          aria-controls="mobile-drawer"
        >
          <Menu size={22} strokeWidth={1.8} aria-hidden="true" />
          <span>Menü</span>
        </button>
      </nav>

      <button
        type="button"
        className="mobile-drawer-backdrop"
        aria-label="Menüyü kapat"
        tabIndex={open ? 0 : -1}
        onClick={close}
      />

      <aside id="mobile-drawer" className="mobile-drawer" aria-label="Menü" inert={!open}>
        <header className="mobile-drawer-header">
          <div className="dashboard-brand">
            <div className="brand-mark" aria-hidden="true">
              A
            </div>
            <div>
              <strong className="brand-wordmark">ArvoLab</strong>
              <span lang="en">Research OS</span>
            </div>
          </div>
          <button ref={closeButtonRef} type="button" className="mobile-drawer-close" onClick={close} aria-label="Menüyü kapat">
            <X size={17} aria-hidden="true" />
          </button>
        </header>

        <section className="mobile-drawer-user">
          <span className="dashboard-user-avatar" aria-hidden="true">
            {initials}
          </span>
          <div>
            <strong>{userName}</strong>
            <span>{roleLabel}</span>
          </div>
        </section>

        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mobile-drawer-title">{group.title}</p>
            <nav className="mobile-drawer-list" aria-label={group.title}>
              {group.items.map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={close}
                  aria-current={isActive(pathname, href) ? "page" : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">
                    <Icon size={17} strokeWidth={1.9} />
                  </span>
                  <span>{label}</span>
                  <ChevronRight size={17} className="nav-chevron" aria-hidden="true" />
                </Link>
              ))}
            </nav>
          </div>
        ))}

        <p className="mobile-drawer-title">Hesap</p>
        <div className="mobile-drawer-list">
          {ACCOUNT_ITEMS.filter((item) => menudeGorunur(item, rol)).map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href} onClick={close} aria-current={isActive(pathname, href) ? "page" : undefined}>
              <span className="nav-icon" aria-hidden="true">
                <Icon size={17} strokeWidth={1.9} />
              </span>
              <span>{label}</span>
              <ChevronRight size={17} className="nav-chevron" aria-hidden="true" />
            </Link>
          ))}
          <ThemeToggle variant="row" />
          <form action={logout}>
            <button type="submit" className="is-danger">
              <span className="nav-icon" aria-hidden="true">
                <LogOut size={17} strokeWidth={1.9} />
              </span>
              <span>Çıkış yap</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
