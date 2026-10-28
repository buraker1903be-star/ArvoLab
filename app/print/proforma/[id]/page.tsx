import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { gunYazisi, kalemTutari, proformaDurumu, tutarYazisi } from "@/lib/faturalama";
import { yazdirmaFaturalamasi } from "@/lib/faturalama-sunucu";
import { trGunAnahtari } from "@/lib/tr-time";
import PrintActions from "../../manuscript/[id]/print-actions";

export const metadata: Metadata = { title: "Proforma fatura", robots: { index: false } };

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
  const okuma = await yazdirmaFaturalamasi();
  if (okuma.durum === "oturum-yok") redirect("/");
  if (okuma.durum === "yetki-yok") notFound();
  const { veri } = okuma;
  if (!veri) {
    return (
      <div className="print-page">
        <PrintActions backHref="/dashboard/abonelik" autoPrint={false} backLabel="Aboneliğe dön" />
        <p className="makbuz-uyari">Proforma şu an okunamadı; biraz sonra tekrar deneyin.</p>
      </div>
    );
  }
  const p = veri.proformalar.find((x) => x.id === id);
  if (!p) notFound();
  const durum = proformaDurumu(p, trGunAnahtari());
  const satici = veri.satici;

  return (
    <div className="print-page">
      <PrintActions backHref="/dashboard/abonelik" autoPrint={false} backLabel="Aboneliğe dön" />
      <article className="print-sheet makbuz proforma">
        <header>
          <h1>Proforma fatura</h1>
          <p>
            {p.no} · Düzenleme {gunYazisi(p.duzenlemeTarihi)} · Geçerlilik {gunYazisi(p.gecerlilikTarihi)}
          </p>
          {durum !== "bekliyor" ? (
            <p className="proforma-durum">{durum === "odendi" ? "Ödendi" : "Süresi doldu — güncel proforma için bizimle iletişime geçin."}</p>
          ) : null}
        </header>

        <div className="proforma-taraflar">
          <section>
            <h2>Düzenleyen</h2>
            <p><b>{satici?.unvan ?? "Arvo"}</b></p>
            {satici?.adres ? <p>{satici.adres}</p> : null}
            {satici?.vergiDairesi || satici?.vergiNo ? (
              <p>
                {satici.vergiDairesi ? `${satici.vergiDairesi} V.D.` : ""}
                {satici.vergiDairesi && satici.vergiNo ? " · " : ""}
                {satici.vergiNo ? `VKN ${satici.vergiNo}` : ""}
              </p>
            ) : null}
            {satici?.mersisNo ? <p>MERSİS {satici.mersisNo}</p> : null}
          </section>
          <section>
            <h2>Sayın</h2>
            <p><b>{p.musteriAdi}</b></p>
          </section>
        </div>

        <table className="proforma-tablo">
          <thead>
            <tr>
              <th>Açıklama</th>
              <th className="sayi">Miktar</th>
              <th className="sayi">Birim fiyat</th>
              <th className="sayi">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {p.kalemler.map((k, i) => (
              <tr key={i}>
                <td>{k.aciklama}</td>
                <td className="sayi">{k.miktar.toLocaleString("tr-TR")}</td>
                <td className="sayi">{tutarYazisi(k.birimFiyat, p.paraBirimi)}</td>
                <td className="sayi">{tutarYazisi(kalemTutari(k), p.paraBirimi)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3}>Ara toplam (KDV hariç)</th>
              <td className="sayi">{tutarYazisi(p.araToplam, p.paraBirimi)}</td>
            </tr>
            <tr>
              <th colSpan={3}>KDV (%{p.kdvOrani.toLocaleString("tr-TR")})</th>
              <td className="sayi">{tutarYazisi(p.kdv, p.paraBirimi)}</td>
            </tr>
            <tr className="proforma-genel">
              <th colSpan={3}>Genel toplam</th>
              <td className="sayi">{tutarYazisi(p.toplam, p.paraBirimi)}</td>
            </tr>
          </tfoot>
        </table>

        {satici?.hesaplar.length ? (
          <section className="proforma-hesaplar">
            <h2>Ödeme bilgileri</h2>
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
            <p>Havale açıklamasına <b>{p.no}</b> yazınız. Kartla ödemeyi Abonelik ve kredi sayfasından yapabilirsiniz.</p>
          </section>
        ) : null}

        {p.notlar ? <p className="proforma-not">{p.notlar}</p> : null}

        <p className="makbuz-uyari">
          Bu belge proforma faturadır; mali değeri yoktur. Ödeme alındıktan sonra faturanız kesilir ve Abonelik ve
          kredi sayfasındaki &quot;Faturalar ve ödemeler&quot; bölümünde yer alır.
        </p>
      </article>
    </div>
  );
}
