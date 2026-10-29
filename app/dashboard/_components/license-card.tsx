import { BadgeCheck, CalendarClock } from "lucide-react";
import { payArvolabSubscription } from "@/app/actions/subscription";
import { licenseSummary } from "@/lib/license-summary";
import { planButtonLabel } from "@/lib/billing-plan";
import type { AccessState } from "@/lib/access";
import OdemeButonu from "./odeme-butonu";
import YasalNot from "./yasal-not";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";

// Ana sayfadaki lisans/abonelik bölümü: aktif mi, ödeme alınmadıysa neden ve
// geçerlilik tarihi. İç ekipte ve durum bilinmiyorken hiç gösterilmez.

export default async function LicenseCard({ access }: { access: AccessState }) {
  const t = await ceviri();
  const dil = await aktifDil();
  const summary = licenseSummary(access, new Date(), dil);
  if (!summary) return null;

  return (
    <section className="license-card" data-tone={summary.tone} aria-label={t({ tr: "Lisans durumu", en: "License status" })}>
      <div className="license-card-head">
        <span className="dashboard-kicker">{t({ tr: "Lisans ve abonelik", en: "License and subscription" })}</span>
        <span className="chip" data-tone={summary.tone}>
          <BadgeCheck size={14} aria-hidden="true" />
          {summary.statusLabel}
        </span>
      </div>
      <h2>{summary.title}</h2>
      {summary.detail ? (
        <p className="license-card-validity">
          <CalendarClock size={15} aria-hidden="true" />
          <span>{summary.detail}</span>
        </p>
      ) : null}
      {summary.paymentNote ? <p className="tone-text text-sm" data-tone={summary.tone}>{summary.paymentNote}</p> : null}
      {summary.yenilemeNotu ? <p className="muted text-sm">{summary.yenilemeNotu}</p> : null}
      {summary.showPayment ? (
        access.plans.length > 0 ? (
          <>
          <div className="cluster">
            {access.plans.map((plan, index) => (
              <form action={payArvolabSubscription} key={plan.code ?? plan.interval ?? index}>
                {plan.code ? <input type="hidden" name="plan" value={plan.code} /> : null}
                <OdemeButonu birincil={index === 0} etiket={`${t({ tr: "Kartla öde", en: "Pay by card" })} · ${planButtonLabel(plan, dil)}`} />
              </form>
            ))}
          </div>
          <YasalNot />
          </>
        ) : (
          <p className="muted text-sm">
            {t({ tr: "Abonelik planı henüz tanımlanmadı. Bizimle iletişime geçin.", en: "No subscription plan has been set up yet. Please contact us." })}
          </p>
        )
      ) : access.kind === "organization" && (summary.tone === "warning" || summary.tone === "danger") ? (
        <p className="muted text-sm">
          {t({
            tr: "Yenilemek için ArvoOS panelinizdeki Ödeme ve Lisans sayfasından ArvoLab aboneliğini ödeyin.",
            en: "To renew, pay for the ArvoLab subscription on the Payment and License page of your ArvoOS panel.",
          })}
        </p>
      ) : null}
    </section>
  );
}
