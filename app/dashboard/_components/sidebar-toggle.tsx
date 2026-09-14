"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_COOKIE } from "./navigation";

// Kenar çubuğunu simge moduna daraltır. Tercih çerezde tutulur; dashboard
// düzeni çerezi okuyup ilk çizimde doğru sınıfı verir (açılışta titreme yok).
export default function SidebarToggle({ initialCollapsed }: { initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.querySelector(".dashboard-shell")?.classList.toggle("is-nav-collapsed", next);
    document.cookie = `${NAV_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  }

  const label = collapsed ? "Menüyü genişlet" : "Menüyü daralt";
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <button type="button" className="sidebar-toggle" onClick={toggle} aria-pressed={collapsed} title={label}>
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
