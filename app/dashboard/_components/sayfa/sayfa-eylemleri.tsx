"use client";

import { Fragment, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { eylemYerlesimi } from "@/lib/os/sayfa-standardi";
import AracMenusu from "../acilir-menu";
import { useEkranSinifi } from "../ekran-sinifi";

/*
  SAYFA EYLEMLERİ — PageActions + ResponsiveActionBar (Signature OS 4.1).

  Üç tür eylem (karar: lib/os/sayfa-standardi.ts):
  - birincil: YALNIZCA kullanıcının gerçek ana görevi varsa ("Kaynak bul",
    "İddia ekle"). Her sayfada zorunlu değil: Analiz Merkezi'nin ana işi
    sayfanın içindeki veri yükleme alanı, başlığa ikinci bir "yükle"
    düğmesi koymak aynı işi iki yerde gösterirdi.
  - ikincil: sık kullanılan; masaüstünde ve tablette satırda.
  - tasma: seyrek (dışa aktarma, eski kayıtlar); her zaman "⋯" menüsünde.

  TELEFONDA (ResponsiveActionBar): birincil yerinde kalır, ikinciller
  taşma menüsüne girer — Kaynaklar'da dört düğme iki satıra sarıyordu.
  Ayrı bir yapışık alt çubuk YAZILMADI: telefonda alt gezinme çubuğu
  zaten yapışık; ikinci bir yapışık şerit 844 piksellik ekranın altını
  iki katına çıkarır ve içeriği örter.

  Öğeler sunucuda çizilmiş düğmeler ya da pencereler (PanelDrawer) olabilir.
  Ekran boyuna göre FARKLI yerde çiziliyorlar, CSS ile gizlenmiyorlar:
  aynı pencere iki kez çizilirse iki ayrı pencere doğar. Menüden açılan
  pencere kapanınca odak menü düğmesine döner (panel-drawer.tsx).
*/
export default function SayfaEylemleri({
  birincil,
  ikincil = [],
  tasma = [],
  etiket,
}: {
  birincil?: ReactNode;
  ikincil?: ReactNode[];
  tasma?: ReactNode[];
  /** Grubun ekran okuyucudaki adı; yoksa "Sayfa eylemleri". */
  etiket?: string;
}) {
  const t = useCeviri();
  const ekran = useEkranSinifi();
  const ik = ikincil.filter(Boolean);
  const ta = tasma.filter(Boolean);
  const yer = eylemYerlesimi(ekran, { ikincil: ik.length, tasma: ta.length });
  const liste = (ogeler: ReactNode[], on: string) => ogeler.map((o, i) => <Fragment key={`${on}${i}`}>{o}</Fragment>);
  const menuOgeleri = [...(yer.ikincil === "menu" ? ik : []), ...ta];

  return (
    <div className="sayfa-eylemleri" role="group" aria-label={etiket ?? t({ tr: "Sayfa eylemleri", en: "Page actions" })}>
      {yer.ikincil === "satir" ? liste(ik, "i") : null}
      {yer.menuVar ? (
        <AracMenusu
          ikon={<MoreHorizontal size={16} aria-hidden="true" />}
          etiket={yer.ikincil === "menu" ? t({ tr: "Diğer eylemler", en: "More actions" }) : t({ tr: "Diğer", en: "More" })}
          aciklama={t({ tr: "Diğer eylemler", en: "More actions" })}
          etiketiGizle={yer.ikincil !== "menu"}
          dugmeSinifi="projects-filter-button button-compact sayfa-tasma-dugme"
          pencereSinifi="sayfa-tasma-menu"
        >
          {liste(menuOgeleri, "m")}
        </AracMenusu>
      ) : null}
      {birincil}
    </div>
  );
}
