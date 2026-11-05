"use client";

import { ArrowUpDown, Search } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  LİSTE ARAÇLARI — DataList'in üst şeridi (Signature OS 4.1, 05.11.2026).

  Arama, süzgeç ve sıralama tek şeritte ve her listede aynı sırayla.
  Eskiden Kaynaklar listesi aramayı ve süzgeci kendisi yazıyordu, sıralama
  yoktu; Çalışmalarım kendi süzgecini, personel listeleri kendi seçim
  kutularını. Durum (aranan metin, seçili süzgeç) listeyi çizen bileşende
  kalır: süzme listenin işi, bu bileşen yalnızca denetimleri çizer.

  Süzgeç düğmeleri `aria-pressed` taşır ve sayısını gösterir; sayısı sıfır
  olan süzgeç (ör. "Eksik künye") hiç çizilmez — boş bir listeye götüren
  düğme gürültüdür.
*/
export type Suzgec<K extends string> = { kod: K; ad: string; sayi: number; herZaman?: boolean };

export default function ListeAraclari<K extends string, S extends string>({
  arama,
  onArama,
  aramaEtiketi,
  aramaIpucu,
  suzgecler,
  secili,
  onSuzgec,
  siralamalar,
  sira,
  onSira,
}: {
  arama: string;
  onArama: (deger: string) => void;
  aramaEtiketi: string;
  aramaIpucu: string;
  suzgecler: Suzgec<K>[];
  secili: K;
  onSuzgec: (kod: K) => void;
  siralamalar?: { kod: S; ad: string }[];
  sira?: S;
  onSira?: (kod: S) => void;
}) {
  const t = useCeviri();
  return (
    <div className="liste-araclari">
      <div className="liste-araclari-ust">
        <label className="kaynak-arama">
          <Search size={14} aria-hidden="true" />
          <input type="search" placeholder={aramaIpucu} value={arama} onChange={(e) => onArama(e.target.value)} aria-label={aramaEtiketi} />
        </label>
        {siralamalar?.length && sira && onSira ? (
          <label className="liste-sirala">
            {/* Telefonda yazı yerine simge (sayfa-standardi.css); erişilebilir ad yazıdan gelir. */}
            <ArrowUpDown size={15} aria-hidden="true" className="liste-sirala-simge" />
            <span className="liste-sirala-metin">{t({ tr: "Sırala", en: "Sort" })}</span>
            <select className="compact-select" value={sira} onChange={(e) => onSira(e.target.value as S)}>
              {siralamalar.map((s) => (
                <option key={s.kod} value={s.kod}>
                  {s.ad}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="cluster liste-suzgecler" role="group" aria-label={t({ tr: "Süzgeç", en: "Filter" })}>
        {suzgecler
          .filter((s) => s.herZaman || s.sayi > 0)
          .map((s) => (
            <button key={s.kod} type="button" className="projects-filter-button button-compact" aria-pressed={secili === s.kod} onClick={() => onSuzgec(s.kod)}>
              {s.ad} <small>{s.sayi}</small>
            </button>
          ))}
      </div>
    </div>
  );
}
