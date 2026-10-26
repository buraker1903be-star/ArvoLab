"use client";

import { useState } from "react";
import { ListTree } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import { icindekiler } from "@/lib/icindekiler";
import type { OutlineHeading } from "./editor-navigation";

/*
  Sağ paneldeki İçindekiler kartı (26.10.2026). Eskiden panelin en altında
  her zaman açık bir "Belge planı" listesi vardı; uzun tezde paneli
  kaydırmak gerekiyordu ve sayfa numarası yoktu. Artık kart yalnızca
  özet, liste pencerede: bölüm numarası, başlık ve tahmini sayfa
  (lib/icindekiler.ts). Satıra basınca o başlığa gidilir.
*/
export default function IcindekilerKarti({
  headings,
  numaralama,
  sayfaBasiKelime,
  onJump,
}: {
  headings: OutlineHeading[];
  numaralama: boolean;
  sayfaBasiKelime: number;
  onJump: (heading: OutlineHeading) => void;
}) {
  const [acik, setAcik] = useState(false);
  const satirlar = acik ? icindekiler(headings, numaralama, sayfaBasiKelime) : [];

  return (
    <section className="outline-card">
      <header className="outline-head">
        <strong>
          <ListTree size={15} aria-hidden="true" /> İçindekiler
        </strong>
        <span className="muted text-sm">{headings.length} başlık</span>
      </header>
      {headings.length ? (
        <button type="button" className="projects-filter-button outline-action" onClick={() => setAcik(true)}>
          İçindekileri aç
        </button>
      ) : (
        <p className="muted text-sm">Başlık ekledikçe (H1–H3) içindekiler burada oluşur.</p>
      )}

      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        kicker="Belge planı"
        title="İçindekiler"
        description="Sayfa numaraları yazı boyutu, satır aralığı ve kenar boşluklarına göre tahmindir; şekil, tablo ve kapak dahil değildir. Kesin numaralar Word çıktısındaki içindekiler tablosunda."
      >
        <ol className="icindekiler-listesi">
          {satirlar.map((s) => (
            <li key={s.pos} data-level={s.level}>
              <button
                type="button"
                onClick={() => {
                  setAcik(false);
                  onJump(s);
                }}
              >
                <span className="icindekiler-baslik">
                  {s.numara ? <b>{s.numara}</b> : null}
                  {s.text || "(başlıksız)"}
                </span>
                <span className="icindekiler-nokta" aria-hidden="true" />
                <span className="icindekiler-sayfa">{s.sayfa}</span>
              </button>
            </li>
          ))}
        </ol>
      </Dialog>
    </section>
  );
}
