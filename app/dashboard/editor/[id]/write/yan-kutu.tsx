"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";

/*
  Sağ paneldeki küçük kutu (26.10.2026, kurum sahibinin isteği: "sağ
  sütundaki kartları küçük kartlar yapalım, açılır popup pencere olsun").
  Kutu yalnızca özeti gösterir — bir sayı ve ne olduğu; ayrıntı ve
  eylemler pencerede. Eskiden dört kart alt alta açık duruyordu ve
  yorumlara ulaşmak için panel kaydırılıyordu.

  İNCELEME KARTI (04.11.2026, Jenni'nin "İncele" paneli örnek): 2×2
  kutuda sayı vardı ama kutunun NE yaptığı yazmıyordu; "Yazarlık %0"
  ya da "Ön sayfalar Ekle" ilk kez gören öğrenciye bir şey anlatmıyordu.
  Kart artık tam satır: simge, ad, ne işe yaradığı (aciklama), durum ve
  sağda değer. Tek tıkla penceresi açılır.
*/
export default function YanKutu({
  ikon: Ikon,
  baslik,
  deger,
  alt,
  aciklama,
  ton,
  vurgu = false,
  onClick,
}: {
  ikon: LucideIcon;
  baslik: string;
  deger: string | number;
  alt: string;
  /** Kartın ne yaptığı, tek cümle (ilk kez gören öğrenci için). */
  aciklama?: string;
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
      <span className="yan-kutu-ikon" aria-hidden="true">
        <Ikon size={16} />
      </span>
      <span className="yan-kutu-govde">
        <span className="yan-kutu-bas">{baslik}</span>
        {aciklama ? <span className="yan-kutu-aciklama">{aciklama}</span> : null}
        <small>{alt}</small>
      </span>
      <b className="yan-kutu-deger">{deger}</b>
      <ChevronRight size={16} className="yan-kutu-ok" aria-hidden="true" />
    </button>
  );
}
