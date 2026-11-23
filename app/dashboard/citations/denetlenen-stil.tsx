"use client";

import { KAPSAM_ADI, type KapsamSatiri } from "@/lib/atif/denetim-kapsami";
import { stilAdiMetni } from "@/lib/atif/stiller";
import type { OlasiStilSonucu } from "@/lib/atif/olasi-stil";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  DENETLENEN STİL VE KAPSAM (23.11.2026).

  İki soruyu aynı yerde cevaplıyor: denetim HANGİ stille yapıldı ve o
  stilde HANGİ kontroller uygulanabildi.

  Neden gerekli: "sorun bulunmadı" iki ayrı şeyin aynı cümlesi olmuştu.
  Yerleşik bir stilde (APA 7, Vancouver, Chicago) künye biçimi gerçekten
  denetleniyor; CSL deposundan seçilen bir dergi stilinde künyeyi
  citeproc yazdığı için biçime HİÇ bakılmıyor, yalnızca atıf–kaynakça
  eşleşmesi denetleniyor. Kullanıcı ikisini sonuçtan ayırt edemiyordu:
  denetlenmediği hâlde temiz görünen bir rapor, hiç rapor vermemekten
  kötüdür.

  Stil KAYDIN KENDİSİNDEN okunuyor; eski kayıtlarda yok ve orada stil
  UYDURULMUYOR ("kaydedilmedi"). Eskiden çalışmanın o anki stili
  yazılıyordu: stilini sonradan değiştiren kullanıcı eski denetimini yeni
  stilin kurallarıyla etiketlenmiş görüyordu.
*/

const DURUM_TONU = { uygulandi: "success", gerekmiyor: "neutral", uygulanamadi: "warning" } as const;

export default function DenetlenenStil({
  stil,
  kapsam,
  olasiStil,
  onStilSec,
}: {
  stil: { id: string; ad: string; adEn?: string } | null;
  kapsam: KapsamSatiri[] | null;
  olasiStil?: OlasiStilSonucu | null;
  /** Verilirse "Olası stil" önerileri seçilebilir olur (yalnızca o denetim için). */
  onStilSec?: (deger: string) => void;
}) {
  const t = useCeviri();
  const uygulanamayan = (kapsam ?? []).filter((s) => s.durum === "uygulanamadi");
  const uygulanan = (kapsam ?? []).filter((s) => s.durum === "uygulandi");
  /* Önerilen stil zaten denetlenen stille aynıysa öneri bilgi taşımıyor. */
  const oneriler = (olasiStil?.adaylar ?? []).filter((a) => a.stil !== stil?.id);

  return (
    <div className="denetlenen-stil">
      <p className="denetlenen-stil-satir">
        <span>{t({ tr: "Denetlenen stil", en: "Checked style" })}</span>
        <b>
          {stil
            ? t({ tr: stil.ad, en: stil.adEn ?? stil.ad })
            : t({ tr: "kaydedilmedi (eski denetim)", en: "not recorded (older check)" })}
        </b>
      </p>

      {kapsam === null ? (
        <p className="muted text-sm">
          {t({
            tr: "Bu kayıtta hangi kontrollerin uygulandığı saklanmamış; boş bir liste “sorun yok” demek değil.",
            en: "This record doesn't store which checks ran; an empty list does not mean “no problems”.",
          })}
        </p>
      ) : (
        <>
          {uygulanamayan.length ? (
            <div className="alert" data-tone="warning">
              <strong>
                {t({
                  tr: `Bu stilde ${uygulanamayan.length} kontrol uygulanamadı`,
                  en: `${uygulanamayan.length} ${uygulanamayan.length === 1 ? "check" : "checks"} could not be applied in this style`,
                })}
              </strong>
              <ul className="denetlenen-stil-liste">
                {uygulanamayan.map((s) => (
                  <li key={s.anahtar}>
                    <b>{t(KAPSAM_ADI[s.anahtar])}:</b> {s.gerekce ? t(s.gerekce) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <details className="denetlenen-stil-tum">
            <summary>
              {t({
                tr: `Uygulanan kontroller (${uygulanan.length}/${kapsam.length})`,
                en: `Checks applied (${uygulanan.length}/${kapsam.length})`,
              })}
            </summary>
            <ul className="denetlenen-stil-liste">
              {kapsam.map((s) => (
                <li key={s.anahtar} data-tone={DURUM_TONU[s.durum]}>
                  <b>{t(KAPSAM_ADI[s.anahtar])}</b>{" "}
                  <span className="tone-text" data-tone={DURUM_TONU[s.durum]}>
                    {t(
                      s.durum === "uygulandi"
                        ? { tr: "uygulandı", en: "applied" }
                        : s.durum === "gerekmiyor"
                          ? { tr: "bu stilde gerekmiyor", en: "not required in this style" }
                          : { tr: "uygulanamadı", en: "could not be applied" },
                    )}
                  </span>
                  {s.gerekce ? <small>{t(s.gerekce)}</small> : null}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}

      {oneriler.length ? (
        <div className="denetlenen-stil-oneri">
          <strong>
            {t({
              tr: oneriler.length === 1 ? "Olası stil" : `Olası stiller (${oneriler.length})`,
              en: oneriler.length === 1 ? "Probable style" : `Probable styles (${oneriler.length})`,
            })}
          </strong>
          <p className="muted text-sm">
            {t({
              tr: "Kaynakçanızın biçimi şu stil(ler)e benziyor. Seçim sizde: öneri, denetlenen stili kendiliğinden değiştirmez.",
              en: "Your reference list's format resembles the following style(s). The choice is yours: a suggestion never changes the checked style on its own.",
            })}
          </p>
          <ul className="denetlenen-stil-liste">
            {oneriler.map((aday) => (
              <li key={aday.stil}>
                <b>{t(stilAdiMetni(aday.stil))}</b>
                <small>{aday.gerekce.map((g) => t(g)).join(" ")}</small>
                {onStilSec ? (
                  <button type="button" className="projects-filter-button button-compact" onClick={() => onStilSec(aday.stil)}>
                    {t({ tr: "Bu stille denetle", en: "Check with this style" })}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
