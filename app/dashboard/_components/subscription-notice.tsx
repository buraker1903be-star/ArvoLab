import { payArvolabSubscription } from "@/app/actions/subscription";
import type { AccessState } from "@/lib/access";
import { describePlan, planButtonLabel } from "@/lib/billing-plan";
import OdemeButonu from "./odeme-butonu";
import Link from "next/link";
import { aktifDil } from "@/lib/dil-sunucu";
import { ceviriciKur } from "@/lib/dil";
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

export default async function SubscriptionNotice({ access }: { access: AccessState }) {
  const individual = access.kind === "individual";
  const dil = await aktifDil();
  const t = ceviriciKur(dil);
  return (
    <main className="dashboard-page">
      <section className="dashboard-hero">
        <div>
          <span className="dashboard-kicker">{t({ tr: "Abonelik", en: "Subscription" })}</span>
          <h1>{t({ tr: "Erişiminiz şu an kapalı", en: "Your access is currently closed" })}</h1>
          <p>
            {kapaliErisimCumlesi(access, dil)}{" "}
            {t({
              tr: "Çalışmalarınız duruyor, silinmedi; abonelik yenilenince kaldığınız yerden devam edersiniz.",
              en: "Your work is safe and has not been deleted; once the subscription is renewed you continue where you left off.",
            })}
          </p>
          {individual ? (
            access.plans.length > 0 ? (
              <>
                <p>
                  {t({
                    tr: "Güvenli PayTR ödeme sayfasına yönlendirilirsiniz; ödeme onaylanınca erişiminiz hemen açılır.",
                    en: "You will be taken to the secure PayTR payment page; access opens as soon as the payment is confirmed.",
                  })}
                  {access.plans.length > 1 ? t({ tr: " Size uygun dönemi seçin.", en: " Choose the period that suits you." }) : ""}
                </p>
                <ul className="subscription-plans">
                  {access.plans.map((plan, index) => (
                    <li key={plan.code ?? plan.interval ?? index}>
                      <span>{describePlan(plan, dil)}</span>
                      <form action={payArvolabSubscription}>
                        {plan.code ? <input type="hidden" name="plan" value={plan.code} /> : null}
                        <OdemeButonu birincil={index === 0} ikonlu={false} etiket={`${t({ tr: "Kartla öde", en: "Pay by card" })} · ${planButtonLabel(plan, dil)}`} />
                      </form>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>
                {t({
                  tr: "Abonelik planı henüz tanımlanmadı. Aşağıdaki Destek bölümünden bize yazın; erişiminizi birlikte açalım.",
                  en: "No subscription plan has been set up yet. Write to us from Support below and we will open your access together.",
                })}
              </p>
            )
          ) : (
            <p>
              {t({
                tr: "Yenilemek için ArvoOS panelinizdeki Ödeme ve Lisans sayfasından ArvoLab aboneliğini ödeyin ya da Destek bölümünden bize yazın.",
                en: "To renew, pay for the ArvoLab subscription from the Payment and License page in your ArvoOS panel, or write to us from Support.",
              })}
            </p>
          )}
          <nav className="pencere-dugmeler" aria-label={t({ tr: "Kapalı erişimde açık sayfalar", en: "Pages available while access is closed" })}>
            <Link className="projects-filter-button button-compact" href="/dashboard/abonelik">
              {t({ tr: "Abonelik ve faturalar", en: "Subscription and invoices" })}
            </Link>
            <Link className="projects-filter-button button-compact" href="/dashboard/expert-requests">
              {t({ tr: "Destek", en: "Support" })}
            </Link>
            <Link className="projects-filter-button button-compact" href="/dashboard/settings">
              {t({ tr: "Ayarlar", en: "Settings" })}
            </Link>
            <a className="projects-filter-button button-compact" href="/api/hesabim/verilerim" download>
              {t({ tr: "Verilerimi indir", en: "Download my data" })}
            </a>
          </nav>
        </div>
      </section>
    </main>
  );
}
