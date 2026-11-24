"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ayarlariAc } from "./ayarlar-olay";

/*
  HESAP MENÜSÜNDEKİ "AYARLAR" (24.11.2026).

  Düğme değil BAĞLANTI: hesap menüsü sunucuda çiziliyor ve JavaScript
  olmadan da çalışıyor (<details>). Bağlantı /dashboard/settings'e
  gidiyor; JavaScript varsa tıklama yakalanıp sayfa değişmeden pencere
  açılıyor. Böylece editörde yazan öğrenci belgesinden çıkmıyor, ama
  adres doğrudan açıldığında ya da yeni sekmede açıldığında aynı ayarlara
  sayfa olarak ulaşılabiliyor.

  Ctrl/Cmd/Shift ile ya da orta tuşla tıklama KARIŞMIYOR: kullanıcı
  bilerek yeni sekme istiyordur.
*/
export default function AyarlarMenuBaglantisi({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={(olay) => {
        if (olay.metaKey || olay.ctrlKey || olay.shiftKey || olay.altKey || olay.button !== 0) return;
        olay.preventDefault();
        /* Menü <details>; pencere açılırken kapanmalı, yoksa arkada açık kalıyor. */
        olay.currentTarget.closest("details")?.removeAttribute("open");
        ayarlariAc();
      }}
    >
      {children}
    </Link>
  );
}
