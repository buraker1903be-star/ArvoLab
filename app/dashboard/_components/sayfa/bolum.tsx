import type { ReactNode } from "react";

/*
  BÖLÜM — SectionLayout (Signature OS 4.1, 05.11.2026).

  Kart KULLANMADAN içerik gruplama: başlık, isteğe bağlı kısa açıklama ve
  eylem, altında içerik; gruplar arasında ince bir çizgi. Kartın içinde
  kart yok.

  Eskiden bir kartın içindeki gruplar `h4.calisma-durum-alt` ile ayrılıyor,
  içerik başlığın altına bağsız diziliyordu: başlık hangi satırları
  kapsıyor, ekran okuyucu bilemiyordu (bölge yoktu) ve her sayfa grup
  aralığını kendi boşluğuyla ayarlıyordu. Bölüm `section` +
  `aria-labelledby` ile adlı bir bölge; başlık düzeyi sayfadaki yerine
  göre verilir (sayfada h2, kartın içinde h3).
*/
export default function Bolum({
  id,
  baslik,
  aciklama,
  eylem,
  duzey = 3,
  children,
  sinif,
}: {
  /** Başlığın kimliği; sayfada tekil olmalı. */
  id: string;
  baslik: string;
  aciklama?: ReactNode;
  eylem?: ReactNode;
  duzey?: 2 | 3 | 4;
  children: ReactNode;
  sinif?: string;
}) {
  const Baslik = `h${duzey}` as const;
  return (
    <section className={sinif ? `sayfa-bolum ${sinif}` : "sayfa-bolum"} aria-labelledby={id}>
      <div className="sayfa-bolum-bas">
        <div>
          <Baslik id={id}>{baslik}</Baslik>
          {aciklama ? <p>{aciklama}</p> : null}
        </div>
        {eylem}
      </div>
      {children}
    </section>
  );
}
