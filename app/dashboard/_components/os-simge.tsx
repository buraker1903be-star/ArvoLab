import { BookMarked, BookOpenCheck, ChartNoAxesCombined, FileCheck2, GraduationCap, LayoutDashboard, LayoutGrid, LifeBuoy, PenLine, Quote, Settings, type LucideIcon, CreditCard } from "lucide-react";
import type { OsIkon } from "@/lib/os/uygulamalar";

/*
  Dock ve başlatıcı ikonları. ArvoOS ile ArvoARC elle çizilmiş SVG
  kullanıyor; ArvoLab'ın kenar çubuğu zaten lucide ile çiziliyor ve
  aynı sayfa iki ayrı ikon dilinde görünmemeli — eşleme bu yüzden
  menüdekinin (navigation.ts) AYNISI.

  Uygulama listesi (lib/os/uygulamalar.ts) React'e dokunmuyor, bu
  yüzden ikon orada bir metin anahtarı; bileşene çevrildiği tek yer
  burası.
*/
const IKONLAR: Record<OsIkon, LucideIcon> = {
  home: LayoutDashboard,
  tez: PenLine,
  literatur: BookOpenCheck,
  kaynakca: Quote,
  analiz: ChartNoAxesCombined,
  belge: FileCheck2,
  kilavuz: BookMarked,
  docentlik: GraduationCap,
  destek: LifeBuoy,
  settings: Settings,
  apps: LayoutGrid,
  abonelik: CreditCard,
};

export function OsSimge({ ad, boyut = 22 }: { ad: OsIkon; boyut?: number }) {
  const Ikon = IKONLAR[ad];
  return <Ikon size={boyut} aria-hidden="true" />;
}
