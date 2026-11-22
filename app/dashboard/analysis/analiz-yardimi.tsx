"use client";

import { useState } from "react";
import { ArrowRight, RotateCcw, X } from "lucide-react";
import { ANALIZ_ETIKETLERI_METIN, type AnalizTuru } from "@/lib/analiz-turleri";
import { BILMIYORUM, analizOnerisi, type Yanitlar } from "@/lib/analiz-onerisi";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";

/*
  "HANGİ ANALİZİ SEÇMELİYİM?" PANELİ (22.11.2026).

  Kurallar lib/analiz-onerisi.ts'te, saf ve testli
  (tests/unit/analiz-onerisi.test.ts). Bu dosya yalnızca onları
  çiziyor: panel hesap yapmaz, veriye dokunmaz, ücretli bir çağrı
  yapmaz, kullanıcının seçili analizini kendiliğinden değiştirmez.
  "Bu analizi aç" kullanıcının düğmesidir.
*/
export default function AnalizYardimi({
  id,
  kapat,
  analiziAc,
}: {
  id: string;
  kapat: () => void;
  analiziAc: (tur: AnalizTuru) => void;
}) {
  const t = useCeviri();
  const dil = useDil();
  const [yanitlar, setYanitlar] = useState<Yanitlar>({});
  /* Kullanıcının geri dönüp açtığı soru; yoksa ilk cevapsız soru açıktır. */
  const [acikSoru, setAcikSoru] = useState<keyof Yanitlar | null>(null);
  const oneri = analizOnerisi(yanitlar);
  /*
    CEVAPLANAN SORU TEK SATIRA İNER. Bütün sorular açık dururken panel
    ekranı aşıyor ve aday listesi katlanmanın altında kalıyordu; kullanıcı
    cevabını görmek için kaydırmak zorundaydı. Cevap satırına basınca
    soru yeniden açılır.
  */
  const ilkCevapsiz = oneri.sorular.find((soru) => yanitlar[soru.anahtar] === undefined)?.anahtar ?? null;

  const cevapla = (anahtar: keyof Yanitlar, deger: string) =>
    setYanitlar((eski) => {
      /*
        Bir soru değişince SONRAKİ cevaplar düşer: amaç "fark"tan
        "ilişki"ye çevrildiğinde eskiden grup sayısı cevabı duruyor ve
        akış o cevaba göre dallanıyordu. Soru sırası sorulardan geliyor,
        burada ayrı bir sıra tutulmuyor.
      */
      const sira = oneri.sorular.map((s) => s.anahtar);
      const yer = sira.indexOf(anahtar as (typeof sira)[number]);
      const yeni: Yanitlar = { ...eski, [anahtar]: deger };
      if (yer >= 0) for (const sonraki of sira.slice(yer + 1)) delete yeni[sonraki];
      return yeni;
    });

  return (
    <div className="analiz-yardim" id={id} role="group" aria-label={t({ tr: "Hangi analizi seçmeliyim?", en: "Which analysis should I choose?" })}>
      <div className="analiz-yardim-ust">
        <div>
          <b>{t({ tr: "Hangi analizi seçmeliyim?", en: "Which analysis should I choose?" })}</b>
          <small>
            {t({
              tr: "Birkaç soru; cevaplar yalnızca bu panelde kalır, veriniz okunmaz ve hiçbir analiz çalıştırılmaz.",
              en: "A few questions; the answers stay in this panel, your data is not read and no analysis is run.",
            })}
          </small>
        </div>
        <button type="button" className="projects-filter-button button-compact" onClick={kapat} aria-label={t({ tr: "Yardımı kapat", en: "Close help" })}>
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {oneri.sorular.map((soru) => {
        const cevap = yanitlar[soru.anahtar];
        const acik = acikSoru === soru.anahtar || (acikSoru === null && soru.anahtar === ilkCevapsiz);
        if (cevap !== undefined && !acik) {
          const secilen = soru.secenekler.find((x) => x.anahtar === cevap);
          return (
            <button
              key={soru.anahtar}
              type="button"
              className="analiz-yardim-ozet"
              onClick={() => setAcikSoru(soru.anahtar)}
            >
              <small>{t(soru.baslik)}</small>
              <b>{secilen ? t(secilen.etiket) : cevap}</b>
              <span>{t({ tr: "Değiştir", en: "Change" })}</span>
            </button>
          );
        }
        return (
        <fieldset key={soru.anahtar} className="analiz-yardim-soru">
          <legend>{t(soru.baslik)}</legend>
          {soru.secenekler.map((secenek) => {
            const secili = yanitlar[soru.anahtar] === secenek.anahtar;
            return (
              <label key={secenek.anahtar} className="analiz-yardim-secenek" data-secili={secili ? "1" : undefined}>
                <input
                  type="radio"
                  name={`${id}-${soru.anahtar}`}
                  checked={secili}
                  onChange={() => {
                    cevapla(soru.anahtar, secenek.anahtar);
                    /* Cevap verilince bu soru kapanır, sıradaki açılır. */
                    setAcikSoru(null);
                  }}
                />
                <span>
                  <b>{t(secenek.etiket)}</b>
                  {secenek.aciklama ? <small>{t(secenek.aciklama)}</small> : null}
                </span>
              </label>
            );
          })}
          {yanitlar[soru.anahtar] === BILMIYORUM ? (
            <p className="analiz-yardim-bilmiyorum">
              {t({
                tr: "Bu bilgi olmadan aday listesi daralmıyor; aşağıda neyin eksik olduğu yazılı.",
                en: "Without this the candidate list does not narrow; what is missing is stated below.",
              })}
            </p>
          ) : null}
        </fieldset>
        );
      })}

      {oneri.desteklenmeyen ? (
        /*
          DESTEKLENMEYEN DESENDE ADAY YOK. Benzer bir test önermek
          (üç ölçüme McNemar, MANOVA yerine ayrı ANOVA'lar) öğrenciyi
          savunamayacağı bir analize götürür.
        */
        <div className="analiz-yardim-sonuc" role="status">
          <b>{t({ tr: "Bu desen için ArvoLab'da uygun bir test yok", en: "ArvoLab has no appropriate test for this design" })}</b>
          <p>{t(oneri.desteklenmeyen)}</p>
        </div>
      ) : null}

      {oneri.adaylar.length > 0 ? (
        <div className="analiz-yardim-sonuc" role="status">
          <b>
            {oneri.adaylar.length === 1
              ? t({ tr: "Aday analiz", en: "Candidate analysis" })
              : t({ tr: `Aday analizler · ${oneri.adaylar.length}`, en: `Candidate analyses · ${oneri.adaylar.length}` })}
          </b>
          <ul className="analiz-yardim-adaylar">
            {oneri.adaylar.map((aday) => (
              <li key={aday.tur}>
                <div>
                  <b>{ANALIZ_ETIKETLERI_METIN[aday.tur][dil]}</b>
                  <small>{t(aday.gerekce)}</small>
                  <small className="analiz-yardim-kontrol">
                    <i>{t({ tr: "Kontrol edin:", en: "Check:" })}</i> {t(aday.kontrol)}
                  </small>
                </div>
                <button type="button" className="projects-filter-button button-compact" onClick={() => analiziAc(aday.tur)}>
                  {t({ tr: "Bu analizi aç", en: "Open this analysis" })}
                  <ArrowRight size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {oneri.sinirlar.length > 0 ? (
        <ul className="analiz-yardim-sinirlar">
          {oneri.sinirlar.map((sinir) => (
            <li key={sinir.tr}>{t(sinir)}</li>
          ))}
        </ul>
      ) : null}

      {Object.keys(yanitlar).length > 0 ? (
        <button type="button" className="projects-filter-button button-compact" onClick={() => { setYanitlar({}); setAcikSoru(null); }}>
          <RotateCcw size={13} aria-hidden="true" />
          {t({ tr: "Baştan başla", en: "Start over" })}
        </button>
      ) : null}
    </div>
  );
}
