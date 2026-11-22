"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, HelpCircle, Search } from "lucide-react";
import { ANALIZ_ETIKETLERI_METIN, type AnalizTuru } from "@/lib/analiz-turleri";
import { ANALIZ_KATEGORILERI, kategorileriSuz, turunKategorisi } from "@/lib/analiz-kategorileri";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import AnalizYardimi from "./analiz-yardimi";

/*
  SOL ANALİZ GEZGİNİ (22.11.2026, onaylı "A — Analiz çalışma alanı").

  Eskiden yöntem seçimi sağ kartın içinde 25 kutuluk bir ızgaraydı ve
  seçim yapılınca katlanıyordu: başka bir analize geçmek için "Değiştir",
  sonra ızgarayı tarama, sonra tıklama gerekiyordu. Hangi analizlerin
  var olduğu da yalnızca o ızgara açıkken görünüyordu.

  Şimdi liste solda sürekli duruyor; kategoriler SPSS/jamovi
  menülerindeki başlıklarla (lib/analiz-kategorileri.ts). Arama
  kısaltmaları da buluyor ("AFA", "U testi", "RM ANOVA").

  LİSTE VERİ OLMADAN DA GEZİLİR: öğrenci programın ne yapabildiğini
  dosya yüklemeden görebilmeli. Seçim de yapılabilir — hesaplamayı
  engelleyen sağdaki çalışma alanı (veri yoksa "Analizi Çalıştır" hiç
  çizilmiyor), gezgin değil.
*/
export default function AnalizGezgini({
  secili,
  sec,
  veriYuklu,
}: {
  secili: AnalizTuru;
  sec: (tur: AnalizTuru) => void;
  veriYuklu: boolean;
}) {
  const t = useCeviri();
  const dil = useDil();
  const [terim, setTerim] = useState("");
  const [yardimAcik, setYardimAcik] = useState(false);
  /*
    TELEFONDA İKİ AYRI GÖRÜNÜM (Kaynaklar'daki liste↔panel kuralının
    aynısı). Yedi kategori çalışma alanının üstünde alt alta dururken
    öğrenci veri yükleme alanına ulaşmak için bütün listeyi kaydırıyordu.
    Şimdi telefonda gezgin tek satırlık bir özete iniyor; "Değiştir"
    listeyi tam ekran açıyor, analiz seçilince çalışma alanına dönülüyor.
    Masaüstünde bu durum hiç okunmuyor (yalnızca CSS, ≤760 px).
  */
  const [telefonListe, setTelefonListe] = useState(false);
  /*
    Açık kategoriler: başlangıçta yalnızca seçili analizin kategorisi
    açık. Yedi kategoriyi birden açmak listeyi 25 satıra çıkarıp
    telefonda çalışma alanını ekrandan atıyordu.
  */
  const [elleAcilan, setElleAcilan] = useState<Set<string>>(
    () => new Set([turunKategorisi(secili)?.anahtar ?? ANALIZ_KATEGORILERI[0].anahtar]),
  );

  const aramada = terim.trim().length > 0;
  const suzulen = useMemo(() => kategorileriSuz(terim), [terim]);

  const kategoriAcikMi = (anahtar: string) =>
    /* Aramada eşleşen her kategori açık: sonucu bulmak için ayrıca tıklamak gerekmesin. */
    aramada || elleAcilan.has(anahtar);

  const kategoriCevir = (anahtar: string) =>
    setElleAcilan((eski) => {
      const yeni = new Set(eski);
      if (yeni.has(anahtar)) yeni.delete(anahtar);
      else yeni.add(anahtar);
      return yeni;
    });

  const analizSec = (tur: AnalizTuru) => {
    sec(tur);
    setTelefonListe(false);
    /* Seçilen analizin kategorisi açık kalsın: kapalı kategoride seçili satır görünmez. */
    const kategori = turunKategorisi(tur);
    if (kategori) setElleAcilan((eski) => new Set(eski).add(kategori.anahtar));
  };

  return (
    <div className="analiz-gezgin" data-telefon={telefonListe ? "liste" : "ozet"}>
      {/* Telefon özeti: masaüstünde hiç çizilmez (app/styles/analiz-alani.css). */}
      <div className="analiz-gezgin-telefon">
        <span>
          <small>{t({ tr: "Analiz", en: "Analysis" })}</small>
          <b>{ANALIZ_ETIKETLERI_METIN[secili][dil]}</b>
        </span>
        <button type="button" className="projects-filter-button button-compact" onClick={() => setTelefonListe(true)}>
          {t({ tr: "Değiştir", en: "Change" })}
        </button>
      </div>
      <button type="button" className="analiz-gezgin-geri" onClick={() => setTelefonListe(false)}>
        <ArrowLeft size={15} aria-hidden="true" />
        {t({ tr: "Çalışma alanına dön", en: "Back to the workspace" })}
      </button>
      <div className="analiz-gezgin-ust">
        <label className="analiz-gezgin-arama">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={terim}
            onChange={(e) => setTerim(e.target.value)}
            placeholder={t({ tr: "Analiz ara", en: "Search analyses" })}
            aria-label={t({ tr: "Analiz ara (Türkçe, İngilizce ya da kısaltma)", en: "Search analyses (Turkish, English or abbreviation)" })}
          />
        </label>
      </div>

      {/*
        YARDIM İKİNCİL BİR BAĞLANTI, listenin önüne geçmiyor: adını
        bilen kullanıcı doğrudan arar. Panel aynı ekranda açılıyor,
        başka sayfaya götürmüyor.

        Arama kutusunun DIŞINDA duruyor: telefonun özet kipinde liste ve
        arama gizlenirken yardım erişilebilir kalmalı. Eskiden kutunun
        içindeydi ve telefonda analiz adını bilmeyen kullanıcı yardıma
        hiç ulaşamıyordu.
      */}
      <button
        type="button"
        className="analiz-gezgin-yardim"
        aria-expanded={yardimAcik}
        aria-controls="analiz-yardim-paneli"
        onClick={() => setYardimAcik((a) => !a)}
      >
        <HelpCircle size={14} aria-hidden="true" />
        {t({ tr: "Hangi analizi seçmeliyim?", en: "Which analysis should I choose?" })}
      </button>

      {yardimAcik ? (
        <AnalizYardimi
          id="analiz-yardim-paneli"
          kapat={() => setYardimAcik(false)}
          analiziAc={(tur) => {
            analizSec(tur);
            setYardimAcik(false);
          }}
        />
      ) : null}

      {!veriYuklu ? (
        /*
          Veri yüklenmedi: liste gezilebilir ama hesap başlamaz. Bunu
          gezginde yazmak, sağdaki boş çalışma alanına bakıp "neden
          çalışmıyor" diye arayan kullanıcıyı bekletmemek için.
        */
        <p className="analiz-gezgin-not" role="status">
          {t({
            tr: "Listeyi şimdi gezebilirsiniz. Hesaplama için sağdan veri yükleyin.",
            en: "You can browse the list now. To compute, upload data on the right.",
          })}
        </p>
      ) : null}

      {aramada && suzulen.length === 0 ? (
        <div className="analiz-gezgin-bos" role="status">
          <p>
            <b>{t({ tr: `“${terim.trim()}” için sonuç yok.`, en: `No results for “${terim.trim()}”.` })}</b>
          </p>
          <p className="muted text-sm">
            {t({
              tr: "Aradığınız yöntem ArvoLab'da henüz olmayabilir. Türkçe adıyla, İngilizce adıyla ya da kısaltmasıyla da deneyebilirsiniz (ANOVA, AFA, U testi).",
              en: "The method you are looking for may not be in ArvoLab yet. You can also try its Turkish name, English name or abbreviation (ANOVA, EFA, U test).",
            })}
          </p>
          <button type="button" className="projects-filter-button button-compact" onClick={() => setTerim("")}>
            {t({ tr: "Aramayı temizle", en: "Clear search" })}
          </button>
        </div>
      ) : null}

      <nav aria-label={t({ tr: "Analizler", en: "Analyses" })}>
        {suzulen.map(({ kategori, turler }) => {
          const acik = kategoriAcikMi(kategori.anahtar);
          const govdeId = `analiz-kategori-${kategori.anahtar}`;
          return (
            <section key={kategori.anahtar} className="analiz-kategori">
              <h3>
                <button
                  type="button"
                  className="analiz-kategori-bas"
                  aria-expanded={acik}
                  aria-controls={govdeId}
                  onClick={() => kategoriCevir(kategori.anahtar)}
                >
                  <ChevronDown size={14} aria-hidden="true" data-acik={acik ? "1" : undefined} />
                  <span>{t(kategori.ad)}</span>
                  <small>{turler.length}</small>
                </button>
              </h3>
              <ul id={govdeId} hidden={!acik}>
                {turler.map((tur) => (
                  <li key={tur}>
                    <button
                      type="button"
                      className="analiz-gezgin-oge"
                      /* Seçili satır aria-current ile de bildiriliyor: renk tek işaret olmasın. */
                      aria-current={tur === secili ? "true" : undefined}
                      onClick={() => analizSec(tur)}
                    >
                      {ANALIZ_ETIKETLERI_METIN[tur][dil]}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>
    </div>
  );
}
