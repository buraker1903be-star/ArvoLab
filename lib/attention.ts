// Personel ana sayfası: dikkat isteyen çalışmaların sayıları. Her madde Çalışmalarım listesini
// ilgili filtreyle açar (lib/project-filters.ts adres parametreleri). Sıfır olan maddeler gösterilmez.
import { dueInfo } from "@/lib/due-date";
import type { Tone } from "@/lib/status-tone";

export interface AttentionProject {
  id: string;
  status: string;
  due_date: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  controller_approved_at: string | null;
}

export type AttentionId = "overdue" | "due-soon" | "unassigned" | "approval" | "comments";

export interface AttentionItem {
  id: AttentionId;
  label: string;
  count: number;
  tone: Tone;
  href: string;
}

const CLOSED_STATUSES = new Set(["delivered", "archived"]);
const DUE_SOON_DAYS = 7;

export function computeAttention(
  projects: AttentionProject[],
  openComments: ReadonlyMap<string, number>,
  options: { includeUnassigned?: boolean; now?: Date } = {}
): AttentionItem[] {
  const active = projects.filter((project) => !CLOSED_STATUSES.has(project.status));
  const days = active.map((project) => dueInfo(project.due_date, project.status, options.now)?.days ?? null);

  const items: AttentionItem[] = [
    {
      id: "overdue",
      label: "Teslim tarihi geçmiş",
      count: days.filter((day) => day !== null && day < 0).length,
      tone: "danger",
      href: "/dashboard/editor?durum=aktif&sirala=teslim",
    },
    {
      id: "due-soon",
      label: `${DUE_SOON_DAYS} gün içinde teslim`,
      count: days.filter((day) => day !== null && day >= 0 && day <= DUE_SOON_DAYS).length,
      tone: "warning",
      href: "/dashboard/editor?durum=aktif&sirala=teslim",
    },
    {
      id: "unassigned",
      label: "Sorumlusu atanmamış",
      // Eski kayıtlardaki serbest metin sorumlu da atanmış sayılır (liste filtresiyle aynı kural)
      count: options.includeUnassigned ? active.filter((project) => !project.assignee_id && !project.assignee_name).length : 0,
      tone: "warning",
      href: "/dashboard/editor?durum=aktif&atanan=atanmamis",
    },
    {
      id: "approval",
      label: "Kontrolör onayı bekliyor",
      count: projects.filter((project) => project.status === "ready" && !project.controller_approved_at).length,
      tone: "info",
      href: "/dashboard/editor?durum=ready",
    },
    {
      id: "comments",
      label: "Yanıt bekleyen yorumu var",
      count: active.filter((project) => (openComments.get(project.id) ?? 0) > 0).length,
      tone: "info",
      href: "/dashboard/editor?durum=aktif&sirala=duzenleme",
    },
  ];
  return items.filter((item) => item.count > 0);
}
