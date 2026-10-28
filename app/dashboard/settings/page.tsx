import Link from "next/link";
import type { Metadata } from "next";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { YEREL } from "@/lib/dil";
import { redirect } from "next/navigation";
import { Cpu, Download, Keyboard, KeyRound, LogOut, Save, Sparkles, Trash2 } from "lucide-react";
import { getAuthContext } from "@/lib/auth-guards";
import { ADMIN_ROLES, ROLE_LABELS, STAFF_ROLES } from "@/lib/project-labels";
import { sayfaGorunumu } from "@/lib/onizleme-sunucu";
import PanelDrawer from "../_components/panel-drawer";
import { aiKurulumu, aiKurulumSorunu } from "@/lib/ai/saglayici";
import { krediOzeti, type KrediSatiri } from "@/lib/ai/kredi-ozeti";
import { KREDI_SATIN_ALMA_ADRESI } from "@/lib/ai/kredi-karari";
import { getAccessState } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import LicenseCard from "../_components/license-card";
import { changePassword, digerOturumlariKapat } from "@/app/actions/auth";
import { KisayolListesi } from "../editor/[id]/write/shortcuts-dialog";
import { updateMyProfile } from "@/app/actions/profile";
import DilSecici from "@/app/_components/dil-secici";
import ActionForm from "../action-form";
import PasswordForm from "./password-form";
import HesapSilmeFormu from "./hesap-silme-formu";
import { hesapSilmeTalebi } from "@/app/actions/hesap";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Ayarlar", en: "Settings" }) };
}

