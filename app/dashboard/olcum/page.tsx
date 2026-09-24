import { ChartNoAxesCombined, ShieldAlert } from "lucide-react";
import BosDurum from "../_components/bos-durum";
import { olcumOzeti } from "@/app/actions/olcum";

/*
  Ürün ölçümü — iç ekip görünümü.

  Neden bir sayfa gerekti: bireysel abonelik açıldı ama "denemeyi başlatan
  kaç kişiden kaçı ödedi" sorusunun cevabı hiçbir yerde görünmüyordu. Fiyat,
  deneme süresi ve hatırlatma zamanlaması bu sayıya bakılmadan ayarlanamaz.

  Neden dış analitik yok: hesabın tamamı kendi tablolarımızdan çıkıyor
  (lib/olcum.ts). Üçüncü bir servise kullanıcı davranışı göndermek ayrı bir
  açık rıza meselesi açardı.
*/
export const dynamic = "force-dynamic";

const yuzde = (deger: number | null) => (deger === null ? "—" : `%${deger}`);

export default async function OlcumPage() {
  const ozet = await olcumOzeti();

  if (ozet.yetkisiz) {
    return (
      <main className="dashboard-page">
        <BosDurum
          ikon={ShieldAlert}
          baslik="Bu sayfa size kapalı"
          aciklama="Ürün ölçümü yalnızca Sistem Yöneticisi ve Kurucu'ya açıktır."
          eylem={{ etiket: "Ana sayfaya dön", href: "/dashboard" }}
        />
      </main>
    );
  }

  const { sayilar, donusum, aktivasyon } = ozet;

  return (
    <main className="dashboard-page">
      <section className="projects-header">
        <div>
          <span className="dashboard-kicker">İç ekip</span>
          <h1>Ürün Ölçümü</h1>
          <p>
            Bireysel abonelerin hunisi, aktivasyonu ve kaybı. Sayılar canlı
            tablolardan okunuyor; dışarıya hiçbir veri gönderilmiyor.
          </p>
        </div>
      </section>

      {/* Eksik veriyle çizilmiş bir huni olmayan bir sorunu icat eder; bu
          yüzden okuma hatası gizlenmiyor. */}
      {ozet.okunamadi ? (
        <p className="alert" role="alert">
          Sayıların bir bölümü okunamadı. Aşağıdakiler <strong>eksik</strong>{" "}
          olabilir — karar vermeden önce sayfayı yenileyin.
        </p>
      ) : null}

      <section className="dashboard-stats" aria-label="Bireysel abonelik hunisi">
        {[
          { label: "Kayıt", value: String(sayilar.kayit), note: "Kurumu olmayan üye/öğrenci hesapları" },
          { label: "Deneme başlattı", value: String(sayilar.denemeBaslatan), note: "ArvoOS'ta abone kaydı açılmış" },
          { label: "Ödemeye geçti", value: String(sayilar.odemeyeGecen), note: "Dönemi deneme bitişinin ötesine uzamış" },
          { label: "Dönüşüm", value: yuzde(donusum), note: "Denemeyi başlatanların ödeyen oranı" },
          { label: "Şu an erişimi açık", value: String(sayilar.suAnErisimi), note: "Deneme ya da ödenmiş dönem sürüyor" },
        ].map((kart) => (
          <article className="dashboard-stat-card" key={kart.label}>
            <div>
              <strong>{kart.value}</strong>
              <span>{kart.label}</span>
              <em>{kart.note}</em>
            </div>
          </article>
        ))}
      </section>

      <section className="section mt-lg">
        <h2 className="section-title">Aktivasyon</h2>
        <p className="muted text-sm">
          Payda her kayıtlı bireysel kullanıcı. Adımlar birbirinin içine
          daralmıyor: &ldquo;çalışma açanların kaçı yazdı&rdquo; biçiminde bir zincir,
          insanların nerede bıraktığını gizler.
        </p>
        {sayilar.kayit === 0 ? (
          <BosDurum
            kompakt
            ikon={ChartNoAxesCombined}
            aciklama="Henüz bireysel kayıt yok. İlk kayıtlardan sonra bu bölüm ürünün gerçekten kullanılıp kullanılmadığını gösterecek."
          />
        ) : (
          <div className="table-scroll" role="region" aria-label="Aktivasyon tablosu" tabIndex={0}>
            <table className="stats-result-table">
              <thead>
                <tr>
                  <th>Adım</th>
                  <th>Kişi</th>
                  <th>Oran</th>
                </tr>
              </thead>
              <tbody>
                {aktivasyon.map((adim) => (
                  <tr key={adim.etiket}>
                    <td>{adim.etiket}</td>
                    <td>{adim.kisi}</td>
                    <td>{yuzde(adim.yuzde)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section mt-lg">
        <h2 className="section-title">Kayıp</h2>
        <div className="dashboard-stats" aria-label="Kayıp">
          <article className="dashboard-stat-card" data-tone="warning">
            <div>
              <strong>{sayilar.denemedeBirakan}</strong>
              <span>Denemede bıraktı</span>
              <em>Deneme süresi doldu, hiç ödeme yapmadı</em>
            </div>
          </article>
          <article className="dashboard-stat-card" data-tone="warning">
            <div>
              <strong>{sayilar.yenilemeyen}</strong>
              <span>Yenilemedi</span>
              <em>Ödemişti, dönemi bitti, uzatmadı</em>
            </div>
          </article>
        </div>
        <p className="muted text-sm mt-sm">
          Otomatik yenileme yok: kart saklanmıyor, her dönem kullanıcının
          kendisi ödüyor. Bu iki sayı bu yüzden aynı şey değil — ikincisi
          ürünü beğenmiş ama ödeme adımına dönmemiş kişileri sayar.
        </p>
      </section>

      <section className="section mt-lg">
        <h2 className="section-title">Ürün geri bildirimi</h2>
        <p className="text-base">
          {sayilar.geriBildirimSayisi === 0
            ? "Henüz kimse geri bildirim sorusunu cevaplamadı."
            : `${sayilar.geriBildirimSayisi} kişi cevapladı, ortalama puan ${sayilar.geriBildirimOrtalamasi ?? "—"}/5.`}
        </p>
      </section>
    </main>
  );
}
