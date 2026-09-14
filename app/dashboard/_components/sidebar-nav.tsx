"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { ACCOUNT_ITEMS, NAV_GROUPS, isActive } from "./navigation";

export default function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <>
      <nav className="dashboard-nav" aria-label="Ana menü">
        {NAV_GROUPS.map((group) => (
          <div className="dashboard-nav-group" key={group.title}>
            <p className="dashboard-nav-title">{group.title}</p>
            {group.items.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="dashboard-nav-link"
                aria-current={isActive(pathname, href) ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="dashboard-sidebar-footer">
        {ACCOUNT_ITEMS.filter((item) => !item.adminOnly || isAdmin).map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="dashboard-nav-link"
            aria-current={isActive(pathname, href) ? "page" : undefined}
          >
            <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
        <div className="dashboard-security-card">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>Güvenli oturum</strong>
            <span>Kurumsal koruma aktif</span>
          </div>
        </div>
      </div>
    </>
  );
}
