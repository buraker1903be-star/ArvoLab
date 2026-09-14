import {
  BookMarked,
  BookOpenCheck,
  ChartNoAxesCombined,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  PenLine,
  Quote,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Kenar çubuğu daraltma tercihi (sidebar-toggle.tsx yazar, dashboard düzeni okur). */
export const NAV_COOKIE = "arvolab_nav";

export interface NavItem {
  label: string;
  /** Mobil alt sekme çubuğundaki kısa ad */
  short?: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

// Kenar çubuğu ve mobil menü aynı yapıyı kullanır.
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Çalışma",
    items: [
      { label: "Ana Sayfa", short: "Ana Sayfa", href: "/dashboard", icon: LayoutDashboard },
      { label: "Belge Editörü", short: "Editör", href: "/dashboard/editor", icon: PenLine },
      { label: "Literatür Taraması", href: "/dashboard/literature", icon: BookOpenCheck },
      { label: "Kaynakça Doğrulama", href: "/dashboard/citations", icon: Quote },
    ],
  },
  {
    title: "Kontrol ve analiz",
    items: [
      { label: "Belge Kontrol", short: "Belge", href: "/dashboard/documents", icon: FileCheck2 },
      { label: "Analiz Merkezi", short: "Analiz", href: "/dashboard/analysis", icon: ChartNoAxesCombined },
      { label: "Kılavuzlar", href: "/dashboard/guidelines", icon: BookMarked },
      { label: "Doçentlik Puan Sorgulama", href: "/dashboard/associate-professorship", icon: GraduationCap },
    ],
  },
  {
    title: "Destek",
    items: [
      { label: "Uzman Desteği", href: "/dashboard/expert-requests", icon: Users },
      { label: "Uygulama Destek Talep", href: "/dashboard/support", icon: LifeBuoy },
    ],
  },
];

export const ACCOUNT_ITEMS: NavItem[] = [
  { label: "Ekip Yönetimi", href: "/dashboard/team", icon: UserCog, adminOnly: true },
  { label: "Ayarlar", href: "/dashboard/settings", icon: Settings },
];

// Mobil alt sekme çubuğu: en sık kullanılan dört bölüm + "Menü".
export const TAB_HREFS = ["/dashboard", "/dashboard/editor", "/dashboard/documents", "/dashboard/analysis"];

const ALL_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((group) => group.items), ...ACCOUNT_ITEMS];

export const TAB_ITEMS: NavItem[] = TAB_HREFS.map((href) => ALL_ITEMS.find((item) => item.href === href)!);

export function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Geçerli sayfaya en özel eşleşen menü öğesi (üst çubuk başlığı için). */
export function findNavItem(pathname: string): NavItem | undefined {
  return ALL_ITEMS.filter((item) => isActive(pathname, item.href)).sort((a, b) => b.href.length - a.href.length)[0];
}
