"use client";

import { useState } from "react";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { analizEtiketi, type AnalizTuru } from "@/lib/analiz-turleri";
import {
  rehberBasliklari,
  rehberOrnekSatirlari,
  rehberSablonAdi,
  rehberSablonCsv,
  veriRehberi,
  type RehberSecenekleri,
} from "@/lib/analiz-veri-rehberi";

/*
  "BU ANALİZ İÇİN HANGİ VERİLER GEREKLİ?" (23.11.2026).

  Güvenilirliğe özel olan kart bütün analizlere yayıldı. İçerik
  lib/analiz-veri-rehberi.ts'ten geliyor: örnek tablo ile indirilen boş
  şablonun sütunları AYNI tanımdan üretiliyor, ikisi ayrışamaz.

  İki kipte çiziliyor: dosya yüklenmeden önce açık, veri geldikten
  sonra "Veri gereksinimlerini gör" özetinin içinde katlanmış — ilk
  ekranı kalabalıklaştırmadan erişilebilir kalsın.
*/
export default function VeriRehberiKarti({
  tur,
  secenek,
  katlanir = false,
}: {
  tur: AnalizTuru;
  secenek?: RehberSecenekleri;
  /** Veri yüklendikten sonra: özet içinde katlanmış. */
  katlanir?: boolean;
}) {
  const t = useCeviri();
  const dil = useDil();
  const [ornekAcik, setOrnekAcik] = useState(false);
  const rehber = veriRehberi(tur, secenek);
  const basliklar = rehberBasliklari(rehber, dil);
  const satirlar = rehberOrnekSatirlari(rehber, dil);
  const baslik = t({ tr: "Bu analiz için hangi veriler gerekli?", en: "What data does this analysis need?" });

  /* Elle memolanmıyor: rehber her çizimde yeniden kuruluyor ve
     React derleyicisi bu işi kendisi üstleniyor. */
  const sablonuIndir = () => {
    const url = URL.createObjectURL(new Blob([rehberSablonCsv(rehber, dil)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = rehberSablonAdi(tur, dil);
    a.click();
    URL.revokeObjectURL(url);
  };

  const hucre = (x: "sayi" | "kategori" | "etiket") =>
    x === "sayi"
      ? t({ tr: "sayı", en: "number" })
      : x === "kategori"
        ? t({ tr: "kategori", en: "category" })
        : t({ tr: "etiket", en: "label" });

  const govde = (
    <>
      <p className="muted text-sm">{t(rehber.satir)}</p>
      <ul>
        {rehber.sutunlar.map((x) => (
          <li key={x.ad.tr}>
            <b>{dil === "en" ? x.ad.en : x.ad.tr}</b> — {hucre(x.tur)}
            {x.zorunlu ? "" : ` · ${t({ tr: "isteğe bağlı", en: "optional" })}`}
            {/* "seçilmez" değil "seçmeyin": kategorik analizlerde uygulama
                etiket sütununu da listeliyor, kullanıcı seçmemeli. */}
            {x.tur === "etiket" ? ` · ${t({ tr: "analize seçmeyin", en: "do not select it for the analysis" })}` : ""}
          </li>
        ))}
        {(rehber.notlar ?? []).map((x) => (
          <li key={x.tr}>{t(x)}</li>
        ))}
      </ul>
      {rehber.ekNot ? <p className="muted text-sm">{t(rehber.ekNot)}</p> : null}
      {rehber.ekranGirdileri.length ? (
        <p className="muted text-sm">
          <b>{t({ tr: "Dosyada değil, ekranda:", en: "Not in the file, on screen:" })}</b>{" "}
          {rehber.ekranGirdileri.map((x) => t(x)).join(" ")}
        </p>
      ) : null}
      {/* Kalıcı AÇIKLAMA, canlı durum uyarısı değil: .alert[data-tone="warning"]
          kullanmıyor. Eskiden kullanıyordu ve eskiyen sonuç uyarısıyla aynı
          seçiciye giriyordu — ekranda iki not ayırt edilemiyordu. */}
      <p className="analiz-veri-karti-hata mt-sm" role="note">
        <b>{t({ tr: "Sık yapılan hata:", en: "A common mistake:" })}</b> {t(rehber.yayginHata)}
      </p>
      <div className="cluster">
        <button type="button" className="projects-filter-button button-compact" aria-expanded={ornekAcik} onClick={() => setOrnekAcik((a) => !a)}>
          {t({ tr: "Örnek tabloyu gör", en: "See an example table" })}
        </button>
        <button type="button" className="projects-filter-button button-compact" onClick={sablonuIndir}>
          {t({ tr: "Boş şablonu indir", en: "Download the blank template" })}
        </button>
      </div>
      {ornekAcik ? (
        <>
          <div className="table-scroll mt-sm" role="region" aria-label={t({ tr: "Örnek tablo", en: "Example table" })} tabIndex={0}>
            <table className="stats-result-table">
              <thead>
                <tr>
                  {basliklar.map((b) => (
                    <th key={b}>{b}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {satirlar.map((satir, i) => (
                  <tr key={satir[0] + String(i)}>
                    {satir.map((h, j) => (
                      <td key={basliklar[j]}>{h}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted text-sm">
            {t({
              tr: "Sayılar kurgusaldır; örnek yalnızca biçimi gösterir. Boş şablonda yalnızca sütun başlıkları bulunur.",
              en: "The numbers are fictional; the example only shows the layout. The blank template contains the column headers only.",
            })}
          </p>
        </>
      ) : null}
    </>
  );

  if (katlanir) {
    return (
      <details className="analiz-veri-karti analiz-veri-karti-katli">
        <summary>{t({ tr: "Veri gereksinimlerini gör", en: "See the data requirements" })}</summary>
        <div className="analiz-veri-karti-ic">
          <p className="muted text-sm">{analizEtiketi(tur, dil)}</p>
          {govde}
        </div>
      </details>
    );
  }

  return (
    <section className="analiz-veri-karti" aria-label={baslik}>
      <h4>{baslik}</h4>
      {govde}
    </section>
  );
}
