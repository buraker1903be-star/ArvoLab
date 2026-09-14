import type { Tone } from "@/lib/status-tone";

export interface DueInfo {
  /** Bugünden teslim gününe kalan gün (geçmişse negatif) */
  days: number;
  label: string;
  tone: Tone;
}

const DAY_MS = 86_400_000;
const CLOSED_STATUSES = new Set(["delivered", "archived"]);

// Takvim günü Türkiye saatine göre: gece yarısından sonra "yarın" hemen "bugün" olur.
function todayInTurkey(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(now);
}

function toUtcDay(isoDate: string) {
  const [year, month, day] = isoDate.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Teslim tarihi için kalan gün, kısa etiket ve renk tonu. Tarih yoksa ya da iş kapandıysa null. */
export function dueInfo(dueDate: string | null | undefined, status?: string | null, now = new Date()): DueInfo | null {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}/.test(dueDate)) return null;
  if (status && CLOSED_STATUSES.has(status)) return null;
  const days = Math.round((toUtcDay(dueDate) - toUtcDay(todayInTurkey(now))) / DAY_MS);
  if (days < 0) return { days, label: `${-days} gün gecikti`, tone: "danger" };
  if (days === 0) return { days, label: "Bugün teslim", tone: "danger" };
  if (days === 1) return { days, label: "Yarın teslim", tone: "warning" };
  if (days <= 7) return { days, label: `${days} gün kaldı`, tone: "warning" };
  if (days <= 30) return { days, label: `${days} gün kaldı`, tone: "info" };
  return { days, label: `${days} gün kaldı`, tone: "neutral" };
}
