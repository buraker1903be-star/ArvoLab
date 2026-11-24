"use client";

import { useState } from "react";
import { Calendar, Zap } from "lucide-react";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { YEREL } from "@/lib/dil";
import { formatTry, type BillingInterval, type BillingPlan } from "@/lib/billing-plan";
import { donemler, donemPlanlari, katalogEksikleri, planSatirlari } from "@/lib/plan-karsilastirma";
import { payArvolabSubscription } from "@/app/actions/subscription";
import Dialog from "@/app/dashboard/_components/dialog";

/*
  PLANLARI KARŞILAŞTIR (24.11.2026).

  Satırlar KATALOGDAN. ArvoOS plan adını ("Standart", "Plus", "Pro") ve
  plana dahil aylık krediyi bildirirse yazılıyor; bildirmezse "—" kalıyor
  ve bu ekranda açıkça söyleniyor. ArvoLab bir plan adı ya da kredi
  miktarı UYDURMUYOR: fiyatı ArvoOS belirliyor, kullanıcı ekranda
  gördüğünden başkasını ödememeli.

  Seçimi kullanıcı yapıyor; "Değişikliği incele" ArvoOS'un ödeme
  özetini açıyor (payArvolabSubscription). Tutar ve dönem onay ekranından
  ÖNCE burada okunabiliyor.
*/
export default function PlanlariKarsilastir({
  acik,
  kapat,
  planlar,
  mevcutKod,
}: {
  acik: boolean;
  kapat: () => void;
  planlar: BillingPlan[];
  /** Kullanıcının yürürlükteki plan kodu; bilinmiyorsa null. */
  mevcutKod: string | null;
}) {
  const t = useCeviri();
  const dil = useDil();
  const sayi = (n: number) => new Intl.NumberFormat(YEREL[dil]).format(n);
  const mevcutDonemler = donemler(planlar);
  const [donem, setDonem] = useState<BillingInterval | null>(mevcutDonemler[0] ?? null);
  const [secili, setSecili] = useState<string | null>(null);

  const gosterilen = donemPlanlari(planlar, mevcutDonemler.length > 1 ? donem : null);
  const satirlar = planSatirlari(gosterilen, mevcutKod);
  const eksik = katalogEksikleri(planlar);
  const seciliPlan = satirlar.find((s) => s.plan.code === secili) ?? null;

  const DONEM_ADI: Record<BillingInterval, string> = {
    month: t({ tr: "Aylık", en: "Monthly" }),
    year: t({ tr: "Yıllık", en: "Yearly" }),
  };

  return (
    <Dialog
      open={acik}
      onClose={kapat}
      boy="genis"
      kicker={t({ tr: "Abonelik", en: "Subscription" })}
      title={t({ tr: "Planları karşılaştır", en: "Compare plans" })}
      description={t({ tr: "Araştırma temponuza uygun planı seçin.", en: "Choose the plan that fits your research pace." })}
    >
      <div className="karsilastir">
        {/* Dönem seçici yalnızca katalogda İKİ dönem varsa. */}
        {mevcutDonemler.length > 1 ? (
          <div className="karsilastir-donem" role="group" aria-label={t({ tr: "Faturalama dönemi", en: "Billing period" })}>
            {mevcutDonemler.map((d) => (
              <button
                key={d}
                type="button"
                className="karsilastir-donem-dugme"
                data-etkin={donem === d || undefined}
                aria-pressed={donem === d}
                onClick={() => {
                  setDonem(d);
                  setSecili(null);
                }}
              >
                {DONEM_ADI[d]}
              </button>
            ))}
          </div>
        ) : null}

        {satirlar.length === 0 ? (
          <p className="alert" data-tone="warning" role="status">
            {t({
              tr: "Plan listesi şu anda alınamıyor. Ödeme sistemine ulaşılamıyor olabilir; biraz sonra tekrar deneyin.",
              en: "The plan list is unavailable right now. The payment system may be unreachable; try again shortly.",
            })}
          </p>
        ) : (
          <>
            <div className="karsilastir-izgara" role="radiogroup" aria-label={t({ tr: "Planlar", en: "Plans" })}>
              {satirlar.map((s, i) => {
                const kod = s.plan.code;
                const secilebilir = Boolean(kod) && !s.mevcut;
                /* Son sütun görsel olarak öne çıkıyor: katalog sıralı
                   geliyor ve en üst plan sonda. "Önerilen" demiyoruz,
                   doğrulanamayan bir iddia olurdu. */
                const oneCikan = i === satirlar.length - 1 && satirlar.length > 1;
                return (
                  <div
                    key={kod ?? i}
                    className="karsilastir-sutun"
                    data-one-cikan={oneCikan || undefined}
                    data-secili={secili === kod || undefined}
                  >
                    <h3>{s.ad ?? (s.plan.interval ? DONEM_ADI[s.plan.interval] : t({ tr: "Plan", en: "Plan" }))}</h3>
                    <p className="karsilastir-fiyat">
                      {s.plan.price !== null ? formatTry(s.plan.price, dil) : "—"}
                      {s.plan.interval ? <small>{` / ${DONEM_ADI[s.plan.interval].toLocaleLowerCase(YEREL[dil])}`}</small> : null}
                    </p>
                    {s.mevcut ? <span className="karsilastir-rozet" data-tur="mevcut">{t({ tr: "Mevcut plan", en: "Current plan" })}</span> : null}
                    {oneCikan && !s.mevcut ? (
                      <span className="karsilastir-rozet" data-tur="one-cikan">{t({ tr: "Yoğun araştırmalar için", en: "For intensive research" })}</span>
                    ) : null}
                    <label className="karsilastir-sec">
                      <input
                        type="radio"
                        name="plan-secimi"
                        value={kod ?? ""}
                        checked={secili === kod}
                        disabled={!secilebilir}
                        onChange={() => setSecili(kod)}
                      />
                      <span className="sr-only">
                        {s.ad ?? (s.plan.interval ? DONEM_ADI[s.plan.interval] : t({ tr: "Plan", en: "Plan" }))}
                      </span>
                    </label>
                  </div>
                );
              })}
            </div>

            <dl className="karsilastir-satirlar">
              <div>
                <dt>
                  <Zap size={15} aria-hidden="true" /> {t({ tr: "Asistan kredisi", en: "Assistant credits" })}
                </dt>
                {satirlar.map((s, i) => (
                  <dd key={s.plan.code ?? i}>{s.kredi !== null ? sayi(s.kredi) : "—"}</dd>
                ))}
              </div>
              <div>
                <dt>
                  <Calendar size={15} aria-hidden="true" /> {t({ tr: "Faturalama dönemi", en: "Billing period" })}
                </dt>
                {satirlar.map((s, i) => (
                  <dd key={s.plan.code ?? i}>{s.plan.interval ? DONEM_ADI[s.plan.interval] : "—"}</dd>
                ))}
              </div>
            </dl>

            {/* Katalogda olmayanı ekranda da söylüyoruz. */}
            {eksik.adYok || eksik.krediYok ? (
              <p className="muted text-sm">
                {eksik.adYok && eksik.krediYok
                  ? t({
                      tr: "Plan adları ve plana dahil kredi bilgisi ödeme sisteminden henüz gelmiyor; bu satırlar “—” görünüyor.",
                      en: "Plan names and included credits are not yet reported by the payment system; those rows show “—”.",
                    })
                  : eksik.krediYok
                    ? t({
                        tr: "Plana dahil kredi bilgisi ödeme sisteminden henüz gelmiyor.",
                        en: "Included credits are not yet reported by the payment system.",
                      })
                    : t({ tr: "Plan adları ödeme sisteminden henüz gelmiyor.", en: "Plan names are not yet reported by the payment system." })}
              </p>
            ) : null}

            {/* Onaydan ÖNCE okunabilenler: tutar ve dönem. Değişikliğin
                geçerli olacağı tarihi ödeme sistemi bildirmiyor, bu yüzden
                tarih YAZMIYORUZ; ne zaman geçerli olacağı söyleniyor. */}
            {seciliPlan ? (
              <div className="karsilastir-ozet" role="status">
                <b>
                  {t({
                    tr: `Seçilen: ${seciliPlan.ad ?? (seciliPlan.plan.interval ? DONEM_ADI[seciliPlan.plan.interval] : "plan")}`,
                    en: `Selected: ${seciliPlan.ad ?? (seciliPlan.plan.interval ? DONEM_ADI[seciliPlan.plan.interval] : "plan")}`,
                  })}
                </b>
                <span>
                  {seciliPlan.plan.price !== null
                    ? t({
                        tr: `Toplam tahsilat ${formatTry(seciliPlan.plan.price, dil)}${seciliPlan.plan.interval ? ` · ${DONEM_ADI[seciliPlan.plan.interval].toLocaleLowerCase("tr-TR")} dönem` : ""}. Değişiklik ödeme onaylandığında geçerli olur.`,
                        en: `Total charge ${formatTry(seciliPlan.plan.price, dil)}${seciliPlan.plan.interval ? ` · ${DONEM_ADI[seciliPlan.plan.interval].toLocaleLowerCase("en-US")} period` : ""}. The change takes effect once the payment is approved.`,
                      })
                    : t({
                        tr: "Bu planın tutarı ödeme sisteminden gelmiyor; tutarı ödeme ekranında göreceksiniz.",
                        en: "This plan's amount is not reported by the payment system; you will see it on the payment screen.",
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
          <form action={payArvolabSubscription}>
            <input type="hidden" name="plan" value={secili ?? ""} />
            <button type="submit" className="projects-primary-button" disabled={!secili}>
              {t({ tr: "Değişikliği incele", en: "Review the change" })}
            </button>
          </form>
        </div>
      </div>
    </Dialog>
  );
}
