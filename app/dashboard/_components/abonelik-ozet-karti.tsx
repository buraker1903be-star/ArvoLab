import Link from "next/link";
import { ChevronRight, Coins } from "lucide-react";
import { licenseSummary } from "@/lib/license-summary";
import type { AccessState } from "@/lib/access";
import type { KrediOzeti } from "@/lib/ai/kredi-ozeti";

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
const sayi = (deger: number) => new Intl.NumberFormat("tr-TR").format(deger);

export default function AbonelikOzetKarti({
  access,
  kredi,
  bireysel,
}: {
  access: AccessState;
  kredi: KrediOzeti;
  bireysel: boolean;
}) {
  const ozet = licenseSummary(access);
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
          <h2>Abonelik ve kredi</h2>
          <p>{access.kind === "organization" ? "Kurumunuz yönetiyor" : "Planınız ve asistan hakkınız"}</p>
        </div>
        <Link href="/dashboard/abonelik" className="gb-kart-baglanti">
          Ayrıntı <ChevronRight size={14} aria-hidden="true" />
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
            <span>kredi kullanılabilir</span>
          </div>
          <progress
            className="kredi-cubugu"
            max={Math.max(1, kredi.aylikLimit)}
            value={kredi.aylikKalan}
            aria-label={`Aylık hakkın ${sayi(kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} kredisi kaldı`}
          />
          <small className="abonelik-ozet-not">
            Bu ay {sayi(kredi.aylikKalan)} / {sayi(kredi.aylikLimit)} hak · bakiye {sayi(kredi.ekBakiye)}
          </small>
        </>
      ) : (
        <p className="muted text-sm">Asistan kredisi şu an gösterilemiyor; asistanı kullanmaya devam edebilirsiniz.</p>
      )}

      {bireysel ? (
        <Link href="/dashboard/abonelik" className="projects-filter-button button-compact abonelik-ozet-eylem">
          <Coins size={15} aria-hidden="true" /> Kredi satın al
        </Link>
      ) : null}
    </article>
  );
}
