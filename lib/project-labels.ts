const PROJECT_TYPES: Record<string, string> = {
  thesis: "Tez",
  article: "Makale",
  project: "Proje",
  "associate-professorship": "Doçentlik dosyası",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Yeni",
  planned: "Planlandı",
  writing: "Yazım aşamasında",
  analysis: "Analiz bekliyor",
  review: "İncelemede",
  revision: "Revizyonda",
  turnitin: "Benzerlik kontrolünde",
  ready: "Teslime hazır",
  delivered: "Teslim edildi",
  archived: "Arşivlendi",
};

export const PROJECT_STATUSES = Object.keys(STATUS_LABELS);

// Kontrolör onayı gerektiren durumlar — guard_academic_project_update
// tetikleyicisindeki listeyle aynı tutulmalıdır.
export const OVERSIGHT_ONLY_STATUSES = ["ready", "delivered"];

export function projectTypeLabel(type: string) {
  return PROJECT_TYPES[type] ?? type;
}

export function statusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export type UserRole =
  | "client"
  | "employee"
  | "expert"
  | "controller"
  | "academic_manager"
  | "system_admin"
  | "founder";

export const ROLE_LABELS: Record<UserRole, string> = {
  client: "Üye / Öğrenci",
  employee: "Çalışan",
  expert: "Uzman",
  controller: "Kontrolör",
  academic_manager: "Akademik Yönetici",
  system_admin: "Sistem Yöneticisi",
  founder: "Kurucu/Yönetim",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS) as UserRole[];

// Rol grupları — hem arayüzde hem server action yetki kontrollerinde
// kullanılır; RLS politikalarındaki rol listeleriyle aynı tutulmalıdır.
export const OVERSIGHT_ROLES: readonly UserRole[] = ["controller", "academic_manager", "system_admin", "founder"];
export const MANAGER_ROLES: readonly UserRole[] = ["academic_manager", "system_admin", "founder"];
export const ADMIN_ROLES: readonly UserRole[] = ["system_admin", "founder"];
export const EXPERT_ROLES: readonly UserRole[] = ["expert", ...OVERSIGHT_ROLES];
// Çalışmalara sorumlu olarak atanabilecek personel (Üye/Öğrenci hariç herkes).
export const STAFF_ROLES: readonly UserRole[] = ["employee", ...EXPERT_ROLES];

export function isOversightRole(role: UserRole | null | undefined) {
  return !!role && OVERSIGHT_ROLES.includes(role);
}

export function isExpertEligible(role: UserRole | null | undefined) {
  return role === "expert" || isOversightRole(role);
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  analysis: "Analiz desteği",
  editing: "Dil/biçim düzenleme",
  methodology: "Metodoloji danışmanlığı",
  statistics: "İstatistik desteği",
  full_review: "Kapsamlı inceleme",
  other: "Diğer",
};

export function requestTypeLabel(type: string) {
  return REQUEST_TYPE_LABELS[type] ?? type;
}
