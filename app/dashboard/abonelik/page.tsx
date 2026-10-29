import { seciliKurum } from "@/lib/kurum-secimi-sunucu";
import { redirect } from "next/navigation";
import { Gift, History, Infinity as Sinirsiz, Lock, Plus, RefreshCw, Sparkles, Wallet } from "lucide-react";
import { getAuthContext } from "@/lib/auth-guards";
import { getAccessState } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import { krediSatinAl, kurumKrediSatinAl } from "@/app/actions/subscription";
import { krediOzeti, type KrediSatiri } from "@/lib/ai/kredi-ozeti";
import { binKrediFiyati, paketFiyati } from "@/lib/kredi-paketleri";
import type { Metadata } from "next";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import { YEREL, type Metin } from "@/lib/dil";
import { formatTry } from "@/lib/billing-plan";
import { faturalamaKapsami } from "@/lib/faturalama";
import { faturalamaVePaketler, kartDurumum } from "@/lib/subscription";
import { KART_HATALARI } from "@/lib/kart-odeme";
import { licenseSummary } from "@/lib/license-summary";
import { kartlaOdemeBaslat } from "@/app/actions/kart-odeme";
import LicenseCard from "../_components/license-card";
import OdemeButonu from "../_components/odeme-butonu";
import YasalNot from "../_components/yasal-not";
import FaturalarBolumu from "./faturalar-bolumu";
import KartBolumu from "./kart-bolumu";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Abonelik ve Kredi", en: "Subscription and Credits" }) };
}

/*
  ABONELİK VE KREDİ (26.10.2026, kurum sahibinin isteği: "bireysel
  öğrencilerin abonelik ve kullanım hakları, kredi satın alabilecekleri
  sayfa").

  Bireysel abonenin ArvoOS paneli yok; aboneliğini ve kredisini buradan
  yönetiyor. Solda abonelik (ana sayfadaki kartın aynısı, plan ve ödeme
  düğmeleriyle), sağda asistan kredisi: bu ay kalan hak, satın alınan
  bakiye, paketler ve son hareketler.

  Model (migration 20261026181929): aboneliğe her ay 1.000 kredi dahil,
  kullanılmayan yanar; satın alınan kredi yanmaz. Paketler ve fiyatlar
  ArvoOS'tan geliyor (lib/kredi-paketleri.ts) — kurumla aynı liste.
  Ödeme ArvoOS'ta (PayTR); onaylanınca kredi bakiyeye kendiliğinden ekleniyor.

  Kurum üyesine aynı sayfa kurumun kredisini gösteriyor. Kurumun
  kredisini kurum yöneticisi (Akademik Yönetici; iç ekip seçtiği kurum
  için) bu sayfadan alıyor — 28.10.2026'ya kadar ArvoOS panelinden
  alıyordu, orada artık yalnızca "Abonelik ve faturalama" var. Paketi
  kimin görüp alabileceği faturaları kimin görebileceğiyle aynı karar
  (faturalamaKapsami); öğrenci ve personel yalnızca durumu görür.
*/

const HATA: Record<string, Metin> = {
  odeme: {
    tr: "Ödeme başlatılamadı. Ödeme sistemine şu an ulaşılamıyor ya da aboneliğiniz kredi almaya açık değil; biraz sonra tekrar deneyin.",
    en: "Payment could not be started. The payment system is unreachable right now, or your subscription is not eligible for credit purchases; try again shortly.",
  },
  paket: {
    tr: "Seçilen paket tanınmadı; sayfayı yenileyip tekrar deneyin.",
    en: "The selected package was not recognized; refresh the page and try again.",
  },
  kurum: {
    tr: "Kurumunuzun kredisini kurum yöneticiniz alır.",
    en: "Your institution administrator buys your institution's credits.",
  },
  platform: {
    tr: "Seçili kurum ArvoOS'un kendisi; ArvoOS kendi kredisi için ödeme almaz ve iç ekip krediye tabi değil. Bir müşteri kurumu adına almak için profil menüsündeki Kurum seçiminden o kurumu seçin.",
    en: "The selected institution is ArvoOS itself; ArvoOS does not take payment for its own credits and the internal team is not subject to credits. To buy for a customer institution, select it under Institution in the profile menu.",
  },
  sahip: {
    tr: "Kurumunuzun ArvoOS'ta etkin bir sahibi bulunamadığı için ödeme açılamadı. Arvo destek ekibiyle iletişime geçin.",
    en: "Payment could not be started because your institution has no active owner in ArvoOS. Contact Arvo support.",
  },
  ...KART_HATALARI,
};

