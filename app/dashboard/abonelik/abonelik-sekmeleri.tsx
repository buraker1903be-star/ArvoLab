"use client";

import { useId, useState, type ReactNode } from "react";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  FATURALAR / KREDİ HAREKETLERİ (24.11.2026).

  İkisi eskiden sayfanın iki ayrı kartında, birbirinden uzaktaydı:
  "geçen ay ne ödedim, kredim nereye gitti" sorusu iki yere bakmayı
  gerektiriyordu. Sekmeler aynı yere topluyor.

  İKİSİ DE ÇİZİLİ kalıyor, etkin olmayan `hidden`: sekme değiştirmek
  listeyi söküp yeniden kurmuyor, kaydırma konumu da kayboluyor.
*/
export default function AbonelikSekmeleri({ faturalar, hareketler }: { faturalar: ReactNode; hareketler: ReactNode }) {
  const t = useCeviri();
  const kimlik = useId();
  const [sekme, setSekme] = useState<"faturalar" | "hareketler">("faturalar");

  const SEKMELER = [
    { id: "faturalar" as const, ad: t({ tr: "Faturalar", en: "Invoices" }) },
    { id: "hareketler" as const, ad: t({ tr: "Kredi hareketleri", en: "Credit activity" }) },
  ];

  return (
    <div className="abonelik-sekmeler">
      <div className="ayarlar-sekme-serit" role="tablist" aria-label={t({ tr: "Kayıtlar", en: "Records" })}>
        {SEKMELER.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            id={`${kimlik}-${s.id}`}
            aria-selected={sekme === s.id}
            aria-controls={`${kimlik}-panel-${s.id}`}
            className="ayarlar-sekme"
            data-etkin={sekme === s.id || undefined}
            onClick={() => setSekme(s.id)}
          >
            {s.ad}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`${kimlik}-panel-faturalar`} aria-labelledby={`${kimlik}-faturalar`} hidden={sekme !== "faturalar"} className="ayarlar-panel">
        {faturalar}
      </section>
      <section role="tabpanel" id={`${kimlik}-panel-hareketler`} aria-labelledby={`${kimlik}-hareketler`} hidden={sekme !== "hareketler"} className="ayarlar-panel">
        {hareketler}
      </section>
    </div>
  );
}
