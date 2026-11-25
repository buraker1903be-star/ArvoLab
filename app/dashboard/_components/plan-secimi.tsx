import { Check, Zap } from "lucide-react";
import { ceviri } from "@/lib/dil-sunucu";
import { aktifDil } from "@/lib/dil-sunucu";
import { YEREL } from "@/lib/dil";
import { formatTry, type BillingPlan } from "@/lib/billing-plan";
import { planKartlari } from "@/lib/plan-satis";
import { payArvolabSubscription } from "@/app/actions/subscription";
import OdemeButonu from "./odeme-butonu";
import YasalNot from "./yasal-not";

/*
  DENEME ÜYESİNE PLAN SEÇİMİ (25.11.2026, ana sayfa ilk kullanım akışı).

  Üç eşit kart. Satış cümlesi ürünün sözü; fiyat, faturalama dönemi,
  plana dahil asistan kredisi ve planı ayıran avantajlar ArvoOS
  KATALOĞUNDAN (lib/plan-satis.ts). Katalog bunları eksiksiz
  bildirmiyorsa bölüm HİÇ çizilmiyor — çağıran o zaman mevcut ödeme
  yolunu gösteriyor. Fiyatı ya da kapsamı bilinmeyen bir plana "seç"
  dedirtmek, müşteriye ne aldığını söylememek olurdu.

  Düğme seçilen planın KODUYLA mevcut ödeme akışını açıyor
  (payArvolabSubscription → ArvoOS'un ödeme sayfası). Burada yeni bir
  ödeme yolu tanımlanmıyor ve ArvoLab ödemeyi DOĞRULAMIYOR: onay
  ArvoOS'a PayTR'nin bildirimiyle geliyor, ArvoLab bir sonraki
  "ensure" çağrısında yeni durumu okuyor. İptal ya da hata hâlinde
  yerelde hiçbir şey değişmediği için deneme üyeliği sürüyor.
*/
export default async function PlanSecimi({
  planlar,
  denemeBitis,
}: {
  planlar: BillingPlan[];
  /** Yerelleştirilmiş deneme bitiş tarihi; yoksa satır çizilmez. */
  denemeBitis: string | null;
}) {
  const t = await ceviri();
  const dil = await aktifDil();
  const kartlar = planKartlari(planlar);
  if (!kartlar.length) return null;
  const sayi = (n: number) => new Intl.NumberFormat(YEREL[dil]).format(n);
  const DONEM: Record<string, string> = {
    month: t({ tr: "aylık", en: "monthly" }),
    year: t({ tr: "yıllık", en: "yearly" }),
  };

  return (
    <section className="pw-bolum plan-secimi" aria-labelledby="plan-secimi-baslik">
      <h2 id="plan-secimi-baslik">{t({ tr: "Çalışma temponuza uygun planı seçin", en: "Choose the plan that fits your working pace" })}</h2>
      {/* Deneme bitişi KISA bir satırda, kartların üstünde: kullanıcı
          kaç günü kaldığını bilmeden seçim yapmak zorunda kalmasın.
          Tarih yoksa satır yok, "—" yazılmıyor. */}
      {denemeBitis ? (
        <p className="plan-secimi-deneme">
          {t({ tr: `Deneme üyeliğiniz ${denemeBitis} tarihinde bitiyor.`, en: `Your trial ends on ${denemeBitis}.` })}
        </p>
      ) : null}

      <div className="plan-secimi-izgara">
        {kartlar.map((k) => (
          <article key={k.kod} className="plan-secimi-kart">
            <h3>{k.ad}</h3>
            <p className="plan-secimi-fiyat">
              {formatTry(k.fiyat, dil)} <small>{`/ ${DONEM[k.donem] ?? k.donem}`}</small>
            </p>
            <p className="plan-secimi-metin">{t(k.metin)}</p>
            <ul className="plan-secimi-liste">
              <li>
                <Zap size={14} aria-hidden="true" />
                {t({ tr: `Aylık ${sayi(k.kredi)} asistan kredisi`, en: `${sayi(k.kredi)} assistant credits each month` })}
              </li>
              {k.avantajlar.map((a) => (
                <li key={a}>
                  <Check size={14} aria-hidden="true" />
                  {a}
                </li>
              ))}
            </ul>
            {/*
              ANA DÜĞMELER AYNI YATAY ÇİZGİDE (25.11.2026). Eylemler tek
              bir sarmalayıcıdaydı ve yalnızca ALTLARI hizalanıyordu:
              yıllık seçeneği olan Standart ve Pro'nun ana düğmesi
              yukarı kayıyor, yıllığı olmayan Plus'ınki aşağıda
              kalıyordu. Artık her satır kartın kendi ızgara satırı
              (subgrid, app/styles/os5-ana-sayfa.css): ana düğmeler aynı
              satırda, yıllık seçenek KENDİ planının ana düğmesinin
              altındaki satırda. Yıllığı olmayan kartta o satır BOŞ
              kalıyor — sahte bir düğme konmuyor.
            */}
            <form action={payArvolabSubscription} className="plan-secimi-ana-eylem">
              <input type="hidden" name="plan" value={k.kod} />
              <OdemeButonu birincil etiket={t(k.dugme)} />
            </form>
            {/* Yıllık seçenek kendi planının altında; düğme planın adını
                taşıyor ki hangi plana ait olduğu belirsiz kalmasın. */}
            {k.yillik ? (
              <form action={payArvolabSubscription} className="plan-secimi-yillik-eylem">
                <input type="hidden" name="plan" value={k.yillik.kod} />
                <OdemeButonu
                  birincil={false}
                  ikonlu={false}
                  etiket={t({
                    tr: `${k.ad} yıllık · ${formatTry(k.yillik.fiyat, dil)}`,
                    en: `${k.ad} yearly · ${formatTry(k.yillik.fiyat, dil)}`,
                  })}
                />
              </form>
            ) : null}
          </article>
        ))}
      </div>

      {/*
        ÖDEME KOŞULLARI ÜÇ KARTIN HEMEN ALTINDA (25.11.2026). Aşağıdaki
        lisans kartı aynı notu ve aynı ödeme düğmelerini tekrar
        ediyordu; kullanıcı hangi düğmenin hangisi olduğunu
        ayıramıyordu. Not buraya taşındı, lisans kartındaki ödeme
        bölümü bu ekranda gizleniyor (odemeGizle).
      */}
      <YasalNot />
    </section>
  );
}