/*
  Kartla ödemeden dönüş (app/api/odeme-donus) ve kart işlemlerinin sonucu.
  "tamam" ödemenin ONAYLANDIĞI anlamına gelmez: onay ArvoOS'a PayTR'nin
  bildirimiyle gelir, dönem orada uzar. Kullanıcıya "işleniyor" denir.
*/
const KART_DURUMU: Record<string, { ton: "success" | "danger" | "info"; metin: Metin }> = {
  tamam: {
    ton: "info",
    metin: { tr: "Ödemeniz işleniyor; onaylanınca aboneliğiniz uzar.", en: "Your payment is being processed; your subscription will be extended once it is approved." },
  },
  hata: {
    ton: "danger",
    metin: { tr: "Ödeme tamamlanamadı. Kart bilgilerinizi kontrol edip yeniden deneyin.", en: "The payment could not be completed. Check your card details and try again." },
  },
  yenileme_kapali: {
    ton: "success",
    metin: { tr: "Otomatik yenileme kapatıldı; kartınızdan kendiliğinden çekim yapılmayacak.", en: "Automatic renewal has been turned off; your card will not be charged automatically." },
  },
  silindi: {
    ton: "success",
    metin: { tr: "Kart silindi.", en: "The card has been deleted." },
  },
};

/* Hareket türünün simgesi ve tonu: listeyi okumadan taramak için (yükleme yeşil, tüketim nötr). */
const HAREKET: Record<string, { ad: Metin; isaret: string; ikon: typeof Plus; ton: "success" | "info" | "neutral" }> = {
  yukleme: { ad: { tr: "Satın alındı", en: "Purchased" }, isaret: "+", ikon: Plus, ton: "success" },
  yenileme: { ad: { tr: "Aylık hak yenilendi", en: "Monthly allowance renewed" }, isaret: "", ikon: RefreshCw, ton: "info" },
  tuketim: { ad: { tr: "Asistan çalışması", en: "Assistant run" }, isaret: "−", ikon: Sparkles, ton: "neutral" },
};

