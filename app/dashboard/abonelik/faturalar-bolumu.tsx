import Link from "next/link";
import { FileText, Paperclip, Receipt, ScrollText } from "lucide-react";
import { gunYazisi, odemeAciklamasi, odemeninProformasi, proformaDurumu, tutarYazisi, type Faturalama } from "@/lib/faturalama";
import { trGunAnahtari } from "@/lib/tr-time";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";

/*
  FATURALAR VE ÖDEMELER (26.10.2026, kurum sahibinin isteği: "müşteriye
  kesilen faturaları ve ödeme sliplerini burada görebilmeli, cari bakiye
  gibi").

  Fatura elle kesilip ArvoOS'a PDF olarak yükleniyor; yüklenene kadar satır
  "Fatura hazırlanıyor" der. Havale dekontu kurumun kendi yüklediği
  belgedir. Kart ödemesinin dekontu yok; yerine yazdırılabilir makbuz
  (fatura DEĞİL, ödemenin alındığını gösterir).

  Cari özet: bireysel abone peşin ödüyor, açık borcu olamaz; kurumda
  onay bekleyen havale tutarı ayrıca gösteriliyor.

  Liste okunamazsa "okunamadı" yazılıyor, boş liste değil: boş liste
  "hiç ödemeniz yok" demek olurdu.
*/
const DURUM = {
  odendi: { ad: { tr: "Ödendi", en: "Paid" }, ton: "success" },
  bekliyor: { ad: { tr: "Onay bekliyor", en: "Awaiting approval" }, ton: "warning" },
  reddedildi: { ad: { tr: "Reddedildi", en: "Rejected" }, ton: "danger" },
} as const;

/*
  Proformalar (27.10.2026): ödemeden önce gelen belge. Ödenmemiş olanlar
  "ödeme bekleniyor"; ödendiğinde ArvoOS proformayı ödemeyle eşliyor ve
  ödeme satırında proforma numarası görünüyor.
*/
const PROFORMA_DURUMU = {
  bekliyor: { ad: { tr: "Ödeme bekleniyor", en: "Awaiting payment" }, ton: "info" },
  odendi: { ad: { tr: "Ödendi", en: "Paid" }, ton: "success" },
  suresi_doldu: { ad: { tr: "Süresi doldu", en: "Expired" }, ton: "warning" },
} as const;

