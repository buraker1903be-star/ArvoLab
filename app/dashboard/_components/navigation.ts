import { KAYIT_ROLLERI } from "@/lib/ai/kayit-gorunum";
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
  Sparkles,
  TrendingUp,
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
  /**
   * Menüde görünmesi için gereken roller. Sayfanın KENDİ yetki kontrolüyle
   * aynı listeyi taşımalı: eskiden asistan sayfası kontrolöre açıktı ama
   * menüde yalnızca yöneticiye görünüyordu, yani kontrolör yetkisi olan
   * sayfayı adresini bilmeden bulamıyordu.
   */
  roller?: readonly string[];
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
  // Asistan kayıtları sayfasının kendi kapısı: lib/ai/kayit-gorunum.ts KAYIT_ROLLERI.
  { label: "Asistan Kayıtları", href: "/dashboard/asistan", icon: Sparkles, roller: KAYIT_ROLLERI },
  // Ekip yönetimi yalnızca sistem yöneticisi ve kurucuya açık (team/page.tsx).
  { label: "Ekip Yönetimi", href: "/dashboard/team", icon: UserCog, roller: ["system_admin", "founder"] },
  // Ürün ölçümü de öyle: bireysel abonelerin hunisi iç ekip kararıdır (olcum/page.tsx).
  { label: "Ürün Ölçümü", href: "/dashboard/olcum", icon: TrendingUp, roller: ["system_admin", "founder"] },
  { label: "Ayarlar", href: "/dashboard/settings", icon: Settings },
];

/** Menü öğesi bu role görünür mü? Rolü olmayan (giriş yapmamış) kullanıcıda kısıtlı öğeler gizlenir. */
export function menudeGorunur(item: NavItem, rol: string | undefined): boolean {
  return !item.roller || (!!rol && item.roller.includes(rol));
}

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
