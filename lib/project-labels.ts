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

const OVERSIGHT_ROLES: UserRole[] = ["controller", "academic_manager", "system_admin", "founder"];

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
