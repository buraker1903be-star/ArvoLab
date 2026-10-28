import { payArvolabSubscription } from "@/app/actions/subscription";
import type { AccessState } from "@/lib/access";
import { describePlan, planButtonLabel } from "@/lib/billing-plan";
import OdemeButonu from "./odeme-butonu";
import Link from "next/link";
import { kapaliErisimCumlesi } from "@/lib/abonelik-kapisi";

// Erişimi kapalı kullanıcıya gösterilen ekran. Kurum üyesi ödeme yapamaz
// (kurumu öder); bireysel kullanıcı buradan aylık ya da yıllık planı seçip
// kartla ödeyerek hemen devam eder. Planları ve tutarları ArvoOS bildirir.
//
// Kapalı erişimde de açık kalan sayfalar (lib/abonelik-kapisi.ts) burada
// bağlantı olarak duruyor. Eskiden bu ekranın yorumu "Verilerimi indir
// burada da duruyor" diyordu ama bileşende böyle bir bağlantı yoktu;
// "bizimle iletişime geçin" de hiçbir yere gitmiyordu. Verisini almak için
// önce ödeme yapması gereken bir ürün, veriyi rehin tutuyor demektir.

export default function SubscriptionNotice({ access }: { access: AccessState }) {
  const individual = access.kind === "individual";
  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-kicker">Abonelik</span>
          <h1>Erişiminiz şu an kapalı</h1>
          <p>
            {kapaliErisimCumlesi(access)} Çalışmalarınız duruyor, silinmedi; abonelik yenilenince kaldığınız yerden devam
            edersiniz.
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
                        <OdemeButonu birincil={index === 0} ikonlu={false} etiket={`Kartla öde · ${planButtonLabel(plan)}`} />
                      </form>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Abonelik planı henüz tanımlanmadı. Aşağıdaki Destek bölümünden bize yazın; erişiminizi birlikte açalım.</p>
            )
          ) : (
            <p>Yenilemek için ArvoOS panelinizdeki Ödeme ve Lisans sayfasından ArvoLab aboneliğini ödeyin ya da Destek bölümünden bize yazın.</p>
          )}
          <nav className="pencere-dugmeler" aria-label="Kapalı erişimde açık sayfalar">
            <Link className="projects-filter-button button-compact" href="/dashboard/abonelik">
              Abonelik ve faturalar
            </Link>
            <Link className="projects-filter-button button-compact" href="/dashboard/expert-requests">
              Destek
            </Link>
            <Link className="projects-filter-button button-compact" href="/dashboard/settings">
              Ayarlar
            </Link>
            <a className="projects-filter-button button-compact" href="/api/hesabim/verilerim" download>
              Verilerimi indir
            </a>
          </nav>
        </div>
      </section>
    </main>
  );
}
