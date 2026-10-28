"use client";

import { useState } from "react";
import { Copy, Wand2 } from "lucide-react";
import { aralikTahmini, olcekPuani, tersKodla, type PuanTuru, type TuretmeSonucu } from "@/lib/veri-hazirlama";
import type { VeriSatiri } from "@/lib/veri-eslestirme";
import { showToast } from "@/app/dashboard/_components/toast-events";
import SutunSecimi from "./sutun-secimi";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";

/*
  VERİ HAZIRLAMA (27.10.2026): ters madde ve ölçek/alt boyut puanı.

  Hesap lib/veri-hazirlama.ts'te; bu bileşen yalnızca formu tutuyor.
  Türetilen sütun yüklenen tabloya eklenir ve bütün testlerde seçilebilir;
  dosya değişmez, sunucuya gitmez. Her işlemin SPSS karşılığı listede
  duruyor ve tek düğmeyle kopyalanıyor.
*/
type Turetilen = { sutun: string; aciklama: string; spss: string };

export default function VeriHazirlama({
  satirlar,
  sutunlar,
  sayisalSutunlar,
  ekle,
}: {
  satirlar: VeriSatiri[];
  sutunlar: string[];
  sayisalSutunlar: string[];
  /** Yeni sütunu taşıyan satırları ve sütun adını tabloya yazar. */
  ekle: (satirlar: VeriSatiri[], yeniSutunlar: string[]) => void;
}) {
  const t = useCeviri();
  const dil = useDil();
  const [tersMaddeler, setTersMaddeler] = useState<string[]>([]);
  const [enKucuk, setEnKucuk] = useState("");
  const [enBuyuk, setEnBuyuk] = useState("");
  const [puanMaddeleri, setPuanMaddeleri] = useState<string[]>([]);
  const [puanAdi, setPuanAdi] = useState("olcek_puani");
  const [puanTuru, setPuanTuru] = useState<PuanTuru>("ortalama");
  const [turetilenler, setTuretilenler] = useState<Turetilen[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  /* Boş kalan hücreler kalıcı notta: bildirim birkaç saniyede kaybolur, N'in neden küçüldüğü kalmalı. */
  const [uyari, setUyari] = useState<string | null>(null);

  /* Aralık kutusu boşsa seçili maddelerden tahmin edilir; kullanıcı düzeltebilir. */
  const tahmin = aralikTahmini(satirlar, tersMaddeler);
  const aralik = {
    min: enKucuk.trim() ? Number(enKucuk) : tahmin?.min ?? NaN,
    max: enBuyuk.trim() ? Number(enBuyuk) : tahmin?.max ?? NaN,
  };

  const bosNotu = (sonuc: TuretmeSonucu) =>
    sonuc.bos
      ? t({
          tr: ` ${sonuc.bos} kişide en az bir madde boş; puanı boş bırakıldı.`,
          en: ` at least one item is missing for ${sonuc.bos} participant(s); their score was left blank.`,
        })
      : "";

  const tersCevir = () => {
    setHata(null);
    setUyari(null);
    if (!tersMaddeler.length) return setHata(t({ tr: "Ters çevrilecek maddeleri seçin.", en: "Select the items to reverse-score." }));
    if (!Number.isFinite(aralik.min) || !Number.isFinite(aralik.max) || aralik.min >= aralik.max) {
      return setHata(t({ tr: "Ölçeğin en küçük ve en büyük değerini yazın (ör. 1 ve 5).", en: "Enter the scale's minimum and maximum values (e.g. 1 and 5)." }));
    }
    let guncel = satirlar;
    const adlar = [...sutunlar];
    const yeniler: Turetilen[] = [];
    let aralikDisi = 0;
    for (const madde of tersMaddeler) {
      const sonuc = tersKodla(guncel, madde, aralik, adlar, dil);
      guncel = sonuc.satirlar;
      adlar.push(sonuc.sutun);
      aralikDisi += sonuc.bos;
      yeniler.push({ sutun: sonuc.sutun, aciklama: t({ tr: `${madde} ters çevrildi (${aralik.min}–${aralik.max})`, en: `${madde} reverse-scored (${aralik.min}–${aralik.max})` }), spss: sonuc.spss });
    }
    ekle(guncel, yeniler.map((y) => y.sutun));
    setTuretilenler((onceki) => [...onceki, ...yeniler]);
    setTersMaddeler([]);
    showToast(
      "success",
      t({
        tr: `${yeniler.length} madde ters çevrildi: ${yeniler.map((y) => y.sutun).join(", ")}.`,
        en: `${yeniler.length} item(s) reverse-scored: ${yeniler.map((y) => y.sutun).join(", ")}.`,
      }),
    );
    setUyari(
      aralikDisi
        ? t({
            tr: `${aralikDisi} hücre ölçek aralığı (${aralik.min}–${aralik.max}) dışında olduğu için boş bırakıldı; verinizde giriş hatası olabilir.`,
            en: `${aralikDisi} cell(s) were left blank because they fall outside the scale range (${aralik.min}–${aralik.max}); your data may contain entry errors.`,
          })
        : null,
    );
  };

  const puanHesapla = () => {
    setHata(null);
    setUyari(null);
    try {
      const sonuc = olcekPuani(satirlar, puanMaddeleri, puanTuru, puanAdi, sutunlar, dil);
      ekle(sonuc.satirlar, [sonuc.sutun]);
      setTuretilenler((onceki) => [
        ...onceki,
        {
          sutun: sonuc.sutun,
          aciklama:
            puanTuru === "ortalama"
              ? t({ tr: `${puanMaddeleri.length} maddenin ortalaması`, en: `mean of ${puanMaddeleri.length} items` })
              : t({ tr: `${puanMaddeleri.length} maddenin toplamı`, en: `sum of ${puanMaddeleri.length} items` }),
          spss: sonuc.spss,
        },
      ]);
      setPuanMaddeleri([]);
      showToast("success", t({ tr: `"${sonuc.sutun}" sütunu eklendi.`, en: `Column "${sonuc.sutun}" added.` }));
      setUyari(sonuc.bos ? `"${sonuc.sutun}":${bosNotu(sonuc)}` : null);
    } catch (e) {
      setHata(e instanceof Error ? e.message : t({ tr: "Puan hesaplanamadı.", en: "The score could not be computed." }));
    }
  };

  const spssKopyala = async () => {
    try {
      await navigator.clipboard.writeText(turetilenler.map((r) => r.spss).join("\n"));
      showToast("success", t({ tr: "SPSS sözdizimi kopyalandı.", en: "SPSS syntax copied." }));
    } catch {
      showToast("error", t({ tr: "Panoya kopyalanamadı; metni seçip elle kopyalayın.", en: "Could not copy to the clipboard; select the text and copy it manually." }));
    }
  };

  return (
    <details className="analiz-betik mb-md">
      <summary>
        <Wand2 size={14} className="inline-icon" aria-hidden="true" />
        {t({ tr: "Veri hazırlama: ters madde ve ölçek puanı", en: "Data preparation: reverse items and scale scores" })}
        {turetilenler.length ? t({ tr: ` · ${turetilenler.length} yeni sütun`, en: ` · ${turetilenler.length} new column(s)` }) : ""}
      </summary>
      <div className="veri-hazirlama mt-sm">
        <p className="hint">
          {t({
            tr: "Olumsuz yazılmış maddeleri önce ters çevirin, sonra alt boyut ya da toplam puanı hesaplayın. Yeni sütunlar bütün analizlerde seçilebilir; dosyanız değişmez.",
            en: "Reverse-score negatively worded items first, then compute subscale or total scores. The new columns can be selected in every analysis; your file is not changed.",
          })}
        </p>

        <SutunSecimi etiket={t({ tr: "1. Ters çevrilecek maddeler", en: "1. Items to reverse-score" })} sutunlar={sayisalSutunlar} secili={tersMaddeler} degistir={setTersMaddeler} />
        <div className="project-form-grid">
          <label>
            <span>{t({ tr: "Ölçeğin en küçük değeri", en: "Scale minimum" })}</span>
            <input inputMode="numeric" value={enKucuk} onChange={(e) => setEnKucuk(e.target.value)} placeholder={tahmin ? String(tahmin.min) : "1"} />
          </label>
          <label>
            <span>{t({ tr: "Ölçeğin en büyük değeri", en: "Scale maximum" })}</span>
            <input inputMode="numeric" value={enBuyuk} onChange={(e) => setEnBuyuk(e.target.value)} placeholder={tahmin ? String(tahmin.max) : "5"} />
          </label>
        </div>
        <div className="cluster">
          <button type="button" className="projects-filter-button" onClick={tersCevir} disabled={!tersMaddeler.length}>
            {t({ tr: "Ters çevir", en: "Reverse-score" })}
          </button>
          {tersMaddeler.length && Number.isFinite(aralik.min) && Number.isFinite(aralik.max) ? (
            <small className="muted">
              {aralik.min} ↔ {aralik.max},{" "}
              {t({
                tr: `yeni değer = ${aralik.min + aralik.max} − eski değer`,
                en: `new value = ${aralik.min + aralik.max} − old value`,
              })}
            </small>
          ) : null}
        </div>

        <SutunSecimi etiket={t({ tr: "2. Puanı oluşturacak maddeler", en: "2. Items making up the score" })} sutunlar={sayisalSutunlar} secili={puanMaddeleri} degistir={setPuanMaddeleri}
          ipucu={t({ tr: "Ters maddelerin yerine çevrilmiş (_ters) sütunlarını seçin.", en: "For reversed items, select the reverse-scored (_ters) columns instead." })} />
        <div className="project-form-grid">
          <label>
            <span>{t({ tr: "Yeni sütunun adı", en: "New column name" })}</span>
            <input value={puanAdi} onChange={(e) => setPuanAdi(e.target.value)} maxLength={60} />
          </label>
          <label>
            <span>{t({ tr: "Puan", en: "Score" })}</span>
            <select value={puanTuru} onChange={(e) => setPuanTuru(e.target.value as PuanTuru)}>
              <option value="ortalama">{t({ tr: "Madde ortalaması (ölçek aralığında, ör. 1–5)", en: "Item mean (within the scale range, e.g. 1–5)" })}</option>
              <option value="toplam">{t({ tr: "Madde toplamı", en: "Item sum" })}</option>
            </select>
          </label>
        </div>
        <div className="cluster">
          <button type="button" className="projects-filter-button" onClick={puanHesapla} disabled={puanMaddeleri.length < 2}>
            {t({ tr: "Puanı hesapla", en: "Compute score" })}
          </button>
          <small className="muted">{t({ tr: "Maddelerinden biri boş olan kişinin puanı boş kalır.", en: "A participant with any missing item gets a blank score." })}</small>
        </div>

        {hata ? (
          <p className="alert" data-tone="danger" role="alert">
            {hata}
          </p>
        ) : null}

        {uyari ? (
          <p className="alert" data-tone="warning" role="status">
            {uyari}
          </p>
        ) : null}

        {turetilenler.length ? (
          <>
            <ul className="turetilen-sutunlar">
              {turetilenler.map((r) => (
                <li key={r.sutun}>
                  <span>
                    <b>{r.sutun}</b> <small className="muted">· {r.aciklama}</small>
                  </span>
                  <code>{r.spss}</code>
                </li>
              ))}
            </ul>
            <div className="cluster">
              <button type="button" className="projects-filter-button button-compact" onClick={spssKopyala}>
                <Copy size={14} aria-hidden="true" /> {t({ tr: "SPSS sözdizimini kopyala", en: "Copy SPSS syntax" })}
              </button>
              <small className="muted">{t({ tr: "Aynı sütunları SPSS'te kurmak için.", en: "To build the same columns in SPSS." })}</small>
            </div>
          </>
        ) : null}
      </div>
    </details>
  );
}
