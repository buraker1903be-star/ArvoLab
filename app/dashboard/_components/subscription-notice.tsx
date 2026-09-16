import { payArvolabSubscription } from "@/app/actions/subscription";
import type { AccessState } from "@/lib/access";

// Erişimi kapalı kullanıcıya gösterilen ekran. Kurum üyesi ödeme yapamaz
// (kurumu öder); bireysel kullanıcı buradan kartla ödeyip hemen devam eder.

const formatTry = (value: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value / 100);

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
            access.monthlyFee ? (
              <form action={payArvolabSubscription}>
                <p>Aylık {formatTry(access.monthlyFee)}. Güvenli PayTR ödeme sayfasına yönlendirilirsiniz; ödeme onaylanınca erişiminiz hemen açılır.</p>
                <button type="submit" className="projects-primary-button">Kartla öde · {formatTry(access.monthlyFee)}</button>
              </form>
            ) : (
              <p>Abonelik ücreti henüz tanımlanmadı. Bizimle iletişime geçin.</p>
            )
          ) : (
            <p>Yenilemek için ArvoOS panelinizdeki Ödeme ve Lisans sayfasından ArvoLab aboneliğini ödeyin ya da bizimle iletişime geçin.</p>
          )}
        </div>
      </section>
    </main>
  );
}
