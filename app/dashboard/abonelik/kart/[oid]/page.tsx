import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getAuthContext } from "@/lib/auth-guards";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { formatTry } from "@/lib/billing-plan";
import { siparisNoMu } from "@/lib/kart-odeme";
import { kartCereziAdi, kartOturumuOku } from "@/lib/kart-oturumu";
import KartFormu from "./kart-formu";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Kartla öde", en: "Pay by card" }) };
}

/*
  KART ÖDEME SAYFASI (28.10.2026). Ödeme kaydını bu sayfa AÇMAZ: kayıt
  "Kartla öde" düğmesinin sunucu işleminde açıldı (app/actions/kart-odeme.ts)
  ve yanıtı kısa ömürlü bir çerezle buraya geldi. Sayfa yenilense de
  önceden getirilse de ArvoOS'ta yeni ödeme kaydı oluşmuyor.

  Çerez yoksa (süresi doldu, başka tarayıcı, başka kullanıcı) 404: yeni
  bir ödeme abonelik sayfasından başlatılır.
*/
export default async function KartOdemeSayfasi({ params }: { params: Promise<{ oid: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/");
  const { oid } = await params;
  if (!siparisNoMu(oid)) notFound();
  const odeme = kartOturumuOku((await cookies()).get(kartCereziAdi(oid))?.value, oid, ctx.user.id);
  if (!odeme) notFound();

  const t = await ceviri();
  const dil = await aktifDil();
  const buYil = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric" }).format(new Date()));

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Kartla öde", en: "Pay by card" })}</h1>
          <p>
            {odeme.title} · <b>{formatTry(odeme.amount, dil)}</b>
          </p>
        </div>
        <Link href="/dashboard/abonelik" className="projects-filter-button">
          <ArrowLeft size={16} aria-hidden="true" />
          {t({ tr: "Abonelik sayfasına dön", en: "Back to subscription" })}
        </Link>
      </section>

      <article className="gb-kart kart-odeme-karti">
        <KartFormu
          paymentUrl={odeme.paymentUrl}
          merchantOid={odeme.merchantOid}
          fields={odeme.fields}
          utoken={odeme.utoken}
          consentText={odeme.consentText}
          buYil={buYil}
        />
      </article>
    </main>
  );
}
