// Çalışmalarım listesi: arama, durum/sorumlu filtresi ve sıralama. Değerler adres satırında
// (?q=…&durum=…&sirala=…&atanan=…) tutulur; geçersiz değerler varsayılana döner.

export type ProjectSort = "yeni" | "duzenleme" | "teslim" | "baslik";
export type AssigneeFilter = "tumu" | "benim" | "atanmamis";

export interface ProjectFilters {
  q: string;
  /** "tumu", "aktif" (teslim edilmemiş/arşivlenmemiş) ya da tek bir durum */
  status: string;
  sort: ProjectSort;
  assignee: AssigneeFilter;
}

export interface ProjectFilterInput {
  id: string;
  title: string;
  university: string | null;
  status: string;
  due_date: string | null;
  created_at: string;
  assignee_id: string | null;
  assignee_name: string | null;
}

export const DEFAULT_PROJECT_FILTERS: ProjectFilters = { q: "", status: "tumu", sort: "yeni", assignee: "tumu" };

const SORTS: ProjectSort[] = ["yeni", "duzenleme", "teslim", "baslik"];
const ASSIGNEE_FILTERS: AssigneeFilter[] = ["tumu", "benim", "atanmamis"];
const CLOSED_STATUSES = new Set(["delivered", "archived"]);

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export function parseProjectFilters(params: Record<string, string | string[] | undefined>, statuses: readonly string[]): ProjectFilters {
  const status = firstValue(params.durum);
  const sort = firstValue(params.sirala) as ProjectSort;
  const assignee = firstValue(params.atanan) as AssigneeFilter;
  return {
    q: firstValue(params.q).trim().slice(0, 100),
    status: status === "aktif" || statuses.includes(status) ? status : "tumu",
    sort: SORTS.includes(sort) ? sort : "yeni",
    assignee: ASSIGNEE_FILTERS.includes(assignee) ? assignee : "tumu",
  };
}

export function isFiltered(filters: ProjectFilters): boolean {
  return (Object.keys(DEFAULT_PROJECT_FILTERS) as (keyof ProjectFilters)[]).some((key) => filters[key] !== DEFAULT_PROJECT_FILTERS[key]);
}

const fold = (text: string) => text.toLocaleLowerCase("tr-TR").normalize("NFC");

export function applyProjectFilters<T extends ProjectFilterInput>(
  projects: T[],
  filters: ProjectFilters,
  context: { lastEdited: (projectId: string) => string | undefined; userId?: string; canFilterAssignee: boolean }
): T[] {
  const needle = fold(filters.q);
  const result = projects.filter((project) => {
    if (needle && !fold(`${project.title} ${project.university ?? ""}`).includes(needle)) return false;
    if (filters.status === "aktif" ? CLOSED_STATUSES.has(project.status) : filters.status !== "tumu" && project.status !== filters.status) {
      return false;
    }
    // Sorumlu filtresi yalnızca tüm çalışmaları gören denetim rollerinde anlamlıdır
    if (context.canFilterAssignee) {
      if (filters.assignee === "benim" && project.assignee_id !== context.userId) return false;
      if (filters.assignee === "atanmamis" && (project.assignee_id || project.assignee_name)) return false;
    }
    return true;
  });

  const newestFirst = (a: T, b: T) => b.created_at.localeCompare(a.created_at);
  switch (filters.sort) {
    case "duzenleme":
      return result.sort((a, b) => {
        const x = context.lastEdited(a.id);
        const y = context.lastEdited(b.id);
        if (x && y) return y.localeCompare(x);
        if (x || y) return x ? -1 : 1; // hiç yazılmamışlar sona
        return newestFirst(a, b);
      });
    case "teslim":
      return result.sort((a, b) => {
        // Teslim edilmiş/arşivlenmiş ve tarihsiz çalışmalar sona; kalanlar en yakın tarih önce
        const rank = (p: T) => (CLOSED_STATUSES.has(p.status) ? 2 : p.due_date ? 0 : 1);
        return rank(a) - rank(b) || (a.due_date && b.due_date ? a.due_date.localeCompare(b.due_date) : 0) || newestFirst(a, b);
      });
    case "baslik":
      return result.sort((a, b) => a.title.localeCompare(b.title, "tr", { sensitivity: "base" }) || newestFirst(a, b));
    default:
      return result.sort(newestFirst);
  }
}
