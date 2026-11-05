import Link from "next/link";
import type { Metadata } from "next";
import { aktifDil, ceviri, tarihler } from "@/lib/dil-sunucu";
import { redirect } from "next/navigation";
import { Cpu, Download, FileCheck2, Keyboard, KeyRound, Languages, LogOut, Palette, Save, Trash2 } from "lucide-react";
import { getAuthContext } from "@/lib/auth-guards";
import { ADMIN_ROLES, ROLE_LABELS, STAFF_ROLES } from "@/lib/project-labels";
import { sayfaGorunumu } from "@/lib/onizleme-sunucu";
import PanelDrawer from "../_components/panel-drawer";
import { aiKurulumu, aiKurulumSorunu } from "@/lib/ai/saglayici";
import { krediOzeti, type KrediSatiri } from "@/lib/ai/kredi-ozeti";
import { getAccessState } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import LicenseCard from "../_components/license-card";
import SayfaBasligi from "../_components/sayfa/sayfa-basligi";
import Bolum from "../_components/sayfa/bolum";
import TemaSecimi from "./tema-secimi";
import KrediOzetKarti from "../_components/kredi-ozet-karti";
import { licenseSummary } from "@/lib/license-summary";
import { changePassword, digerOturumlariKapat } from "@/app/actions/auth";
import { KisayolListesi } from "../editor/[id]/write/shortcuts-dialog";
import { updateMyProfile } from "@/app/actions/profile";
import DilSecici from "@/app/_components/dil-secici";
import ActionForm from "../action-form";
import PasswordForm from "./password-form";
import HesapSilmeFormu from "./hesap-silme-formu";
import { hesapSilmeTalebi } from "@/app/actions/hesap";
import { sozlesmeOnaylarim } from "@/lib/sozlesme/onay-durumu";
import SozlesmeKopyasi from "./sozlesme-kopyasi";
import { konumYazisi } from "@/lib/sozlesme/konum";
import { kullanimSozlesmesi, SOZLESME_SURUMU } from "@/lib/sozlesme/kullanim-sozlesmesi";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Ayarlar", en: "Settings" }) };
}

