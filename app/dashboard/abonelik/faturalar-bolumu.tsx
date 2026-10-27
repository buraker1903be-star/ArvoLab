import Link from "next/link";
import { FileText, Paperclip, Receipt, ScrollText } from "lucide-react";
import { gunYazisi, odemeAciklamasi, odemeninProformasi, proformaDurumu, tutarYazisi, type Faturalama } from "@/lib/faturalama";
import { trGunAnahtari, trTarih } from "@/lib/tr-time";

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
  odendi: { ad: "Ödendi", ton: "success" },
  bekliyor: { ad: "Onay bekliyor", ton: "warning" },
  reddedildi: { ad: "Reddedildi", ton: "danger" },
} as const;

/*
  Proformalar (27.10.2026): ödemeden önce gelen belge. Ödenmemiş olanlar
  "ödeme bekleniyor"; ödendiğinde ArvoOS proformayı ödemeyle eşliyor ve
  ödeme satırında proforma numarası görünüyor.
*/
const PROFORMA_DURUMU = {
  bekliyor: { ad: "Ödeme bekleniyor", ton: "info" },
  odendi: { ad: "Ödendi", ton: "success" },
  suresi_doldu: { ad: "Süresi doldu", ton: "warning" },
} as const;

export default function FaturalarBolumu({ veri, kurum }: { veri: Faturalama | null; kurum: boolean }) {
  return (
    <>
      <h3 className="calisma-durum-alt">
        <Receipt size={14} aria-hidden="true" /> {kurum ? "Kurumun faturaları ve ödemeleri" : "Faturalar ve ödemeler"}
      </h3>
      {!veri ? (
        <p className="gb-bos">Ödeme geçmişi şu an okunamadı; ödeme sistemine ulaşılamıyor olabilir. Sayfayı sonra yenileyin.</p>
      ) : (
        <>
          <dl className="cari-ozet">
            <div>
              <dt>Toplam ödenen</dt>
              <dd>{tutarYazisi(veri.toplamOdenen)}</dd>
            </div>
            <div>
              <dt>{kurum ? "Onay bekleyen" : "Açık borç"}</dt>
              <dd>{kurum ? tutarYazisi(veri.bekleyenTutar) : "Yok"}</dd>
            </div>
          </dl>
          {!kurum ? <p className="hint">Ödemeler peşin alınır; otomatik çekim ve borç oluşmaz.</p> : null}
          {veri.proformalar.length ? (
            <ul className="gb-liste fatura-listesi" aria-label="Proformalar">
              {veri.proformalar.map((p) => {
                const durum = PROFORMA_DURUMU[proformaDurumu(p, trGunAnahtari())];
                return (
                  <li key={p.id} className="fatura-satir">
                    <span className="gb-satir-govde">
                      <b>Proforma {p.no}</b>
                      <small>
                        {p.kalemler.map((k) => k.aciklama).join(", ")} · Geçerlilik {gunYazisi(p.gecerlilikTarihi)}
                      </small>
                    </span>
                    <span className="fatura-tutar">{tutarYazisi(p.toplam, p.paraBirimi)}</span>
                    <span className="status-pill" data-tone={durum.ton}>
                      {durum.ad}
                    </span>
                    <span className="fatura-belgeler">
                      <Link href={`/print/proforma/${encodeURIComponent(p.id)}`} target="_blank">
                        <ScrollText size={13} aria-hidden="true" /> Proforma
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
                    <b>{odemeAciklamasi(o)}</b>
                    <small>
                      {o.tarih ? trTarih(o.tarih) : "Tarih yok"} · {o.kanal === "kart" ? "Kart" : "Havale/EFT"}
                      {o.referans ? ` · ${o.referans}` : ""}
                      {odemeninProformasi(veri, o.id) ? ` · Proforma ${odemeninProformasi(veri, o.id)!.no}` : ""}
                    </small>
                  </span>
                  <span className="fatura-tutar">{tutarYazisi(o.tutar, o.paraBirimi)}</span>
                  <span className="status-pill" data-tone={DURUM[o.durum].ton}>
                    {DURUM[o.durum].ad}
                  </span>
                  <span className="fatura-belgeler">
                    {o.fatura?.url ? (
                      <a href={o.fatura.url} target="_blank" rel="noreferrer noopener">
                        <FileText size={13} aria-hidden="true" /> Fatura {o.fatura.no}
                      </a>
                    ) : o.durum === "odendi" ? (
                      <small className="muted">Fatura hazırlanıyor</small>
                    ) : null}
                    {o.dekontUrl ? (
                      <a href={o.dekontUrl} target="_blank" rel="noreferrer noopener">
                        <Paperclip size={13} aria-hidden="true" /> Dekont
                      </a>
                    ) : null}
                    {o.durum === "odendi" ? (
                      <Link href={`/print/makbuz/${encodeURIComponent(o.id)}`} target="_blank">
                        <Receipt size={13} aria-hidden="true" /> Makbuz
                      </Link>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="gb-bos">Henüz ödeme yok.</p>
          )}
        </>
      )}
    </>
  );
}
