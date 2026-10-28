import { seciliKurum } from "@/lib/kurum-secimi-sunucu";
import { redirect } from "next/navigation";
import { ExternalLink, History } from "lucide-react";
import { getAuthContext } from "@/lib/auth-guards";
import { getAccessState } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import { krediSatinAl } from "@/app/actions/subscription";
import { krediOzeti, type KrediSatiri } from "@/lib/ai/kredi-ozeti";
import { KREDI_SATIN_ALMA_ADRESI } from "@/lib/ai/kredi-karari";
import { binKrediFiyati, paketFiyati } from "@/lib/kredi-paketleri";
import { trTarihSaat } from "@/lib/tr-time";
import { faturalamaKapsami } from "@/lib/faturalama";
import { faturalamaYukle } from "@/lib/subscription";
import LicenseCard from "../_components/license-card";
import OdemeButonu from "../_components/odeme-butonu";
import FaturalarBolumu from "./faturalar-bolumu";

export const metadata = { title: "Abonelik ve Kredi" };

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

  Kurum üyesine aynı sayfa kurumun kredisini gösteriyor ama satış yok:
  kurumun kredisini kurum yöneticisi ArvoOS panelinden alıyor.
*/

const sayi = (deger: number) => new Intl.NumberFormat("tr-TR").format(deger);

const HATA: Record<string, string> = {
  odeme: "Ödeme başlatılamadı. Ödeme sistemine şu an ulaşılamıyor ya da aboneliğiniz kredi almaya açık değil; biraz sonra tekrar deneyin.",
  paket: "Seçilen paket tanınmadı; sayfayı yenileyip tekrar deneyin.",
  kurum: "Kurum üyesi olduğunuz için krediyi kurum yöneticiniz alır.",
};

const HAREKET: Record<string, { ad: string; isaret: string }> = {
  yukleme: { ad: "Satın alındı", isaret: "+" },
  yenileme: { ad: "Aylık hak yenilendi", isaret: "" },
  tuketim: { ad: "Asistan çalışması", isaret: "−" },
};

