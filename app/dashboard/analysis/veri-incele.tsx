"use client";

import { useMemo, useState } from "react";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  "VERİYİ İNCELE" (22.11.2026).

  Dosya yüklendikten sonra kullanıcı neyin okunduğunu göremiyordu:
  şeritte yalnızca satır/sütun sayısı vardı. Virgüllü ondalık yanlış
  okunduğunda ya da Excel'in başlık satırı kaymış olduğunda hata ancak
  analiz tuhaf bir sonuç verince anlaşılıyordu.

  BÜTÜN DOSYA DOM'A YAZILMAZ. Büyük bir veri setinde (binlerce satır ×
  onlarca sütun) her hücreyi çizmek sekmeyi kilitler. Önizleme ilk
  ONIZLEME_SATIR satırı gösteriyor; sütun özeti (tür, eksik sayısı)
  bütün satırlardan hesaplanıyor ama ekrana tek satır olarak iniyor.
*/
const ONIZLEME_SATIR = 20;
const ONIZLEME_SUTUN = 12;

type Satir = Record<string, string | number | null>;

export default function VeriIncele({
  satirlar,
  sutunlar,
  sayisalSutunlar,
}: {
  satirlar: Satir[];
  sutunlar: string[];
  sayisalSutunlar: string[];
}) {
  const t = useCeviri();
  const [hepsiniGoster, setHepsiniGoster] = useState(false);

  /*
    Sütun özeti bütün satırlardan hesaplanıyor; eksik sayısını ilk 20
    satırdan çıkarmak yanıltıcı olurdu ("eksik yok" diyen bir özet,
    1000. satırdaki boşlukları saklar).
  */
  const ozet = useMemo(
    () =>
      sutunlar.map((ad) => {
        let eksik = 0;
        const farkli = new Set<string>();
        for (const satir of satirlar) {
          const deger = satir[ad];
          if (deger === null || deger === "" || deger === undefined) {
            eksik += 1;
            continue;
          }
          if (farkli.size <= 25) farkli.add(String(deger));
        }
        return {
          ad,
          eksik,
          sayisal: sayisalSutunlar.includes(ad),
          /* 25'ten çok farklı değer varsa sayımı vermiyoruz: üstü sayılmadı. */
          farkliSayi: farkli.size > 25 ? null : farkli.size,
        };
      }),
    [satirlar, sutunlar, sayisalSutunlar],
  );

  const gorunenSutunlar = hepsiniGoster ? sutunlar : sutunlar.slice(0, ONIZLEME_SUTUN);
  const gorunenSatirlar = satirlar.slice(0, ONIZLEME_SATIR);
  const gizliSutun = sutunlar.length - gorunenSutunlar.length;

  return (
    <div className="veri-incele">
      <h4 className="veri-incele-bas">{t({ tr: "Sütunlar", en: "Columns" })}</h4>
      <ul className="veri-incele-sutunlar">
        {ozet.map((s) => (
          <li key={s.ad}>
            <b>{s.ad}</b>
            <small>
              {s.sayisal ? t({ tr: "sayısal", en: "numeric" }) : t({ tr: "kategorik", en: "categorical" })}
              {s.farkliSayi !== null
                ? t({ tr: ` · ${s.farkliSayi} farklı değer`, en: ` · ${s.farkliSayi} distinct values` })
                : t({ tr: " · 25'ten çok farklı değer", en: " · more than 25 distinct values" })}
              {s.eksik > 0 ? (
                <span className="tone-text" data-tone="warning">
                  {t({ tr: ` · ${s.eksik} eksik`, en: ` · ${s.eksik} missing` })}
                </span>
              ) : (
                t({ tr: " · eksik yok", en: " · no missing values" })
              )}
            </small>
          </li>
        ))}
      </ul>

      <h4 className="veri-incele-bas">
        {t({
          tr: `İlk ${gorunenSatirlar.length} satır`,
          en: `First ${gorunenSatirlar.length} rows`,
        })}
        {satirlar.length > gorunenSatirlar.length ? (
          <small className="muted">
            {t({ tr: ` · toplam ${satirlar.length} satır`, en: ` · ${satirlar.length} rows in total` })}
          </small>
        ) : null}
      </h4>
      <div className="table-scroll" role="region" aria-label={t({ tr: "Veri önizlemesi", en: "Data preview" })} tabIndex={0}>
        <table className="stats-result-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              {gorunenSutunlar.map((ad) => (
                <th key={ad} scope="col">
                  {ad}
                </th>
              ))}
              {gizliSutun > 0 ? <th scope="col">…</th> : null}
            </tr>
          </thead>
          <tbody>
            {gorunenSatirlar.map((satir, i) => (
              <tr key={i}>
                <td className="muted">{i + 1}</td>
                {gorunenSutunlar.map((ad) => {
                  const deger = satir[ad];
                  const bos = deger === null || deger === "" || deger === undefined;
                  return (
                    <td key={ad} className={bos ? "muted" : undefined}>
                      {bos ? t({ tr: "boş", en: "empty" }) : String(deger)}
                    </td>
                  );
                })}
                {gizliSutun > 0 ? <td className="muted">…</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {gizliSutun > 0 ? (
        <button type="button" className="projects-filter-button button-compact mt-sm" onClick={() => setHepsiniGoster(true)}>
          {t({ tr: `${gizliSutun} sütun daha göster`, en: `Show ${gizliSutun} more columns` })}
        </button>
      ) : null}
      <p className="muted text-sm mt-sm">
        {t({
          tr: "Sayılar yanlış görünüyorsa (ondalık virgülü nokta okunmuş, başlık satırı kaymış) dosyayı Excel'den .xlsx olarak kaydedip yeniden yükleyin.",
          en: "If the numbers look wrong (a decimal comma read as a point, a shifted header row), save the file from Excel as .xlsx and upload it again.",
        })}
      </p>
    </div>
  );
}