export default async function SettingsPage() {
  const t = await ceviri();
  const dil = await aktifDil();
  const ctx = await getAuthContext();
  if (!ctx) redirect("/");
  const [sozlesmeOnaylari, { tarihSaat }] = await Promise.all([sozlesmeOnaylarim(ctx.user.id), tarihler()]);
  const sozlesmeMetni = kullanimSozlesmesi(dil);

  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("full_name")
    .eq("id", ctx.user.id)
    .maybeSingle();

  let organizationName: string | null = null;
  if (ctx.organizationId) {
    const { data: organization } = await ctx.supabase
      .from("organizations")
      .select("name")
      .eq("id", ctx.organizationId)
      .maybeSingle();
    organizationName = organization?.name ?? null;
  }

  /*
    Etkin asistan sunucusu. Ortam değişkenleri girildiği halde hangisinin
    kullanıldığı hiçbir yerde görünmüyordu: "Claude'a geçtim" denip
    isteklerin OpenAI'ye gitmeye devam ettiği bir gün yaşandı ve anlamanın
    tek yolu ai_assistant_runs tablosuna SQL atmaktı. Yeni bir değişken
    dağıtım olmadan etkili olmuyor; burası onu da görünür kılıyor.

    Yalnızca iç ekibe: müşteriye hangi modeli kullandığımız bilgisi
    verilmiyor (AGENTS.md: "Ürün arayüzünde sağlayıcının adı hiç geçmez").
    ANAHTAR GÖSTERİLMİYOR, yalnızca tanımlı olup olmadığı.
  */
  /*
    AI kredisi: kullanıcı durumu bugüne kadar yalnızca İKİ anda
    öğreniyordu — %80'de çalışmanın ortasında bir uyarıyla ya da hak
    bitince asistan durduğunda. İkisi de iş üstünde, ikisi de geç.
    Burada sakin sakin bakılabiliyor.

    ai_kredi_durumum() parametre almıyor; yalnızca çağıranın kendi
    kurumunun durumunu döndürüyor (ArvoLab migration 20260924100013).
    Okunamazsa kart hiç çizilmiyor: "0 kredi" yazmak, hakkı olmayanla
    ölçümü kopmuş olanı aynı göstermek olurdu.
  */
  const { data: krediSatiri, error: krediHatasi } = await ctx.supabase.rpc("ai_kredi_durumum").maybeSingle();
  if (krediHatasi) console.error("[ayarlar] kredi durumu okunamadı:", krediHatasi.message);
  const kredi = krediOzeti((krediSatiri as KrediSatiri | null) ?? null);
  const bireyselKredi = Boolean((krediSatiri as KrediSatiri | null)?.bireysel);

  /*
    Abonelik durumu bugüne kadar YALNIZCA ana sayfada duruyordu. Bireysel
    abone "planım ne, ne zaman bitiyor, nereden ödeyeceğim" sorusuyla
    Ayarlar'a geliyor ve orada aboneliğine dair tek satır bulamıyordu.
    Kart aynı kart (tek kaynak); ana sayfadan kaldırılmadı, çünkü orada
    süresi dolan kişiye ilk uyarıyı o veriyor.
  */
  const access = await getAccessState(await getCurrentProfile());
  // Abonelik bölümü kart da kredi de yoksa hiç çizilmez (LicenseCard aynı özeti kendi içinde de hesaplıyor).
  const licenseVar = licenseSummary(access, new Date(), dil) !== null;

  const icEkip = ctx.role !== null && ADMIN_ROLES.includes(ctx.role);
  const kurulum = icEkip ? aiKurulumu() : null;
  const sunucu = kurulum ? (() => { try { return new URL(kurulum.tabanUrl).host; } catch { return kurulum.tabanUrl; } })() : null;

  /*
    Düzen geçmişi: 26.10.2026'ya kadar altı kart alt altaydı, sonra iki
    kart yan yana; 4.4'te tek yüzeyde adlı bölümler (aşağıda, return'ün
    üstündeki not). Her satır tek satır, işlemi pencerede; geri dönüşü
    olmayan hesap silme hep en sonda.

    Asistan sunucusu bilgisi PERSONEL GÖRÜNÜMÜNDE: iç ekip öğrenci
    düzenini önizlerken görmemeli (lib/onizleme.ts).
  */
  const gorunum = await sayfaGorunumu({
    rol: ctx.role ?? undefined,
    personelRolu: ctx.role ? STAFF_ROLES.includes(ctx.role) : false,
    kurumVar: Boolean(ctx.organizationId),
  });

  /*
    Açıklama role göre. Eskiden herkese "Rol ve kurum değişiklikleri
    Sistem Yöneticisi tarafından yapılır" yazıyordu: bireysel öğrencinin
    ne rolü ne kurumu değişir, iç ekibe kendi işini anlatıyordu.
  */
  const aciklama = icEkip
    ? t({ tr: "Hesabınız ve kurulum bilgileri.", en: "Your account and setup information." })
    : ctx.organizationId
      ? t({
          tr: `Hesabınız ve güvenliğiniz. Rolünüz ve kurum bağınız ${organizationName ?? "kurumunuz"} tarafından belirlenir; değişiklik için kurum yöneticinize başvurun.`,
          en: `Your account and security. Your role and institution link are set by ${organizationName ?? "your institution"}; contact your institution administrator to change them.`,
        })
      : t({ tr: "Hesabınız, aboneliğiniz ve verileriniz.", en: "Your account, subscription and data." });

  /*
    SIGNATURE OS 4.4 (05.11.2026): TEK YÜZEY, ADLI BÖLÜMLER. Eskiden iki
    kart yan yanaydı ("Hesabım" ve "Güvenlik ve veriler"); ikincisi
    şifreden klavye kısayollarına, kredi bilgisinden sözleşmeye kadar
    birbiriyle ilgisiz yedi satırı taşıyordu ve kartların boyu eşit
    olmadığı için sol kartın altı boş kalıyordu. Şimdi aynı satırlar
    konularına göre bölümlerde: Profil, Tercihler, Abonelik ve kredi,
    Güvenlik, Veriler ve gizlilik, (iç ekip için) Kurulum ve en sonda
    Hesap. Masaüstünde soldaki dizin bölümlere atlatır. Hiçbir işlem,
    form ya da okuma değişmedi; yalnızca yerleri.
  */
  const bolumler: { id: string; ad: string }[] = [
    { id: "ayar-profil", ad: t({ tr: "Profil", en: "Profile" }) },
    { id: "ayar-tercihler", ad: t({ tr: "Tercihler", en: "Preferences" }) },
    ...(kredi.goster || licenseVar ? [{ id: "ayar-abonelik", ad: t({ tr: "Abonelik ve kredi", en: "Subscription and credits" }) }] : []),
    { id: "ayar-guvenlik", ad: t({ tr: "Güvenlik", en: "Security" }) },
    { id: "ayar-veriler", ad: t({ tr: "Veriler ve gizlilik", en: "Data and privacy" }) },
    ...(icEkip && gorunum.personel && kurulum ? [{ id: "ayar-kurulum", ad: t({ tr: "Kurulum", en: "Setup" }) }] : []),
    ...(!icEkip ? [{ id: "ayar-hesap", ad: t({ tr: "Hesap", en: "Account" }) }] : []),
  ];

  return (
    <main className="dashboard-page ayarlar-sayfa">
      <SayfaBasligi baslik={t({ tr: "Ayarlar", en: "Settings" })} aciklama={aciklama} />

      <div className="ayarlar-govde">
        <nav className="ayarlar-dizin" aria-label={t({ tr: "Ayar bölümleri", en: "Settings sections" })}>
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
            id="ayar-profil"
            duzey={2}
            sinif="ayar-bolum"
            baslik={t({ tr: "Profil", en: "Profile" })}
            aciklama={t({ tr: "Ad soyadınız kapak sayfasında ve ekip listesinde kullanılır.", en: "Your full name is used on the cover page and in the team list." })}
          >
            <div className="ayar-bolum-icerik">
              <dl className="ayar-bilgiler">
                <div>
                  <dt>{t({ tr: "E-posta", en: "Email" })}</dt>
                  <dd>{ctx.user.email ?? "—"}</dd>
                </div>
                <div>
                  <dt>{t({ tr: "Rol", en: "Role" })}</dt>
                  <dd>{ctx.role ? t(ROLE_LABELS[ctx.role]) : "—"}</dd>
                </div>
                <div>
                  <dt>{t({ tr: "Kurum", en: "Institution" })}</dt>
                  <dd>{organizationName ?? t({ tr: "Kuruma bağlı değil", en: "Not linked to an institution" })}</dd>
                </div>
              </dl>

              <ActionForm action={updateMyProfile} className="ayar-ad-formu" successMessage={t({ tr: "Profiliniz güncellendi.", en: "Your profile has been updated." })}>
                <label>
                  <span>{t({ tr: "Ad soyad", en: "Full name" })}</span>
                  <input name="fullName" type="text" className="field-control" defaultValue={profile?.full_name ?? ""} minLength={2} maxLength={120} required autoComplete="name" />
                </label>
                <button type="submit" className="projects-primary-button">
                  <Save size={15} aria-hidden="true" />
                  {t({ tr: "Kaydet", en: "Save" })}
                </button>
              </ActionForm>
            </div>
          </Bolum>

          <Bolum
            id="ayar-tercihler"
            duzey={2}
            sinif="ayar-bolum"
            baslik={t({ tr: "Tercihler", en: "Preferences" })}
            aciklama={t({ tr: "Arayüzün dili ve görünümü.", en: "Interface language and appearance." })}
          >
            <ul className="ayar-listesi ayar-bolum-icerik">
              {/*
                ARAYÜZ DİLİ (28.10.2026, kurum sahibinin isteği: Türk öğrenciler
                İngilizce kullanmak isteyebilir). Başlık İKİ dilde yazılı: yanlış
                dilde açılmış bir paneli okuyamayan kişi de ayarı bulabilmeli.
                Tercih profile yazılıyor; başka cihazda girişte de geçerli.
              */}
              <li className="ayar-satir ayar-satir-secim">
                <Languages size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b lang="tr">
                    Dil · <span lang="en">Language</span>
                  </b>
                  <small>
                    {t({
                      tr: "Hesabınıza kaydedilir; diğer cihazlarınızda ve size gönderilen e-postalarda da geçerli olur.",
                      en: "Saved to your account; applies on your other devices and in the emails we send you.",
                    })}
                  </small>
                </span>
                <DilSecici sinif="ayar-dil" />
              </li>
              {/* Görünüm bu cihazda saklanır (tema düğmesiyle aynı tercih, lib/tema.ts). */}
              <li className="ayar-satir ayar-satir-secim">
                <Palette size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b>{t({ tr: "Görünüm", en: "Appearance" })}</b>
                  <small>
                    {t({
                      tr: "Bu cihazda geçerli. Sistem, cihazınızın açık/koyu ayarını izler.",
                      en: "Applies on this device. System follows your device's light/dark setting.",
                    })}
                  </small>
                </span>
                <TemaSecimi />
              </li>
              {/*
                Kısayollar editörde Yardım menüsünde de var; burada da, çünkü
                kullanıcı "Word'deki tuş burada ne" sorusuyla Ayarlar'a
                geliyor. Liste editördekinin AYNISI (KisayolListesi).
              */}
              <li className="ayar-satir">
                <Keyboard size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b>{t({ tr: "Klavye kısayolları", en: "Keyboard shortcuts" })}</b>
                  <small>
                    {t({
                      tr: "Editörde Word'deki tuşlar aynı işi yapar: hizalama, punto, başlık, dipnot, girinti.",
                      en: "In the editor, Word's shortcuts do the same thing: alignment, font size, headings, footnotes, indentation.",
                    })}
                  </small>
                </span>
                <PanelDrawer
                  triggerLabel={t({ tr: "Göster", en: "Show" })}
                  triggerClassName="projects-filter-button button-compact"
                  kicker={t({ tr: "Yardım", en: "Help" })}
                  title={t({ tr: "Klavye kısayolları", en: "Keyboard shortcuts" })}
                  description={t({
                    tr: "Word'deki tuşlar burada da aynı işi yapar. Fareye uzanmadan daha hızlı yazın.",
                    en: "Word's shortcuts work the same way here. Write faster without reaching for the mouse.",
                  })}
                >
                  <KisayolListesi />
                </PanelDrawer>
              </li>
            </ul>
          </Bolum>

          {/*
            ABONELİK VE KREDİ. Abonelik kartı ana sayfadakiyle aynı (tek
            kaynak): bireysel abone "planım ne, ne zaman bitiyor, nereden
            ödeyeceğim" sorusuyla buraya geliyor. Kredi okunamazsa satır hiç
            çizilmiyor: "0 kredi" yazmak, hakkı olmayanla ölçümü kopmuş olanı
            aynı göstermek olurdu. Eskiden kredi tek uzun cümleydi (dört sayı
            art arda); şimdi kalan hak bir ölçü çubuğunda, ayrıntı altında.
          */}
          {kredi.goster || licenseVar ? (
            <Bolum
              id="ayar-abonelik"
              duzey={2}
              sinif="ayar-bolum"
              baslik={t({ tr: "Abonelik ve kredi", en: "Subscription and credits" })}
              aciklama={t({ tr: "Planınız ve asistan krediniz.", en: "Your plan and assistant credits." })}
              eylem={
                <Link className="projects-filter-button button-compact" href="/dashboard/abonelik">
                  {t({ tr: "Ayrıntı", en: "Details" })}
                </Link>
              }
            >
              <div className="ayar-bolum-icerik">
                <LicenseCard access={access} />
                {kredi.goster ? (
                  <KrediOzetKarti kredi={kredi}>
                    {/* Bireysel abone krediyi Abonelik ve kredi sayfasından alır; kurum üyesi için kurum yöneticisi aynı sayfadan (28.10.2026'ya kadar ArvoOS panelindendi). */}
                    {kredi.tukendi || (kredi.ekBakiye === 0 && kredi.oran >= 80) ? (
                      <p className="tone-text text-sm" data-tone={kredi.tukendi ? "danger" : "warning"}>
                        {kredi.tukendi
                          ? t({ tr: "Krediniz bitti; asistan yeni çalışma yapmıyor. ", en: "You are out of credits; the assistant will not run new checks. " })
                          : t({ tr: `Aylık hakkınızın %${kredi.oran}'i kullanıldı. `, en: `${kredi.oran}% of your monthly allowance is used. ` })}
                        {bireyselKredi
                          ? t({ tr: "Ek kredi için “Ayrıntı”ya gidin.", en: "Go to “Details” for more credits." })
                          : t({ tr: "Kurum yöneticiniz Abonelik ve kredi sayfasından ek kredi satın alabilir.", en: "Your institution administrator can buy more credits on the Subscription and credits page." })}
                      </p>
                    ) : null}
                  </KrediOzetKarti>
                ) : null}
              </div>
            </Bolum>
          ) : null}

          <Bolum
            id="ayar-guvenlik"
            duzey={2}
            sinif="ayar-bolum"
            baslik={t({ tr: "Güvenlik", en: "Security" })}
            aciklama={t({ tr: "Şifreniz ve açık oturumlarınız.", en: "Your password and open sessions." })}
          >
            <ul className="ayar-listesi ayar-bolum-icerik">
              <li className="ayar-satir">
                <KeyRound size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b>{t({ tr: "Şifre", en: "Password" })}</b>
                  <small>
                    {t({
                      tr: "En az 8 karakter. Değiştirdikten sonra diğer cihazlardaki oturumları aşağıdan kapatabilirsiniz.",
                      en: "At least 8 characters. After changing it, you can sign out other devices below.",
                    })}
                  </small>
                </span>
                <PanelDrawer
                  triggerLabel={t({ tr: "Değiştir", en: "Change" })}
                  triggerClassName="projects-filter-button button-compact"
                  kicker={t({ tr: "Güvenlik", en: "Security" })}
                  title={t({ tr: "Şifrenizi değiştirin", en: "Change your password" })}
                  description={t({ tr: "Yeni şifreniz en az 8 karakter olmalı.", en: "Your new password must be at least 8 characters." })}
                >
                  <PasswordForm action={changePassword} variant="panel" submitLabel={t({ tr: "Şifreyi güncelle", en: "Update password" })} />
                </PanelDrawer>
              </li>

              <li className="ayar-satir">
                <LogOut size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b>{t({ tr: "Diğer cihazlar", en: "Other devices" })}</b>
                  <small>
                    {t({
                      tr: "Hesabınız aynı anda tek cihazda açık kalır; başka bir cihazdan giriş yapılınca öncekiler kendiliğinden kapanır. Şifrenizi değiştirdiyseniz bunu şimdi yapın.",
                      en: "Your account stays signed in on one device at a time; signing in elsewhere signs out the others. If you changed your password, do this now.",
                    })}
                  </small>
                </span>
                <ActionForm
                  action={digerOturumlariKapat}
                  confirmMessage={t({ tr: "Bu cihaz dışındaki bütün oturumlar kapatılsın mı?", en: "Sign out all sessions except this device?" })}
                  successMessage={t({ tr: "Diğer cihazlardaki oturumlar kapatıldı.", en: "Sessions on other devices have been signed out." })}
                >
                  <button type="submit" className="projects-filter-button button-compact">
                    {t({ tr: "Kapat", en: "Sign out" })}
                  </button>
                </ActionForm>
              </li>
            </ul>
          </Bolum>

          <Bolum
            id="ayar-veriler"
            duzey={2}
            sinif="ayar-bolum"
            baslik={t({ tr: "Veriler ve gizlilik", en: "Data and privacy" })}
            aciklama={t({ tr: "Verilerinizin bir kopyası ve sözleşme kayıtlarınız.", en: "A copy of your data and your agreement records." })}
          >
            <ul className="ayar-listesi ayar-bolum-icerik">
              {/*
                Verinin taşınabilir olması hem KVKK'nın istediği bir hak hem güven
                meselesi. İndirme bir ROTA (sunucu eylemi değil): tez metinleri
                megabaytlarca olabiliyor ve sunucu eyleminin yanıt sınırı aşılamaz.
              */}
              <li className="ayar-satir">
                <Download size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b>{t({ tr: "Verilerim", en: "My data" })}</b>
                  <small>
                    {t({
                      tr: "Çalışmalarınız, metinleriniz, kaynaklarınız ve denetim kayıtlarınız tek dosyada (JSON). Word çıktısı için editördeki dışa aktarmayı kullanın.",
                      en: "Your projects, texts, sources and check records in a single file (JSON). For Word output, use the export in the editor.",
                    })}
                  </small>
                </span>
                <a className="projects-filter-button button-compact" href="/api/hesabim/verilerim" download>
                  {t({ tr: "İndir", en: "Download" })}
                </a>
              </li>

              {/*
                KULLANIM SÖZLEŞMESİ: onaylanan sürümler ve kayıt bilgileri
                (lib/sozlesme). Kullanıcı neyi, ne zaman, hangi cihazdan
                onayladığını kendisi de görebilmeli; kopyası e-postasında.
              */}
              <li className="ayar-satir">
                <FileCheck2 size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b>{t({ tr: "Kullanım Sözleşmesi", en: "Terms of Use" })}</b>
                  <small>
                    {sozlesmeOnaylari.okunamadi
                      ? t({ tr: "Onay kayıtlarınız şu anda okunamadı.", en: "Your approval records could not be loaded right now." })
                      : sozlesmeOnaylari.satirlar.length
                        ? t({
                            tr: `Son onay: ${tarihSaat(sozlesmeOnaylari.satirlar[0].onaylandi)} · Sürüm ${sozlesmeOnaylari.satirlar[0].surum}`,
                            en: `Last approved: ${tarihSaat(sozlesmeOnaylari.satirlar[0].onaylandi)} · Version ${sozlesmeOnaylari.satirlar[0].surum}`,
                          })
                        : t({ tr: "Henüz onay kaydı yok.", en: "No approval record yet." })}
                  </small>
                </span>
                <PanelDrawer
                  triggerLabel={t({ tr: "Görüntüle", en: "View" })}
                  triggerClassName="projects-filter-button button-compact"
                  kicker={t({ tr: "Sözleşme", en: "Agreement" })}
                  title={sozlesmeMetni.baslik}
                  description={sozlesmeMetni.giris}
                >
                  <h3 className="section-title">{t({ tr: "Onay kayıtlarınız", en: "Your approval records" })}</h3>
                  {sozlesmeOnaylari.satirlar.some((o) => o.surum === SOZLESME_SURUMU) ? <SozlesmeKopyasi /> : null}
                  {sozlesmeOnaylari.satirlar.length ? (
                    <ul className="sozlesme-onaylarim">
                      {sozlesmeOnaylari.satirlar.map((o) => (
                        <li key={o.id}>
                          <b>{tarihSaat(o.onaylandi)}</b> ·{" "}
                          {o.olay === "odeme_sonrasi"
                            ? t({ tr: "Ödemeden sonra", en: "After payment" })
                            : o.olay === "kayit"
                              ? t({ tr: "Kayıt sırasında", en: "At sign-up" })
                              : t({ tr: "Giriş", en: "Sign-in" })}
                          <dl>
                            <dt>{t({ tr: "Sürüm", en: "Version" })}</dt>
                            <dd>{o.surum} ({o.dil.toUpperCase()})</dd>
                            <dt>{t({ tr: "IP adresi", en: "IP address" })}</dt>
                            <dd>{o.ip ?? "—"}</dd>
                            {konumYazisi({ ulke: o.ulke ?? null, bolge: o.bolge ?? null, sehir: o.sehir ?? null, enlem: o.enlem ?? null, boylam: o.boylam ?? null }) ? (
                              <>
                                <dt>{t({ tr: "Yaklaşık konum", en: "Approximate location" })}</dt>
                                <dd>{konumYazisi({ ulke: o.ulke ?? null, bolge: o.bolge ?? null, sehir: o.sehir ?? null, enlem: o.enlem ?? null, boylam: o.boylam ?? null })}</dd>
                              </>
                            ) : null}
                            <dt>{t({ tr: "Cihaz", en: "Device" })}</dt>
                            <dd>{o.kullanici_araci ?? "—"}</dd>
                            {o.odeme_referansi ? (
                              <>
                                <dt>{t({ tr: "Ödeme", en: "Payment" })}</dt>
                                <dd>{o.odeme_referansi}</dd>
                              </>
                            ) : null}
                            <dt>{t({ tr: "Metin özeti", en: "Text digest" })}</dt>
                            <dd>{o.metin_ozeti}</dd>
                          </dl>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted text-sm">{t({ tr: "Henüz onay kaydı yok.", en: "No approval record yet." })}</p>
                  )}
                  <h3 className="section-title">{t({ tr: "Yürürlükteki metin", en: "Current text" })}</h3>
                  {sozlesmeMetni.bolumler.map((b) => (
                    <section key={b.baslik}>
                      <h4>{b.baslik}</h4>
                      {b.paragraflar.map((p) => (
                        <p key={p.slice(0, 40)} className="text-sm">{p}</p>
                      ))}
                    </section>
                  ))}
                </PanelDrawer>
              </li>
            </ul>
          </Bolum>

          {/*
            Etkin asistan sunucusu: yalnızca iç ekip, personel görünümünde.
            Müşteriye hangi modeli kullandığımız söylenmez; ANAHTAR
            GÖSTERİLMİYOR, yalnızca durum. Durum yerine SEBEP yazılıyor:
            sorun anahtar değil adres de olabiliyor.
          */}
          {icEkip && gorunum.personel && kurulum ? (
            <Bolum
              id="ayar-kurulum"
              duzey={2}
              sinif="ayar-bolum"
              baslik={t({ tr: "Kurulum", en: "Setup" })}
              aciklama={t({ tr: "Yalnızca iç ekip görür.", en: "Visible to the internal team only." })}
            >
              <ul className="ayar-listesi ayar-bolum-icerik">
                <li className="ayar-satir">
                  <Cpu size={18} aria-hidden="true" />
                  <span className="ayar-govde">
                    <b>{t({ tr: "Asistan sunucusu", en: "Assistant server" })}</b>
                    <small>
                      {/* Sorun metni kendi noktasıyla bitiyor; eskiden ardına bir nokta daha ekleniyordu (".."). */}
                      {sunucu} · {kurulum.model} · {(aiKurulumSorunu(dil) ?? t({ tr: "asistan açık", en: "assistant enabled" })).replace(/\.$/, "")}.{" "}
                      {t({ tr: "Değişken eklendikten sonra yeniden dağıtım gerekir.", en: "A redeploy is required after adding a variable." })}
                    </small>
                  </span>
                </li>
              </ul>
            </Bolum>
          ) : null}

          {/*
            HESAP SİLME EN SONDA ve iç ekibe gösterilmiyor (founder ya da
            system_admin hesabı kurulumu da yönetiyor; sunucu da reddediyor).
          */}
          {!icEkip ? (
            <Bolum
              id="ayar-hesap"
              duzey={2}
              sinif="ayar-bolum ayar-bolum-tehlike"
              baslik={t({ tr: "Hesap", en: "Account" })}
              aciklama={t({ tr: "Geri dönüşü olmayan işlemler.", en: "Actions that cannot be undone." })}
            >
              <ul className="ayar-listesi ayar-bolum-icerik">
                <li className="ayar-satir" data-tone="danger">
                  <Trash2 size={18} aria-hidden="true" />
                  <span className="ayar-govde">
                    <b>{t({ tr: "Hesabımı sil", en: "Delete my account" })}</b>
                    <small>
                      {t({
                        tr: "Hesabınız ve bütün verileriniz kalıcı silinir. Silme hemen olmaz; vazgeçmek için süreniz olur.",
                        en: "Your account and all your data are permanently deleted. Deletion is not immediate; you have time to change your mind.",
                      })}
                    </small>
                  </span>
                  <PanelDrawer
                    triggerLabel={t({ tr: "Sil", en: "Delete" })}
                    triggerClassName="projects-filter-button button-compact button-danger"
                    kicker={t({ tr: "Hesap", en: "Account" })}
                    title={t({ tr: "Hesabımı sil", en: "Delete my account" })}
                    description={t({
                      tr: "Hesabınızı ve ArvoLab'daki bütün verilerinizi kalıcı olarak silme talebi. Silme hemen olmaz; vazgeçmek için süreniz olur.",
                      en: "A request to permanently delete your account and all your data in ArvoLab. Deletion is not immediate; you have time to change your mind.",
                    })}
                  >
                    <HesapSilmeFormu action={hesapSilmeTalebi} eposta={ctx.user.email ?? ""} bireysel={access.kind === "individual"} />
                  </PanelDrawer>
                </li>
              </ul>
            </Bolum>
          ) : null}
        </div>
      </div>
    </main>
  );
}