export default async function AbonelikPage({ searchParams }: { searchParams: Promise<{ hata?: string; kart?: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/");
  const { hata, kart } = await searchParams;
  const t = await ceviri();
  const dil = await aktifDil();
  const { tarihSaat } = await tarihler();
  const sayi = (deger: number) => new Intl.NumberFormat(YEREL[dil]).format(deger);
  // Türkçede paket fiyatı ArvoOS'la aynı yazımda ("499 TL"); İngilizcede tutar yine TL, yalnızca biçim değişiyor.
  const fiyat = (kurus: number) => (dil === "tr" ? paketFiyati(kurus) : formatTry(kurus, dil));

  const [access, { data: krediSatiri, error: krediHatasi }] = await Promise.all([
    getAccessState(await getCurrentProfile()),
    ctx.supabase.rpc("ai_kredi_durumum").maybeSingle(),
  ]);
  if (krediHatasi) console.error("[abonelik] kredi durumu okunamadı:", krediHatasi.message);
  const satir = (krediSatiri as KrediSatiri | null) ?? null;
  const kredi = krediOzeti(satir);
  const bireysel = Boolean(satir?.bireysel);

  /* Faturalar: bireysel abone kendi ödemelerini, kurumda yalnızca kurum yöneticisi kurumunkileri görür. */
  /* İç ekip: kurum seçicide seçili kurum, yoksa kendi kurumu (lib/kurum-secimi.ts). */
  const seciliKurumu = access.kind === "staff" ? await seciliKurum() : null;
  const kapsam = faturalamaKapsami(access.kind, ctx.role, seciliKurumu?.id ?? ctx.organizationId);
  let faturaKurumu: string | null = seciliKurumu?.ad ?? null;
  if (access.kind === "staff" && !faturaKurumu && ctx.organizationId) {
    const { data: kendi } = await ctx.supabase.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle();
    faturaKurumu = kendi?.name ?? null;
  }
  const kurumKredisi = kapsam?.tur === "kurum" ? kapsam.kurumId : null;
  const [faturalamaVeri, { data: hareketler }] = await Promise.all([
    kapsam && ctx.user.email ? faturalamaVePaketler(kapsam, { id: ctx.user.id, email: ctx.user.email }) : null,
    /*
      Son hareketler: bireysel abonenin kendi defteri ya da kurum
      yöneticisinin kurumunki (ai_kurum_kredi_hareketleri; yetki içeride,
      faturalarla aynı kural). Öğrenci kurumun defterini görmez.
    */
    bireysel
      ? ctx.supabase.rpc("ai_bireysel_kredi_hareketlerim")
      : kurumKredisi
        ? ctx.supabase.rpc("ai_kurum_kredi_hareketleri", { p_organization_id: kurumKredisi })
        : Promise.resolve({ data: null }),
  ]);
  const faturalama = faturalamaVeri?.faturalama ?? null;
  const sonHareketler = (hareketler ?? []) as { tur: string; kredi: number; created_at: string }[];

  /*
    Kart saklama yalnızca bireysel abonede ve ArvoOS anahtarı açıkken. Kart
    durumu ayrı bir köprü çağrısı; okunamazsa null ("okunamadı").
  */
  const kartSaklama = access.kind === "individual" && access.kartSaklama && Boolean(ctx.user.email);
  const kartDurumu = kartSaklama && ctx.user.email ? await kartDurumum({ id: ctx.user.id, email: ctx.user.email }) : null;
  // Mevcut ödeme düğmesiyle aynı koşul (lib/license-summary.ts → showPayment).
  const kartlaOdenebilir = kartSaklama && Boolean(licenseSummary(access, new Date(), dil)?.showPayment);

  /* Satış: bireysel abone kendine, kurum yöneticisi kurumuna. Paketler bireyselde ensure'dan, kurumda org_billing'den. */
  const platformKurumu = Boolean(faturalamaVeri?.platformKurumu);
  const satis = access.kind === "individual" ? ("bireysel" as const) : kurumKredisi && !platformKurumu ? ("kurum" as const) : null;
  const paketler = satis === "bireysel" ? access.krediPaketleri : satis === "kurum" ? (faturalamaVeri?.krediPaketleri ?? []) : [];
  const enUcuzBirim = paketler.length ? Math.max(...paketler.map(binKrediFiyati)) : 0;
  /*
    Öne çıkan paket: birim fiyatı EN DÜŞÜK olan ("En avantajlı"). Eskiden
    listenin ilk paketi birincil düğmeyi alıyordu — en pahalı birim
    fiyatlı paket görsel olarak önerilmiş oluyordu. Etiket ölçülebilir bir
    gerçeği söylüyor, "popüler" gibi doğrulanamayan bir iddiayı değil.
  */
  const enAvantajli = paketler.length > 1 ? paketler.reduce((a, b) => (binKrediFiyati(b) < binKrediFiyati(a) ? b : a)).kod : null;

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Abonelik ve kredi", en: "Subscription and credits" })}</h1>
          <p>{t({ tr: "Aboneliğiniz, asistan kullanım hakkınız ve ek kredi paketleri.", en: "Your subscription, assistant allowance and extra credit packages." })}</p>
        </div>
      </section>

      {hata && HATA[hata] ? (
        <p className="alert" data-tone="danger" role="alert">
          {t(HATA[hata])}
        </p>
      ) : null}
      {kart && KART_DURUMU[kart] ? (
        <p className="alert" data-tone={KART_DURUMU[kart].ton} role={KART_DURUMU[kart].ton === "danger" ? "alert" : "status"}>
          {t(KART_DURUMU[kart].metin)}
        </p>
      ) : null}

      <section className="gb-sutunlar kaynaklar-ikili" aria-label={t({ tr: "Abonelik ve kredi", en: "Subscription and credits" })}>
        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Aboneliğim", en: "My subscription" })}</h2>
              <p>
                {access.kind === "organization"
                  ? t({ tr: "Aboneliğinizi kurumunuz yönetiyor.", en: "Your subscription is managed by your institution." })
                  : access.kind === "individual"
                    ? kartSaklama
                      ? t({ tr: "Bireysel abonelik; ödeme kartla, otomatik yenileme isteğe bağlı.", en: "Individual subscription; paid by card, automatic renewal is optional." })
                      : t({ tr: "Bireysel abonelik; ödeme kartla, otomatik çekim yok.", en: "Individual subscription; paid by card, no automatic charges." })
                    : t({ tr: "İç ekip hesabı.", en: "Internal team account." })}
              </p>
            </div>
          </header>

          <LicenseCard access={access} />

          {/*
            Kartla ödeme, kart kaydetme seçeneğiyle (28.10.2026). Ödeme kaydı
            düğmenin sunucu işleminde açılır, sayfa çiziminde değil. Tutarı
            ArvoOS belirler; buradan plan ya da tutar gitmez.
          */}
          {kartlaOdenebilir ? (
            <form action={kartlaOdemeBaslat} className="cluster">
              <OdemeButonu birincil={false} etiket={t({ tr: "Kartla öde · kartı kaydetme seçeneğiyle", en: "Pay by card · with option to save card" })} />
            </form>
          ) : null}

          {access.kind === "individual" ? (
            <p className="hint">
              {t({
                tr: "Aboneliğe her ay 1.000 asistan kredisi dahil (1 kredi = 1.000 karakter); kullanılmayan aylık hak devretmez. Satın alınan kredi yanmaz, aylık hak bitince kullanılır.",
                en: "Your subscription includes 1,000 assistant credits each month (1 credit = 1,000 characters); unused monthly credits do not roll over. Purchased credits never expire and are used once the monthly allowance runs out.",
              })}
            </p>
          ) : null}

          {access.kind === "staff" && kapsam && faturaKurumu ? (
            <p className="hint">
              {t({ tr: "", en: "Showing invoices for " })}
              <b>{faturaKurumu}</b>
              {t({
                tr: " faturaları gösteriliyor. Diğer kurumunuzunkiler için profil menüsündeki Kurum seçimini değiştirin.",
                en: ". For another institution's, change the Institution selection in the profile menu.",
              })}
            </p>
          ) : null}
          {kartSaklama ? <KartBolumu durum={kartDurumu?.ok ? kartDurumu.veri : null} /> : null}
          {kapsam ? <FaturalarBolumu veri={faturalama} kurum={kapsam.tur === "kurum"} /> : null}
        </article>

        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Asistan kredisi", en: "Assistant credits" })}</h2>
              <p>
                {bireysel
                  ? t({ tr: "Bu ayki hakkınız ve satın aldığınız bakiye", en: "This month's allowance and your purchased balance" })
                  : t({ tr: "Kurumunuzun bu ayki kredisi", en: "Your institution's credits this month" })}
              </p>
            </div>
          </header>

          {/*
            Sayı üretilemiyorsa (okunamadı, hak bildirilmemiş, iç ekip) kutu
            çizilmiyor: "0 kredi" yazmak, hakkı olmayanla ölçümü okunamayanı
            aynı göstermek olurdu (lib/ai/kredi-ozeti.ts).
          */}
          {kredi.goster ? (
            <>
              {/*
                Kredi göstergesi: büyük sayı toplam kullanılabilir kredi; şerit
                iki parçalı — aylık hak (yanar) ile satın alınan bakiye (yanmaz)
                ayrı renkte, çünkü kullanıcının "hangisi önce biter" sorusu
                tam bu ayrım. Yerleşik <progress> aylık oranı erişilebilir
                biçimde taşıyor; satır içi genişlik stili yazılmıyor.
              */}
              <div className="kredi-sayac" data-tone={kredi.tukendi ? "danger" : kredi.ekBakiye === 0 && kredi.oran >= 80 ? "warning" : "success"}>
                <div className="kredi-sayac-ust">
                  <span className="kredi-sayac-etiket">
                    <Wallet size={15} aria-hidden="true" /> {t({ tr: "Kullanılabilir kredi", en: "Available credits" })}
                  </span>
                  {kredi.ekBakiye > 0 ? (
                    <span className="kredi-sayac-rozet">
                      <Sinirsiz size={13} aria-hidden="true" /> {t({ tr: `${sayi(kredi.ekBakiye)} yanmaz`, en: `${sayi(kredi.ekBakiye)} never expire` })}
                    </span>
                  ) : null}
                </div>
                <b className="kredi-sayac-sayi">{sayi(kredi.toplam)}</b>
                <progress
                  className="kredi-cubugu"
                  max={Math.max(1, kredi.aylikLimit)}
                  value={kredi.aylikKalan}
                  aria-label={t({
                    tr: `Aylık hakkın ${sayi(kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} kredisi kaldı`,
                    en: `${sayi(kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} monthly credits left`,
                  })}
                />
                <dl className="kredi-sayac-ayrinti">
                  <div>
                    <dt>
                      <span className="kredi-nokta" data-tur="aylik" aria-hidden="true" /> {t({ tr: "Bu ay kalan hak", en: "Left this month" })}
                    </dt>
                    <dd>
                      {sayi(kredi.aylikKalan)} <small>/ {sayi(kredi.aylikLimit)}</small>
                    </dd>
                    <small>{t({ tr: "Ayın başında yenilenir", en: "Renews at the start of the month" })}</small>
                  </div>
                  <div>
                    <dt>
                      <span className="kredi-nokta" data-tur="ek" aria-hidden="true" /> {t({ tr: "Satın alınan bakiye", en: "Purchased balance" })}
                    </dt>
                    <dd>{sayi(kredi.ekBakiye)}</dd>
                    <small>{t({ tr: "Yanmaz; aylık hak bitince kullanılır", en: "Never expires; used after the monthly allowance" })}</small>
                  </div>
                </dl>
              </div>
              {kredi.tukendi ? (
                <p className="tone-text text-sm" data-tone="danger">
                  {t({ tr: "Krediniz bitti; asistan yeni çalışma yapmıyor.", en: "You are out of credits; the assistant will not run new checks." })}{" "}
                  {bireysel
                    ? t({ tr: "Aşağıdan ek kredi alabilir ya da ayın başını bekleyebilirsiniz.", en: "You can buy more credits below or wait for the start of the month." })
                    : satis === "kurum"
                      ? t({ tr: "Aşağıdan kurum için ek kredi alabilirsiniz.", en: "You can buy more credits for the institution below." })
                      : t({ tr: "Kurum yöneticiniz ek kredi alabilir.", en: "Your institution administrator can buy more credits." })}
                </p>
              ) : null}
            </>
          ) : (
            <p className="gb-bos kredi-bos">
              {access.kind === "staff" ? <Gift size={18} aria-hidden="true" /> : null}
              {access.kind === "staff"
                ? t({ tr: "İç ekip hesapları asistan kredisine tabi değil.", en: "Internal team accounts are not subject to assistant credits." })
                : t({
                    tr: "Kredi durumu şu an okunamadı. Asistanı kullanmaya devam edebilirsiniz; sayfayı sonra yenileyin.",
                    en: "Your credit status could not be loaded right now. You can keep using the assistant; refresh the page later.",
                  })}
            </p>
          )}

          {platformKurumu ? (
            <p className="hint">
              {t({
                tr: "Seçili kurum ArvoOS'un kendisi; kendi kredisi satılmaz. Bir müşteri kurumu adına kredi almak için profil menüsündeki Kurum seçiminden o kurumu seçin.",
                en: "The selected institution is ArvoOS itself; its own credits are not sold. To buy credits for a customer institution, select it under Institution in the profile menu.",
              })}
            </p>
          ) : null}

          {access.kind === "organization" && !satis ? (
            <p className="hint">
              {t({
                tr: "Kurumunuzun kredisini kurum yöneticiniz bu sayfadan alır.",
                en: "Your institution administrator buys your institution's credits on this page.",
              })}
            </p>
          ) : null}

          {satis ? (
            <>
              <h3 className="calisma-durum-alt">
                {satis === "kurum"
                  ? t({ tr: "Kurum için ek kredi paketleri", en: "Extra credit packages for the institution" })
                  : t({ tr: "Ek kredi paketleri", en: "Extra credit packages" })}
              </h3>
              {paketler.length ? (
                <div className="kredi-paketleri">
                  {paketler.map((paket) => {
                    const birim = binKrediFiyati(paket);
                    const indirim = enUcuzBirim > birim ? Math.round((1 - birim / enUcuzBirim) * 100) : 0;
                    const oneCikan = paket.kod === enAvantajli;
                    return (
                      <form action={satis === "kurum" ? kurumKrediSatinAl : krediSatinAl} key={paket.kod} className="kredi-paketi" data-one-cikan={oneCikan || undefined}>
                        <input type="hidden" name="paket" value={paket.kod} />
                        {oneCikan ? <span className="kredi-paketi-serit">{t({ tr: "En avantajlı", en: "Best value" })}</span> : null}
                        <span className="kredi-paketi-ad">{paket.ad}</span>
                        <span className="kredi-paketi-fiyat">{fiyat(paket.fiyat)}</span>
                        <span className="kredi-paketi-birim">
                          {t({ tr: `1.000 kredi ${fiyat(birim)}`, en: `${fiyat(birim)} per 1,000 credits` })}
                        </span>
                        {indirim ? (
                          <span className="kredi-paketi-indirim">{t({ tr: `%${indirim} tasarruf`, en: `Save ${indirim}%` })}</span>
                        ) : (
                          <span className="kredi-paketi-indirim" data-bos="true">{t({ tr: "Başlangıç paketi", en: "Starter pack" })}</span>
                        )}
                        <OdemeButonu birincil={oneCikan} etiket={t({ tr: "Satın al", en: "Buy" })} />
                      </form>
                    );
                  })}
                </div>
              ) : (
                <p className="muted text-sm">
                  {t({
                    tr: "Kredi paketleri şu an yüklenemedi. Ödeme sistemine ulaşılamıyor olabilir; biraz sonra sayfayı yenileyin.",
                    en: "Credit packages could not be loaded right now. The payment system may be unreachable; refresh the page shortly.",
                  })}
                </p>
              )}
              {paketler.length ? <YasalNot /> : null}
              <p className="hint kredi-guvence">
                <Lock size={14} aria-hidden="true" />
                {satis === "kurum"
                  ? t({
                      tr: "Ödeme ArvoOS üzerinden kartla alınır (PayTR) ve kurumunuz adına kaydedilir; ödeme geçmişinde ve faturalarda görünür. Onaylanınca kredi birkaç dakika içinde kurumun bakiyesine eklenir ve bütün üyeler kullanır.",
                      en: "Payment is taken by card through ArvoOS (PayTR) and recorded for your institution; it appears in the payment history and invoices. Once approved, the credits are added to the institution's balance within a few minutes and every member can use them.",
                    })
                  : t({
                      tr: "Ödeme ArvoOS üzerinden kartla alınır (PayTR). Ödeme onaylanınca kredi birkaç dakika içinde bakiyenize eklenir; aboneliğiniz kapalıyken kredi satılmaz.",
                      en: "Payment is taken by card through ArvoOS (PayTR). Once the payment is approved, the credits are added to your balance within a few minutes; credits cannot be bought while your subscription is inactive.",
                    })}
              </p>
            </>
          ) : null}

          {sonHareketler.length ? (
            <>
              <h3 className="calisma-durum-alt">
                <History size={14} aria-hidden="true" /> {t({ tr: "Son hareketler", en: "Recent activity" })}
              </h3>
              <ul className="kredi-hareketleri">
                {sonHareketler.map((h, i) => {
                  const tur = HAREKET[h.tur];
                  const Ikon = tur?.ikon ?? Sparkles;
                  return (
                    <li key={i} className="kredi-hareket" data-tone={tur?.ton ?? "neutral"}>
                      <span className="kredi-hareket-ikon" aria-hidden="true">
                        <Ikon size={14} />
                      </span>
                      <span className="gb-satir-govde">
                        <b>{tur ? t(tur.ad) : h.tur}</b>
                        <small>{tarihSaat(h.created_at)}</small>
                      </span>
                      <span className="kredi-hareket-tutar">
                        {tur?.isaret ?? ""}
                        {sayi(Number(h.kredi))} <small>{t({ tr: "kredi", en: "credits" })}</small>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </article>
      </section>
    </main>
  );
}
