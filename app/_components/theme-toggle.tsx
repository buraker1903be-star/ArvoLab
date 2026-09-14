"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "arvolab.theme";

type Theme = "light" | "dark";

// Tema <html data-theme> özniteliğinde yaşar (app/layout.tsx boyamadan önce yazar);
// bileşen onu dinler, böylece sunucu/istemci uyuşmazlığı olmaz.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const getSnapshot = (): Theme => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
const getServerSnapshot = (): Theme => "light";

export default function ThemeToggle({
  variant = "icon",
  className = "dashboard-icon-button",
}: {
  /** "icon": üst çubuk düğmesi, "row": mobil menüdeki liste satırı */
  variant?: "icon" | "row";
  className?: string;
}) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? "Aydınlık moda geç" : "Karanlık moda geç";
  const Icon = theme === "dark" ? Sun : Moon;

  function toggle() {
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Gizli sekme vb.: tercih yalnızca bu oturumda geçerli olur.
    }
  }

  if (variant === "row") {
    return (
      <button type="button" onClick={toggle}>
        <span className="nav-icon" aria-hidden="true">
          <Icon size={17} strokeWidth={1.9} />
        </span>
        <span>{theme === "dark" ? "Aydınlık mod" : "Karanlık mod"}</span>
      </button>
    );
  }

  return (
    <button type="button" className={className} onClick={toggle} aria-label={label} title={label}>
      <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
}
