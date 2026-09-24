import { BadgeCheck, CalendarClock } from "lucide-react";
import { payArvolabSubscription } from "@/app/actions/subscription";
import { licenseSummary } from "@/lib/license-summary";
import { planButtonLabel } from "@/lib/billing-plan";
import type { AccessState } from "@/lib/access";
import OdemeButonu from "./odeme-butonu";

// Ana sayfadaki lisans/abonelik bölümü: aktif mi, ödeme alınmadıysa neden ve
// geçerlilik tarihi. İç ekipte ve durum bilinmiyorken hiç gösterilmez.

export default function LicenseCard({ access }: { access: AccessState }) {
  const summary = licenseSummary(access);
  if (!summary) return null;

  return (
    <section className="license-card" data-tone={summary.tone} aria-label="Lisans durumu">
      <div className="license-card-head">
        <span className="dashboard-kicker">Lisans ve abonelik</span>
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
          <div className="cluster">
            {access.plans.map((plan, index) => (
              <form action={payArvolabSubscription} key={plan.code ?? plan.interval ?? index}>
                {plan.code ? <input type="hidden" name="plan" value={plan.code} /> : null}
                <OdemeButonu birincil={index === 0} etiket={`Kartla öde · ${planButtonLabel(plan)}`} />
              </form>
            ))}
          </div>
        ) : (
          <p className="muted text-sm">Abonelik planı henüz tanımlanmadı. Bizimle iletişime geçin.</p>
        )
      ) : access.kind === "organization" && (summary.tone === "warning" || summary.tone === "danger") ? (
        <p className="muted text-sm">
          Yenilemek için ArvoOS panelinizdeki Ödeme ve Lisans sayfasından ArvoLab aboneliğini ödeyin.
        </p>
      ) : null}
    </section>
  );
}
