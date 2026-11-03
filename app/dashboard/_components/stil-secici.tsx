"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { STIL_SECENEKLERI } from "@/lib/atif/stiller";
import { cslCoz, cslGorunenAd } from "@/lib/atif/csl-kimlik";
import { cslStilAra, cslStilBilgisi } from "@/app/actions/csl";
import type { CslSecenegi } from "@/lib/atif/csl-dizin";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  ATIF STİLİ SEÇİCİ (03.11.2026). Yedi yerleşik stil (Türkçe kuralları
  ArvoLab'da yazılı) + CSL deposundaki ~10 800 dergi/yayınevi stili.

  Eskiden aynı <select> beş formda ayrı ayrı yazılıydı; CSL araması
  eklenirken beşine birden kopyalamak, birinde unutulmuş bir stilin
  "tanınmıyor" diye düşmesi demekti. Form içinde `name` ile gizli girdi
  yazar; denetimli kullanımda `value`/`onChange`.
*/

const ARA = "__csl_ara__";
const KOD_ETIKETI = {
  a: { tr: "yazar–tarih", en: "author–date" },
  k: { tr: "numaralı [1]", en: "numbered [1]" },
  p: { tr: "numaralı (1)", en: "numbered (1)" },
  s: { tr: "numaralı ¹", en: "numbered ¹" },
  d: { tr: "dipnot", en: "footnote" },
  y: { tr: "yazar–sayfa", en: "author–page" },
} as const;

export default function StilSecici({
  name,
  value,
  defaultValue = "apa7",
  onChange,
  disabled,
  bosEtiket,
  id,
  kutuRef,
  className,
  gecersiz,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (deger: string) => void;
  disabled?: boolean;
  /** Verilirse en başta boş seçenek ("Seçin"). */
  bosEtiket?: string;
  id?: string;
  /** Doğrulama hatasında kutuya kaydırıp odaklamak için. */
  kutuRef?: Ref<HTMLSelectElement>;
  className?: string;
  gecersiz?: boolean;
}) {
  const t = useCeviri();
  const [icDeger, setIcDeger] = useState(value ?? defaultValue);
  const deger = value ?? icDeger;
  const [ariyor, setAriyor] = useState(false);
  const [sorgu, setSorgu] = useState("");
  const [sonuclar, setSonuclar] = useState<CslSecenegi[] | null>(null);
  const [adlar, setAdlar] = useState<Record<string, string>>({});
  const istek = useRef(0);

  const sec = (yeni: string) => {
    if (value === undefined) setIcDeger(yeni);
    onChange?.(yeni);
  };

  // Kayıtlı CSL stilinin gerçek başlığı (dosya adından türetilen ad yalnızca yedek).
  useEffect(() => {
    if (!cslCoz(deger) || adlar[deger]) return;
    let iptal = false;
    void cslStilBilgisi(deger).then((bilgi) => {
      if (!iptal && bilgi) setAdlar((onceki) => ({ ...onceki, [deger]: bilgi.ad }));
    });
    return () => {
      iptal = true;
    };
  }, [deger, adlar]);

  useEffect(() => {
    if (!ariyor) return;
    const temiz = sorgu.trim();
    // İki harften kısa sorgu aranmaz; eski sonuçlar aşağıda gizleniyor.
    if (temiz.length < 2) return;
    const no = ++istek.current;
    const zamanlayici = setTimeout(() => {
      void cslStilAra(temiz).then((cevap) => {
        if (no === istek.current) setSonuclar(cevap.stiller ?? []);
      });
    }, 250);
    return () => clearTimeout(zamanlayici);
  }, [sorgu, ariyor]);

  const csl = cslCoz(deger);
  const cslAdi = csl ? adlar[deger] ?? cslGorunenAd(deger) : "";

  return (
    <>
      {/* Devre dışı seçim forma eklenmez (sunucu mevcut değeri korur); gizli girdi de öyle. */}
      {name && !disabled ? <input type="hidden" name={name} value={deger} /> : null}
      <select
        id={id}
        ref={kutuRef}
        className={className}
        aria-invalid={gecersiz || undefined}
        value={deger}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === ARA) {
            setAriyor(true);
            return;
          }
          setAriyor(false);
          sec(e.target.value);
        }}
      >
        {bosEtiket !== undefined ? <option value="">{bosEtiket}</option> : null}
        {STIL_SECENEKLERI.map((secenek) => (
          <option key={secenek.deger} value={secenek.deger}>
            {secenek.etiket}
          </option>
        ))}
        {csl ? <option value={deger}>{cslAdi}</option> : null}
        <option value={ARA}>{t({ tr: "Dergi ya da yayınevi stili ara…", en: "Search journal or publisher styles…" })}</option>
      </select>
      {ariyor && !disabled ? (
        <div className="stack-sm">
          <input
            className="picker-search"
            type="search"
            autoFocus
            value={sorgu}
            maxLength={100}
            placeholder={t({ tr: "Dergi, yayınevi ya da stil adı (ör. Nature, AMA, Elsevier)", en: "Journal, publisher or style name (e.g. Nature, AMA, Elsevier)" })}
            onChange={(e) => setSorgu(e.target.value)}
          />
          {sonuclar === null || sorgu.trim().length < 2 ? null : sonuclar.length === 0 ? (
            <p className="muted text-sm">{t({ tr: "Bu adla bir stil bulunamadı.", en: "No style found with that name." })}</p>
          ) : (
            <ul className="picker-list">
              {sonuclar.map((s) => (
                <li key={s.deger}>
                  <div className="picker-item">
                    <button
                      type="button"
                      className="picker-main"
                      onClick={() => {
                        setAdlar((onceki) => ({ ...onceki, [s.deger]: s.ad }));
                        sec(s.deger);
                        setAriyor(false);
                        setSorgu("");
                        setSonuclar(null);
                      }}
                    >
                      <strong>{s.ad}</strong>
                      <small>{t(KOD_ETIKETI[s.kod])}</small>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <small className="muted">
            {t({
              tr: "Stiller: Citation Style Language projesi (CC BY-SA 3.0). Biçimleme: citeproc-js (CPAL 1.0). Bu stillerde künye biçimi denetlenmez; atıf–kaynakça eşleşmesi denetlenir.",
              en: "Styles: Citation Style Language project (CC BY-SA 3.0). Formatting: citeproc-js (CPAL 1.0). In these styles the reference format is not checked; citation–reference matching is.",
            })}
          </small>
        </div>
      ) : null}
    </>
  );
}
