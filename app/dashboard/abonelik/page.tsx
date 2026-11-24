import SozlesmeOnayi from "../_components/sozlesme-onayi";
import { odemeSonrasiOnayVar, sozlesmeOnayGerekli } from "@/lib/sozlesme/onay-durumu";
import { logout } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { Plus, RefreshCw, Sparkles } from "lucide-react";
import { getAuthContext } from "@/lib/auth-guards";
import { getAccessState } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import { krediOzeti, type KrediSatiri } from "@/lib/ai/kredi-ozeti";
import { denemeAsistanHakkim } from "@/lib/ai/erisim";
import { DENEME_ASISTAN_HAKKI } from "@/lib/ai/deneme-hakki";
import type { Metadata } from "next";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import { YEREL, type Metin } from "@/lib/dil";
import { faturalamaKapsami } from "@/lib/faturalama";
import { faturalamaVePaketler, kartDurumum } from "@/lib/subscription";
import { KART_HATALARI } from "@/lib/kart-odeme";
import { licenseSummary } from "@/lib/license-summary";
import { karsilastirmaHazir } from "@/lib/plan-karsilastirma";
import PlaniYonet from "./plani-yonet";
import KredileriIncele from "./kredileri-incele";
import AbonelikSekmeleri from "./abonelik-sekmeleri";
import { kartlaOdemeBaslat } from "@/app/actions/kart-odeme";
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
    tr: "Kurumunuz ArvoOS'un kendisi; ArvoOS kendi kredisi için ödeme almaz ve iç ekip krediye tabi değil.",
    en: "Your institution is ArvoOS itself; ArvoOS does not take payment for its own credits and the internal team is not subject to credits.",
  },
  deneme: {
    tr: "Deneme süresinde ek kredi satılmaz: deneme hakkı krediyle değil kullanım sayısıyla ölçülür. Aboneliğinizi başlattıktan sonra ek kredi alabilirsiniz.",
    en: "Extra credits aren't sold during the trial: trial use is counted in runs, not credits. You can buy extra credits after you start your subscription.",
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
  const { tarihSaat, uzunTarih } = await tarihler();
  const sayi = (deger: number) => new Intl.NumberFormat(YEREL[dil]).format(deger);

  const [access, { data: krediSatiri, error: krediHatasi }] = await Promise.all([
    getAccessState(await getCurrentProfile()),
    ctx.supabase.rpc("ai_kredi_durumum").maybeSingle(),
  ]);
  if (krediHatasi) console.error("[abonelik] kredi durumu okunamadı:", krediHatasi.message);
  const satir = (krediSatiri as KrediSatiri | null) ?? null;
  const kredi = krediOzeti(satir);
  const bireysel = Boolean(satir?.bireysel);
  /* Denemedeki bireysel abone: asistan hakkı krediyle değil sayıyla (lib/ai/deneme-hakki.ts). */
  const deneme = await denemeAsistanHakkim(ctx.user.id, dil);

  /* Faturalar: bireysel abone kendi ödemelerini, kurumda yalnızca kurum yöneticisi kurumunkileri görür. */
  /*
    İç ekip: kendi kurumu. 27.10–20.11.2026 arasında kurum seçiciyle bir
    müşteri kurumu adına kredi alıp faturalarını görebiliyordu; seçici
    kalktı (ArvoLab başka kurumlara kiralanmıyor, kurum ödemeleri ArvoOS'ta).
  */
  const kapsam = faturalamaKapsami(access.kind, ctx.role, ctx.organizationId);
  let faturaKurumu: string | null = null;
  if (access.kind === "staff" && ctx.organizationId) {
    const { data: kendi } = await ctx.supabase.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle();
    faturaKurumu = kendi?.name ?? null;
  }
  const kurumKredisi = kapsam?.tur === "kurum" ? kapsam.kurumId : null;
  /*
    Kart saklama yalnızca bireysel abonede ve ArvoOS anahtarı açıkken. Kart
    durumu ayrı bir köprü çağrısı; okunamazsa null ("okunamadı"). Faturalarla
    AYNI ANDA istenir: eskiden ardından geliyordu ve sayfa üç ArvoOS
    çağrısını sırayla bekliyordu (her biri 8 sn zaman aşımlı).
  */
  const kartSaklama = access.kind === "individual" && access.kartSaklama && Boolean(ctx.user.email);
  const [faturalamaVeri, { data: hareketler }, kartDurumu] = await Promise.all([
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
    kartSaklama && ctx.user.email ? kartDurumum({ id: ctx.user.id, email: ctx.user.email }) : null,
  ]);
  const faturalama = faturalamaVeri?.faturalama ?? null;
  const sonHareketler = (hareketler ?? []) as { tur: string; kredi: number; created_at: string }[];

  // Mevcut ödeme düğmesiyle aynı koşul (lib/license-summary.ts → showPayment).
  const kartlaOdenebilir = kartSaklama && Boolean(licenseSummary(access, new Date(), dil)?.showPayment);

  /* Satış: bireysel abone kendine, kurum yöneticisi kurumuna. Paketler bireyselde ensure'dan, kurumda org_billing'den. */
  const platformKurumu = Boolean(faturalamaVeri?.platformKurumu);
  /* Denemede paket SATILMAZ (02.11.2026): deneme kilidi kullanım sayısına bakıyor, satın alınan
     kredi onu açmazdı — kullanıcı parasını hiçbir şey almadan ödemiş olurdu. */
  /*
    YETKİ ile VERİ ayrı (24.11.2026). "Yetkisi var" ile "satılacak paket
    biliniyor" iki ayrı şey: paket listesi de köprünün ensure/org_billing
    yanıtından geliyor, ArvoOS'a ulaşılamadığında BOŞ. Eskiden yalnızca
    yetkiye bakılıyordu ve köprü kopukken "Kredi paketlerini incele"
    düğmesi boş bir pencere açıyordu. Şimdi eylem yalnızca paket
    okunabildiğinde çiziliyor; okunamadığında nedeni yazılıyor
    (`paketOkunamadi`), "bu hesapta kapalı" denmiyor — kapalı değil,
    şimdilik bilinmiyor.
  */
  const satisYetkisi = access.kind === "individual" ? (deneme.denemede ? null : ("bireysel" as const)) : kurumKredisi && !platformKurumu ? ("kurum" as const) : null;
  const paketler = satisYetkisi === "bireysel" ? access.krediPaketleri : satisYetkisi === "kurum" ? (faturalamaVeri?.krediPaketleri ?? []) : [];
  const satis = paketler.length > 0 ? satisYetkisi : null;
  const paketOkunamadi = satisYetkisi !== null && paketler.length === 0;
  /*
    Öne çıkan paket: birim fiyatı EN DÜŞÜK olan ("En avantajlı"). Eskiden
    listenin ilk paketi birincil düğmeyi alıyordu — en pahalı birim
    fiyatlı paket görsel olarak önerilmiş oluyordu. Etiket ölçülebilir bir
    gerçeği söylüyor, "popüler" gibi doğrulanamayan bir iddiayı değil.
  */
  /*
    PLAN KARTI (24.11.2026). Plan ADI katalogdan gelmiyor (ArvoOS yalnızca
    kod, dönem ve tutar bildiriyor), bu yüzden erişim türünden okunan
    insanca bir ad yazılıyor; katalog bir gün ad gönderirse plan
    karşılaştırma penceresi onu kullanıyor (lib/billing-plan.ts).
  */
  const ozet = licenseSummary(access, new Date(), dil);
  const planAdi =
    access.kind === "organization"
      ? t({ tr: "Kurum lisansı", en: "Institution licence" })
      : access.kind === "individual"
        ? t({ tr: "Bireysel plan", en: "Individual plan" })
        : t({ tr: "İç ekip", en: "Internal team" });
  const yenilemeMetni = access.periodEnd ? uzunTarih(access.periodEnd) : access.trialEndsAt ? uzunTarih(access.trialEndsAt) : null;
  /*
    YÜRÜRLÜKTEKİ PLAN KODU ŞU AN BİLİNMİYOR: köprü de aynası da
    (individual_subscriptions) yalnızca durum ve dönem bitişi tutuyor.
    null geçiliyor ve karşılaştırma penceresi HİÇBİR satırı "Mevcut plan"
    işaretlemiyor — yanlış planı işaretlemek, kullanıcıya ödemediği bir
    planı ödüyormuş gibi göstermek olurdu.
  */
  const mevcutPlanKodu: string | null = null;
  /*
    İKİ EYLEM, İKİ AYRI KARAR (24.11.2026).

    Plan yönetimi ve kredi satın alma eskiden tek koşula bağlıydı
    ("bireysel kullanıcı"). Abonelik verisi alınamadığında ikisi de
    görünüyor, açılan pencerede yönetilecek ya da satın alınacak hiçbir
    şey olmuyordu: "Planı yönet" boş bir pencere, "Kredi paketlerini
    incele" boş bir liste açıyordu. Artık her eylem KENDİ yetkisi VE
    kendi verisi doğrulandığında çiziliyor; biri kapalıyken öteki
    çalışmaya devam ediyor.

    Plan karşılaştırması ayrıca KATALOG kapısından geçiyor
    (karsilastirmaHazir): katalog en az iki adlı, fiyatlı plan
    bildirmediği sürece müşteriye MEVCUT abonelik yönetimi yolu
    sunuluyor — adsız sütunlarla bir plan seçimi çizmek, müşteriye var
    olmayan bir seçim sunmak olurdu.
  */
  const planDegistirebilir = access.kind === "individual" && karsilastirmaHazir(access.plans);
  /* Yönetilecek bir şey var mı: durum/dönem okunabildi, ya da ödenecek
     bir yenileme var, ya da katalog karşılaştırmaya hazır. Üçü de yoksa
     düğme boş bir pencere açardı. */
  const planYonetilebilir =
    access.kind === "individual" && (ozet !== null || kartlaOdenebilir || planDegistirebilir);

  /*
    ÖDEMEDEN SONRA SÖZLEŞME ONAYI (29.10.2026, kurum sahibinin isteği):
    kartla ödemeden dönüşte (kart=tamam) sözleşme yeniden gösterilir ve onay
    ödemeye bağlanarak kaydedilir; itirazda "ödedikten sonra okuyup
    onayladı" delili budur. Sürüm onayı hiç yoksa önce panelin kendi
    penceresi açılır (layout), ardından bu. Son yarım saatte verilmiş ödeme
    sonrası onay varsa yeniden sorulmaz (sayfa yenilemesi).
  */
  const odemeSonrasiOnay =
    kart === "tamam" &&
    !(await sozlesmeOnayGerekli({ id: ctx.user.id, role: ctx.role })) &&
    !(await odemeSonrasiOnayVar(ctx.user.id));

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      {odemeSonrasiOnay ? <SozlesmeOnayi olay="odeme_sonrasi" cikis={logout} /> : null}
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Abonelik ve Kredi", en: "Subscription and Credits" })}</h1>
          <p>{t({ tr: "Planınızı yönetin, asistan kullanımınızı takip edin.", en: "Manage your plan and track your assistant usage." })}</p>
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

      {/*
        ÜSTTE İKİ KOMPAKT KART (24.11.2026, onaylı mockup). Eskiden iki
        uzun sütun vardı ve kredisine bakmaya gelen kullanıcı faturaların,
        kart bölümünün ve paket ızgarasının arasından kaydırıyordu. Şimdi
        üstte "ne ödüyorum" ve "ne kadar kredim var", altta kayıtlar.
        Telefonda kartlar alt alta (app/styles/abonelik.css).
      */}
      <section className="abonelik-kartlar" aria-label={t({ tr: "Abonelik ve kredi", en: "Subscription and credits" })}>
        <article className="abonelik-kart">
          <span className="abonelik-kart-etiket">{t({ tr: "Mevcut plan", en: "Current plan" })}</span>
          <div className="abonelik-plan-ad">
            <b>{planAdi}</b>
            {ozet ? <span className="karsilastir-rozet" data-tur="mevcut" data-ton={ozet.tone}>{ozet.statusLabel}</span> : null}
          </div>
          {/* Yenileme ya da dönem bitişi: ikisi de yoksa satır çizilmiyor,
              "—" yazmak bilinmeyeni bilinir göstermek olurdu. */}
          {yenilemeMetni ? (
            <div className="abonelik-kart-satir">
              <span>{t({ tr: "Sonraki yenileme", en: "Next renewal" })}</span>
              <b>{yenilemeMetni}</b>
            </div>
          ) : null}
          {/*
            PLANA DAHİL AYLIK KREDİ (24.11.2026). Katalogdan DEĞİL:
            ArvoOS plan başına kredi bildirmiyor. Bu sayı ArvoLab'ın
            kendi sayacından geliyor (ai_kredi_durumum → aylık hak;
            bireyselde ai_bireysel_aylik_hak(), kurumda
            organizations.ai_credit_limit). Hak bildirilmemişse satır
            çizilmiyor.
          */}
          {kredi.goster && kredi.aylikLimit > 0 ? (
            <div className="abonelik-kart-satir">
              <span>{t({ tr: "Aylık asistan kredisi", en: "Monthly assistant credits" })}</span>
              <b>{sayi(kredi.aylikLimit)}</b>
            </div>
          ) : null}
          {ozet === null ? (
            <p className="muted text-sm">
              {access.kind === "staff"
                ? t({ tr: "İç ekip hesabı; abonelik ücreti alınmıyor.", en: "Internal team account; no subscription fee." })
                : t({ tr: "Abonelik bilgisi şu anda alınamıyor.", en: "Subscription information is unavailable right now." })}
            </p>
          ) : null}
          {access.kind === "organization" ? (
            <p className="muted text-sm">
              {t({
                tr: `Aboneliğinizi ${access.organizationName ?? "kurumunuz"} yönetiyor; plan değişikliği ve ödeme kurum yöneticinizdedir.`,
                en: `Your subscription is managed by ${access.organizationName ?? "your institution"}; plan changes and payment are handled by your institution administrator.`,
              })}
            </p>
          ) : null}
          {planYonetilebilir ? (
            <PlaniYonet
              planAdi={planAdi}
              durum={ozet?.statusLabel ?? null}
              yenileme={yenilemeMetni ? t({ tr: `Sonraki yenileme: ${yenilemeMetni}`, en: `Next renewal: ${yenilemeMetni}` }) : null}
              dahilKredi={
                kredi.goster && kredi.aylikLimit > 0
                  ? t({ tr: `Aylık ${sayi(kredi.aylikLimit)} asistan kredisi dahil`, en: `${sayi(kredi.aylikLimit)} assistant credits included each month` })
                  : null
              }
              planlar={access.plans}
              mevcutKod={mevcutPlanKodu}
              karsilastirilabilir={planDegistirebilir}
              yenilemeAlani={
                kartlaOdenebilir ? (
                  <form action={kartlaOdemeBaslat}>
                    <OdemeButonu birincil={false} etiket={t({ tr: "Yenilemeyi yönet", en: "Manage renewal" })} />
                  </form>
                ) : null
              }
            />
          ) : null}
        </article>

        <article className="abonelik-kart">
          <span className="abonelik-kart-etiket">{t({ tr: "Asistan kredisi", en: "Assistant credits" })}</span>
          {deneme.denemede ? (
            <p className="alert" data-tone={deneme.kalan > 0 ? "info" : "warning"} role="status">
              {deneme.kalan > 0
                ? t({
                    tr: `Deneme süresince asistanı ${DENEME_ASISTAN_HAKKI} kez kullanabilirsiniz; kalan hakkınız: ${deneme.kalan}.`,
                    en: `During the trial you can use the assistant ${DENEME_ASISTAN_HAKKI} times; uses left: ${deneme.kalan}.`,
                  })
                : t({
                    tr: `Deneme süresindeki ${DENEME_ASISTAN_HAKKI} asistan hakkınızı kullandınız.`,
                    en: `You've used your ${DENEME_ASISTAN_HAKKI} trial assistant runs.`,
                  })}
            </p>
          ) : kredi.goster ? (
            <>
              <p className="abonelik-kredi-sayi">
                <b>{sayi(kredi.toplam)}</b> <span>{t({ tr: "kullanılabilir kredi", en: "credits available" })}</span>
              </p>
              {/*
                KULLANIM ÇUBUĞU yalnızca dönem kullanımı ve toplam hak AYNI
                kaynaktan doğrulanabiliyorsa (ai_kredi_durumum: aylık hak
                bildirilmiş). Hak bildirilmemişse çubuk çizilmiyor: payda
                uydurulmuş bir oran, kullanıcıya olmayan bir sınır gösterir.
              */}
              {kredi.aylikLimit > 0 ? (
                <>
                  <progress
                    className="abonelik-cubuk"
                    max={kredi.aylikLimit}
                    value={Math.max(0, kredi.aylikLimit - kredi.aylikKalan)}
                    aria-label={t({
                      tr: `Bu ay ${sayi(kredi.aylikLimit - kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} kredi kullanıldı`,
                      en: `${sayi(kredi.aylikLimit - kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} credits used this month`,
                    })}
                  />
                  <small className="muted">
                    {t({
                      tr: `${sayi(kredi.aylikLimit - kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} kullanıldı`,
                      en: `${sayi(kredi.aylikLimit - kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} used`,
                    })}
                  </small>
                </>
              ) : null}
              {kredi.ekBakiye > 0 ? (
                <small className="muted">
                  {t({ tr: `${sayi(kredi.ekBakiye)} kredi satın alınmış bakiyeden; yanmaz.`, en: `${sayi(kredi.ekBakiye)} from your purchased balance; never expires.` })}
                </small>
              ) : null}
            </>
          ) : (
            <p className="muted text-sm">
              {access.kind === "staff"
                ? t({ tr: "İç ekip hesapları asistan kredisine tabi değil.", en: "Internal team accounts are not subject to assistant credits." })
                : t({
                    tr: "Kredi durumu şu an okunamadı. Asistanı kullanmaya devam edebilirsiniz.",
                    en: "Your credit status could not be loaded right now. You can keep using the assistant.",
                  })}
            </p>
          )}
        </article>
      </section>

      {/*
        EK KREDİ: tek kompakt alan. Eylem yalnızca SATIN ALMA YETKİSİ olana
        (bireysel abone, denemede değil; kurumda yalnızca yönetici).
        Kurum üyesine ve iç ekibe durum yazılıyor, kullanım geçmişi aşağıda
        herkese açık kalıyor.
      */}
      {satis ? (
        <section className="abonelik-ek-kredi">
          <div>
            <h2>{t({ tr: "Araştırmanıza kaldığınız yerden devam edin", en: "Pick up your research where you left off" })}</h2>
            <p>{t({ tr: "İhtiyaç duyduğunuzda ek asistan kredisi alın.", en: "Buy extra assistant credits whenever you need them." })}</p>
          </div>
          <KredileriIncele paketler={paketler} kurum={satis === "kurum"} />
        </section>
      ) : (
        <section className="abonelik-ek-kredi" data-bilgi="true">
          <div>
            <h2>{t({ tr: "Ek asistan kredisi", en: "Extra assistant credits" })}</h2>
            <p>
              {paketOkunamadi
                ? t({
                    tr: "Kredi paketleri şu anda alınamıyor; ödeme sistemine ulaşılamıyor olabilir. Biraz sonra tekrar deneyin — mevcut krediniz ve kayıtlarınız aşağıda görünmeye devam ediyor.",
                    en: "Credit packages are unavailable right now; the payment system may be unreachable. Try again shortly — your current credits and records remain visible below.",
                  })
                : platformKurumu
                ? t({ tr: "Kurumunuz ArvoOS'un kendisi; kendi kredisi satılmaz.", en: "Your institution is ArvoOS itself; its own credits are not sold." })
                : access.kind === "organization"
                  ? t({ tr: "Kurumunuzun kredisini kurum yöneticiniz bu sayfadan alır.", en: "Your institution administrator buys your institution's credits on this page." })
                  : access.kind === "staff"
                    ? t({ tr: "İç ekip hesapları asistan kredisine tabi değil.", en: "Internal team accounts are not subject to assistant credits." })
                    : deneme.denemede
                      ? t({
                          tr: "Deneme süresinde ek kredi satılmaz; aboneliğinizi başlattığınızda açılır.",
                          en: "Extra credits are not sold during the trial; they become available once you start your subscription.",
                        })
                      : t({ tr: "Bu hesapta ek kredi satın alma açık değil.", en: "Buying extra credits is not available on this account." })}
            </p>
          </div>
        </section>
      )}

      <AbonelikSekmeleri
        faturalar={kapsam ? (
          <>
            {/* İç ekip kendi kurumunun faturalarını görüyor; hangi kurum
                olduğu yazılmazsa liste bağlamsız kalıyordu. */}
            {access.kind === "staff" && faturaKurumu ? (
              <p className="muted text-sm">
                {t({ tr: `${faturaKurumu} faturaları gösteriliyor.`, en: `Showing invoices for ${faturaKurumu}.` })}
              </p>
            ) : null}
            <FaturalarBolumu veri={faturalama} kurum={kapsam.tur === "kurum"} />
          </>
        ) : (
          <p className="muted text-sm">
            {t({ tr: "Bu hesapta görüntülenecek fatura yok.", en: "There are no invoices to show on this account." })}
          </p>
        )}
        hareketler={
          sonHareketler.length ? (
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
          ) : (
            <p className="muted text-sm">{t({ tr: "Henüz kredi hareketi yok.", en: "No credit activity yet." })}</p>
          )
        }
      />

      {/* Kayıtlı kart ve otomatik yenileme: mevcut bölüm olduğu gibi. */}
      {kartSaklama && kartDurumu?.ok && (kartDurumu.veri.cards.length || kartDurumu.veri.autoRenew?.active) ? (
        <section className="abonelik-kart-bolumu">
          <KartBolumu durum={kartDurumu.veri} />
        </section>
      ) : null}

      {satis ? <YasalNot /> : null}

    </main>
  );
}
