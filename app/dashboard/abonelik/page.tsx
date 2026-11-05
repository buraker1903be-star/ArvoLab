import SozlesmeOnayi from "../_components/sozlesme-onayi";
import { odemeSonrasiOnayVar, sozlesmeOnayGerekli } from "@/lib/sozlesme/onay-durumu";
import { logout } from "@/app/actions/auth";
import { seciliKurum } from "@/lib/kurum-secimi-sunucu";
import { redirect } from "next/navigation";
import { Gift, Lock, Plus, RefreshCw, Sparkles } from "lucide-react";
import { getAuthContext } from "@/lib/auth-guards";
import { getAccessState } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import { krediSatinAl, kurumKrediSatinAl } from "@/app/actions/subscription";
import { krediOzeti, type KrediSatiri } from "@/lib/ai/kredi-ozeti";
import { denemeAsistanHakkim } from "@/lib/ai/erisim";
import { DENEME_ASISTAN_HAKKI } from "@/lib/ai/deneme-hakki";
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
import SayfaBasligi from "../_components/sayfa/sayfa-basligi";
import Bolum from "../_components/sayfa/bolum";
import KrediOzetKarti from "../_components/kredi-ozet-karti";
import { PLAN_ADI, planKatmani } from "@/lib/plan-katmani";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Abonelik ve Kredi", en: "Subscription and Credits" }) };
}

