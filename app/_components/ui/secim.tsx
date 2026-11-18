"use client";

import { useId, type ReactNode, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { aciklamaBaglantisi } from "@/lib/os5/bilesen";
import { Alan } from "./alan";

/*
  SEÇİM (Signature OS 5): yerel select. Özel bir açılır liste yerine yerel
  denetim, çünkü telefonda sistem seçicisi ve ekran okuyucu desteği
  kendiliğinden geliyor. Görünüm girdiyle aynı ölçüde.
*/
export function Secim({
  etiket,
  aciklama,
  hata,
  id,
  required,
  children,
  ...geri
}: { etiket: string; aciklama?: ReactNode; hata?: ReactNode; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  const uretilen = useId();
  const kimlik = id ?? uretilen;
  return (
    <Alan kimlik={kimlik} etiket={etiket} zorunlu={required} aciklama={aciklama} hata={hata}>
      <div className="os5-secim-kap">
        <select
          {...geri}
          id={kimlik}
          required={required}
          className="os5-secim"
          aria-invalid={hata ? true : undefined}
          aria-describedby={aciklamaBaglantisi(kimlik, { aciklama: Boolean(aciklama), hata: Boolean(hata) })}
        >
          {children}
        </select>
        <ChevronDown size={16} className="os5-secim-ok" aria-hidden="true" />
      </div>
    </Alan>
  );
}
