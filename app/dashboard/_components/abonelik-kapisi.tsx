"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { kapisizYolMu } from "@/lib/abonelik-kapisi";

/*
  Karar istemcide, yola göre: panel yerleşimi sayfalar arasında gezinirken
  yeniden çizilmiyor, yani sunucuda bir kez verilen karar Destek'ten
  Ana Sayfa'ya geçince güncellenmezdi. Açık yollar lib/abonelik-kapisi.ts'te.
*/
export default function AbonelikKapisi({ kapali, uyari, children }: { kapali: boolean; uyari: ReactNode; children: ReactNode }) {
  const yol = usePathname();
  if (!kapali || kapisizYolMu(yol)) return <>{children}</>;
  return <>{uyari}</>;
}
