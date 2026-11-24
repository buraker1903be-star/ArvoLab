"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  Cpu,
  Download,
  FileCheck2,
  Keyboard,
  KeyRound,
  LogOut,
  Mail,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { YEREL } from "@/lib/dil";
import type { AyarlarVerisi } from "@/app/actions/ayarlar";
import { profilimiKaydet } from "@/app/actions/ayarlar";
import { adlarGecerliMi } from "@/lib/profil-adi";
import { kullanimSozlesmesi } from "@/lib/sozlesme/kullanim-sozlesmesi";
import { changePassword, digerOturumlariKapat } from "@/app/actions/auth";
import { hesapSilmeTalebi } from "@/app/actions/hesap";
import PasswordForm from "@/app/dashboard/settings/password-form";
import HesapSilmeFormu from "@/app/dashboard/settings/hesap-silme-formu";
import SozlesmeKopyasi from "@/app/dashboard/settings/sozlesme-kopyasi";
import DilSecici from "@/app/_components/dil-secici";
import { KisayolListesi } from "@/app/dashboard/editor/[id]/write/shortcuts-dialog";
import ActionForm from "@/app/dashboard/action-form";
import { EN_KISA_SIFRE, EN_UZUN_SIFRE } from "@/lib/kimlik-kurallari";
import PanelDrawer from "./panel-drawer";
import { ACTION_SUCCESS_EVENT } from "./toast-events";
import EpostaDegistir from "./eposta-degistir";

/*
  AYARLARIN İÇERİĞİ (24.11.2026).

  Tek bileşen, iki yer: uygulamanın her yerinden açılan Ayarlar penceresi
  (ayarlar-penceresi.tsx) ve doğrudan açılan /dashboard/settings sayfası
  ikisi de burayı çiziyor. İki ayrı ayar ekranı tutulsaydı biri eskirdi —
  nitekim Ayarlar'daki kısayol listesi editördekiyle aynı kalsın diye
  baştan ortak bileşenden geliyordu.

  BEŞ SEKMENİN HEPSİ ÇİZİLİ KALIYOR, etkin olmayanlar `hidden`. Sekme
  değiştirmek bir bileşeni sökseydi Hesap sekmesindeki yarım kalmış form
  her geçişte silinirdi; kaydırma konumu da kaybolurdu.
*/

export type Sekme = "hesap" | "guvenlik" | "tercihler" | "abonelik" | "veriler";