export default async function SettingsPage() {
  const t = await ceviri();
  const dil = await aktifDil();
  const sayi = (deger: number) => new Intl.NumberFormat(YEREL[dil]).format(deger);
  const ctx = await getAuthContext();
  if (!ctx) redirect("/");

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

  const icEkip = ctx.role !== null && ADMIN_ROLES.includes(ctx.role);
  const kurulum = icEkip ? aiKurulumu() : null;
  const sunucu = kurulum ? (() => { try { return new URL(kurulum.tabanUrl).host; } catch { return kurulum.tabanUrl; } })() : null;

  /*
    TEK EKRAN, İKİ KART (26.10.2026, diğer modüllerle aynı düzen). Eskiden
    altı kart alt alta duruyordu; kredisine bakmaya gelen kullanıcı şifre
    ve hesap silme bölümlerinin arasından kaydırıyordu. Solda kim olduğu
    ve aboneliği, sağda hesabıyla yapabildikleri: her biri tek satır,
    işlemi pencerede. Geri dönüşü olmayan hesap silme yine en sonda.

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

  return (
    <main className="dashboard-page gb gb-tek-ekran">
      <section className="projects-header">
        <div>
          <h1>{t({ tr: "Ayarlar", en: "Settings" })}</h1>
          <p>{aciklama}</p>
        </div>
      </section>

      <section className="gb-sutunlar kaynaklar-ikili" aria-label={t({ tr: "Ayarlar", en: "Settings" })}>
        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Hesabım", en: "My account" })}</h2>
              <p>{t({ tr: "Ad soyadınız kapak sayfasında ve ekip listesinde kullanılır.", en: "Your full name is used on the cover page and in the team list." })}</p>
            </div>
          </header>

          <dl className="settings-facts">
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
              <input name="fullName" type="text" className="field-control" defaultValue={profile?.full_name ?? ""} minLength={2} maxLength={120} required />
            </label>
            <button type="submit" className="projects-primary-button button-compact">
              <Save size={15} aria-hidden="true" />
              {t({ tr: "Kaydet", en: "Save" })}
            </button>
          </ActionForm>

          {/*
            ARAYÜZ DİLİ (28.10.2026, kurum sahibinin isteği: Türk öğrenciler
            İngilizce kullanmak isteyebilir). Başlık İKİ dilde yazılı: yanlış
            dilde açılmış bir paneli okuyamayan kişi de ayarı bulabilmeli.
            Tercih profile yazılıyor; başka cihazda girişte de geçerli.
          */}
          <div className="ayar-dil-bolumu">
            <span className="ayar-dil-baslik" lang="tr">
              Dil · <span lang="en">Language</span>
            </span>
            <DilSecici sinif="ayar-dil" />
            <small className="muted">
              {t({
                tr: "Seçiminiz hesabınıza kaydedilir; diğer cihazlarınızda ve size gönderilen e-postalarda da geçerli olur.",
                en: "Your choice is saved to your account and applies on your other devices and in the emails we send you.",
              })}
            </small>
          </div>

          {/*
            Abonelik kartı ana sayfadakiyle aynı (tek kaynak). Bireysel abone
            "planım ne, ne zaman bitiyor, nereden ödeyeceğim" sorusuyla buraya
            geliyor.
          */}
          <LicenseCard access={access} />
        </article>

        <article className="gb-kart gb-sutun kayan-kart">
          <header className="gb-kart-bas">
            <div>
              <h2>{t({ tr: "Güvenlik ve veriler", en: "Security and data" })}</h2>
              <p>{t({ tr: "Şifreniz, verilerinizin bir kopyası ve asistan kullanımınız.", en: "Your password, a copy of your data, and your assistant usage." })}</p>
            </div>
          </header>

          <ul className="ayar-listesi">
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
                    tr: "Bu cihaz dışındaki bütün oturumları kapatır. Ortak bir bilgisayarda açık unuttuysanız ya da şifrenizi değiştirdiyseniz kullanın.",
                    en: "Signs out every session except this device. Use it if you left yourself signed in on a shared computer or changed your password.",
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
              AI kredisi: kullanıcı durumu yalnızca %80 uyarısında ya da hak
              bitince öğreniyordu. Okunamazsa satır hiç çizilmiyor: "0 kredi"
              yazmak, hakkı olmayanla ölçümü kopmuş olanı aynı göstermek olurdu.
            */}
            {kredi.goster ? (
              <li className="ayar-satir">
                <Sparkles size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b>{t({ tr: "Asistan krediniz", en: "Your assistant credits" })}</b>
                  <small>
                    {t({
                      tr: `Bu ay ${sayi(kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} kredi kaldı · satın alınan bakiye ${sayi(kredi.ekBakiye)} · kullanılabilir ${sayi(kredi.toplam)}. 1 kredi = 1.000 karakter; aylık hak ayın başında yenilenir, satın alınan bakiye yanmaz.`,
                      en: `${sayi(kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} credits left this month · purchased balance ${sayi(kredi.ekBakiye)} · available ${sayi(kredi.toplam)}. 1 credit = 1,000 characters; the monthly allowance renews at the start of each month, and purchased credits never expire.`,
                    })}
                  </small>
                  {/* Bireysel abone krediyi Abonelik ve kredi sayfasından alır; kurum üyesi için yönetici ArvoOS'tan. */}
                  {kredi.tukendi || (kredi.ekBakiye === 0 && kredi.oran >= 80) ? (
                    <small className="tone-text" data-tone={kredi.tukendi ? "danger" : "warning"}>
                      {kredi.tukendi
                        ? t({ tr: "Krediniz bitti; asistan yeni çalışma yapmıyor. ", en: "You are out of credits; the assistant will not run new checks. " })
                        : t({ tr: `Aylık hakkınızın %${kredi.oran}'i kullanıldı. `, en: `${kredi.oran}% of your monthly allowance is used. ` })}
                      {bireyselKredi ? (
                        <>{t({ tr: "Ek kredi için “Ayrıntı”ya gidin.", en: "Go to “Details” for more credits." })}</>
                      ) : (
                        <>
                          {t({ tr: "Kurum yöneticiniz", en: "Your institution administrator can buy more credits from the" })}{" "}
                          <a href={KREDI_SATIN_ALMA_ADRESI} target="_blank" rel="noreferrer noopener">
                            {t({ tr: "ArvoOS panelinden", en: "ArvoOS panel" })}
                          </a>
                          {t({ tr: " ek kredi satın alabilir.", en: "." })}
                        </>
                      )}
                    </small>
                  ) : null}
                </span>
                {/* Ayrıntı, paketler ve son hareketler Abonelik ve kredi sayfasında. */}
                <Link className="projects-filter-button button-compact" href="/dashboard/abonelik">
                  {t({ tr: "Ayrıntı", en: "Details" })}
                </Link>
              </li>
            ) : null}

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

            {/*
              Etkin asistan sunucusu: yalnızca iç ekip, personel görünümünde.
              Müşteriye hangi modeli kullandığımız söylenmez; ANAHTAR
              GÖSTERİLMİYOR, yalnızca durum. Durum yerine SEBEP yazılıyor:
              sorun anahtar değil adres de olabiliyor.
            */}
            {icEkip && gorunum.personel && kurulum ? (
              <li className="ayar-satir">
                <Cpu size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b>{t({ tr: "Asistan sunucusu", en: "Assistant server" })}</b>
                  <small>
                    {sunucu} · {kurulum.model} · {aiKurulumSorunu(dil) ?? t({ tr: "asistan açık", en: "assistant enabled" })}.{" "}
                    {t({ tr: "Değişken eklendikten sonra yeniden dağıtım gerekir.", en: "A redeploy is required after adding a variable." })}
                  </small>
                </span>
              </li>
            ) : null}

            {/*
              HESAP SİLME EN SONDA ve iç ekibe gösterilmiyor (founder ya da
              system_admin hesabı kurulumu da yönetiyor; sunucu da reddediyor).
            */}
            {!icEkip ? (
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
            ) : null}
          </ul>
        </article>
      </section>
    </main>
  );
}
