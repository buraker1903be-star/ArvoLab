import type { Metin } from "./dil";

/*
  Etiketler iki dilde (lib/dil.ts). Fonksiyonlar Metin döndürüyor, düz
  metin değil: çağıran t(...) ile seçmek ZORUNDA — sessizce Türkçe kalan
  bir etiket derlemede yakalanıyor.
*/
const ayni = (deger: string): Metin => ({ tr: deger, en: deger });

const PROJECT_TYPES: Record<string, Metin> = {
  thesis: { tr: "Tez", en: "Thesis" },
  article: { tr: "Makale", en: "Article" },
  project: { tr: "Proje", en: "Project" },
  "associate-professorship": { tr: "Doçentlik dosyası", en: "Associate professorship file" },
};

const STATUS_LABELS: Record<string, Metin> = {
  new: { tr: "Yeni", en: "New" },
  planned: { tr: "Planlandı", en: "Planned" },
  writing: { tr: "Yazım aşamasında", en: "Writing" },
  analysis: { tr: "Analiz bekliyor", en: "Awaiting analysis" },
  review: { tr: "İncelemede", en: "In review" },
  revision: { tr: "Revizyonda", en: "In revision" },
  turnitin: { tr: "Benzerlik kontrolünde", en: "Similarity check" },
  ready: { tr: "Teslime hazır", en: "Ready to submit" },
  delivered: { tr: "Teslim edildi", en: "Submitted" },
  archived: { tr: "Arşivlendi", en: "Archived" },
};

export const PROJECT_STATUSES = Object.keys(STATUS_LABELS);

// Kontrolör onayı gerektiren durumlar — guard_academic_project_update
// tetikleyicisindeki listeyle aynı tutulmalıdır.
export const OVERSIGHT_ONLY_STATUSES = ["ready", "delivered"];

export function projectTypeLabel(type: string): Metin {
  return PROJECT_TYPES[type] ?? ayni(type);
}

export function statusLabel(status: string): Metin {
  return STATUS_LABELS[status] ?? ayni(status);
}

export type UserRole =
  | "client"
  | "employee"
  | "expert"
  | "controller"
  | "academic_manager"
  | "system_admin"
  | "founder";

/*
  Adlar ArvoOS'la aynı dilde: kurumun yöneticisi orada "Yönetici",
  çalışanı "Personel". Eskiden burada "Akademik Yönetici", "Çalışan" ve
  "Kurucu/Yönetim" yazıyordu; aynı kişi iki üründe iki ayrı unvanla
  görünüyordu. Yalnızca görünen ad değişti — rol anahtarları
  (academic_manager, employee, founder) veritabanında ve RLS'te aynı.
*/
export const ROLE_LABELS: Record<UserRole, Metin> = {
  client: { tr: "Üye / Öğrenci", en: "Member / Student" },
  employee: { tr: "Personel", en: "Staff" },
  expert: { tr: "Uzman", en: "Expert" },
  controller: { tr: "Kontrolör", en: "Reviewer" },
  academic_manager: { tr: "Yönetici", en: "Manager" },
  system_admin: { tr: "Sistem Yöneticisi", en: "System administrator" },
  founder: { tr: "Kurucu", en: "Founder" },
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

const REQUEST_TYPE_LABELS: Record<string, Metin> = {
  analysis: { tr: "Analiz desteği", en: "Analysis support" },
  editing: { tr: "Dil/biçim düzenleme", en: "Language and formatting edit" },
  methodology: { tr: "Metodoloji danışmanlığı", en: "Methodology consulting" },
  statistics: { tr: "İstatistik desteği", en: "Statistics support" },
  full_review: { tr: "Kapsamlı inceleme", en: "Full review" },
  other: { tr: "Diğer", en: "Other" },
};

export function requestTypeLabel(type: string): Metin {
  return REQUEST_TYPE_LABELS[type] ?? ayni(type);
}
