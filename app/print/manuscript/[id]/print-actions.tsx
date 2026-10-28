"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";

// Ekranda görünen, çıktıda gizlenen araç çubuğu. Editörden "PDF" ile gelindiyse
// yazdırma penceresi kendiliğinden açılır.
export default function PrintActions({
  backHref,
  autoPrint,
  backLabel,
}: {
  backHref: string;
  autoPrint: boolean;
  backLabel?: string;
}) {
  const t = useCeviri();
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="print-toolbar no-print">
      <Link href={backHref} className="projects-filter-button">
        <ArrowLeft size={16} aria-hidden="true" />
        {backLabel ?? t({ tr: "Editöre dön", en: "Back to editor" })}
      </Link>
      <button type="button" className="projects-primary-button" onClick={() => window.print()}>
        <Printer size={16} aria-hidden="true" />
        {t({ tr: "Yazdır / PDF olarak kaydet", en: "Print / Save as PDF" })}
      </button>
      <span className="print-hint">
        {t({ tr: "Yazdırma penceresinde hedef olarak “PDF olarak kaydet”i seçin.", en: "In the print dialog, choose “Save as PDF” as the destination." })}
      </span>
    </div>
  );
}
