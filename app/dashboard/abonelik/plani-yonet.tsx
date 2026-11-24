"use client";

import Link from "next/link";
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

  /*
    EYLEMSİZ PENCERE "YÖNET" DEMİYOR (24.11.2026).

    Katalog karşılaştırmaya hazır değilken ve ödenecek bir yenileme de
    yokken pencerede tek düğme "Kapat" oluyordu; başlığı "Planı yönet",
    metni "aboneliğinizi bu pencereden yönetebilirsiniz" diyordu. Burada
    yönetilecek bir şey YOK: pencere aboneliğin özetini gösteriyor.
    Yapılamayacak bir şeyi vaat eden etiket, kullanıcıyı eylem arayıp
    bulamadığı bir pencerede bırakıyor.

    Eylem belirince (yenileme ödenebilir ya da katalog doldu) etiket
    kendiliğinden "Planı yönet"e dönüyor.
  */
  const eylemVar = karsilastirilabilir || Boolean(yenilemeAlani);

  return (
    <>
      <button type="button" className="projects-filter-button button-compact" onClick={() => setAcik(true)}>
        {eylemVar ? t({ tr: "Planı yönet", en: "Manage plan" }) : t({ tr: "Abonelik özeti", en: "Subscription summary" })}
      </button>

      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        boy="orta"
        kicker={t({ tr: "Abonelik", en: "Subscription" })}
        title={eylemVar ? t({ tr: "Planı yönet", en: "Manage plan" }) : t({ tr: "Abonelik özeti", en: "Subscription summary" })}
        description={
          eylemVar
            ? t({ tr: "Çalışma temponuza uygun planı bulun.", en: "Find the plan that fits your working pace." })
            : t({ tr: "Planınızın durumu ve yenileme bilgisi.", en: "Your plan's status and renewal information." })
        }
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
              {eylemVar
                ? t({
                    tr: "Plan seçenekleri şu anda ödeme sisteminden gelmiyor; mevcut aboneliğinizi buradan yenileyebilirsiniz.",
                    en: "Plan options are not reported by the payment system right now; you can renew your current subscription here.",
                  })
                : t({
                    tr: "Plan seçenekleri şu anda ödeme sisteminden gelmiyor; bu pencere aboneliğinizin özetini gösteriyor.",
                    en: "Plan options are not reported by the payment system right now; this window shows a summary of your subscription.",
                  })}{" "}
              {/* Destek yönlendirmesi MEVCUT destek yoluna: /dashboard/support
                  (editörün "Uzmana sor" düğmesiyle aynı adres). Eskiden
                  "Destek'ten yazın" diyordu ama bağlantı yoktu. */}
              {t({ tr: "Farklı bir plana geçmek isterseniz", en: "To move to a different plan," })}{" "}
              <Link href="/dashboard/support">{t({ tr: "Destek'e yazın", en: "write to Support" })}</Link>.
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
