"use client";

import { useId, useState, type ReactNode, type TextareaHTMLAttributes } from "react";
import { aciklamaBaglantisi, sayacDurumu } from "@/lib/os5/bilesen";
import { Alan } from "./alan";

/*
  METİN ALANI (Signature OS 5). `maxLength` verilirse sayaç görünür; sınıra
  yaklaşınca rengi değişir. Sayaç bir duyuru değildir (her tuşta okunmasın
  diye aria-live yok); sınır zaten maxLength ile tarayıcıda uygulanıyor.
*/
export function MetinAlani({
  etiket,
  aciklama,
  hata,
  id,
  required,
  maxLength,
  defaultValue,
  value,
  onChange,
  ...geri
}: { etiket: string; aciklama?: ReactNode; hata?: ReactNode } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const uretilen = useId();
  const kimlik = id ?? uretilen;
  const [uzunluk, setUzunluk] = useState(String(value ?? defaultValue ?? "").length);
  const sayac = sayacDurumu(value !== undefined ? String(value).length : uzunluk, maxLength);
  return (
    <Alan
      kimlik={kimlik}
      etiket={etiket}
      zorunlu={required}
      aciklama={aciklama}
      hata={hata}
      sonEk={
        sayac ? (
          <span className="os5-sayac" data-yakin={sayac.yakin || undefined}>
            {sayac.metin}
          </span>
        ) : null
      }
    >
      <textarea
        {...geri}
        id={kimlik}
        required={required}
        maxLength={maxLength}
        defaultValue={defaultValue}
        value={value}
        onChange={(olay) => {
          setUzunluk(olay.target.value.length);
          onChange?.(olay);
        }}
        className="os5-metin"
        aria-invalid={hata ? true : undefined}
        aria-describedby={aciklamaBaglantisi(kimlik, { aciklama: Boolean(aciklama), hata: Boolean(hata) })}
      />
    </Alan>
  );
}
