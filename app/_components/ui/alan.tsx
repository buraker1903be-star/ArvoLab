import type { ReactNode } from "react";
import { alanKimlikleri } from "@/lib/os5/bilesen";

/*
  ALAN ÇERÇEVESİ: etiket + kontrol + açıklama/hata. Girdi, şifre, seçim ve
  metin alanı aynı çerçeveyi paylaşır ki etiket, boşluk ve hata metni her
  formda aynı yerde dursun. Kimlikler lib/os5/bilesen.ts'ten: kontrolün
  aria-describedby'ı ile buradaki metinler aynı kökten türer.
*/
export function Alan({
  kimlik,
  etiket,
  zorunlu,
  aciklama,
  hata,
  sonEk,
  children,
}: {
  kimlik: string;
  etiket: string;
  zorunlu?: boolean;
  aciklama?: ReactNode;
  hata?: ReactNode;
  sonEk?: ReactNode;
  children: ReactNode;
}) {
  const k = alanKimlikleri(kimlik);
  return (
    <div className="os5-alan">
      <label className="os5-etiket" htmlFor={kimlik}>
        {etiket}
        {zorunlu ? (
          <span className="os5-zorunlu" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hata ? (
        <span className="os5-hata-metni" id={k.hata}>
          {hata}
        </span>
      ) : null}
      {aciklama ? (
        <span className="os5-aciklama" id={k.aciklama}>
          {aciklama}
        </span>
      ) : null}
      {sonEk}
    </div>
  );
}