/*
  ABONELİK VE KREDİ (26.10.2026, kurum sahibinin isteği: "bireysel
  öğrencilerin abonelik ve kullanım hakları, kredi satın alabilecekleri
  sayfa").

  Bireysel abonenin ArvoOS paneli yok; aboneliğini ve kredisini buradan
  yönetiyor: plan (ana sayfadaki kartın aynısı, ödeme düğmeleriyle),
  asistan kredisi, paketler, son hareketler, faturalar. Düzen için
  return'ün üstündeki 4.4 notu.

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
  deneme: {
    tr: "Deneme süresinde ek kredi satılmaz: deneme hakkı krediyle değil kullanım sayısıyla ölçülür. Aboneliğinizi başlattıktan sonra ek kredi alabilirsiniz.",
    en: "Extra credits aren't sold during the trial: trial use is counted in runs, not credits. You can buy extra credits after you start your subscription.",
  },
  /* Ödeme başlatılırken yıllık ya da tanınmayan plan kodu (app/actions/subscription.ts → planKoduKarari). */
  plan: {
    tr: "Seçilen abonelik planıyla ödeme başlatılamadı. Şu an yalnızca aylık ödeme alınabiliyor; sayfayı yenileyip aylık planla tekrar deneyin.",
    en: "Payment could not be started with the selected subscription plan. Only monthly payment is available right now; refresh the page and try again with the monthly plan.",
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
  /* Denemedeki bireysel abone: asistan hakkı krediyle değil sayıyla (lib/ai/deneme-hakki.ts). */
  const deneme = await denemeAsistanHakkim(ctx.user.id, dil);

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
  const satis = access.kind === "individual" ? (deneme.denemede ? null : ("bireysel" as const)) : kurumKredisi && !platformKurumu ? ("kurum" as const) : null;
  const paketler = satis === "bireysel" ? access.krediPaketleri : satis === "kurum" ? (faturalamaVeri?.krediPaketleri ?? []) : [];
  const enUcuzBirim = paketler.length ? Math.max(...paketler.map(binKrediFiyati)) : 0;
  /*
    Öne çıkan paket: birim fiyatı EN DÜŞÜK olan ("En avantajlı"). Eskiden
    listenin ilk paketi birincil düğmeyi alıyordu — en pahalı birim
    fiyatlı paket görsel olarak önerilmiş oluyordu. Etiket ölçülebilir bir
    gerçeği söylüyor, "popüler" gibi doğrulanamayan bir iddiayı değil.
  */
  const enAvantajli = paketler.length > 1 ? paketler.reduce((a, b) => (binKrediFiyati(b) < binKrediFiyati(a) ? b : a)).kod : null;

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

  /*
    SIGNATURE OS 4.4 (05.11.2026): AYARLAR'LA AYNI DÜZEN. Eskiden iki kart
    yan yanaydı ve sayfa sabit yükseklikteydi: sağdaki koyu "Kullanılabilir
    kredi" sayacı paketlerin altında sıkışıp kesiliyor (sayı okunmuyordu),
    faturalar sol kartın içinde kayıyordu. Şimdi tek yüzeyde adlı bölümler
    (başlık solda, içerik sağda; geniş ekranda soldaki dizin): Planınız,
    Asistan kredisi, Ek kredi paketleri, Son hareketler, Faturalar ve
    ödemeler, Kayıtlı kart. Kredi gösterimi Ayarlar'la AYNI bileşen
    (KrediOzetKarti). Hiçbir okuma, karar, ödeme ya da köprü çağrısı
    değişmedi; yalnızca yerleri.
  */
  const katman = planKatmani(access);
  const kartBolumuVar = Boolean(kartSaklama && kartDurumu?.ok && (kartDurumu.veri.cards.length || kartDurumu.veri.autoRenew?.active));
  const bolumler: { id: string; ad: string }[] = [
    { id: "abonelik-plan", ad: t({ tr: "Planınız", en: "Your plan" }) },
    { id: "abonelik-kredi", ad: t({ tr: "Asistan kredisi", en: "Assistant credits" }) },
    ...(satis ? [{ id: "abonelik-paketler", ad: t({ tr: "Ek kredi paketleri", en: "Extra credit packages" }) }] : []),
    ...(sonHareketler.length ? [{ id: "abonelik-hareketler", ad: t({ tr: "Son hareketler", en: "Recent activity" }) }] : []),
    ...(kapsam ? [{ id: "abonelik-faturalar", ad: t({ tr: "Faturalar ve ödemeler", en: "Invoices and payments" }) }] : []),
    ...(kartBolumuVar ? [{ id: "abonelik-kart", ad: t({ tr: "Kayıtlı kart", en: "Saved card" }) }] : []),
  ];

  return (
    <main className="dashboard-page ayarlar-sayfa abonelik-sayfa">
      {odemeSonrasiOnay ? <SozlesmeOnayi olay="odeme_sonrasi" cikis={logout} /> : null}
      <SayfaBasligi
        baslik={t({ tr: "Abonelik ve kredi", en: "Subscription and credits" })}
        aciklama={t({ tr: "Aboneliğiniz, asistan kullanım hakkınız, ek kredi paketleri ve ödemeleriniz.", en: "Your subscription, assistant allowance, extra credit packages and payments." })}
      />

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

      <div className="ayarlar-govde">
        <nav className="ayarlar-dizin" aria-label={t({ tr: "Abonelik bölümleri", en: "Subscription sections" })}>
          <ul>
            {bolumler.map((b) => (
              <li key={b.id}>
                <a href={`#${b.id}`}>{b.ad}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ayarlar-yuzey">
          <Bolum
            id="abonelik-plan"
            duzey={2}
            sinif="ayar-bolum"
            baslik={t({ tr: "Planınız", en: "Your plan" })}
            aciklama={
              access.kind === "organization"
                ? t({ tr: "Aboneliğinizi kurumunuz yönetiyor.", en: "Your subscription is managed by your institution." })
                : access.kind === "individual"
                  ? t({ tr: "Bireysel abonelik; ödeme kartla, otomatik çekim yok.", en: "Individual subscription; paid by card, no automatic charges." })
                  : t({ tr: "İç ekip hesabı.", en: "Internal team account." })
            }
            eylem={<span className="abonelik-katman">{t(PLAN_ADI[katman])}</span>}
          >
            <div className="ayar-bolum-icerik">
              <LicenseCard access={access} />
              {/*
                Köprüye ulaşılamadığında (access.status "unreachable") lisans kartı
                hiç çizilmiyor; eskiden bölüm sessizce boş kalıyordu. Erişim bu
                durumda ENGELLENMEZ (lib/access.ts: geçici arıza kimseyi dışarıda
                bırakmamalı); kullanıcıya bunu söylüyoruz.
              */}
              {access.kind === "individual" && katman === "bilinmiyor" ? (
                <p className="abonelik-bos" role="status">
                  {t({
                    tr: "Abonelik bilginize şu an ulaşılamıyor. Bu süre içinde erişiminiz kapanmaz; sayfayı biraz sonra yenileyin.",
                    en: "Your subscription details can't be reached right now. Your access is not closed in the meantime; refresh the page shortly.",
                  })}
                </p>
              ) : null}

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
                <p className="ayar-not">
                  {t({
                    tr: "Aboneliğe her ay 1.000 asistan kredisi dahil (1 kredi = 1.000 karakter); kullanılmayan aylık hak devretmez. Satın alınan kredi yanmaz, aylık hak bitince kullanılır.",
                    en: "Your subscription includes 1,000 assistant credits each month (1 credit = 1,000 characters); unused monthly credits do not roll over. Purchased credits never expire and are used once the monthly allowance runs out.",
                  })}
                </p>
              ) : null}

              {access.kind === "staff" && kapsam && faturaKurumu ? (
                <p className="ayar-not">
                  {t({ tr: "", en: "Showing invoices for " })}
                  <b>{faturaKurumu}</b>
                  {t({
                    tr: " faturaları gösteriliyor. Diğer kurumunuzunkiler için profil menüsündeki Kurum seçimini değiştirin.",
                    en: ". For another institution's, change the Institution selection in the profile menu.",
                  })}
                </p>
              ) : null}
            </div>
          </Bolum>

          <Bolum
            id="abonelik-kredi"
            duzey={2}
            sinif="ayar-bolum"
            baslik={t({ tr: "Asistan kredisi", en: "Assistant credits" })}
            aciklama={
              bireysel
                ? t({ tr: "Bu ayki hakkınız ve satın aldığınız bakiye.", en: "This month's allowance and your purchased balance." })
                : t({ tr: "Kurumunuzun bu ayki kredisi.", en: "Your institution's credits this month." })
            }
          >
            <div className="ayar-bolum-icerik">
              {/*
                DENEME HAKKI (02.11.2026): deneme süresinde asistan ayda 1.000
                krediyle değil, 2 kullanımla sınırlı. Kredi göstergesi bu
                kullanıcıya "1.000 kredi" gösterseydi ikinci kullanımdan sonraki
                kilit ona bir hata gibi görünürdü.
              */}
              {deneme.denemede ? (
                <p className="alert" data-tone={deneme.kalan > 0 ? "info" : "warning"} role="status">
                  {deneme.kalan > 0
                    ? t({
                        tr: `Deneme süresince asistanı ${DENEME_ASISTAN_HAKKI} kez kullanabilirsiniz; kalan hakkınız: ${deneme.kalan}. Aboneliğinizi başlattığınızda aylık kredi tanımlanır.`,
                        en: `During the trial you can use the assistant ${DENEME_ASISTAN_HAKKI} times; uses left: ${deneme.kalan}. Monthly credits are added when you start your subscription.`,
                      })
                    : t({
                        tr: `Deneme süresindeki ${DENEME_ASISTAN_HAKKI} asistan hakkınızı kullandınız. Aboneliğinizi başlattığınızda asistan aylık krediyle yeniden açılır.`,
                        en: `You've used your ${DENEME_ASISTAN_HAKKI} trial assistant runs. The assistant reopens with monthly credits once you start your subscription.`,
                      })}
                </p>
              ) : null}

              {/*
                Sayı üretilemiyorsa (okunamadı, hak bildirilmemiş, iç ekip) kutu
                çizilmiyor: "0 kredi" yazmak, hakkı olmayanla ölçümü okunamayanı
                aynı göstermek olurdu (lib/ai/kredi-ozeti.ts).
              */}
              {deneme.denemede ? null : kredi.goster ? (
                <KrediOzetKarti kredi={kredi} ayrintili>
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
                </KrediOzetKarti>
              ) : (
                <p className="abonelik-bos">
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
                <p className="ayar-not">
                  {t({
                    tr: "Seçili kurum ArvoOS'un kendisi; kendi kredisi satılmaz. Bir müşteri kurumu adına kredi almak için profil menüsündeki Kurum seçiminden o kurumu seçin.",
                    en: "The selected institution is ArvoOS itself; its own credits are not sold. To buy credits for a customer institution, select it under Institution in the profile menu.",
                  })}
                </p>
              ) : null}

              {access.kind === "organization" && !satis ? (
                <p className="ayar-not">
                  {t({
                    tr: "Kurumunuzun kredisini kurum yöneticiniz bu sayfadan alır.",
                    en: "Your institution administrator buys your institution's credits on this page.",
                  })}
                </p>
              ) : null}
            </div>
          </Bolum>

          {satis ? (
            <Bolum
              id="abonelik-paketler"
              duzey={2}
              sinif="ayar-bolum"
              baslik={
                satis === "kurum"
                  ? t({ tr: "Kurum için ek kredi", en: "Extra credits for the institution" })
                  : t({ tr: "Ek kredi paketleri", en: "Extra credit packages" })
              }
              aciklama={t({ tr: "Satın alınan kredi yanmaz; aylık hak bitince kullanılır.", en: "Purchased credits never expire; they are used after the monthly allowance." })}
            >
              <div className="ayar-bolum-icerik">
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
                          {/* Paket adını ArvoOS Türkçe gönderiyor ("2.500 kredi"); İngilizce arayüzde adı krediden kuruyoruz. */}
                          <span className="kredi-paketi-ad">{dil === "en" ? `${sayi(paket.kredi)} credits` : paket.ad}</span>
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
                  <p className="abonelik-bos">
                    {t({
                      tr: "Kredi paketleri şu an yüklenemedi. Ödeme sistemine ulaşılamıyor olabilir; biraz sonra sayfayı yenileyin.",
                      en: "Credit packages could not be loaded right now. The payment system may be unreachable; refresh the page shortly.",
                    })}
                  </p>
                )}
                {paketler.length ? <YasalNot /> : null}
                <p className="ayar-not kredi-guvence">
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
              </div>
            </Bolum>
          ) : null}

          {sonHareketler.length ? (
            <Bolum
              id="abonelik-hareketler"
              duzey={2}
              sinif="ayar-bolum"
              baslik={t({ tr: "Son hareketler", en: "Recent activity" })}
              aciklama={t({ tr: "Kredinize eklenenler ve asistanın kullandıkları.", en: "Credits added and used by the assistant." })}
            >
              <ul className="kredi-hareketleri ayar-bolum-icerik">
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
            </Bolum>
          ) : null}

          {kapsam ? (
            <Bolum
              id="abonelik-faturalar"
              duzey={2}
              sinif="ayar-bolum"
              baslik={
                kapsam.tur === "kurum"
                  ? t({ tr: "Kurumun faturaları ve ödemeleri", en: "Institution invoices and payments" })
                  : t({ tr: "Faturalar ve ödemeler", en: "Invoices and payments" })
              }
              aciklama={t({ tr: "Proformalar, ödemeler, faturalar ve makbuzlar.", en: "Pro forma invoices, payments, invoices and receipts." })}
            >
              <div className="ayar-bolum-icerik">
                <FaturalarBolumu veri={faturalama} kurum={kapsam.tur === "kurum"} />
              </div>
            </Bolum>
          ) : null}

          {/* Otomatik yenileme kaldırıldıktan sonra (29.10.2026) yeni kart kaydedilmiyor;
              bölüm yalnızca eskiden kaydedilmiş bir kart (silebilsin) ya da açık kalmış
              bir yenileme varsa çizilir. Boş "kayıtlı kartınız yok" kutusu yalnızca gürültüydü. */}
          {kartBolumuVar && kartDurumu?.ok ? (
            <Bolum
              id="abonelik-kart"
              duzey={2}
              sinif="ayar-bolum"
              baslik={t({ tr: "Kayıtlı kart", en: "Saved card" })}
              aciklama={t({ tr: "Eskiden kaydedilmiş kartınız ve otomatik yenileme.", en: "Your previously saved card and automatic renewal." })}
            >
              <div className="ayar-bolum-icerik">
                <KartBolumu durum={kartDurumu.veri} />
              </div>
            </Bolum>
          ) : null}
        </div>
      </div>
    </main>
  );
}