export default function AyarlarIcerik({
  veri,
  sekme,
  sekmeDegis,
  kirliDegis,
}: {
  veri: AyarlarVerisi;
  sekme: Sekme;
  sekmeDegis: (s: Sekme) => void;
  /** Kaydedilmemiş profil taslağı var mı: pencere kapanmadan önce sorulur. */
  kirliDegis?: (kirli: boolean) => void;
}) {
  const t = useCeviri();
  const dil = useDil();
  const sayi = (deger: number) => new Intl.NumberFormat(YEREL[dil]).format(deger);
  const sozlesmeMetni = kullanimSozlesmesi(dil);
  const sekmeKimlik = useId();

  const SEKMELER: { id: Sekme; ad: string }[] = [
    { id: "hesap", ad: t({ tr: "Hesap", en: "Account" }) },
    { id: "guvenlik", ad: t({ tr: "Güvenlik", en: "Security" }) },
    { id: "tercihler", ad: t({ tr: "Tercihler", en: "Preferences" }) },
    { id: "abonelik", ad: t({ tr: "Abonelik", en: "Subscription" }) },
    { id: "veriler", ad: t({ tr: "Veriler", en: "Data" }) },
  ];

  return (
    <div className="ayarlar">
      {/*
        Sekme şeridi telefonda yatay kayıyor (app/styles/ayarlar.css).
        Etkin sekme görünür kalsın diye seçilince kendi görüş alanına
        kaydırılıyor: dar ekranda "Veriler"e geçince şerit başta kalıp
        hangi sekmede olunduğu görünmüyordu.
      */}
      <div className="ayarlar-sekme-serit" role="tablist" aria-label={t({ tr: "Ayarlar bölümleri", en: "Settings sections" })}>
        {SEKMELER.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            id={`${sekmeKimlik}-${s.id}`}
            aria-selected={sekme === s.id}
            aria-controls={`${sekmeKimlik}-panel-${s.id}`}
            className="ayarlar-sekme"
            data-etkin={sekme === s.id || undefined}
            onClick={(olay) => {
              sekmeDegis(s.id);
              olay.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
            }}
          >
            {s.ad}
          </button>
        ))}
      </div>

      <div className="ayarlar-govde">
        <section
          role="tabpanel"
          id={`${sekmeKimlik}-panel-hesap`}
          aria-labelledby={`${sekmeKimlik}-hesap`}
          hidden={sekme !== "hesap"}
          className="ayarlar-panel"
        >
          <HesapSekmesi veri={veri} kirliDegis={kirliDegis} />
        </section>

        <section
          role="tabpanel"
          id={`${sekmeKimlik}-panel-guvenlik`}
          aria-labelledby={`${sekmeKimlik}-guvenlik`}
          hidden={sekme !== "guvenlik"}
          className="ayarlar-panel"
        >
          <ul className="ayar-listesi">
            <li className="ayar-satir">
              <KeyRound size={18} aria-hidden="true" />
              <span className="ayar-govde">
                <b>{t({ tr: "Şifre", en: "Password" })}</b>
                <small>
                  {/* Uzunluk SABİTTEN yazılıyor; ekrana elle sayı yazmak
                      kural değişince sessizce yanlışa düşerdi
                      (tests/unit/kimlik-kurallari.test.ts). */}
                  {t({
                    tr: `${EN_KISA_SIFRE}–${EN_UZUN_SIFRE} karakter. Değiştirmek için mevcut şifreniz gerekir; değişince diğer cihazlardaki oturumlar kapanır.`,
                    en: `${EN_KISA_SIFRE}–${EN_UZUN_SIFRE} characters. You need your current password to change it; once changed, sessions on other devices are signed out.`,
                  })}
                </small>
              </span>
              <PanelDrawer
                triggerLabel={t({ tr: "Değiştir", en: "Change" })}
                triggerClassName="projects-filter-button button-compact"
                kicker={t({ tr: "Güvenlik", en: "Security" })}
                title={t({ tr: "Şifrenizi değiştirin", en: "Change your password" })}
                description={t({ tr: "Önce mevcut şifrenizi girin.", en: "Enter your current password first." })}
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
                    tr: "Hesabınız aynı anda tek cihazda açık kalır: başka bir cihazdan giriş yapılınca ya da şifre değişince öncekiler kendiliğinden kapanır. Bu düğme aynı işi şimdi yapar.",
                    en: "Your account stays signed in on one device at a time: signing in elsewhere or changing your password signs out the others automatically. This button does the same right now.",
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
        </section>

        <section
          role="tabpanel"
          id={`${sekmeKimlik}-panel-tercihler`}
          aria-labelledby={`${sekmeKimlik}-tercihler`}
          hidden={sekme !== "tercihler"}
          className="ayarlar-panel"
        >
          {/*
            Başlık İKİ dilde yazılı: yanlış dilde açılmış bir paneli
            okuyamayan kişi de ayarı bulabilmeli. Tercih profile yazılıyor;
            başka cihazda girişte de geçerli (davranış değişmedi).
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

          <ul className="ayar-listesi">
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
                boy="orta"
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
        </section>

        <section
          role="tabpanel"
          id={`${sekmeKimlik}-panel-abonelik`}
          aria-labelledby={`${sekmeKimlik}-abonelik`}
          hidden={sekme !== "abonelik"}
          className="ayarlar-panel"
        >
          <AbonelikSekmesi veri={veri} sayi={sayi} />
        </section>

        <section
          role="tabpanel"
          id={`${sekmeKimlik}-panel-veriler`}
          aria-labelledby={`${sekmeKimlik}-veriler`}
          hidden={sekme !== "veriler"}
          className="ayarlar-panel"
        >
          <ul className="ayar-listesi">
            {/* İndirme bir ROTA (sunucu eylemi değil): tez metinleri
                megabaytlarca olabiliyor, yanıt sınırı aşılamaz. */}
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

            <li className="ayar-satir">
              <FileCheck2 size={18} aria-hidden="true" />
              <span className="ayar-govde">
                <b>{t({ tr: "Kullanım Sözleşmesi", en: "Terms of Use" })}</b>
                <small>
                  {veri.sozlesme.okunamadi
                    ? t({ tr: "Onay kayıtlarınız şu anda okunamadı.", en: "Your approval records could not be loaded right now." })
                    : veri.sozlesme.sonOnay
                      ? t({
                          tr: `Son onay: ${veri.sozlesme.sonOnay.tarih} · Sürüm ${veri.sozlesme.sonOnay.surum}`,
                          en: `Last approved: ${veri.sozlesme.sonOnay.tarih} · Version ${veri.sozlesme.sonOnay.surum}`,
                        })
                      : t({ tr: "Henüz onay kaydı yok.", en: "No approval record yet." })}
                </small>
              </span>
              <PanelDrawer
                triggerLabel={t({ tr: "Görüntüle", en: "View" })}
                triggerClassName="projects-filter-button button-compact"
                boy="genis"
                kicker={t({ tr: "Sözleşme", en: "Agreement" })}
                title={sozlesmeMetni.baslik}
                description={sozlesmeMetni.giris}
              >
                <h3 className="section-title">{t({ tr: "Onay kayıtlarınız", en: "Your approval records" })}</h3>
                {veri.sozlesme.guncelSurumOnaylandi ? <SozlesmeKopyasi /> : null}
                {veri.sozlesme.kayitlar.length ? (
                  <ul className="sozlesme-onaylarim">
                    {veri.sozlesme.kayitlar.map((o) => (
                      <li key={o.id}>
                        <b>{o.tarih}</b> ·{" "}
                        {o.olay === "odeme_sonrasi"
                          ? t({ tr: "Ödemeden sonra", en: "After payment" })
                          : o.olay === "kayit"
                            ? t({ tr: "Kayıt sırasında", en: "At sign-up" })
                            : t({ tr: "Giriş", en: "Sign-in" })}
                        <dl>
                          <dt>{t({ tr: "Sürüm", en: "Version" })}</dt>
                          <dd>
                            {o.surum} ({o.dil})
                          </dd>
                          <dt>{t({ tr: "IP adresi", en: "IP address" })}</dt>
                          <dd>{o.ip ?? "—"}</dd>
                          {o.konum ? (
                            <>
                              <dt>{t({ tr: "Yaklaşık konum", en: "Approximate location" })}</dt>
                              <dd>{o.konum}</dd>
                            </>
                          ) : null}
                          <dt>{t({ tr: "Cihaz", en: "Device" })}</dt>
                          <dd>{o.cihaz ?? "—"}</dd>
                          {o.odeme ? (
                            <>
                              <dt>{t({ tr: "Ödeme", en: "Payment" })}</dt>
                              <dd>{o.odeme}</dd>
                            </>
                          ) : null}
                          <dt>{t({ tr: "Metin özeti", en: "Text digest" })}</dt>
                          <dd>{o.ozet}</dd>
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
                      <p key={p.slice(0, 40)} className="text-sm">
                        {p}
                      </p>
                    ))}
                  </section>
                ))}
              </PanelDrawer>
            </li>

            {/* Asistan sunucusu: yalnızca iç ekip, personel görünümünde.
                Sağlayıcının adı ürün arayüzünde geçmiyor; ANAHTAR YOK. */}
            {veri.asistanSunucusu ? (
              <li className="ayar-satir">
                <Cpu size={18} aria-hidden="true" />
                <span className="ayar-govde">
                  <b>{t({ tr: "Asistan sunucusu", en: "Assistant server" })}</b>
                  <small>
                    {veri.asistanSunucusu.sunucu} · {veri.asistanSunucusu.model} · {veri.asistanSunucusu.durum}.{" "}
                    {t({ tr: "Değişken eklendikten sonra yeniden dağıtım gerekir.", en: "A redeploy is required after adding a variable." })}
                  </small>
                </span>
              </li>
            ) : null}

            {/* Hesap silme EN SONDA ve iç ekibe gösterilmiyor; sunucu da reddediyor. */}
            {veri.icEkip ? null : (
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
                {/* #149'daki onay penceresi: tek adım, onay boyunda. */}
                <PanelDrawer
                  triggerLabel={t({ tr: "Sil", en: "Delete" })}
                  triggerClassName="projects-filter-button button-compact button-danger"
                  boy="onay"
                  kicker={t({ tr: "Hesap", en: "Account" })}
                  title={t({ tr: "Hesabımı sil", en: "Delete my account" })}
                >
                  <HesapSilmeFormu
                    action={hesapSilmeTalebi}
                    eposta={veri.eposta}
                    bireysel={veri.abonelik.tur === "individual"}
                  />
                </PanelDrawer>
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ---------- Hesap ---------- */

function HesapSekmesi({ veri, kirliDegis }: { veri: AyarlarVerisi; kirliDegis?: (kirli: boolean) => void }) {
  const t = useCeviri();
  /*
    KAYITTAN SONRA TASLAK BİTER. Karşılaştırma açılıştaki `veri`ye göre
    yapılsaydı, başarıyla kaydeden kullanıcının formu "kaydedilmemiş
    değişiklik var" saymaya devam eder ve pencereyi her kapatışta soru
    çıkardı. Ölçüt kaydedilen SON değer; başarı olayını ActionForm
    yayıyor (toast-events.ts).
  */
  const [temel, setTemel] = useState({ ad: veri.ad, soyad: veri.soyad });
  const [ad, setAd] = useState(veri.ad);
  const [soyad, setSoyad] = useState(veri.soyad);

  const kirli = ad !== temel.ad || soyad !== temel.soyad;
  const gecerli = adlarGecerliMi(ad, soyad);

  useEffect(() => {
    kirliDegis?.(kirli);
  }, [kirli, kirliDegis]);

  useEffect(() => {
    const basarili = () => setTemel({ ad, soyad });
    window.addEventListener(ACTION_SUCCESS_EVENT, basarili);
    return () => window.removeEventListener(ACTION_SUCCESS_EVENT, basarili);
  }, [ad, soyad]);

  return (
    <div className="ayarlar-bolum">
      <h3 className="ayarlar-baslik">{t({ tr: "Profil", en: "Profile" })}</h3>

      <ActionForm
        action={profilimiKaydet}
        className="ayarlar-form"
        successMessage={t({ tr: "Profiliniz güncellendi.", en: "Your profile has been updated." })}
      >
        {/*
          AD VE SOYAD AYRI. Masaüstünde yan yana, dar ekranda alt alta.
          Eski hesapların tek alanda yazılı adı bölünerek GÖSTERİLİYOR ama
          kendiliğinden kaydedilmiyor: sütunlar ancak kullanıcı Kaydet'e
          bastığında yazılıyor, o zamana kadar görünen ad full_name'den
          geliyor (supabase/migrations/…_profil_ad_soyad.sql).
        */}
        <div className="ayarlar-ikili">
          <label>
            <span>{t({ tr: "Ad", en: "First name" })}</span>
            <input
              className="field-control"
              name="ad"
              type="text"
              autoComplete="given-name"
              maxLength={80}
              value={ad}
              onChange={(o) => setAd(o.target.value)}
              required
            />
          </label>
          <label>
            <span>{t({ tr: "Soyad", en: "Last name" })}</span>
            <input
              className="field-control"
              name="soyad"
              type="text"
              autoComplete="family-name"
              maxLength={80}
              value={soyad}
              onChange={(o) => setSoyad(o.target.value)}
              required
            />
          </label>
        </div>
        {veri.adBolunusuBelirsiz ? (
          <p className="muted text-sm">
            {t({
              tr: "Adınız şimdiye kadar tek alanda kayıtlıydı; buradaki bölünüş bir öneridir ve kaydedene kadar değişmez.",
              en: "Your name was stored in a single field until now; the split shown here is a suggestion and nothing changes until you save.",
            })}
          </p>
        ) : null}

        {/* Kaydet, Ad ve Soyad'la AYNI grupta: neyi kaydettiği belli olsun. */}
        <div className="ayarlar-kaydet">
          <button type="submit" className="projects-primary-button button-compact" disabled={!kirli || !gecerli}>
            <Save size={15} aria-hidden="true" />
            {t({ tr: "Kaydet", en: "Save" })}
          </button>
        </div>
      </ActionForm>

      {/*
        E-POSTA TEK BÖLÜMDE: adres, varsa bekleyen doğrulama ve değiştirme
        düğmesi bir arada. Eskiden adres salt okunur bir bilgi satırındaydı
        ve değiştirme düğmesi listenin altında ayrı bir satırdaydı; ikisinin
        aynı şeye baktığı görünmüyordu. Telefonda düğme adresin HEMEN
        ALTINDA (app/styles/ayarlar.css).
      */}
      <div className="ayarlar-eposta">
        <span className="ayarlar-etiket" id="ayarlar-eposta-etiket">
          {t({ tr: "E-posta", en: "Email" })}
        </span>
        <div className="ayarlar-eposta-satir">
          <p className="ayarlar-eposta-adres" aria-labelledby="ayarlar-eposta-etiket">
            {veri.eposta || "—"}
          </p>
          <PanelDrawer
            triggerLabel={t({ tr: "E-postayı değiştir", en: "Change email" })}
            triggerClassName="projects-filter-button button-compact"
            boy="onay"
            kicker={t({ tr: "Hesap", en: "Account" })}
            title={t({ tr: "E-posta adresinizi değiştirin", en: "Change your email address" })}
          >
            <EpostaDegistir mevcut={veri.eposta} bekleyen={veri.bekleyenEposta} />
          </PanelDrawer>
        </div>
        {veri.bekleyenEposta ? (
          <span className="ayarlar-bekleyen">
            <Mail size={13} aria-hidden="true" />
            {t({
              tr: `Doğrulama bekleniyor: ${veri.bekleyenEposta}. Bağlantıyı onaylayana kadar adresiniz değişmez.`,
              en: `Awaiting verification: ${veri.bekleyenEposta}. Your address does not change until you confirm the link.`,
            })}
          </span>
        ) : null}
      </div>

      {/* Rol ve kurum salt okunur: ikisini de kurum yöneticisi belirliyor. */}
      <dl className="ayarlar-bilgiler">
        <div>
          <dt>{t({ tr: "Rol", en: "Role" })}</dt>
          <dd>{veri.rolEtiketi}</dd>
        </div>
        <div>
          <dt>{t({ tr: "Kurum", en: "Institution" })}</dt>
          <dd>{veri.kurumAdi ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

/* ---------- Abonelik ---------- */

function AbonelikSekmesi({ veri, sayi }: { veri: AyarlarVerisi; sayi: (n: number) => string }) {
  const t = useCeviri();
  const a = veri.abonelik;
  const DURUM: Record<string, string> = {
    active: t({ tr: "Etkin", en: "Active" }),
    trialing: t({ tr: "Deneme sürüyor", en: "Trial" }),
    past_due: t({ tr: "Ödeme gecikti", en: "Past due" }),
    canceled: t({ tr: "İptal edildi", en: "Canceled" }),
    internal: t({ tr: "İç ekip", en: "Internal team" }),
  };

  /*
    BİLGİ ALINAMADI ≠ ABONELİK YOK. Durum "unreachable" ya da "unknown"
    olduğunda ArvoOS'a ulaşılamamış demektir; plan, durum ve tarih
    uydurmak yerine bunu söylüyoruz. "İptal edildi" yazmak, parası ödenmiş
    bir kullanıcıya aboneliğinin bittiğini söylemek olurdu.
  */
  if (a.bilinmiyor) {
    return (
      <div className="ayarlar-bolum">
        <h3 className="ayarlar-baslik">{t({ tr: "Abonelik", en: "Subscription" })}</h3>
        <p className="alert" data-tone="warning" role="status">
          {t({
            tr: "Abonelik bilgisi şu anda alınamıyor. Erişiminiz etkilenmez; birazdan tekrar bakabilirsiniz.",
            en: "Subscription information is unavailable right now. Your access is not affected; please check again shortly.",
          })}
        </p>
        <div className="cluster">
          <Link className="projects-filter-button button-compact" href="/dashboard/abonelik">
            {t({ tr: "Abonelik ve Kredi", en: "Subscription and credits" })}
          </Link>
        </div>
      </div>
    );
  }

  /* Kurum yönetimli abonelik AYRI gösteriliyor: kullanıcının yapabileceği
     bir şey yok, plan ve ödeme kurum yöneticisinde. */
  if (a.tur === "organization") {
    return (
      <div className="ayarlar-bolum">
        <h3 className="ayarlar-baslik">{t({ tr: "Kurum aboneliği", en: "Institution subscription" })}</h3>
        <p className="alert" data-tone="info" role="status">
          {t({
            tr: `Aboneliğiniz ${a.kurumAdi ?? "kurumunuz"} tarafından yönetiliyor. Plan değişikliği ve ödeme kurum yöneticinizdedir.`,
            en: `Your subscription is managed by ${a.kurumAdi ?? "your institution"}. Plan changes and payment are handled by your institution administrator.`,
          })}
        </p>
        <dl className="ayarlar-bilgiler">
          <div>
            <dt>{t({ tr: "Kurum", en: "Institution" })}</dt>
            <dd>{a.kurumAdi ?? "—"}</dd>
          </div>
          <div>
            <dt>{t({ tr: "Durum", en: "Status" })}</dt>
            <dd>{DURUM[a.durum] ?? a.durum}</dd>
          </div>
          {a.donemBitis ? (
            <div>
              <dt>{t({ tr: "Dönem bitişi", en: "Period ends" })}</dt>
              <dd>{a.donemBitis}</dd>
            </div>
          ) : null}
        </dl>
        {veri.kredi ? <KrediSatiri kredi={veri.kredi} sayi={sayi} /> : null}
        <div className="cluster">
          <Link className="projects-filter-button button-compact" href="/dashboard/abonelik">
            {t({ tr: "Abonelik ve Kredi", en: "Subscription and credits" })}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ayarlar-bolum">
      <h3 className="ayarlar-baslik">
        {a.tur === "individual" ? t({ tr: "Bireysel abonelik", en: "Individual subscription" }) : t({ tr: "Abonelik", en: "Subscription" })}
      </h3>
      <dl className="ayarlar-bilgiler">
        <div>
          <dt>{t({ tr: "Durum", en: "Status" })}</dt>
          <dd>{DURUM[a.durum] ?? a.durum}</dd>
        </div>
        {a.denemeBitis ? (
          <div>
            <dt>{t({ tr: "Deneme bitişi", en: "Trial ends" })}</dt>
            <dd>{a.denemeBitis}</dd>
          </div>
        ) : null}
        {a.donemBitis ? (
          <div>
            <dt>{t({ tr: "Dönem bitişi", en: "Period ends" })}</dt>
            <dd>{a.donemBitis}</dd>
          </div>
        ) : null}
      </dl>

      {veri.kredi ? <KrediSatiri kredi={veri.kredi} sayi={sayi} /> : null}

      <div className="cluster">
        {/* Planı değiştir yalnızca yetkisi SUNUCUDA doğrulanan kullanıcıya:
            kural app/actions/ayarlar.ts'te (planDegistirmeYetkisi), istemciye
            yalnızca sonucu geliyor. */}
        {a.planDegistirebilir ? (
          <Link className="projects-primary-button button-compact" href="/dashboard/abonelik">
            <Sparkles size={15} aria-hidden="true" />
            {t({ tr: "Planı değiştir", en: "Change plan" })}
          </Link>
        ) : null}
        <Link className="projects-filter-button button-compact" href="/dashboard/abonelik">
          {t({ tr: "Abonelik ve Kredi", en: "Subscription and credits" })}
        </Link>
      </div>
      <p className="muted text-sm">
        {t({
          tr: "Fatura, ödeme yöntemi ve kredi paketleri Abonelik ve Kredi sayfasında.",
          en: "Invoices, payment method and credit packages are on the Subscription and credits page.",
        })}
      </p>
    </div>
  );
}

function KrediSatiri({
  kredi,
  sayi,
}: {
  kredi: NonNullable<AyarlarVerisi["kredi"]>;
  sayi: (n: number) => string;
}) {
  const t = useCeviri();
  return (
    <p className="muted text-sm">
      {t({
        tr: `Asistan krediniz: bu ay ${sayi(kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} · satın alınan bakiye ${sayi(kredi.ekBakiye)} · kullanılabilir ${sayi(kredi.toplam)}.`,
        en: `Assistant credits: ${sayi(kredi.aylikKalan)} / ${sayi(kredi.aylikLimit)} this month · purchased balance ${sayi(kredi.ekBakiye)} · available ${sayi(kredi.toplam)}.`,
      })}
    </p>
  );
}
