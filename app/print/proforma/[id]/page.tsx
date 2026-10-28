import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { gunYazisi, kalemTutari, proformaDurumu, tutarYazisi } from "@/lib/faturalama";
import { yazdirmaFaturalamasi } from "@/lib/faturalama-sunucu";
import { trGunAnahtari } from "@/lib/tr-time";
import { YEREL } from "@/lib/dil";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import PrintActions from "../../manuscript/[id]/print-actions";

// Başlık PDF'in dosya adı oluyor; kullanıcının dilinde olsun.
export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Proforma fatura", en: "Pro forma invoice" }), robots: { index: false } };
}

/*
  PROFORMA FATURA (27.10.2026). Ödemeden önce müşteriye giden belge:
  ne ödeyeceğini, KDV'yi ve nereye ödeyeceğini gösterir. Sıra: proforma
  → ödeme → makbuz → fatura. Proformayı Arvo ArvoOS'ta düzenliyor;
  burada yalnızca gösteriliyor.

  Fatura DEĞİL — sayfa bunu açıkça yazıyor. Abonelik kapısı bilerek YOK:
  ödeme yolları asla kapatılmaz (AGENTS.md), aboneliği bitmiş kişi
  ödemek için proformaya ulaşabilmeli. Yetki: proforma yalnızca Abonelik
  sayfasındaki aynı listede varsa açılır (lib/faturalama-sunucu.ts).
*/
export default async function ProformaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await ceviri();
  const dil = await aktifDil();
  const geriEtiketi = t({ tr: "Aboneliğe dön", en: "Back to subscription" });
  const okuma = await yazdirmaFaturalamasi();
  if (okuma.durum === "oturum-yok") redirect("/");
  if (okuma.durum === "yetki-yok") notFound();
  const { veri } = okuma;
  if (!veri) {
    return (
      <div className="print-page">
        <PrintActions backHref="/dashboard/abonelik" autoPrint={false} backLabel={geriEtiketi} />
        <p className="makbuz-uyari">
          {t({ tr: "Proforma şu an okunamadı; biraz sonra tekrar deneyin.", en: "The pro forma invoice could not be loaded right now; try again shortly." })}
        </p>
      </div>
    );
  }
  const p = veri.proformalar.find((x) => x.id === id);
  if (!p) notFound();
  const durum = proformaDurumu(p, trGunAnahtari());
  const satici = veri.satici;

  return (
    <div className="print-page">
      <PrintActions backHref="/dashboard/abonelik" autoPrint={false} backLabel={geriEtiketi} />
      <article className="print-sheet makbuz proforma">
        <header>
          <h1>{t({ tr: "Proforma fatura", en: "Pro forma invoice" })}</h1>
          <p>
            {p.no} · {t({ tr: "Düzenleme", en: "Issued" })} {gunYazisi(p.duzenlemeTarihi, dil)} · {t({ tr: "Geçerlilik", en: "Valid until" })}{" "}
            {gunYazisi(p.gecerlilikTarihi, dil)}
          </p>
          {durum !== "bekliyor" ? (
            <p className="proforma-durum">
              {durum === "odendi"
                ? t({ tr: "Ödendi", en: "Paid" })
                : t({
                    tr: "Süresi doldu — güncel proforma için bizimle iletişime geçin.",
                    en: "Expired — contact us for an updated pro forma invoice.",
                  })}
            </p>
          ) : null}
        </header>

        <div className="proforma-taraflar">
          <section>
            <h2>{t({ tr: "Düzenleyen", en: "Issued by" })}</h2>
            <p><b>{satici?.unvan ?? "Arvo"}</b></p>
            {satici?.adres ? <p>{satici.adres}</p> : null}
            {satici?.vergiDairesi || satici?.vergiNo ? (
              <p>
                {satici.vergiDairesi ? t({ tr: `${satici.vergiDairesi} V.D.`, en: `${satici.vergiDairesi} Tax Office` }) : ""}
                {satici.vergiDairesi && satici.vergiNo ? " · " : ""}
                {satici.vergiNo ? t({ tr: `VKN ${satici.vergiNo}`, en: `Tax ID ${satici.vergiNo}` }) : ""}
              </p>
            ) : null}
            {satici?.mersisNo ? <p>{t({ tr: "MERSİS", en: "MERSIS No." })} {satici.mersisNo}</p> : null}
          </section>
          <section>
            <h2>{t({ tr: "Sayın", en: "Bill to" })}</h2>
            <p><b>{p.musteriAdi}</b></p>
          </section>
        </div>

        <table className="proforma-tablo">
          <thead>
            <tr>
              <th>{t({ tr: "Açıklama", en: "Description" })}</th>
              <th className="sayi">{t({ tr: "Miktar", en: "Quantity" })}</th>
              <th className="sayi">{t({ tr: "Birim fiyat", en: "Unit price" })}</th>
              <th className="sayi">{t({ tr: "Tutar", en: "Amount" })}</th>
            </tr>
          </thead>
          <tbody>
            {p.kalemler.map((k, i) => (
              <tr key={i}>
                <td>{k.aciklama}</td>
                <td className="sayi">{k.miktar.toLocaleString(YEREL[dil])}</td>
                <td className="sayi">{tutarYazisi(k.birimFiyat, p.paraBirimi, dil)}</td>
                <td className="sayi">{tutarYazisi(kalemTutari(k), p.paraBirimi, dil)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3}>{t({ tr: "Ara toplam (KDV hariç)", en: "Subtotal (excl. VAT)" })}</th>
              <td className="sayi">{tutarYazisi(p.araToplam, p.paraBirimi, dil)}</td>
            </tr>
            <tr>
              <th colSpan={3}>
                {t({ tr: `KDV (%${p.kdvOrani.toLocaleString("tr-TR")})`, en: `VAT (${p.kdvOrani.toLocaleString("en-US")}%)` })}
              </th>
              <td className="sayi">{tutarYazisi(p.kdv, p.paraBirimi, dil)}</td>
            </tr>
            <tr className="proforma-genel">
              <th colSpan={3}>{t({ tr: "Genel toplam", en: "Total" })}</th>
              <td className="sayi">{tutarYazisi(p.toplam, p.paraBirimi, dil)}</td>
            </tr>
          </tfoot>
        </table>

        {satici?.hesaplar.length ? (
          <section className="proforma-hesaplar">
            <h2>{t({ tr: "Ödeme bilgileri", en: "Payment details" })}</h2>
            <dl>
              {satici.hesaplar.map((h) => (
                <div key={h.iban}>
                  <dt>{h.banka}</dt>
                  <dd>
                    {h.iban}
                    {h.hesapSahibi ? ` · ${h.hesapSahibi}` : ""}
                  </dd>
                </div>
              ))}
            </dl>
            {/* Kartla ödeme cümlesi kaldırıldı: kurumun Abonelik sayfasında kart düğmesi yok, bireyselde
                düğme plan tutarını çeker, bu proformanın tutarını değil. Proforma havale belgesidir. */}
            <p>
              {t({ tr: "Havale açıklamasına", en: "Include" })} <b>{p.no}</b>{" "}
              {t({ tr: "yazınız.", en: "in the transfer description." })}
            </p>
          </section>
        ) : null}

        {p.notlar ? <p className="proforma-not">{p.notlar}</p> : null}

        <p className="makbuz-uyari">
          {t({
            tr: "Bu belge proforma faturadır; mali değeri yoktur. Ödeme alındıktan sonra faturanız kesilir ve Abonelik ve kredi sayfasındaki \"Faturalar ve ödemeler\" bölümünde yer alır.",
            en: "This is a pro forma invoice and has no fiscal value. Once payment is received, your invoice is issued and appears in the \"Invoices and payments\" section of the Subscription and credits page.",
          })}
        </p>
      </article>
    </div>
  );
}