export default async function FaturalarBolumu({ veri, kurum }: { veri: Faturalama | null; kurum: boolean }) {
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarih } = await tarihler();
  return (
    <>
      <h3 className="calisma-durum-alt">
        <Receipt size={14} aria-hidden="true" /> {kurum
          ? t({ tr: "Kurumun faturaları ve ödemeleri", en: "Institution invoices and payments" })
          : t({ tr: "Faturalar ve ödemeler", en: "Invoices and payments" })}
      </h3>
      {!veri ? (
        <p className="gb-bos">
          {t({
            tr: "Ödeme geçmişi şu an okunamadı; ödeme sistemine ulaşılamıyor olabilir. Sayfayı sonra yenileyin.",
            en: "Payment history could not be loaded right now; the payment system may be unreachable. Refresh the page later.",
          })}
        </p>
      ) : (
        <>
          <dl className="cari-ozet">
            <div>
              <dt>{t({ tr: "Toplam ödenen", en: "Total paid" })}</dt>
              <dd>{tutarYazisi(veri.toplamOdenen, "TRY", dil)}</dd>
            </div>
            <div>
              <dt>{kurum ? t({ tr: "Onay bekleyen", en: "Awaiting approval" }) : t({ tr: "Açık borç", en: "Outstanding balance" })}</dt>
              <dd>{kurum ? tutarYazisi(veri.bekleyenTutar, "TRY", dil) : t({ tr: "Yok", en: "None" })}</dd>
            </div>
          </dl>
          {!kurum ? <p className="hint">{t({ tr: "Ödemeler peşin alınır; otomatik çekim ve borç oluşmaz.", en: "Payments are taken up front; there are no automatic charges and no debt." })}</p> : null}
          {veri.proformalar.length ? (
            <ul className="gb-liste fatura-listesi" aria-label={t({ tr: "Proformalar", en: "Pro forma invoices" })}>
              {veri.proformalar.map((p) => {
                const durum = PROFORMA_DURUMU[proformaDurumu(p, trGunAnahtari())];
                return (
                  <li key={p.id} className="fatura-satir">
                    <span className="gb-satir-govde">
                      <b>{t({ tr: `Proforma ${p.no}`, en: `Pro forma ${p.no}` })}</b>
                      <small>
                        {p.kalemler.map((k) => k.aciklama).join(", ")} · {t({ tr: "Geçerlilik", en: "Valid until" })}{" "}
                        {gunYazisi(p.gecerlilikTarihi, dil)}
                      </small>
                    </span>
                    <span className="fatura-tutar">{tutarYazisi(p.toplam, p.paraBirimi, dil)}</span>
                    <span className="status-pill" data-tone={durum.ton}>
                      {t(durum.ad)}
                    </span>
                    <span className="fatura-belgeler">
                      <Link href={`/print/proforma/${encodeURIComponent(p.id)}`} target="_blank">
                        <ScrollText size={13} aria-hidden="true" /> {t({ tr: "Proforma", en: "Pro forma" })}
                      </Link>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {veri.odemeler.length ? (
            <ul className="gb-liste fatura-listesi">
              {veri.odemeler.map((o) => (
                <li key={o.id} className="fatura-satir">
                  <span className="gb-satir-govde">
                    <b>{odemeAciklamasi(o, dil)}</b>
                    <small>
                      {o.tarih ? tarih(o.tarih) : t({ tr: "Tarih yok", en: "No date" })} ·{" "}
                      {o.kanal === "kart" ? t({ tr: "Kart", en: "Card" }) : t({ tr: "Havale/EFT", en: "Bank transfer" })}
                      {o.referans ? ` · ${o.referans}` : ""}
                      {odemeninProformasi(veri, o.id)
                        ? t({ tr: ` · Proforma ${odemeninProformasi(veri, o.id)!.no}`, en: ` · Pro forma ${odemeninProformasi(veri, o.id)!.no}` })
                        : ""}
                    </small>
                  </span>
                  <span className="fatura-tutar">{tutarYazisi(o.tutar, o.paraBirimi, dil)}</span>
                  <span className="status-pill" data-tone={DURUM[o.durum].ton}>
                    {t(DURUM[o.durum].ad)}
                  </span>
                  <span className="fatura-belgeler">
                    {o.fatura?.url ? (
                      <a href={o.fatura.url} target="_blank" rel="noreferrer noopener">
                        <FileText size={13} aria-hidden="true" /> {t({ tr: "Fatura", en: "Invoice" })} {o.fatura.no}
                      </a>
                    ) : o.durum === "odendi" ? (
                      <small className="muted">{t({ tr: "Fatura hazırlanıyor", en: "Invoice in preparation" })}</small>
                    ) : null}
                    {o.dekontUrl ? (
                      <a href={o.dekontUrl} target="_blank" rel="noreferrer noopener">
                        <Paperclip size={13} aria-hidden="true" /> {t({ tr: "Dekont", en: "Transfer slip" })}
                      </a>
                    ) : null}
                    {o.durum === "odendi" ? (
                      <Link href={`/print/makbuz/${encodeURIComponent(o.id)}`} target="_blank">
                        <Receipt size={13} aria-hidden="true" /> {t({ tr: "Makbuz", en: "Receipt" })}
                      </Link>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="gb-bos">{t({ tr: "Henüz ödeme yok.", en: "No payments yet." })}</p>
          )}
        </>
      )}
    </>
  );
}
