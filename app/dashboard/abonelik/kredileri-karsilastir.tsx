"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { YEREL } from "@/lib/dil";
import { formatTry } from "@/lib/billing-plan";
import { paketFiyati, type KrediPaketi } from "@/lib/kredi-paketleri";
import { enYuksekPaket, yuzKrediFiyati } from "@/lib/plan-karsilastirma";
import { krediSatinAl, kurumKrediSatinAl } from "@/app/actions/subscription";
import Dialog from "@/app/dashboard/_components/dialog";

/*
  KREDİLERİ KARŞILAŞTIR (24.11.2026).

  Plan penceresiyle aynı görsel dil; içerik GERÇEK katalogdan (ArvoOS'un
  creditPackages listesi, lib/kredi-paketleri.ts). Paket kodu, kredi
  miktarı ve fiyat orada tanımlı; ArvoLab kopyasını tutmuyor, yoksa fiyat
  değiştiği gün iki taraf ayrı tutar gösterir ve müşteri ekranda
  gördüğünden farklı öderdi.

  "Satın almayı incele" mevcut ödeme akışını açıyor (krediSatinAl /
  kurumKrediSatinAl); yetki sunucuda, paket kodu orada da doğrulanıyor.
*/
export default function KredileriKarsilastir({
  acik,
  kapat,
  paketler,
  kurum,
}: {
  acik: boolean;
  kapat: () => void;
  paketler: KrediPaketi[];
  /** Kurum adına alım: eylem ve yetki farklı (kurumKrediSatinAl). */
  kurum: boolean;
}) {
  const t = useCeviri();
  const dil = useDil();
  const sayi = (n: number) => new Intl.NumberFormat(YEREL[dil]).format(n);
  const fiyat = (kurus: number) => (dil === "tr" ? paketFiyati(kurus) : formatTry(kurus, dil));
  const [secili, setSecili] = useState<string | null>(null);
  const yogun = enYuksekPaket(paketler);
  const seciliPaket = paketler.find((p) => p.kod === secili) ?? null;

  return (
    <Dialog
      open={acik}
      onClose={kapat}
      boy="genis"
      kicker={t({ tr: "Tek seferlik satın alma", en: "One-time purchase" })}
      title={t({ tr: "Kredileri karşılaştır", en: "Compare credits" })}
      description={t({ tr: "Araştırma temponuza uygun kredi miktarını seçin.", en: "Choose the amount of credits that fits your research pace." })}
    >
      <div className="karsilastir">
        {paketler.length === 0 ? (
          <p className="alert" data-tone="warning" role="status">
            {t({
              tr: "Kredi paketleri şu anda alınamıyor. Ödeme sistemine ulaşılamıyor olabilir; biraz sonra tekrar deneyin.",
              en: "Credit packages are unavailable right now. The payment system may be unreachable; try again shortly.",
            })}
          </p>
        ) : (
          <>
            <div className="karsilastir-izgara" role="radiogroup" aria-label={t({ tr: "Kredi paketleri", en: "Credit packages" })}>
              {paketler.map((paket) => (
                <div
                  key={paket.kod}
                  className="karsilastir-sutun"
                  data-one-cikan={paket.kod === yogun && paketler.length > 1 ? true : undefined}
                  data-secili={secili === paket.kod || undefined}
                >
                  <h3>{t({ tr: `${sayi(paket.kredi)} kredi`, en: `${sayi(paket.kredi)} credits` })}</h3>
                  <p className="karsilastir-fiyat">{fiyat(paket.fiyat)}</p>
                  {paket.kod === yogun && paketler.length > 1 ? (
                    <span className="karsilastir-rozet" data-tur="one-cikan">{t({ tr: "Yoğun kullanım için", en: "For intensive use" })}</span>
                  ) : null}
                  <label className="karsilastir-sec">
                    <input
                      type="radio"
                      name="paket-secimi"
                      value={paket.kod}
                      checked={secili === paket.kod}
                      onChange={() => setSecili(paket.kod)}
                    />
                    <span className="sr-only">{t({ tr: `${sayi(paket.kredi)} kredi`, en: `${sayi(paket.kredi)} credits` })}</span>
                  </label>
                </div>
              ))}
            </div>

            <dl className="karsilastir-satirlar">
              <div>
                <dt>
                  <Zap size={15} aria-hidden="true" /> {t({ tr: "Eklenen kredi", en: "Credits added" })}
                </dt>
                {paketler.map((p) => (
                  <dd key={p.kod}>{sayi(p.kredi)}</dd>
                ))}
              </div>
              <div>
                <dt>{t({ tr: "100 kredi başına", en: "Per 100 credits" })}</dt>
                {paketler.map((p) => (
                  <dd key={p.kod}>{fiyat(yuzKrediFiyati(p))}</dd>
                ))}
              </div>
            </dl>

            <p className="muted text-sm">
              {t({
                tr: "Tek seferlik satın alma: kredi bakiyenize eklenir, yanmaz ve aylık hakkınız bittiğinde kullanılır. Abonelik yenilemesi değildir.",
                en: "A one-time purchase: the credits are added to your balance, never expire and are used once your monthly allowance runs out. This is not a subscription renewal.",
              })}
            </p>

            {seciliPaket ? (
              <div className="karsilastir-ozet" role="status">
                <b>{t({ tr: `Seçilen: ${sayi(seciliPaket.kredi)} kredi`, en: `Selected: ${sayi(seciliPaket.kredi)} credits` })}</b>
                <span>
                  {t({
                    tr: `Toplam tahsilat ${fiyat(seciliPaket.fiyat)} · 100 kredi ${fiyat(yuzKrediFiyati(seciliPaket))}. Ödeme onaylanınca kredi birkaç dakika içinde bakiyenize eklenir.`,
                    en: `Total charge ${fiyat(seciliPaket.fiyat)} · ${fiyat(yuzKrediFiyati(seciliPaket))} per 100 credits. Once the payment is approved, the credits reach your balance within a few minutes.`,
                  })}
                </span>
              </div>
            ) : null}
          </>
        )}

        <div className="project-form-actions">
          <button type="button" className="projects-filter-button" onClick={kapat}>
            {t({ tr: "Vazgeç", en: "Cancel" })}
          </button>
          <form action={kurum ? kurumKrediSatinAl : krediSatinAl}>
            <input type="hidden" name="paket" value={secili ?? ""} />
            <button type="submit" className="projects-primary-button" disabled={!secili}>
              {t({ tr: "Satın almayı incele", en: "Review the purchase" })}
            </button>
          </form>
        </div>
      </div>
    </Dialog>
  );
}
