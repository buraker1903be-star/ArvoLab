"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

// Ekranda görünen, çıktıda gizlenen araç çubuğu. Editörden "PDF" ile gelindiyse
// yazdırma penceresi kendiliğinden açılır.
export default function PrintActions({ backHref, autoPrint }: { backHref: string; autoPrint: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="print-toolbar no-print">
      <Link href={backHref} className="projects-filter-button">
        <ArrowLeft size={16} aria-hidden="true" />
        Editöre dön
      </Link>
      <button type="button" className="projects-primary-button" onClick={() => window.print()}>
        <Printer size={16} aria-hidden="true" />
        Yazdır / PDF olarak kaydet
      </button>
      <span className="print-hint">Yazdırma penceresinde hedef olarak “PDF olarak kaydet”i seçin.</span>
    </div>
  );
}
