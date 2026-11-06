"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileCheck2, MailCheck } from "lucide-react";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { yasalAdres } from "@/lib/yasal-baglantilar";
import { signUp } from "@/app/actions/auth";
import type { ActionResult } from "@/lib/auth-guards";
import { kullanimSozlesmesi, SOZLESME_SURUMU } from "@/lib/sozlesme/kullanim-sozlesmesi";

/*
  KAYIT FORMU (02.11.2026'da yeniden yazıldı, kurum sahibinin isteği:
  açılır pencerede ad soyad, e-posta, telefon ve yasal metin kutuları).

  ŞİFRE BURADA ALINMIYOR (G1, 06.11.2026): kayıtta alınan şifreyi adresin
  sahibi olmayan biri de koyabiliyordu ve gerçek sahip e-postasını
  doğrulayınca hesap o şifreyle açılıyordu. Şifre, doğrulama bağlantısından
  sonra açılan "Şifrenizi belirleyin" sayfasında belirleniyor.

  Aynı bileşen iki yerde: giriş sayfasındaki "Ücretsiz hesap oluştur"
  penceresi ve /kayit sayfası (sitedeki "Ücretsiz deneyin" bağlantıları
  oraya gidiyor). `pencerede` başlığı ve geri bağlantısını gizler; pencerenin
  kendi başlığı var.

  SÖZLEŞME KUTUSU OKUMADAN İŞARETLENMEZ. Kutuya basınca metin formun
  YERİNE açılır (form gizlenir, doldurulan alanlar kaybolmaz), sonuna kadar
  kaydırılınca "Okudum ve onaylıyorum" etkinleşir ve kutu işaretlenir.
  Onay sunucuda IP, cihaz ve konumla kayda yazılır (lib/sozlesme/onay-yaz.ts)
  — kullanıcı ilk girişte aynı metni ikinci kez onaylamaz. Okundu bilgisi
  gizli alanla gider; sunucu ikisini birden ister (lib/kayit.ts).

  Başarıda form YERİNE bir bilgi ekranı geliyor: kullanıcının yapacağı tek
  iş posta kutusuna bakmak, formu tekrar doldurmaya çalışması yalnızca hız
  sınırını yakar.
*/
export default function KayitFormu({ pencerede = false }: { pencerede?: boolean }) {
  const t = useCeviri();
  const dil = useDil();
  const [durum, gonder, bekliyor] = useActionState<ActionResult | null, FormData>(
    async (_onceki, formData) => (await signUp(_onceki, formData)) ?? null,
    null,
  );
  const [okuyor, setOkuyor] = useState(false);
  const [okundu, setOkundu] = useState(false);
  const [sozlesme, setSozlesme] = useState(false);
  const sozlesmeKutusu = useRef<HTMLInputElement>(null);

  if (durum?.success) {
    return (
      <div className="login-heading kayit-tamam">
        <span className="kayit-tamam-ikon" aria-hidden="true">
          <MailCheck size={22} />
        </span>
        <span className="login-kicker">{t({ tr: "Son adım", en: "Last step" })}</span>
        <h2>{t({ tr: "Posta kutunuza bakın", en: "Check your inbox" })}</h2>
        <p>
          {t({
            tr: "Adresinize bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladığınızda hesabınız açılır ve şifrenizi belirlersiniz. Bağlantı 24 saat geçerli; e-postayı göremiyorsanız spam klasörünü kontrol edin.",
            en: "We sent a verification link to your address. Clicking it activates your account and lets you set your password. The link is valid for 24 hours; if you don't see the email, check your spam folder.",
          })}
        </p>
        <p className="muted text-sm">
          {t({
            tr: "Bu adresle zaten bir hesabınız varsa yeni hesap açılmaz; bunun yerine giriş bağlantısı gönderilir.",
            en: "If you already have an account with this address, no new account is created; we send you a sign-in link instead.",
          })}
        </p>
        {pencerede ? null : (
          <Link href="/" className="projects-filter-button">
            {t({ tr: "Giriş ekranına dön", en: "Back to sign in" })}
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      {okuyor ? (
        <SozlesmeOkuyucu
          onOnay={() => {
            setOkundu(true);
            setSozlesme(true);
            setOkuyor(false);
            window.requestAnimationFrame(() => sozlesmeKutusu.current?.focus());
          }}
          onGeri={() => {
            setOkuyor(false);
            window.requestAnimationFrame(() => sozlesmeKutusu.current?.focus());
          }}
        />
      ) : null}

      {/* Okuyucu açıkken form GİZLENİR, sökülmez: doldurulan alanlar kaybolmasın. */}
      <div hidden={okuyor}>
        {pencerede ? null : (
          <div className="login-heading">
            <span className="login-kicker">{t({ tr: "Ücretsiz deneme", en: "Free trial" })}</span>
            <h1>{t({ tr: "ArvoLab hesabı oluşturun", en: "Create your ArvoLab account" })}</h1>
            <p>
              {t({
                tr: "Tezinizi yazmaya, kaynak bulmaya ve kılavuz denetimine birkaç dakika içinde başlayın.",
                en: "Start writing your thesis, finding sources and checking against your guidelines within minutes.",
              })}
            </p>
          </div>
        )}

        {durum?.error ? (
          <p className="alert" role="alert">
            {durum.error}
          </p>
        ) : null}

        <form className="login-form kayit-formu" action={gonder}>
          <input type="hidden" name="sozlesmeOkundu" value={okundu ? "1" : ""} />

          <div className="kayit-alan kayit-alan-genis">
            <label htmlFor="kayit-ad">{t({ tr: "Ad soyad", en: "Full name" })}</label>
            <input id="kayit-ad" name="fullName" type="text" autoComplete="name" minLength={2} maxLength={120} required />
          </div>

          <div className="kayit-alan">
            <label htmlFor="kayit-eposta">{t({ tr: "E-posta adresi", en: "Email address" })}</label>
            <input
              id="kayit-eposta"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder={t({ tr: "ornek@universite.edu.tr", en: "name@university.edu" })}
              required
            />
          </div>

          <div className="kayit-alan">
            <label htmlFor="kayit-telefon">{t({ tr: "Telefon", en: "Phone" })}</label>
            {/* Desen lib/kayit.ts telefonuTemizle ile aynı aralık: boşluk, tire, parantez serbest. */}
            <input
              id="kayit-telefon"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder={t({ tr: "05xx xxx xx xx", en: "+44 20 7946 0958" })}
              pattern="\+?[\d\s().\-]{10,20}"
              title={t({ tr: "10–15 rakamlı bir telefon numarası", en: "A phone number with 10–15 digits" })}
              required
            />
          </div>

          <p className="kayit-ipucu kayit-alan-genis">
            {t({
              tr: "Şifrenizi, e-posta adresinizi doğruladıktan sonra belirleyeceksiniz.",
              en: "You will set your password after verifying your email address.",
            })}
          </p>

          <fieldset className="kayit-onaylar kayit-alan-genis">
            <legend className="sr-only">{t({ tr: "Yasal onaylar", en: "Legal consents" })}</legend>

            <label className="kayit-onay">
              {/*
                Kontrollü kutu: okunmadan basılırsa işaretlenmez, okuyucu açılır.
                Okunduktan sonra kullanıcı kutuyu kaldırıp yeniden işaretleyebilir.
              */}
              <input
                ref={sozlesmeKutusu}
                type="checkbox"
                name="sozlesme"
                checked={sozlesme}
                onChange={(e) => {
                  if (!okundu) {
                    e.preventDefault();
                    setOkuyor(true);
                    return;
                  }
                  setSozlesme(e.target.checked);
                }}
                required
              />
              <span>
                <button type="button" className="kayit-metin-baglanti" onClick={() => setOkuyor(true)}>
                  {t({ tr: "ArvoLab Kullanım Sözleşmesi'ni", en: "I have read and accept the ArvoLab Terms of Use" })}
                </button>
                {t({ tr: " okudum ve kabul ediyorum.", en: "." })} <b className="kayit-zorunlu">{t({ tr: "Zorunlu", en: "Required" })}</b>
                {okundu ? null : (
                  <small className="kayit-ipucu">{t({ tr: "Kutuya basınca metin açılır; sonuna kadar okuyunca onaylayabilirsiniz.", en: "Ticking the box opens the text; you can accept once you've read it to the end." })}</small>
                )}
              </span>
            </label>

            <label className="kayit-onay">
              <input type="checkbox" name="kvkk" required />
              <span>
                <a href={yasalAdres("gizlilik", dil)} target="_blank" rel="noreferrer">
                  {t({ tr: "KVKK Aydınlatma Metni'ni", en: "I have read the Privacy Notice" })}
                </a>
                {t({
                  tr: " okudum; kişisel verilerimin bu metinde belirtilen amaçlarla işlenmesini onaylıyorum.",
                  en: " and consent to my personal data being processed for the purposes it describes.",
                })}{" "}
                <b className="kayit-zorunlu">{t({ tr: "Zorunlu", en: "Required" })}</b>
              </span>
            </label>

            {/*
              Ticari elektronik ileti onayı (6563 sayılı Kanun): İSTEĞE BAĞLI ve
              varsayılan İŞARETSİZ. Hizmetin kullanımına dair zorunlu bildirimler
              (doğrulama, deneme süresi, ödeme) bu izne bağlı değil.
            */}
            <label className="kayit-onay">
              <input type="checkbox" name="iletisim" />
              <span>
                {t({
                  tr: "Yenilikler, duyurular ve kampanyalardan e-posta ve SMS ile haberdar olmak istiyorum.",
                  en: "I'd like to hear about new features, announcements and offers by email and SMS.",
                })}{" "}
                <span className="kayit-istege-bagli">{t({ tr: "İsteğe bağlı", en: "Optional" })}</span>
              </span>
            </label>
          </fieldset>

          <button className="login-button kayit-alan-genis" type="submit" disabled={bekliyor}>
            {bekliyor ? t({ tr: "Hesabınız oluşturuluyor…", en: "Creating your account…" }) : t({ tr: "Ücretsiz hesabımı oluştur", en: "Create my free account" })}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>

        {pencerede ? null : (
          <p className="muted text-sm">
            {t({ tr: "Hesabınız var mı?", en: "Already have an account?" })} <Link href="/">{t({ tr: "Giriş yapın", en: "Sign in" })}</Link>
          </p>
        )}
      </div>
    </>
  );
}

/*
  Sözleşme okuyucu. Panel içindeki onay penceresiyle (dashboard/_components/
  sozlesme-onayi.tsx) aynı kural: düğme metnin SONUNA kaydırılmadan
  etkinleşmez; metin baştan sığıyorsa hemen etkin.
*/
function SozlesmeOkuyucu({ onOnay, onGeri }: { onOnay: () => void; onGeri: () => void }) {
  const t = useCeviri();
  const dil = useDil();
  const metin = kullanimSozlesmesi(dil);
  const kutu = useRef<HTMLDivElement>(null);
  const [sona, setSona] = useState(false);
  const [ilerleme, setIlerleme] = useState(0);

  const olc = useCallback(() => {
    const k = kutu.current;
    if (!k) return;
    const kalan = k.scrollHeight - k.clientHeight - k.scrollTop;
    const oran = k.scrollHeight <= k.clientHeight ? 1 : k.scrollTop / (k.scrollHeight - k.clientHeight);
    setIlerleme(Math.min(100, Math.round(oran * 100)));
    if (kalan <= 8) setSona(true);
  }, []);

  useEffect(() => {
    olc();
    kutu.current?.focus();
    window.addEventListener("resize", olc);
    return () => window.removeEventListener("resize", olc);
  }, [olc]);

  return (
    <section className="kayit-okuyucu" aria-label={metin.baslik}>
      <header className="kayit-okuyucu-baslik">
        <FileCheck2 size={18} aria-hidden="true" />
        <div>
          <h2>{metin.baslik}</h2>
          <small>{t({ tr: `Sürüm ${SOZLESME_SURUMU}`, en: `Version ${SOZLESME_SURUMU}` })}</small>
        </div>
      </header>
      <div ref={kutu} className="sozlesme-onay-metin kayit-okuyucu-metin" tabIndex={0} onScroll={olc} aria-label={t({ tr: "Sözleşme metni", en: "Agreement text" })}>
        <p className="sozlesme-onay-giris">{metin.giris}</p>
        {metin.bolumler.map((b) => (
          <section key={b.baslik}>
            <h3>{b.baslik}</h3>
            {b.paragraflar.map((p) => (
              <p key={p.slice(0, 40)}>{p}</p>
            ))}
          </section>
        ))}
        <p className="sozlesme-onay-son">{t({ tr: `Sözleşmenin sonu · Sürüm ${SOZLESME_SURUMU}`, en: `End of agreement · Version ${SOZLESME_SURUMU}` })}</p>
      </div>
      <div className="sozlesme-onay-ilerleme" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={sona ? 100 : ilerleme} aria-label={t({ tr: "Okuma ilerlemesi", en: "Reading progress" })}>
        <span data-deger={sona ? 100 : Math.round(ilerleme / 10) * 10} />
      </div>
      <p className="kayit-ipucu" aria-live="polite">
        {sona
          ? t({ tr: "Onayınız, hesabınız oluşturulurken tarih-saat, IP adresi ve cihaz bilgisiyle kaydedilir.", en: "Your acceptance is recorded with date and time, IP address and device when your account is created." })
          : t({ tr: "Onaylamak için metni sonuna kadar kaydırın.", en: "Scroll to the end of the text to accept." })}
      </p>
      <div className="kayit-okuyucu-dugmeler">
        <button type="button" className="projects-filter-button" onClick={onGeri}>
          <ArrowLeft size={15} aria-hidden="true" /> {t({ tr: "Forma dön", en: "Back to the form" })}
        </button>
        <button type="button" className="projects-primary-button" disabled={!sona} onClick={onOnay}>
          {t({ tr: "Okudum ve onaylıyorum", en: "I have read and agree" })}
        </button>
      </div>
    </section>
  );
}
