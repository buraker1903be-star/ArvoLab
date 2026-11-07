"use client";

import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  ASİSTAN YÜKLENİRKEN (UX S2, 07.11.2026). Yazım asistanı ayrı bir paket
  ve ilk açılışta indiriliyor. Eskiden indirilirken yerinde HİÇBİR ŞEY
  yoktu: panelde yalnızca "Satır içi öneri" anahtarı görünüyor, istem
  kutusu ~1,5 saniye sonra geliyordu; ilk tıklamada "farklı içerik"
  görünmesinin sebebi buydu. İskelet asistanın düzenini (ileti alanı,
  istem kutusu) taşır, yerine oturduğunda sayfa kaymaz. Hafif tutuldu:
  asistan paketinden hiçbir şey içe aktarmaz.
*/
export default function YazimPaneliIskeleti() {
  const t = useCeviri();
  return (
    <div className="yazim-paneli yazim-paneli-iskelet" aria-busy="true" role="status">
      <span className="sr-only">{t({ tr: "Yazım asistanı yükleniyor…", en: "Loading the writing assistant…" })}</span>
      <div className="yazim-paneli-liste" aria-hidden="true">
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line" />
      </div>
      <div className="yazim-girdi" aria-hidden="true">
        <span className="skeleton yazim-iskelet-kutu" />
      </div>
    </div>
  );
}