export default async function AbonelikPage({ searchParams }: { searchParams: Promise<{ hata?: string }> }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/");
  const { hata } = await searchParams;

  const [access, { data: krediSatiri, error: krediHatasi }] = await Promise.all([
    getAccessState(await getCurrentProfile()),
    ctx.supabase.rpc("ai_kredi_durumum").maybeSingle(),
  ]);
  if (krediHatasi) console.error("[abonelik] kredi durumu okunamadı:", krediHatasi.message);
  const satir = (krediSatiri as KrediSatiri | null) ?? null;
  const kredi = krediOzeti(satir);
  const bireysel = Boolean(satir?.bireysel);

  /* Son hareketler yalnızca bireysel abonede (kurumun defteri kurum yöneticisinin). */
  const { data: hareketler } = bireysel
    ? await ctx.supabase.rpc("ai_bireysel_kredi_hareketlerim")
    : { data: null };
  const sonHareketler = (hareketler ?? []) as { tur: string; kredi: number; created_at: string }[];

  /* Faturalar: bireysel abone kendi ödemelerini, kurumda yalnızca kurum yöneticisi kurumunkileri görür. */
  /* İç ekip: kurum seçicide seçili kurum, yoksa kendi kurumu (lib/kurum-secimi.ts). */
  const seciliKurumu = access.kind === "staff" ? await seciliKurum() : null;
  const kapsam = faturalamaKapsami(access.kind, ctx.role, seciliKurumu?.id ?? ctx.organizationId);
  let faturaKurumu: string | null = seciliKurumu?.ad ?? null;
  if (access.kind === "staff" && !faturaKurumu && ctx.organizationId) {
    const { data: kendi } = await ctx.supabase.from("organizations").select("name").eq("id", ctx.organizationId).maybeSingle();
    faturaKurumu = kendi?.name ?? null;
  }
  const faturalama = kapsam && ctx.user.email ? await faturalamaYukle(kapsam, { id: ctx.user.id, email: ctx.user.email }) : null;

  const paketler = access.kind === "individual" ? access.krediPaketleri : [];
  const enUcuzBirim = paketler.length ? Math.max(...paketler.map(binKrediFiyati)) : 0;

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>Abonelik ve kredi</h1>
          <p>Aboneliğiniz, asistan kullanım hakkınız ve ek kredi paketleri.</p>
        </div>
      </section>

      {hata && HATA[hata] ? (
        <p className="alert" data-tone="danger" role="alert">
          {HATA[hata]}
        </p>
      ) : null}

      <section className="gb-sutunlar kaynaklar-ikili" aria-label="Abonelik ve kredi">
        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>Aboneliğim</h2>
              <p>
                {access.kind === "organization"
                  ? "Aboneliğinizi kurumunuz yönetiyor."
                  : access.kind === "individual"
                    ? "Bireysel abonelik; ödeme kartla, otomatik çekim yok."
                    : "İç ekip hesabı."}
              </p>
            </div>
          </header>

          <LicenseCard access={access} />

          {access.kind === "individual" ? (
            <p className="hint">
              Aboneliğe her ay 1.000 asistan kredisi dahil (1 kredi = 1.000 karakter); kullanılmayan aylık hak devretmez.
              Satın alınan kredi yanmaz, aylık hak bitince kullanılır.
            </p>
          ) : null}

          {access.kind === "staff" && kapsam && faturaKurumu ? (
            <p className="hint">
              <b>{faturaKurumu}</b> faturaları gösteriliyor. Diğer kurumunuzunkiler için profil menüsündeki Kurum seçimini değiştirin.
            </p>
          ) : null}
          {kapsam ? <FaturalarBolumu veri={faturalama} kurum={kapsam.tur === "kurum"} /> : null}
        </article>

        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>Asistan kredisi</h2>
              <p>{bireysel ? "Bu ayki hakkınız ve satın aldığınız bakiye" : "Kurumunuzun bu ayki kredisi"}</p>
            </div>
          </header>

          {/*
            Sayı üretilemiyorsa (okunamadı, hak bildirilmemiş, iç ekip) kutu
            çizilmiyor: "0 kredi" yazmak, hakkı olmayanla ölçümü okunamayanı
            aynı göstermek olurdu (lib/ai/kredi-ozeti.ts).
          */}
          {kredi.goster ? (
            <>
              <div className="kaynakca-puan" data-tone={kredi.tukendi ? "danger" : kredi.ekBakiye === 0 && kredi.oran >= 80 ? "warning" : "success"}>
                <b>{sayi(kredi.toplam)}</b>
                <span>kredi kullanılabilir</span>
              </div>
              {/* Yerleşik <progress>: satır içi genişlik stili yazmadan dolu oranı gösterir. */}
              <progress
                className="kredi-cubugu"
                max={Math.max(1, kredi.aylikLimit)}
                value={kredi.aylikKalan}
                aria-label={`Aylık hakkın ${sayi(kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} kredisi kaldı`}
              />
              <ul className="gb-liste">
                <li className="gb-satir">
                  <span className="gb-satir-govde">
                    <b>Bu ay kalan hak</b>
                    <small>Ayın başında {sayi(kredi.aylikLimit)} krediye yenilenir</small>
                  </span>
                  <span className="gb-zaman">
                    {sayi(kredi.aylikKalan)} / {sayi(kredi.aylikLimit)}
                  </span>
                </li>
                <li className="gb-satir">
                  <span className="gb-satir-govde">
                    <b>Satın alınan bakiye</b>
                    <small>Yanmaz; aylık hak bitince kullanılır</small>
                  </span>
                  <span className="gb-zaman">{sayi(kredi.ekBakiye)}</span>
                </li>
              </ul>
              {kredi.tukendi ? (
                <p className="tone-text text-sm" data-tone="danger">
                  Krediniz bitti; asistan yeni çalışma yapmıyor.{" "}
                  {bireysel ? "Aşağıdan ek kredi alabilir ya da ayın başını bekleyebilirsiniz." : "Kurum yöneticiniz ek kredi alabilir."}
                </p>
              ) : null}
            </>
          ) : (
            <p className="gb-bos">
              {access.kind === "staff"
                ? "İç ekip hesapları asistan kredisine tabi değil."
                : "Kredi durumu şu an okunamadı. Asistanı kullanmaya devam edebilirsiniz; sayfayı sonra yenileyin."}
            </p>
          )}

          {access.kind === "organization" ? (
            <p className="hint">
              Kurumunuzun kredisini kurum yöneticiniz{" "}
              <a href={KREDI_SATIN_ALMA_ADRESI} target="_blank" rel="noreferrer noopener">
                ArvoOS panelinden <ExternalLink size={12} aria-hidden="true" />
              </a>{" "}
              alır.
            </p>
          ) : null}

          {access.kind === "individual" ? (
            <>
              <h3 className="calisma-durum-alt">Ek kredi paketleri</h3>
              {paketler.length ? (
                <div className="kredi-paketleri">
                  {paketler.map((paket, i) => {
                    const birim = binKrediFiyati(paket);
                    const indirim = enUcuzBirim > birim ? Math.round((1 - birim / enUcuzBirim) * 100) : 0;
                    return (
                      <form action={krediSatinAl} key={paket.kod} className="kredi-paketi">
                        <input type="hidden" name="paket" value={paket.kod} />
                        <b>{paket.ad}</b>
                        <span className="kredi-paketi-fiyat">{paketFiyati(paket.fiyat)}</span>
                        <small>
                          1.000 kredi {paketFiyati(birim)}
                          {indirim ? ` · %${indirim} avantajlı` : ""}
                        </small>
                        <OdemeButonu birincil={i === 0} etiket="Satın al" />
                      </form>
                    );
                  })}
                </div>
              ) : (
                <p className="muted text-sm">
                  Kredi paketleri şu an yüklenemedi. Ödeme sistemine ulaşılamıyor olabilir; biraz sonra sayfayı
                  yenileyin.
                </p>
              )}
              <p className="hint">
                Ödeme ArvoOS üzerinden kartla alınır (PayTR). Ödeme onaylanınca kredi birkaç dakika içinde bakiyenize
                eklenir; aboneliğiniz kapalıyken kredi satılmaz.
              </p>
            </>
          ) : null}

          {bireysel && sonHareketler.length ? (
            <>
              <h3 className="calisma-durum-alt">
                <History size={14} aria-hidden="true" /> Son hareketler
              </h3>
              <ul className="gb-liste">
                {sonHareketler.map((h, i) => (
                  <li key={i} className="gb-satir">
                    <span className="gb-satir-govde">
                      <b>{HAREKET[h.tur]?.ad ?? h.tur}</b>
                      <small>{trTarihSaat(h.created_at)}</small>
                    </span>
                    <span className="gb-zaman">
                      {HAREKET[h.tur]?.isaret ?? ""}
                      {sayi(Number(h.kredi))} kredi
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </article>
      </section>
    </main>
  );
}
