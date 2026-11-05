"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { YEREL } from "@/lib/dil";
import { sirala, sonrakiSiralama, type SiralamaDegeri, type SiralamaYonu } from "@/lib/os/sayfa-standardi";
import { useEkranSinifi } from "../ekran-sinifi";

/*
  VERİ TABLOSU — DataTable (Signature OS 4.1, 05.11.2026).

  İlk kullanıcı Kanıt Matrisi: dokuz sütun. Eskiden tablo 960 piksel
  genişliğe sabitlenip kartın içinde yatay kayıyordu ve bunu hiçbir şey
  söylemiyordu: telefonda yalnızca "İddia" ve "Bölüm" görünüyor, destek
  düzeyi, eksik kanıt ve önerilen düzeltme ekranın dışında kalıyordu —
  sütunlar sessizce gizlenmişti.

  Şimdi:
  - TELEFONDA tablo yerine kart listesi: her satır bir kart, birincil
    sütun başlıkta, öteki SÜTUNLARIN HEPSİ başlıklarıyla birlikte
    (dt/dd) — bilgi eksilmiyor, yalnızca yerleşim değişiyor.
  - Tablet ve masaüstünde gerçek tablo; birincil sütun yapışık, tablo
    taşıyorsa bunu yazan bir satır çıkar ve kaydırma alanı klavyeyle
    odaklanabilir (ok tuşlarıyla kayar; WCAG 2.1.1).
  - Sıralama: başlıktaki düğme (aria-sort), telefonda bir seçim kutusu.
    Sıralama değeri satırla birlikte verilir; hücrenin çizimi (rozet,
    pencere düğmesi) sıralamaya karışmaz. Boş değer her yönde sonda
    (lib/os/sayfa-standardi.ts).

  Hücreler sunucuda çizilebilir (içinde pencere ya da sunucu işlemi olan
  düğmeler). Tablo ile kartlar CSS'le değil ekran sınıfıyla seçiliyor:
  ikisi birden çizilse her satırın penceresi iki kez doğardı.
*/
export type VeriSutunu = {
  anahtar: string;
  baslik: string;
  siralanabilir?: boolean;
  /** Satırın adı: tabloda ilk ve yapışık sütun, kartta başlık. Bir tane olmalı. */
  birincil?: boolean;
};
export type VeriSatiri = {
  id: string;
  hucreler: Record<string, ReactNode>;
  degerler?: Record<string, SiralamaDegeri>;
};

export default function VeriTablosu({
  etiket,
  sutunlar,
  satirlar,
  ilkSira = null,
}: {
  /** Tablonun adı (caption) ve kaydırma alanının etiketi. */
  etiket: string;
  sutunlar: VeriSutunu[];
  satirlar: VeriSatiri[];
  ilkSira?: { anahtar: string; yon: SiralamaYonu } | null;
}) {
  const t = useCeviri();
  const dil = useDil();
  const ekran = useEkranSinifi();
  const kimlik = useId();
  const [sira, setSira] = useState(ilkSira);
  const alan = useRef<HTMLDivElement>(null);
  const [tasiyor, setTasiyor] = useState(false);

  const birincil = sutunlar.find((s) => s.birincil) ?? sutunlar[0];
  const digerleri = sutunlar.filter((s) => s !== birincil);
  const sirali = sira ? sirala(satirlar, (s) => s.degerler?.[sira.anahtar], sira.yon, YEREL[dil]) : satirlar;
  const siralanabilir = sutunlar.filter((s) => s.siralanabilir);

  useEffect(() => {
    const el = alan.current;
    if (!el) return;
    const olc = () => setTasiyor(el.scrollWidth > el.clientWidth + 1);
    olc();
    const gozcu = new ResizeObserver(olc);
    gozcu.observe(el);
    return () => gozcu.disconnect();
  }, [ekran]);

  if (ekran === "telefon") {
    return (
      <div className="veri-kartlari-kap">
        {siralanabilir.length ? (
          <label className="veri-sirala">
            <span>{t({ tr: "Sırala", en: "Sort" })}</span>
            <select
              className="compact-select"
              value={sira ? `${sira.anahtar}:${sira.yon}` : ""}
              onChange={(e) => {
                const [anahtar, yon] = e.target.value.split(":");
                setSira(anahtar ? { anahtar, yon: yon as SiralamaYonu } : null);
              }}
            >
              <option value="">{t({ tr: "Eklenme sırası", en: "Order added" })}</option>
              {siralanabilir.flatMap((s) => [
                <option key={`${s.anahtar}:artan`} value={`${s.anahtar}:artan`}>{`${s.baslik} ↑`}</option>,
                <option key={`${s.anahtar}:azalan`} value={`${s.anahtar}:azalan`}>{`${s.baslik} ↓`}</option>,
              ])}
            </select>
          </label>
        ) : null}
        <ul className="veri-kartlari" aria-label={etiket}>
          {sirali.map((satir) => (
            <li key={satir.id} className="veri-karti">
              <div className="veri-karti-bas">{satir.hucreler[birincil.anahtar]}</div>
              <dl>
                {digerleri.map((s) => (
                  <div key={s.anahtar}>
                    <dt>{s.baslik}</dt>
                    <dd>{satir.hucreler[s.anahtar] ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="veri-tablo-kap">
      {tasiyor ? (
        <p className="veri-tablo-ipucu" id={`${kimlik}-ipucu`}>
          {t({
            tr: `${sutunlar.length} sütunun tamamı için tabloyu yatay kaydırın.`,
            en: `Scroll the table sideways to see all ${sutunlar.length} columns.`,
          })}
        </p>
      ) : null}
      <div
        ref={alan}
        className="veri-tablo-sarici"
        role="region"
        aria-label={etiket}
        aria-describedby={tasiyor ? `${kimlik}-ipucu` : undefined}
        tabIndex={tasiyor ? 0 : undefined}
        data-tasiyor={tasiyor || undefined}
      >
        <table className="veri-tablo">
          <caption className="sr-only">{etiket}</caption>
          <thead>
            <tr>
              {[birincil, ...digerleri].map((s) => {
                const etkin = sira?.anahtar === s.anahtar ? sira.yon : null;
                return (
                  <th
                    key={s.anahtar}
                    scope="col"
                    className={s === birincil ? "veri-tablo-birincil" : undefined}
                    aria-sort={etkin === "artan" ? "ascending" : etkin === "azalan" ? "descending" : undefined}
                  >
                    {s.siralanabilir ? (
                      <button type="button" className="veri-tablo-sirala" onClick={() => setSira((x) => sonrakiSiralama(x, s.anahtar))}>
                        {s.baslik}
                        {etkin === "artan" ? <ArrowUp size={13} aria-hidden="true" /> : etkin === "azalan" ? <ArrowDown size={13} aria-hidden="true" /> : <ArrowUpDown size={13} aria-hidden="true" />}
                      </button>
                    ) : (
                      s.baslik
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sirali.map((satir) => (
              <tr key={satir.id}>
                <th scope="row" className="veri-tablo-birincil">
                  {satir.hucreler[birincil.anahtar]}
                </th>
                {digerleri.map((s) => (
                  <td key={s.anahtar}>{satir.hucreler[s.anahtar] ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
