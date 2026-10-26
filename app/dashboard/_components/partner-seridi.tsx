import Image from "next/image";
import { ExternalLink } from "lucide-react";

/*
  PARTNER ŞERİDİ: Akademik Merkez (26.10.2026, kurum sahibinin isteği:
  "uzman desteğinde Akademik Merkez logosu ve partnerimiz ifadesi, linkiyle").

  Destek sayfasının Uzman desteği kartında. Reklam olduğu AÇIKÇA yazıyor:
  "Uzmana sor" talebi kurumun uzmanına ya da ArvoLab ekibine gidiyor,
  bu bağlantı ise ArvoLab'dan bağımsız, ücretli bir hizmete. İkisi
  karıştırılırsa öğrenci ücretli bir hizmeti ürünün parçası sanar.

  Tanıtım cümlesi sitenin kendi sözlerinden (akademikmerkez.com: ana
  sayfa ve etik ilkeler): "danışmanlık esaslı hizmet modeli". İlk
  sürümde "çalışmanızı sizin yerinize yazmaz" yazıyordu; kurum sahibi
  olumsuz cümle yerine hizmet modelinin adını istedi.

  Bağlantı yeni sekmede, rel="sponsored": arama motorlarına ücretli
  bağlantı olarak bildirilir. utm etiketi partnerin, gelen ziyaretin
  ArvoLab'dan geldiğini görebilmesi için.
*/
const ADRES = "https://akademikmerkez.com/?utm_source=arvolab&utm_medium=partner&utm_campaign=uzman_destegi";

export default function PartnerSeridi() {
  return (
    <aside className="partner-serit" aria-label="Partnerimiz Akademik Merkez">
      <span className="partner-etiket">Partnerimiz</span>
      <a href={ADRES} target="_blank" rel="sponsored noopener noreferrer" className="partner-logo">
        {/*
          Tek logo, iki temada da: koyu temada beyaz zemin üstünde. Sitenin
          beyaz logosu (logo-white-trimmed) farklı yerleşimli, yazısı bu
          boyda okunmuyordu.
        */}
        <Image src="/partner/akademik-merkez.png" alt="Akademik Merkez" width={600} height={98} />
      </a>
      <p>
        Tez, makale ve doçentlik süreçlerinde yöntem, istatistik ve analiz (SPSS, Python, MAXQDA), literatür, dil ve
        biçim danışmanlığı. Danışmanlık esaslı çalışır: her adım gerekçesiyle açıklanır ve sizinle birlikte yürütülür.
      </p>
      <div className="partner-alt">
        <a href={ADRES} target="_blank" rel="sponsored noopener noreferrer" className="projects-filter-button button-compact">
          Akademik Merkez&apos;i ziyaret et <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
      {/*
        Fiyat ve sorumluluk notu (kurum sahibinin isteği): öğrenci partnerin
        ücretini aboneliğinin parçası sanmamalı, bir sorun yaşarsa kime
        başvuracağını bilmeli. Kısa ve kesin: dahil değil, sorumlu partner.
      */}
      <p className="partner-not">
        Akademik Merkez&apos;in danışmanlık hizmetleri ArvoLab aboneliğine dahil değildir. Fiyatlandırma, hizmetin kapsamı
        ve yürütülmesi tamamen Akademik Merkez&apos;in sorumluluğundadır; ArvoLab bu hizmetin satıcısı ya da tarafı değildir.
      </p>
    </aside>
  );
}
