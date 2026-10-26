import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth-guards";
import { getAccessState } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import { faturalamaKapsami, odemeAciklamasi, tutarYazisi } from "@/lib/faturalama";
import { faturalamaYukle } from "@/lib/subscription";
import { trTarihSaat } from "@/lib/tr-time";
import PrintActions from "../../manuscript/[id]/print-actions";

export const metadata: Metadata = { title: "Ödeme makbuzu · ArvoLab", robots: { index: false } };

/*
  ÖDEME MAKBUZU (26.10.2026). Kart ödemesinin dekontu yok; müşteri
  "ödememi yaptım" belgesini buradan yazdırıyor. Fatura DEĞİL — fatura
  elle kesilip ayrıca yükleniyor; sayfa bunu açıkça yazıyor.

  Abonelik kapısı bilerek YOK: ödeme yolları asla kapatılmaz
  (AGENTS.md), aboneliği biten kişi de geçmiş ödemesinin belgesini
  alabilmeli. Yetki: ödeme yalnızca Abonelik sayfasındaki aynı listede
  (bireysel abonenin kendi ya da kurum yöneticisinin kurumunun) varsa
  gösteriliyor; kimlik tahmin edilerek başkasının ödemesi açılamaz.
*/
export default async function MakbuzPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) redirect("/");

  const access = await getAccessState(await getCurrentProfile());
  const kapsam = faturalamaKapsami(access.kind, ctx.role, ctx.organizationId);
  if (!kapsam || !ctx.user.email) notFound();
  const veri = await faturalamaYukle(kapsam, { id: ctx.user.id, email: ctx.user.email });
  if (!veri) {
    return (
      <div className="print-page">
        <PrintActions backHref="/dashboard/abonelik" autoPrint={false} backLabel="Aboneliğe dön" />
        <p className="makbuz-uyari">Ödeme bilgisi şu an okunamadı; biraz sonra tekrar deneyin.</p>
      </div>
    );
  }
  const odeme = veri.odemeler.find((o) => o.id === id && o.durum === "odendi");
  if (!odeme) notFound();

  return (
    <div className="print-page">
      <PrintActions backHref="/dashboard/abonelik" autoPrint={false} backLabel="Aboneliğe dön" />
      <article className="print-sheet makbuz">
        <header>
          <h1>Ödeme makbuzu</h1>
          <p>ArvoLab · Arvo</p>
        </header>
        <dl>
          <dt>Ödeyen</dt>
          <dd>{kapsam.tur === "kurum" ? "Kurum hesabı" : ctx.user.email}</dd>
          <dt>Tarih</dt>
          <dd>{odeme.tarih ? trTarihSaat(odeme.tarih) : "—"}</dd>
          <dt>Açıklama</dt>
          <dd>{odemeAciklamasi(odeme)}</dd>
          <dt>Ödeme yolu</dt>
          <dd>{odeme.kanal === "kart" ? "Kredi/banka kartı (PayTR)" : "Havale/EFT"}</dd>
          {odeme.referans ? (
            <>
              <dt>Referans</dt>
              <dd>{odeme.referans}</dd>
            </>
          ) : null}
          <dt>Tutar</dt>
          <dd className="makbuz-tutar">{tutarYazisi(odeme.tutar, odeme.paraBirimi)}</dd>
          {odeme.fatura ? (
            <>
              <dt>Fatura</dt>
              <dd>
                {odeme.fatura.no}
                {odeme.fatura.tarih ? ` · ${odeme.fatura.tarih.split("-").reverse().join(".")}` : ""}
              </dd>
            </>
          ) : null}
        </dl>
        <p className="makbuz-uyari">
          Bu belge fatura değildir; ödemenin alındığını gösterir. Faturanız Abonelik ve kredi sayfasındaki
          &quot;Faturalar ve ödemeler&quot; bölümünde yer alır.
        </p>
      </article>
    </div>
  );
}
