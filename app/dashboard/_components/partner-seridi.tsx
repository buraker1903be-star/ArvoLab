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
  sayfa ve etik ilkeler): danışmanlık esaslı, kişi adına tez yazmıyor.
  ArvoLab'ın "asistan denetler, yazmaz" ilkesiyle aynı çizgi; aksini
  vaat eden bir partner metni burada durmamalı.

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
        biçim danışmanlığı. Çalışmanızı sizin yerinize yazmaz; her adımı gerekçesiyle açıklayarak kendi çalışmanızı
        tamamlamanıza destek olur.
      </p>
      <div className="partner-alt">
        <a href={ADRES} target="_blank" rel="sponsored noopener noreferrer" className="projects-filter-button button-compact">
          Akademik Merkez&apos;i ziyaret et <ExternalLink size={14} aria-hidden="true" />
        </a>
        <small>ArvoLab&apos;dan bağımsız, ücretli bir danışmanlık hizmetidir.</small>
      </div>
    </aside>
  );
}
