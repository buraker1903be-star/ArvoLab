import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { HareketSerisi } from "@/lib/genel-bakis";
import type { YazimRitmi } from "@/lib/yazim-ritmi";
import { YEREL } from "@/lib/dil";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";

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
export async function SeriKarti({
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
  const t = await ceviri();
  const dil = await aktifDil();
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
                <dd>{o.deger.toLocaleString(YEREL[dil])}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <div className="gb-toplam">
          <strong>{seri.toplam.toLocaleString(YEREL[dil])}</strong>
          {seri.degisim !== null ? (
            <span data-tone={seri.degisim >= 0 ? "success" : "danger"}>
              {seri.degisim >= 0 ? "+" : ""}
              {seri.degisim}% {t({ tr: "önceki döneme göre", en: "vs. previous period" })}
            </span>
          ) : seri.toplam ? (
            <span data-tone="neutral">{t({ tr: "önceki dönemde kayıt yok", en: "no records in previous period" })}</span>
          ) : null}
        </div>
      </header>
      {bosSeri ? (
        <p className="gb-seri-bos">{bos}</p>
      ) : (
        <div className="gb-cubuklar" role="img" aria-label={t({ tr: `${alt}: toplam ${seri.toplam} ${adet}`, en: `${alt}: ${seri.toplam} ${adet} in total` })}>
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
export async function RitimKarti({ ritim, href }: { ritim: YazimRitmi; href: string }) {
  const yazildi = ritim.gunler.some((g) => g.net !== 0);
  const t = await ceviri();
  const dil = await aktifDil();
  const isaret = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString(YEREL[dil])}`;
  return (
    <article className="gb-kart gb-sutun">
      <header className="gb-kart-bas">
        <div>
          <h2>{t({ tr: "Yazım ritmi", en: "Writing rhythm" })}</h2>
          <p>{t({ tr: "Son 14 gün, net kelime", en: "Last 14 days, net words" })}</p>
        </div>
      </header>
      <dl className="gb-ritim-ozet">
        <div>
          <dt>{t({ tr: "Bu hafta", en: "This week" })}</dt>
          <dd data-tone={ritim.buHafta > 0 ? "success" : ritim.buHafta < 0 ? "danger" : undefined}>{isaret(ritim.buHafta)}</dd>
        </div>
        <div>
          <dt>{t({ tr: "Seri", en: "Streak" })}</dt>
          <dd>{ritim.seri ? t({ tr: `${ritim.seri} gün`, en: `${ritim.seri} day${ritim.seri === 1 ? "" : "s"}` }) : "—"}</dd>
        </div>
        <div>
          <dt>{t({ tr: "Yazılan gün", en: "Days written" })}</dt>
          <dd>{ritim.aktifGun}/14</dd>
        </div>
      </dl>
      {yazildi ? (
        <div className="gb-cubuklar gb-ritim" role="img" aria-label={t({ tr: `Bu hafta net ${isaret(ritim.buHafta)} kelime`, en: `Net ${isaret(ritim.buHafta)} words this week` })}>
          {ritim.gunler.map((gun) => (
            <div
              key={gun.anahtar}
              className={`gb-cubuk${gun.bugun ? " is-bugun" : ""}${gun.net > 0 ? "" : " is-bos"}${gun.net < 0 ? " is-eksi" : ""}`}
              title={t({ tr: `${gun.baslik}: ${isaret(gun.net)} kelime`, en: `${gun.baslik}: ${isaret(gun.net)} words` })}
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
        <p className="gb-bos">
          {t({
            tr: "Son iki haftada kaydedilmiş yazım yok. Editörde yazdıkça günlük ilerlemeniz burada birikir.",
            en: "No saved writing in the last two weeks. As you write in the editor, your daily progress builds up here.",
          })}
        </p>
      )}
      <Link className="gb-kart-baglanti" href={href}>
        {t({ tr: "Yazmaya devam et", en: "Continue writing" })} <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </article>
  );
}
