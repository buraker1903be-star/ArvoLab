"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { aciklamaBaglantisi } from "@/lib/os5/bilesen";
import { Alan } from "./alan";

/* GİRDİ (Signature OS 5): 40 px, 4 px radius, 1 px kenarlık; hata hem kenarlıkta hem metinde. */
export function Girdi({
  etiket,
  aciklama,
  hata,
  id,
  required,
  ...geri
}: { etiket: string; aciklama?: ReactNode; hata?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const uretilen = useId();
  const kimlik = id ?? uretilen;
  return (
    <Alan kimlik={kimlik} etiket={etiket} zorunlu={required} aciklama={aciklama} hata={hata}>
      <input
        {...geri}
        id={kimlik}
        required={required}
        className="os5-girdi"
        aria-invalid={hata ? true : undefined}
        aria-describedby={aciklamaBaglantisi(kimlik, { aciklama: Boolean(aciklama), hata: Boolean(hata) })}
      />
    </Alan>
  );
}
