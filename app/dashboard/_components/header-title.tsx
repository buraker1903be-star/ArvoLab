"use client";

import { usePathname } from "next/navigation";
import { findNavItem } from "./navigation";

// Masaüstünde "ArvoLab / Sayfa adı", mobilde iOS gezinme çubuğu gibi logo + sayfa adı.
export default function HeaderTitle() {
  const pathname = usePathname();
  const label = findNavItem(pathname)?.label ?? "ArvoLab";

  return (
    <>
      <div className="dashboard-header-title">
        <span className="dashboard-header-label">ArvoLab</span>
        <strong>{label}</strong>
      </div>
      <div className="dashboard-header-brand">
        <div className="brand-mark" aria-hidden="true">
          A
        </div>
        <strong>{label}</strong>
      </div>
    </>
  );
}
