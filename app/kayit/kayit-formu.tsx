"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FileCheck2, MailCheck } from "lucide-react";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";
import { yasalAdres } from "@/lib/yasal-baglantilar";
import { signUp } from "@/app/actions/auth";
import type { ActionResult } from "@/lib/auth-guards";
import { EN_KISA_SIFRE } from "@/lib/kayit";
import { kullanimSozlesmesi, SOZLESME_SURUMU } from "@/lib/sozlesme/kullanim-sozlesmesi";
import { Bildirim } from "@/app/_components/ui/bildirim";
import { Dugme, DugmeBaglanti } from "@/app/_components/ui/dugme";
import { Girdi } from "@/app/_components/ui/girdi";
import { SifreGirdisi } from "@/app/_components/ui/sifre-girdisi";

/*
  KAYIT FORMU (02.11.2026'da yeniden yazıldı, kurum sahibinin isteği:
  açılır pencerede ad soyad, e-posta, telefon, şifre, şifre tekrarı ve
  yasal metin kutuları).

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

  Signature OS 5 / Phase 2 (12.11.2026): yalnızca görünüş. Alan adları,
  kimlikler, autocomplete, minLength (EN_KISA_SIFRE), telefon deseni,
  sözleşme okuma kuralı, gizli "sozlesmeOkundu" alanı ve signUp eylemi
  AYNI. Şifre ve tekrarı ayrı göster/gizle düğmeleri taşıyor (ortak
  SifreGirdisi); eskiden tek düğme ikisini birden açıyordu. Form tek
  sütun, sayfada da pencerede de (os5-kimlik.css).
*/
export default function KayitFormu({ pencerede = false }: { pencerede?: boolean }) {
  const t = useCeviri();
  const dil = useDil();
  const [durum, gonder, bekliyor] = useActionState<ActionResult | null, FormData>(
    async (_onceki, formData) => (await signUp(_onceki, formData)) ?? null,
    null,
  );
  const [sifre, setSifre] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [okuyor, setOkuyor] = useState(false);
  const [okundu, setOkundu] = useState(false);
  const [sozlesme, setSozlesme] = useState(false);
  const sozlesmeKutusu = useRef<HTMLInputElement>(null);

  const eslesmiyor = tekrar.length > 0 && tekrar !== sifre;

  if (durum?.success) {
    return (
      <div className="os5-kimlik-tamam">
        <span className="os5-kimlik-tamam-simge" aria-hidden="true">
          <MailCheck size={22} />
        </span>
        <header className="os5-kimlik-baslik">
          <h2>{t({ tr: "Posta kutunuza bakın", en: "Check your inbox" })}</h2>
          <p>
            {t({
              tr: "Adresinize bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladığınızda hesabınız açılır ve doğrudan çalışma alanınıza girersiniz. Bağlantı 24 saat geçerli; e-postayı göremiyorsanız spam klasörünü kontrol edin.",
              en: "We sent a verification link to your address. Clicking it activates your account and takes you straight to your workspace. The link is valid for 24 hours; if you don't see the email, check your spam folder.",
            })}
          </p>
        </header>
        <p className="os5-kimlik-not">
          {t({
            tr: "Bu adresle zaten bir hesabınız varsa yeni hesap açılmaz; bunun yerine giriş bağlantısı gönderilir.",
            en: "If you already have an account with this address, no new account is created; we send you a sign-in link instead.",
          })}
        </p>
        {pencerede ? null : (
          <DugmeBaglanti href="/" tur="ikincil" tamGenislik>
            {t({ tr: "Giriş ekranına dön", en: "Back to sign in" })}
          </DugmeBaglanti>
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
          <header className="os5-kimlik-baslik">
            <h1>{t({ tr: "ArvoLab hesabı oluşturun", en: "Create your ArvoLab account" })}</h1>
            <p>
              {t({
                tr: "Tezinizi yazmaya, kaynak bulmaya ve kılavuz denetimine birkaç dakika içinde başlayın.",
                en: "Start writing your thesis, finding sources and checking against your guidelines within minutes.",
              })}
            </p>
          </header>
        )}

        {durum?.error ? (
          <div className="os5-kimlik-bildirimler">
            <Bildirim ton="hata" rol="alert">
              {durum.error}
            </Bildirim>
          </div>
        ) : null}

        <form className="os5-kimlik-formu" action={gonder}>
          <input type="hidden" name="sozlesmeOkundu" value={okundu ? "1" : ""} />

          <Girdi id="kayit-ad" name="fullName" type="text" etiket={t({ tr: "Ad soyad", en: "Full name" })} autoComplete="name" minLength={2} maxLength={120} required />

          <Girdi
            id="kayit-eposta"
            name="email"
            type="email"
            etiket={t({ tr: "E-posta adresi", en: "Email address" })}
            autoComplete="email"
            inputMode="email"
            placeholder={t({ tr: "ornek@universite.edu.tr", en: "name@university.edu" })}
            required
          />

          {/* Desen lib/kayit.ts telefonuTemizle ile aynı aralık: boşluk, tire, parantez serbest. */}
          <Girdi
            id="kayit-telefon"
            name="phone"
            type="tel"
            etiket={t({ tr: "Telefon", en: "Phone" })}
            autoComplete="tel"
            inputMode="tel"
            placeholder={t({ tr: "05xx xxx xx xx", en: "+44 20 7946 0958" })}
            pattern="\+?[\d\s().\-]{10,20}"
            title={t({ tr: "10–15 rakamlı bir telefon numarası", en: "A phone number with 10–15 digits" })}
            required
          />

          <SifreGirdisi
            id="kayit-sifre"
            name="password"
            etiket={t({ tr: "Şifre", en: "Password" })}
            autoComplete="new-password"
            minLength={EN_KISA_SIFRE}
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
            aciklama={t({ tr: `En az ${EN_KISA_SIFRE} karakter.`, en: `At least ${EN_KISA_SIFRE} characters.` })}
            required
          />

          {/*
            Eşleşmeme: alan aria-invalid olur ve hata metni aria-describedby ile
            bağlanır. Duyuru aşağıdaki KALICI canlı bölgeden: sonradan eklenen
            bir aria-live öğesini ekran okuyucular çoğu zaman okumaz; eskiden
            de canlı bölge sürekli yerindeydi.
          */}
          <SifreGirdisi
            id="kayit-sifre-tekrar"
            name="passwordRepeat"
            etiket={t({ tr: "Şifre tekrarı", en: "Repeat password" })}
            autoComplete="new-password"
            minLength={EN_KISA_SIFRE}
            value={tekrar}
            onChange={(e) => setTekrar(e.target.value)}
            hata={eslesmiyor ? t({ tr: "Şifreler aynı değil.", en: "Passwords don't match." }) : undefined}
            required
          />
          <span className="sr-only" aria-live="polite">
            {eslesmiyor ? t({ tr: "Şifreler aynı değil.", en: "Passwords don't match." }) : ""}
          </span>

          <fieldset className="os5-kimlik-onaylar">
            <legend className="sr-only">{t({ tr: "Yasal onaylar", en: "Legal consents" })}</legend>

            <label className="os5-onay">
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
                <button type="button" className="os5-kimlik-metin-baglanti" onClick={() => setOkuyor(true)}>
                  {t({ tr: "ArvoLab Kullanım Sözleşmesi'ni", en: "I have read and accept the ArvoLab Terms of Use" })}
                </button>
                {t({ tr: " okudum ve kabul ediyorum.", en: "." })} <b className="os5-kimlik-etiketcik">{t({ tr: "Zorunlu", en: "Required" })}</b>
                {okundu ? null : (
                  <small className="os5-aciklama">{t({ tr: "Kutuya basınca metin açılır; sonuna kadar okuyunca onaylayabilirsiniz.", en: "Ticking the box opens the text; you can accept once you've read it to the end." })}</small>
                )}
              </span>
            </label>

            <label className="os5-onay">
              <input type="checkbox" name="kvkk" required />
              <span>
                <a className="os5-kimlik-metin-baglanti" href={yasalAdres("gizlilik", dil)} target="_blank" rel="noreferrer">
                  {t({ tr: "KVKK Aydınlatma Metni'ni", en: "I have read the Privacy Notice" })}
                </a>
                {t({
                  tr: " okudum; kişisel verilerimin bu metinde belirtilen amaçlarla işlenmesini onaylıyorum.",
                  en: " and consent to my personal data being processed for the purposes it describes.",
                })}{" "}
                <b className="os5-kimlik-etiketcik">{t({ tr: "Zorunlu", en: "Required" })}</b>
              </span>
            </label>

            {/*
              Ticari elektronik ileti onayı (6563 sayılı Kanun): İSTEĞE BAĞLI ve
              varsayılan İŞARETSİZ. Hizmetin kullanımına dair zorunlu bildirimler
              (doğrulama, deneme süresi, ödeme) bu izne bağlı değil.
            */}
            <label className="os5-onay">
              <input type="checkbox" name="iletisim" />
              <span>
                {t({
                  tr: "Yenilikler, duyurular ve kampanyalardan e-posta ve SMS ile haberdar olmak istiyorum.",
                  en: "I'd like to hear about new features, announcements and offers by email and SMS.",
                })}{" "}
                <span className="os5-kimlik-etiketcik">{t({ tr: "İsteğe bağlı", en: "Optional" })}</span>
              </span>
            </label>
          </fieldset>

          <Dugme type="submit" tamGenislik yukleniyor={bekliyor} disabled={bekliyor || eslesmiyor}>
            {bekliyor ? t({ tr: "Hesabınız oluşturuluyor…", en: "Creating your account…" }) : t({ tr: "Ücretsiz hesabımı oluştur", en: "Create my free account" })}
            {bekliyor ? null : <ArrowRight size={18} aria-hidden="true" />}
          </Dugme>
        </form>

        {pencerede ? null : (
          <p className="os5-kimlik-not">
            {t({ tr: "Hesabınız var mı?", en: "Already have an account?" })}{" "}
            <Link className="os5-kimlik-baglanti" href="/">
              {t({ tr: "Giriş yapın", en: "Sign in" })}
            </Link>
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
    <section className="os5-kimlik-okuyucu" aria-label={metin.baslik}>
      <header className="os5-kimlik-okuyucu-baslik">
        <FileCheck2 size={18} aria-hidden="true" />
        <div>
          <h2>{metin.baslik}</h2>
          <small>{t({ tr: `Sürüm ${SOZLESME_SURUMU}`, en: `Version ${SOZLESME_SURUMU}` })}</small>
        </div>
      </header>
      <div ref={kutu} className="sozlesme-onay-metin os5-kimlik-okuyucu-metin" tabIndex={0} onScroll={olc} aria-label={t({ tr: "Sözleşme metni", en: "Agreement text" })}>
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
      <p className="os5-aciklama" aria-live="polite">
        {sona
          ? t({ tr: "Onayınız, hesabınız oluşturulurken tarih-saat, IP adresi ve cihaz bilgisiyle kaydedilir.", en: "Your acceptance is recorded with date and time, IP address and device when your account is created." })
          : t({ tr: "Onaylamak için metni sonuna kadar kaydırın.", en: "Scroll to the end of the text to accept." })}
      </p>
      <div className="os5-kimlik-okuyucu-dugmeler">
        <Dugme tur="ikincil" onClick={onGeri}>
          <ArrowLeft size={15} aria-hidden="true" /> {t({ tr: "Forma dön", en: "Back to the form" })}
        </Dugme>
        <Dugme disabled={!sona} onClick={onOnay}>
          {t({ tr: "Okudum ve onaylıyorum", en: "I have read and agree" })}
        </Dugme>
      </div>
    </section>
  );
}
