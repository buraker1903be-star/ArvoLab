import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { HareketSerisi } from "@/lib/genel-bakis";
import type { YazimRitmi } from "@/lib/yazim-ritmi";

/*
  GENEL BAKIŞ PARÇALARI — ArvoOS'un ana ekran şablonunun
  (app/panel/os/genel-bakis.tsx) ArvoLab karşılığı.

  Düzen: selamlama · tam genişlikte grafik kartı · altında yan yana dört
  liste kartı, her biri en fazla altı satır ve kendi sayfasına bağlantı.
  Tek ekrana sığar. İki ürünün ana ekranı aynı dili konuşsun diye
  sınıf adları ve ölçüler ArvoOS'tan (genel-bakis.css).
*/

export const GENEL_BAKIS_SATIR = 6;

export type SeriOzeti = { ad: string; deger: number };

/** Tam genişlikte grafik: son 14 gün, toplam ve önceki döneme göre değişim. */
export function SeriKarti({
  baslik,
  alt,
  seri,
  adet,
  ozet,
  bos,
}: {
  baslik: string;
  alt: string;
  seri: HareketSerisi;
  /** Çubuk ipucundaki ad: "hareket". */
  adet: string;
  ozet?: SeriOzeti[];
  /*
    Pencerede hiç kayıt yoksa çubukların yerine yazılan cümle. On dört
    gri kütük hiçbir şey söylemeden ekranın en geniş bloğunu kaplıyordu
    (ArvoOS'ta 15.10.2026'da yaşandı); başlık ve toplam yerinde kalıyor.
  */
  bos: string;
}) {
  const bosSeri = seri.toplam === 0;
  return (
    <article className="gb-kart gb-grafik">
      <header className="gb-kart-bas">
        <div>
          <h2>{baslik}</h2>
          <p>{alt}</p>
        </div>
        {ozet?.length ? (
          <dl className="gb-ozet">
            {ozet.map((o) => (
              <div key={o.ad}>
                <dt>{o.ad}</dt>
                <dd>{o.deger.toLocaleString("tr-TR")}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="gb-toplam">
          <strong>{seri.toplam.toLocaleString("tr-TR")}</strong>
          {seri.degisim !== null ? (
            <span data-tone={seri.degisim >= 0 ? "success" : "danger"}>
              {seri.degisim >= 0 ? "+" : ""}
              {seri.degisim}% önceki döneme göre
            </span>
          ) : seri.toplam ? (
            <span data-tone="neutral">önceki dönemde kayıt yok</span>
          ) : null}
        </div>
      </header>
      {bosSeri ? (
        <p className="gb-seri-bos">{bos}</p>
      ) : (
        <div className="gb-cubuklar" role="img" aria-label={`${alt}: toplam ${seri.toplam} ${adet}`}>
          {seri.gunler.map((gun) => (
            <div
              key={gun.anahtar}
              className={`gb-cubuk${gun.bugun ? " is-bugun" : ""}${gun.adet ? "" : " is-bos"}`}
              title={`${gun.baslik}: ${gun.adet} ${adet}`}
            >
              <span className="gb-cubuk-deger">{gun.adet || ""}</span>
              {/* Yükseklik veriye bağlı: satır içi değer yalnızca bu. */}
              <span
                className="gb-cubuk-dolgu"
                style={{ "--h": `${gun.adet ? Math.max(10, (gun.adet / seri.enBuyuk) * 100) : 4}%` } as CSSProperties}
              />
              <small>{gun.gun}</small>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

/** Dört sütunun ortak kartı: başlık, alt başlık, liste ya da boş durum, alt bağlantı. */
export function ListeKarti({
  baslik,
  alt,
  bos,
  href,
  hrefEtiket,
  sayi,
  children,
}: {
  baslik: string;
  alt: string;
  bos: string;
  href?: string;
  hrefEtiket?: string;
  sayi: number;
  children?: ReactNode;
}) {
  return (
    <article className="gb-kart gb-sutun">
      <header className="gb-kart-bas">
        <div>
          <h2>{baslik}</h2>
          <p>{alt}</p>
        </div>
      </header>
      {sayi ? <ul className="gb-liste">{children}</ul> : <p className="gb-bos">{bos}</p>}
      {href ? (
        <Link className="gb-kart-baglanti" href={href}>
          {hrefEtiket} <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ) : null}
    </article>
  );
}

export function ListeIzgarasi({ children, etiket }: { children: ReactNode; etiket: string }) {
  return (
    <section className="gb-sutunlar" aria-label={etiket}>
      {children}
    </section>
  );
}

/*
  Liste satırı. Sağı boş kalan satıra ok çizilir: rozeti ya da zamanı
  olan satırda sağ uç zaten dolu; boş olanı düz metin gibi duruyor ve
  tıklanabilir olduğunu söylemiyordu (ArvoOS, 15.10.2026).
*/
export function ListeSatiri({
  href,
  baslik,
  alt,
  onizleme,
  sag,
  zaman,
}: {
  href: string;
  baslik: ReactNode;
  alt?: ReactNode;
  /** Alt satır bir yorum önizlemesiyse tek satıra kırpılır. */
  onizleme?: boolean;
  sag?: ReactNode;
  zaman?: string;
}) {
  return (
    <li>
      <Link className="gb-satir" href={href}>
        <span className="gb-satir-govde">
          <b>{baslik}</b>
          {alt ? <small className={onizleme ? "gb-onizleme" : undefined}>{alt}</small> : null}
        </span>
        {sag}
        {zaman ? <small className="gb-zaman">{zaman}</small> : null}
        {!sag && !zaman ? <ChevronRight className="gb-ok" size={14} aria-hidden="true" /> : null}
      </Link>
    </li>
  );
}

/*
  YAZIM RİTMİ KARTI (öğrencinin ana sayfası). Gün gün NET yazılan
  kelime; eksi gün (silme, taşıma) çubuğun altında kendi rengiyle.
  Üstte öğrencinin asıl sorusunun cevabı: "bu hafta ne kadar yazdım".
*/
export function RitimKarti({ ritim, href }: { ritim: YazimRitmi; href: string }) {
  const yazildi = ritim.gunler.some((g) => g.net !== 0);
  const isaret = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("tr-TR")}`;
  return (
    <article className="gb-kart gb-sutun">
      <header className="gb-kart-bas">
        <div>
          <h2>Yazım ritmi</h2>
          <p>Son 14 gün, net kelime</p>
        </div>
      </header>
      <dl className="gb-ritim-ozet">
        <div>
          <dt>Bu hafta</dt>
          <dd data-tone={ritim.buHafta > 0 ? "success" : ritim.buHafta < 0 ? "danger" : undefined}>{isaret(ritim.buHafta)}</dd>
        </div>
        <div>
          <dt>Seri</dt>
          <dd>{ritim.seri ? `${ritim.seri} gün` : "—"}</dd>
        </div>
        <div>
          <dt>Yazılan gün</dt>
          <dd>{ritim.aktifGun}/14</dd>
        </div>
      </dl>
      {yazildi ? (
        <div className="gb-cubuklar gb-ritim" role="img" aria-label={`Bu hafta net ${isaret(ritim.buHafta)} kelime`}>
          {ritim.gunler.map((gun) => (
            <div
              key={gun.anahtar}
              className={`gb-cubuk${gun.bugun ? " is-bugun" : ""}${gun.net > 0 ? "" : " is-bos"}${gun.net < 0 ? " is-eksi" : ""}`}
              title={`${gun.baslik}: ${isaret(gun.net)} kelime`}
            >
              <span
                className="gb-cubuk-dolgu"
                style={{ "--h": `${gun.net ? Math.max(10, (Math.abs(gun.net) / ritim.enBuyuk) * 100) : 4}%` } as CSSProperties}
              />
              <small>{gun.gun}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="gb-bos">Son iki haftada kaydedilmiş yazım yok. Editörde yazdıkça günlük ilerlemeniz burada birikir.</p>
      )}
      <Link className="gb-kart-baglanti" href={href}>
        Yazmaya devam et <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </article>
  );
}
