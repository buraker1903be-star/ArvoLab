import { payArvolabSubscription } from "@/app/actions/subscription";
import type { AccessState } from "@/lib/access";
import { describePlan, planButtonLabel } from "@/lib/billing-plan";

// Erişimi kapalı kullanıcıya gösterilen ekran. Kurum üyesi ödeme yapamaz
// (kurumu öder); bireysel kullanıcı buradan aylık ya da yıllık planı seçip
// kartla ödeyerek hemen devam eder. Planları ve tutarları ArvoOS bildirir.

function reason(access: AccessState) {
  if (access.status === "suspended") return "askıya alındı";
  if (access.status === "canceled") return "iptal edildi";
  if (access.kind === "individual" && access.status === "trialing") return "deneme süreniz doldu";
  if (access.periodEnd) return "sona erdi";
  return "henüz başlatılmadı";
}

export default function SubscriptionNotice({ access }: { access: AccessState }) {
  const individual = access.kind === "individual";
  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-kicker">Abonelik</span>
          <h1>Erişiminiz şu an kapalı</h1>
          <p>
            {individual ? "ArvoLab aboneliğiniz" : `${access.organizationName ?? "Kurumunuzun"} ArvoLab aboneliği`}{" "}
            {reason(access)}. Çalışmalarınız duruyor, silinmedi; abonelik yenilenince kaldığınız yerden devam edersiniz.
          </p>
          {individual ? (
            access.plans.length > 0 ? (
              <>
                <p>
                  Güvenli PayTR ödeme sayfasına yönlendirilirsiniz; ödeme onaylanınca erişiminiz hemen açılır.
                  {access.plans.length > 1 ? " Size uygun dönemi seçin." : ""}
                </p>
                <ul className="subscription-plans">
                  {access.plans.map((plan, index) => (
                    <li key={plan.code ?? plan.interval ?? index}>
                      <span>{describePlan(plan)}</span>
                      <form action={payArvolabSubscription}>
                        {plan.code ? <input type="hidden" name="plan" value={plan.code} /> : null}
                        <button type="submit" className={index === 0 ? "projects-primary-button" : "projects-filter-button"}>
                          Kartla öde · {planButtonLabel(plan)}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Abonelik planı henüz tanımlanmadı. Bizimle iletişime geçin.</p>
            )
          ) : (
            <p>Yenilemek için ArvoOS panelinizdeki Ödeme ve Lisans sayfasından ArvoLab aboneliğini ödeyin ya da bizimle iletişime geçin.</p>
          )}
        </div>
      </section>
    </main>
  );
}
