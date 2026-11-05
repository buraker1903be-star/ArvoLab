import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { YEREL } from "@/lib/dil";
import type { KrediOzeti } from "@/lib/ai/kredi-ozeti";

/*
  ASİSTAN KREDİSİ ÖZETİ (Signature OS 4.4, 05.11.2026). Ayarlar ve Abonelik
  ve Kredi AYNI gösterimi kullanır: kullanılabilir toplam, bu ayın kalan
  hakkı bir ölçü çubuğunda, altında aylık kalan ve satın alınan bakiye.
  Eskiden Abonelik sayfasında koyu lacivert bir "sayaç" kartı vardı,
  Ayarlar'da tek uzun cümle; iki ekranda aynı sayı iki ayrı dille
  anlatılıyordu.

  Yalnızca gösterilebilir özet alır (kredi.goster): okunamayan ya da
  bildirilmemiş kredi "0" diye çizilmez (lib/ai/kredi-ozeti.ts). Uyarılar
  sayfaya göre değiştiği için children olarak gelir.
*/
export default async function KrediOzetKarti({
  kredi,
  ayrintili = false,
  children,
}: {
  kredi: Extract<KrediOzeti, { goster: true }>;
  /** Abonelik sayfası: kalemlerin altında kısa açıklama (yenilenir / yanmaz). */
  ayrintili?: boolean;
  children?: ReactNode;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const sayi = (deger: number) => new Intl.NumberFormat(YEREL[dil]).format(deger);
  const yuzde = kredi.aylikLimit > 0 ? Math.min(100, Math.round((kredi.aylikKalan / kredi.aylikLimit) * 100)) : 0;
  return (
    <div className="ayar-kredi">
      <div className="ayar-kredi-bas">
        <span className="ayar-kredi-ad">
          <Sparkles size={16} aria-hidden="true" />
          {t({ tr: "Asistan krediniz", en: "Your assistant credits" })}
        </span>
        <span className="ayar-kredi-sayi">
          <b>{sayi(kredi.toplam)}</b> {t({ tr: "kullanılabilir", en: "available" })}
        </span>
      </div>
      <progress
        className="ayar-kredi-cubuk"
        data-tone={kredi.tukendi ? "danger" : kredi.oran >= 80 ? "warning" : undefined}
        value={kredi.aylikKalan}
        max={Math.max(kredi.aylikLimit, 1)}
        aria-label={t({ tr: `Bu ayın kalan hakkı: yüzde ${yuzde}`, en: `Remaining this month: ${yuzde} percent` })}
      />
      <dl className="ayar-kredi-ayrinti">
        <div>
          <dt>{t({ tr: "Bu ay kalan", en: "Left this month" })}</dt>
          <dd>
            {sayi(kredi.aylikKalan)} / {sayi(kredi.aylikLimit)}
          </dd>
          {ayrintili ? <small>{t({ tr: "Ayın başında yenilenir", en: "Renews at the start of the month" })}</small> : null}
        </div>
        <div>
          <dt>{t({ tr: "Satın alınan bakiye", en: "Purchased balance" })}</dt>
          <dd>{sayi(kredi.ekBakiye)}</dd>
          {ayrintili ? <small>{t({ tr: "Yanmaz; aylık hak bitince kullanılır", en: "Never expires; used after the monthly allowance" })}</small> : null}
        </div>
      </dl>
      <p className="ayar-not">
        {t({
          tr: "1 kredi = 1.000 karakter. Aylık hak ayın başında yenilenir; satın alınan bakiye yanmaz.",
          en: "1 credit = 1,000 characters. The monthly allowance renews at the start of each month; purchased credits never expire.",
        })}
      </p>
      {children}
    </div>
  );
}
