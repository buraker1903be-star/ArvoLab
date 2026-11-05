"use client";

import type { ReactNode } from "react";
import PanelDrawer from "../panel-drawer";

/*
  AYRINTI PANELİ — DetailPanel (Signature OS 4.1, 05.11.2026).

  Listede seçilen kaydın (kaynak, belge, iddia) ayrıntısı. İki biçimi var
  ve ikisi de var olan bileşenlerin üstünde:
  - YAN PANEL (bu bileşen): masaüstü ve tablette ekranın sağından açılan
    sütun, telefonda alttan açılan sayfa. Liste arkada yerinde kalır.
    Panel kiplidir (PanelDrawer): odak içeride tutulur, Esc kapatır ve
    odak açan satıra döner. Ayrıntısı listeye sığmayan kayıtlar için.
  - YANINDA (iki-kart-secim.tsx): solda liste, sağda seçili kaydın
    ayrıntısı; ekranda yer varsa (Belge Kontrol). Telefonda iki kart üst
    üste düşer ve seçim ayrıntıya kaydırır.

  Ayrı bir pencere sistemi yazılmadı: odak tuzağı, katman sırası, Esc ve
  telefondaki alttan açılma PanelDrawer'da zaten sınanmış durumda.
*/
export default function AyrintiPaneli({
  acik,
  onKapat,
  ust,
  baslik,
  aciklama,
  children,
}: {
  acik: boolean;
  onKapat: () => void;
  ust?: string;
  baslik: string;
  aciklama?: string;
  children: ReactNode;
}) {
  return (
    <PanelDrawer
      tetiksiz
      acik={acik}
      onAcikDegis={(deger) => {
        if (!deger) onKapat();
      }}
      triggerLabel={baslik}
      kicker={ust}
      title={baslik}
      description={aciklama}
      boy="yan"
      basaridaKapan={false}
    >
      {children}
    </PanelDrawer>
  );
}
