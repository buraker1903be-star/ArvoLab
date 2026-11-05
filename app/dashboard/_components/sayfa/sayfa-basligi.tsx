import type { ReactNode } from "react";

/*
  SAYFA BAŞLIĞI — PageHeader (Signature OS 4.1, 05.11.2026).

  On dokuz sayfa başlığını elle yazıyordu (`section.projects-header` +
  kendi div'i + kendi düğme kutusu: `pencere-dugmeler`,
  `merkez-ust-eylemler`). Görünüm aynı CSS'ten geldiği için benziyordu,
  ama yapı ayrışmıştı: kiminde uyarı başlığın içinde, kiminde dışında;
  kiminde çalışma seçici eylemlerle aynı kutuda, kiminde ayrı. Bu
  bileşen yapıyı sabitliyor; görünüm yine `.projects-header`'dan.

  KONUM YOLU başlıkta TEKRAR yazılmaz: tablet ve masaüstünde üst çubukta
  (konum-yolu.tsx), telefonda üst çubuğun markasının altında açık
  uygulamanın adı. İki yerde aynı yol görsel gürültüdür ve ikisi
  ayrışabilir.

  Açıklama TEK CÜMLE olmalı. Eskiden açıklamalar seçili çalışmanın tam
  adını tırnak içinde tekrar ediyordu ("“TÜRKİYE'DE ENFLASYON …”
  çalışmasının literatürü…"); ad zaten çalışma seçicide yazıyor ve
  telefonda açıklama dört satıra çıkıyordu.

  `baglam`: sayfanın neyi gösterdiğini değiştiren denetim (çalışma
  seçici). Eylem değildir, taşma menüsüne girmez.
  `eylemler`: <SayfaEylemleri>.
  `children`: başlığa bağlı uyarı (ör. etik kurul tarihi).
*/
export default function SayfaBasligi({
  ust,
  baslik,
  baslikTitle,
  aciklama,
  baglam,
  eylemler,
  children,
  sinif,
}: {
  /** Başlığın üstündeki küçük etiket ("Kanıt matrisi"). */
  ust?: string;
  baslik: string;
  /** Başlık kesiliyorsa tam metni (çalışma adı). */
  baslikTitle?: string;
  aciklama?: string;
  baglam?: ReactNode;
  eylemler?: ReactNode;
  children?: ReactNode;
  sinif?: string;
}) {
  return (
    <header className={sinif ? `projects-header sayfa-basligi ${sinif}` : "projects-header sayfa-basligi"}>
      <div className="sayfa-basligi-metin">
        {ust ? <span className="dashboard-kicker">{ust}</span> : null}
        <h1 title={baslikTitle}>{baslik}</h1>
        {aciklama ? <p>{aciklama}</p> : null}
        {children}
      </div>
      {baglam || eylemler ? (
        <div className="sayfa-basligi-sag">
          {baglam}
          {eylemler}
        </div>
      ) : null}
    </header>
  );
}
