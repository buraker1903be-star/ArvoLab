"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { konumYolu } from "@/lib/os/konum-yolu";
import type { OsUygulama } from "@/lib/os/uygulamalar";
import { useCalismaBaglami } from "./calisma-baglami";

/*
  ÜST ÇUBUKTAKİ KONUM YOLU (Signature OS, 04.11.2026). Karar saf
  fonksiyonda (lib/os/konum-yolu.ts, birim testli); burada yalnızca
  çizim. Uygulama listesi düzenden geliyor (rolüne göre süzülmüş liste,
  kenar çubuğuyla aynısı).

  Telefonda gizli (shell.css): orada üst çubukta marka ve açık
  uygulamanın adı duruyor, üç öğelik bir yol 375 piksele sığmıyor.
  Uzun çalışma adı tek satırda üç noktayla kesilir; tam adı title'da.
*/
export function KonumYolu({ uygulamalar }: { uygulamalar: OsUygulama[] }) {
  const t = useCeviri();
  const yol = usePathname();
  const sorgu = useSearchParams();
  const baglam = useCalismaBaglami();
  const ogeler = konumYolu({ yol, sorgu: new URLSearchParams(sorgu.toString()), uygulamalar, baglam, t });

  return (
    <nav className="konum-yolu" aria-label={t({ tr: "Konum", en: "Breadcrumb" })}>
      <ol>
        {ogeler.map((oge, i) => (
          <li key={`${i}-${oge.label}`}>
            {i > 0 ? <ChevronRight size={14} aria-hidden="true" className="konum-yolu-ayrac" /> : null}
            {oge.href ? (
              <Link href={oge.href} title={oge.label}>
                {oge.label}
              </Link>
            ) : (
              <span aria-current="page" title={oge.label}>
                {oge.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
