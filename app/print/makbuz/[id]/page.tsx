import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { gunYazisi, odemeAciklamasi, odemeninProformasi, tutarYazisi } from "@/lib/faturalama";
import { yazdirmaFaturalamasi } from "@/lib/faturalama-sunucu";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import PrintActions from "../../manuscript/[id]/print-actions";

// Başlık PDF'in dosya adı oluyor; kullanıcının dilinde olsun.
export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Ödeme makbuzu", en: "Payment receipt" }), robots: { index: false } };
}

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
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarihSaat } = await tarihler();
  const geriEtiketi = t({ tr: "Aboneliğe dön", en: "Back to subscription" });
  const okuma = await yazdirmaFaturalamasi();
  if (okuma.durum === "oturum-yok") redirect("/");
  if (okuma.durum === "yetki-yok") notFound();
  const { ctx, kapsam, veri } = okuma;
  if (!veri) {
    return (
      <div className="print-page">
        <PrintActions backHref="/dashboard/abonelik" autoPrint={false} backLabel={geriEtiketi} />
        <p className="makbuz-uyari">
          {t({ tr: "Ödeme bilgisi şu an okunamadı; biraz sonra tekrar deneyin.", en: "Payment details could not be loaded right now; try again shortly." })}
        </p>
      </div>
    );
  }
  const odeme = veri.odemeler.find((o) => o.id === id && o.durum === "odendi");
  if (!odeme) notFound();
  const proforma = odemeninProformasi(veri, odeme.id);

  return (
    <div className="print-page">
      <PrintActions backHref="/dashboard/abonelik" autoPrint={false} backLabel={geriEtiketi} />
      <article className="print-sheet makbuz">
        <header>
          <h1>{t({ tr: "Ödeme makbuzu", en: "Payment receipt" })}</h1>
          <p>ArvoLab · Arvo</p>
        </header>
        <dl>
          <dt>{t({ tr: "Ödeyen", en: "Paid by" })}</dt>
          <dd>{kapsam.tur === "kurum" ? t({ tr: "Kurum hesabı", en: "Institution account" }) : ctx.user.email}</dd>
          <dt>{t({ tr: "Tarih", en: "Date" })}</dt>
          <dd>{odeme.tarih ? tarihSaat(odeme.tarih) : "—"}</dd>
          <dt>{t({ tr: "Açıklama", en: "Description" })}</dt>
          <dd>{odemeAciklamasi(odeme, dil)}</dd>
          <dt>{t({ tr: "Ödeme yolu", en: "Payment method" })}</dt>
          <dd>{odeme.kanal === "kart"
              ? t({ tr: "Kredi/banka kartı (PayTR)", en: "Credit/debit card (PayTR)" })
              : t({ tr: "Havale/EFT", en: "Bank transfer" })}</dd>
          {odeme.referans ? (
            <>
              <dt>{t({ tr: "Referans", en: "Reference" })}</dt>
              <dd>{odeme.referans}</dd>
            </>
          ) : null}
          <dt>{t({ tr: "Tutar", en: "Amount" })}</dt>
          <dd className="makbuz-tutar">{tutarYazisi(odeme.tutar, odeme.paraBirimi, dil)}</dd>
          {proforma ? (
            <>
              <dt>{t({ tr: "Proforma", en: "Pro forma invoice" })}</dt>
              <dd>
                {proforma.no} · {gunYazisi(proforma.duzenlemeTarihi, dil)}
              </dd>
            </>
          ) : null}
          {odeme.fatura ? (
            <>
              <dt>{t({ tr: "Fatura", en: "Invoice" })}</dt>
              <dd>
                {odeme.fatura.no}
                {odeme.fatura.tarih ? ` · ${gunYazisi(odeme.fatura.tarih, dil)}` : ""}
              </dd>
            </>
          ) : null}
        </dl>
        <p className="makbuz-uyari">
          {t({
            tr: "Bu belge fatura değildir; ödemenin alındığını gösterir. Faturanız Abonelik ve kredi sayfasındaki \"Faturalar ve ödemeler\" bölümünde yer alır.",
            en: "This document is not an invoice; it confirms that the payment was received. Your invoice is in the \"Invoices and payments\" section of the Subscription and credits page.",
          })}
        </p>
      </article>
    </div>
  );
}
