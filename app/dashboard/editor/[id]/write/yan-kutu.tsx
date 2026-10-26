"use client";

import type { LucideIcon } from "lucide-react";

/*
  Sağ paneldeki küçük kutu (26.10.2026, kurum sahibinin isteği: "sağ
  sütundaki kartları küçük kartlar yapalım, açılır popup pencere olsun").
  Kutu yalnızca özeti gösterir — bir sayı ve ne olduğu; ayrıntı ve
  eylemler pencerede. Eskiden dört kart alt alta açık duruyordu ve
  yorumlara ulaşmak için panel kaydırılıyordu.
*/
export default function YanKutu({
  ikon: Ikon,
  baslik,
  deger,
  alt,
  ton,
  vurgu = false,
  onClick,
}: {
  ikon: LucideIcon;
  baslik: string;
  deger: string | number;
  alt: string;
  ton?: "success" | "warning" | "danger";
  /** Yeni bir şey geldi (ör. yeni yorum): kutu kısa süre vurgulanır */
  vurgu?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="yan-kutu"
      data-tone={ton}
      data-vurgu={vurgu ? "" : undefined}
      onClick={onClick}
      aria-haspopup="dialog"
    >
      <span className="yan-kutu-bas">
        <Ikon size={15} aria-hidden="true" />
        {baslik}
      </span>
      <b>{deger}</b>
      <small>{alt}</small>
    </button>
  );
}
