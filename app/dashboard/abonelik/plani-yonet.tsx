"use client";

import { useState, type ReactNode } from "react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import type { BillingPlan } from "@/lib/billing-plan";
import Dialog from "@/app/dashboard/_components/dialog";
import PlanlariKarsilastir from "./planlari-karsilastir";

/*
  PLANI YÖNET (24.11.2026).

  Küçük bir kapı: mevcut plan ve yenileme bilgisi, oradan "Planları
  karşılaştır" ve "Yenilemeyi yönet". Yenileme MEVCUT akışı açıyor
  (kartla ödeme / kayıtlı kart bölümü); bu pencere yeni bir ödeme yolu
  tanımlamıyor.

  İç içe pencere: karşılaştırma bunun ÜSTÜNE açılıyor ve ilk Escape
  yalnızca üsttekini kapatıyor (#148, pencere-katmani.ts).
*/
export default function PlaniYonet({
  planAdi,
  durum,
  yenileme,
  dahilKredi,
  planlar,
  mevcutKod,
  karsilastirilabilir,
  yenilemeAlani,
}: {
  planAdi: string;
  durum: string | null;
  /** "Sonraki yenileme" ya da dönem bitişi; yoksa null. */
  yenileme: string | null;
  /** Plana dahil aylık asistan kredisi (ai_kredi_durumum); bildirilmezse null. */
  dahilKredi: string | null;
  planlar: BillingPlan[];
  mevcutKod: string | null;
  /** Katalog karşılaştırmaya hazır VE yetki doğrulandı mı? */
  karsilastirilabilir: boolean;
  /** Mevcut yenileme akışı (kartla ödeme formu); yoksa null. */
  yenilemeAlani: ReactNode;
}) {
  const t = useCeviri();
  const [acik, setAcik] = useState(false);
  const [karsilastir, setKarsilastir] = useState(false);

  return (
    <>
      <button type="button" className="projects-filter-button button-compact" onClick={() => setAcik(true)}>
        {t({ tr: "Planı yönet", en: "Manage plan" })}
      </button>

      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        boy="orta"
        kicker={t({ tr: "Abonelik", en: "Subscription" })}
        title={t({ tr: "Planı yönet", en: "Manage plan" })}
        description={t({ tr: "Çalışma temponuza uygun planı bulun.", en: "Find the plan that fits your working pace." })}
      >
        <div className="plan-yonet">
          <div className="plan-yonet-mevcut">
            <b>{planAdi}</b>
            {durum ? <span className="karsilastir-rozet" data-tur="mevcut">{durum}</span> : null}
            {yenileme ? <small className="muted">{yenileme}</small> : null}
            {/* Dahil kredi ArvoOS'tan DEĞİL, ArvoLab'ın kendi
                sayacından (ai_kredi_durumum → aylık hak): doğrulanabilen
                tek "plana dahil" rakam bu. */}
            {dahilKredi ? <small className="muted">{dahilKredi}</small> : null}
          </div>

          {karsilastirilabilir ? (
            <div className="plan-yonet-satir">
              <span className="ayar-govde">
                <b>{t({ tr: "Daha fazla kullanım hakkı", en: "More usage" })}</b>
                <small>
                  {t({
                    tr: "Yoğun araştırma ve düzenli asistan kullanımı için üst planları inceleyin.",
                    en: "For intensive research and regular assistant use, review the higher plans.",
                  })}
                </small>
              </span>
              <button type="button" className="projects-primary-button button-compact" onClick={() => setKarsilastir(true)}>
                {t({ tr: "Planları karşılaştır", en: "Compare plans" })}
              </button>
            </div>
          ) : null}

          {yenilemeAlani ? (
            <div className="plan-yonet-satir">
              <span className="ayar-govde">
                <b>{t({ tr: "Mevcut aboneliğiniz", en: "Your current subscription" })}</b>
                <small>
                  {/* Doğrulanan davranış: ArvoOS yeni dönemi
                      greatest(now(), mevcut bitiş) ile başlatıyor
                      (arvo_activate_license_period), erken ödeme gün
                      yakmıyor. Plan DEĞİŞİKLİĞİ için böyle bir doğrulama
                      yok; orada bir yürürlük sözü verilmiyor. */}
                  {t({
                    tr: "Ödeme ve yenileme işlemleri. Dönem bitmeden yenilerseniz yeni dönem mevcut dönemin sonuna eklenir.",
                    en: "Payment and renewal. If you renew before the period ends, the new period is added to the end of the current one.",
                  })}
                </small>
              </span>
              {yenilemeAlani}
            </div>
          ) : null}

          {/*
            KARŞILAŞTIRMA HAZIR DEĞİLSE MEVCUT YOL (24.11.2026). Plan
            seçenekleri ödeme sisteminden gelmiyor (ne ad ne de plana
            dahil kredi). Boş bir karşılaştırma penceresi açmak ya da
            hiçbir şey söylememek yerine, müşteriye bugün yürüyen yol
            söyleniyor: aboneliği buradan yönetiyor, plan seçenekleri
            geldiğinde bu pencereye düşecek.
          */}
          {!karsilastirilabilir ? (
            <p className="muted text-sm">
              {t({
                tr: "Plan seçenekleri şu anda ödeme sisteminden gelmiyor; aboneliğinizi bu pencereden yönetebilirsiniz. Farklı bir plana geçmek isterseniz Destek'ten yazın.",
                en: "Plan options are not reported by the payment system right now; you can manage your subscription from this window. If you want to move to a different plan, write to Support.",
              })}
            </p>
          ) : null}

          <div className="project-form-actions">
            <button type="button" className="projects-filter-button" onClick={() => setAcik(false)}>
              {t({ tr: "Kapat", en: "Close" })}
            </button>
          </div>
        </div>
      </Dialog>

      <PlanlariKarsilastir acik={karsilastir} kapat={() => setKarsilastir(false)} planlar={planlar} mevcutKod={mevcutKod} />
    </>
  );
}
