import Link from "next/link";
import { BookOpenText, ChevronRight, Coins, MessagesSquare, Sparkles } from "lucide-react";
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
  calismaId,
}: {
  access: AccessState;
  kredi: KrediOzeti;
  bireysel: boolean;
  /** Öğrencinin sürdürdüğü çalışma: asistan kısayolları ona açılır. */
  calismaId?: string | null;
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

      {/*
        ASİSTAN KISAYOLLARI (04.11.2026). Kart tez kartıyla aynı yükseklikte
        duruyor ve kredi satırının altı boş kalıyordu. Boşluk kredinin ne
        işe yaradığını gösteren üç kısayolla doluyor: öğrenci asistanı
        ararken menüleri dolaşmasın.
      */}
      {calismaId ? (
        <ul className="abonelik-araclar">
          <li>
            <Link className="gb-satir" href={`/dashboard/editor/${calismaId}/write`}>
              <Sparkles size={16} aria-hidden="true" />
              <span className="gb-satir-govde">
                <b>{t({ tr: "Yazım asistanı", en: "Writing assistant" })}</b>
                <small>{t({ tr: "Paragraf, ana hat, satır içi öneri", en: "Paragraphs, outlines, inline suggestions" })}</small>
              </span>
              <ChevronRight className="gb-ok" size={14} aria-hidden="true" />
            </Link>
          </li>
          <li>
            <Link className="gb-satir" href={`/dashboard/citations?calisma=${calismaId}`}>
              <MessagesSquare size={16} aria-hidden="true" />
              <span className="gb-satir-govde">
                <b>{t({ tr: "Kaynağa sor", en: "Ask a source" })}</b>
                <small>{t({ tr: "PDF'e soru; cevap birebir alıntıyla", en: "Ask a PDF; answers come with exact quotes" })}</small>
              </span>
              <ChevronRight className="gb-ok" size={14} aria-hidden="true" />
            </Link>
          </li>
          <li>
            <Link className="gb-satir" href={`/dashboard/literature?calisma=${calismaId}`}>
              <BookOpenText size={16} aria-hidden="true" />
              <span className="gb-satir-govde">
                <b>{t({ tr: "Literatür taraması", en: "Literature search" })}</b>
                <small>{t({ tr: "Arama stratejisi ve gerçek dizinler", en: "Search strategy and real indexes" })}</small>
              </span>
              <ChevronRight className="gb-ok" size={14} aria-hidden="true" />
            </Link>
          </li>
        </ul>
      ) : null}

      {bireysel ? (
        <Link href="/dashboard/abonelik" className="projects-filter-button button-compact abonelik-ozet-eylem">
          <Coins size={15} aria-hidden="true" /> {t({ tr: "Kredi satın al", en: "Buy credits" })}
        </Link>
      ) : null}
    </article>
  );
}
