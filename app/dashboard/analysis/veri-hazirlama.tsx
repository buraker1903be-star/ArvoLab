"use client";

import { useState } from "react";
import { Copy, Wand2 } from "lucide-react";
import { aralikTahmini, olcekPuani, tersKodla, type PuanTuru, type TuretmeSonucu } from "@/lib/veri-hazirlama";
import type { VeriSatiri } from "@/lib/veri-eslestirme";
import { showToast } from "@/app/dashboard/_components/toast-events";
import SutunSecimi from "./sutun-secimi";

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

  const bosNotu = (sonuc: TuretmeSonucu, neden: string) =>
    sonuc.bos ? ` ${sonuc.bos} kişide ${neden}; puanı boş bırakıldı.` : "";

  const tersCevir = () => {
    setHata(null);
    setUyari(null);
    if (!tersMaddeler.length) return setHata("Ters çevrilecek maddeleri seçin.");
    if (!Number.isFinite(aralik.min) || !Number.isFinite(aralik.max) || aralik.min >= aralik.max) {
      return setHata("Ölçeğin en küçük ve en büyük değerini yazın (ör. 1 ve 5).");
    }
    let guncel = satirlar;
    const adlar = [...sutunlar];
    const yeniler: Turetilen[] = [];
    let aralikDisi = 0;
    for (const madde of tersMaddeler) {
      const sonuc = tersKodla(guncel, madde, aralik, adlar);
      guncel = sonuc.satirlar;
      adlar.push(sonuc.sutun);
      aralikDisi += sonuc.bos;
      yeniler.push({ sutun: sonuc.sutun, aciklama: `${madde} ters çevrildi (${aralik.min}–${aralik.max})`, spss: sonuc.spss });
    }
    ekle(guncel, yeniler.map((y) => y.sutun));
    setTuretilenler((t) => [...t, ...yeniler]);
    setTersMaddeler([]);
    showToast("success", `${yeniler.length} madde ters çevrildi: ${yeniler.map((y) => y.sutun).join(", ")}.`);
    setUyari(aralikDisi ? `${aralikDisi} hücre ölçek aralığı (${aralik.min}–${aralik.max}) dışında olduğu için boş bırakıldı; verinizde giriş hatası olabilir.` : null);
  };

  const puanHesapla = () => {
    setHata(null);
    setUyari(null);
    try {
      const sonuc = olcekPuani(satirlar, puanMaddeleri, puanTuru, puanAdi, sutunlar);
      ekle(sonuc.satirlar, [sonuc.sutun]);
      setTuretilenler((t) => [
        ...t,
        {
          sutun: sonuc.sutun,
          aciklama: `${puanMaddeleri.length} maddenin ${puanTuru === "ortalama" ? "ortalaması" : "toplamı"}`,
          spss: sonuc.spss,
        },
      ]);
      setPuanMaddeleri([]);
      showToast("success", `"${sonuc.sutun}" sütunu eklendi.`);
      setUyari(sonuc.bos ? `"${sonuc.sutun}":${bosNotu(sonuc, "en az bir madde boş")}` : null);
    } catch (e) {
      setHata(e instanceof Error ? e.message : "Puan hesaplanamadı.");
    }
  };

  const spssKopyala = async () => {
    try {
      await navigator.clipboard.writeText(turetilenler.map((t) => t.spss).join("\n"));
      showToast("success", "SPSS sözdizimi kopyalandı.");
    } catch {
      showToast("error", "Panoya kopyalanamadı; metni seçip elle kopyalayın.");
    }
  };

  return (
    <details className="analiz-betik mb-md">
      <summary>
        <Wand2 size={14} className="inline-icon" aria-hidden="true" />
        Veri hazırlama: ters madde ve ölçek puanı
        {turetilenler.length ? ` · ${turetilenler.length} yeni sütun` : ""}
      </summary>
      <div className="veri-hazirlama mt-sm">
        <p className="hint">
          Olumsuz yazılmış maddeleri önce ters çevirin, sonra alt boyut ya da toplam puanı hesaplayın. Yeni sütunlar
          bütün analizlerde seçilebilir; dosyanız değişmez.
        </p>

        <SutunSecimi etiket="1. Ters çevrilecek maddeler" sutunlar={sayisalSutunlar} secili={tersMaddeler} degistir={setTersMaddeler} />
        <div className="project-form-grid">
          <label>
            <span>Ölçeğin en küçük değeri</span>
            <input inputMode="numeric" value={enKucuk} onChange={(e) => setEnKucuk(e.target.value)} placeholder={tahmin ? String(tahmin.min) : "1"} />
          </label>
          <label>
            <span>Ölçeğin en büyük değeri</span>
            <input inputMode="numeric" value={enBuyuk} onChange={(e) => setEnBuyuk(e.target.value)} placeholder={tahmin ? String(tahmin.max) : "5"} />
          </label>
        </div>
        <div className="cluster">
          <button type="button" className="projects-filter-button" onClick={tersCevir} disabled={!tersMaddeler.length}>
            Ters çevir
          </button>
          {tersMaddeler.length && Number.isFinite(aralik.min) && Number.isFinite(aralik.max) ? (
            <small className="muted">
              {aralik.min} ↔ {aralik.max}, yeni değer = {aralik.min + aralik.max} − eski değer
            </small>
          ) : null}
        </div>

        <SutunSecimi etiket="2. Puanı oluşturacak maddeler" sutunlar={sayisalSutunlar} secili={puanMaddeleri} degistir={setPuanMaddeleri}
          ipucu="Ters maddelerin yerine çevrilmiş (_ters) sütunlarını seçin." />
        <div className="project-form-grid">
          <label>
            <span>Yeni sütunun adı</span>
            <input value={puanAdi} onChange={(e) => setPuanAdi(e.target.value)} maxLength={60} />
          </label>
          <label>
            <span>Puan</span>
            <select value={puanTuru} onChange={(e) => setPuanTuru(e.target.value as PuanTuru)}>
              <option value="ortalama">Madde ortalaması (ölçek aralığında, ör. 1–5)</option>
              <option value="toplam">Madde toplamı</option>
            </select>
          </label>
        </div>
        <div className="cluster">
          <button type="button" className="projects-filter-button" onClick={puanHesapla} disabled={puanMaddeleri.length < 2}>
            Puanı hesapla
          </button>
          <small className="muted">Maddelerinden biri boş olan kişinin puanı boş kalır.</small>
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
              {turetilenler.map((t) => (
                <li key={t.sutun}>
                  <span>
                    <b>{t.sutun}</b> <small className="muted">· {t.aciklama}</small>
                  </span>
                  <code>{t.spss}</code>
                </li>
              ))}
            </ul>
            <div className="cluster">
              <button type="button" className="projects-filter-button button-compact" onClick={spssKopyala}>
                <Copy size={14} aria-hidden="true" /> SPSS sözdizimini kopyala
              </button>
              <small className="muted">Aynı sütunları SPSS&apos;te kurmak için.</small>
            </div>
          </>
        ) : null}
      </div>
    </details>
  );
}
