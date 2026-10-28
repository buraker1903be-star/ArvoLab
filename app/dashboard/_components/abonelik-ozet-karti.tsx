import Link from "next/link";
import { ChevronRight, Coins } from "lucide-react";
import { licenseSummary } from "@/lib/license-summary";
import type { AccessState } from "@/lib/access";
import type { KrediOzeti } from "@/lib/ai/kredi-ozeti";
import { YEREL } from "@/lib/dil";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";

/*
  ANA SAYFA: ABONELİK VE KREDİ KARTI (26.10.2026, kurum sahibinin isteği:
  "tez kartını küçültelim, yanına abonelik ve kredi kullanımı kartı").

  Öğrencinin "aboneliğim ne zaman bitiyor, asistan hakkım ne kadar kaldı"
  sorusu ana sayfada tek bakışta. Ayrıntı, paketler ve satın alma
  Abonelik ve kredi sayfasında; kart yalnızca özet ve oraya giden yol.

  Sayı üretilemiyorsa (ölçüm okunamadı, hak bildirilmemiş, iç ekip) kredi
  satırı "0" demiyor, bilinmediğini söylüyor (lib/ai/kredi-ozeti.ts).
  Kurum üyesine satın alma düğmesi gösterilmiyor: kredisini kurum alıyor.
*/
export default async function AbonelikOzetKarti({
  access,
  kredi,
  bireysel,
}: {
  access: AccessState;
  kredi: KrediOzeti;
  bireysel: boolean;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const sayi = (deger: number) => new Intl.NumberFormat(YEREL[dil]).format(deger);
  const ozet = licenseSummary(access, new Date(), dil);
  const krediTonu = !kredi.goster
    ? undefined
    : kredi.tukendi
      ? "danger"
      : kredi.ekBakiye === 0 && kredi.oran >= 80
        ? "warning"
        : "success";

  return (
    <article className="gb-kart abonelik-ozet">
      <header className="gb-kart-bas">
        <div>
          <h2>{t({ tr: "Abonelik ve kredi", en: "Subscription and credits" })}</h2>
          <p>
            {access.kind === "organization"
              ? t({ tr: "Kurumunuz yönetiyor", en: "Managed by your institution" })
              : t({ tr: "Planınız ve asistan hakkınız", en: "Your plan and assistant allowance" })}
          </p>
        </div>
        <Link href="/dashboard/abonelik" className="gb-kart-baglanti">
          {t({ tr: "Ayrıntı", en: "Details" })} <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </header>

      {ozet ? (
        <div className="abonelik-ozet-satir">
          <span className="status-pill" data-tone={ozet.tone}>
            {ozet.statusLabel}
          </span>
          {ozet.detail ? <small>{ozet.detail}</small> : null}
        </div>
      ) : null}

      {kredi.goster ? (
        <>
          <div className="kaynakca-puan" data-tone={krediTonu}>
            <b>{sayi(kredi.toplam)}</b>
            <span>{t({ tr: "kredi kullanılabilir", en: "credits available" })}</span>
          </div>
          <progress
            className="kredi-cubugu"
            max={Math.max(1, kredi.aylikLimit)}
            value={kredi.aylikKalan}
            aria-label={t({
              tr: `Aylık hakkın ${sayi(kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} kredisi kaldı`,
              en: `${sayi(kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} monthly credits left`,
            })}
          />
          <small className="abonelik-ozet-not">
            {t({
              tr: `Bu ay ${sayi(kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} hak · bakiye ${sayi(kredi.ekBakiye)}`,
              en: `This month ${sayi(kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} allowance · balance ${sayi(kredi.ekBakiye)}`,
            })}
          </small>
        </>
      ) : (
        <p className="muted text-sm">
          {t({
            tr: "Asistan kredisi şu an gösterilemiyor; asistanı kullanmaya devam edebilirsiniz.",
            en: "Assistant credits can't be shown right now; you can keep using the assistant.",
          })}
        </p>
      )}

      {bireysel ? (
        <Link href="/dashboard/abonelik" className="projects-filter-button button-compact abonelik-ozet-eylem">
          <Coins size={15} aria-hidden="true" /> {t({ tr: "Kredi satın al", en: "Buy credits" })}
        </Link>
      ) : null}
    </article>
  );
}
