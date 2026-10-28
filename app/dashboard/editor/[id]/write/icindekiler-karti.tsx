"use client";

import { useState } from "react";
import { ListTree } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import YanKutu from "./yan-kutu";
import { icindekiler } from "@/lib/icindekiler";
import type { OutlineHeading } from "./editor-navigation";
import { useCeviri } from "@/app/_components/dil-saglayici";

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
  const t = useCeviri();
  const [acik, setAcik] = useState(false);
  const satirlar = acik ? icindekiler(headings, numaralama, sayfaBasiKelime) : [];

  return (
    <>
      <YanKutu
        ikon={ListTree}
        baslik={t({ tr: "İçindekiler", en: "Contents" })}
        deger={headings.length}
        alt={headings.length ? t({ tr: "başlık · sayfalarıyla", en: "headings · with pages" }) : t({ tr: "henüz başlık yok", en: "no headings yet" })}
        onClick={() => setAcik(true)}
      />

      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        kicker={t({ tr: "Belge planı", en: "Document outline" })}
        title={t({ tr: "İçindekiler", en: "Table of contents" })}
        description={t({
          tr: "Sayfa numaraları yazı boyutu, satır aralığı ve kenar boşluklarına göre tahmindir; şekil, tablo ve kapak dahil değildir. Kesin numaralar Word çıktısındaki içindekiler tablosunda.",
          en: "Page numbers are estimates based on font size, line spacing and margins; figures, tables and the cover are not included. Exact numbers are in the table of contents of the Word export.",
        })}
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
                  {s.text || t({ tr: "(başlıksız)", en: "(untitled)" })}
                </span>
                <span className="icindekiler-nokta" aria-hidden="true" />
                <span className="icindekiler-sayfa">{s.sayfa}</span>
              </button>
            </li>
          ))}
        </ol>
        {satirlar.length === 0 ? (
          <p className="muted text-sm">
            {t({
              tr: "Başlık ekledikçe (Metin / H1–H3 düğmeleri) içindekiler burada oluşur.",
              en: "As you add headings (Text / H1–H3 buttons), the table of contents builds up here.",
            })}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
