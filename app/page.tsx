import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, ChartNoAxesCombined, FileCheck2, ShieldCheck } from "lucide-react";
import { login } from "@/app/actions/auth";
import ThemeToggle from "@/app/_components/theme-toggle";
import DilSecici from "@/app/_components/dil-secici";
import { ceviri } from "@/lib/dil-sunucu";
import { INGILIZCE_YAYINDA, type Metin } from "@/lib/dil";

const highlights = [
  {
    icon: BookOpenCheck,
    title: { tr: "Literatür ve kaynak doğrulama", en: "Literature and source verification" },
    description: {
      tr: "Akademik kaynakları doğrulayın, atıf ve kaynakça uyumunu tek merkezden yönetin.",
      en: "Verify academic sources and manage citation and reference-list consistency in one place.",
    },
  },
  {
    icon: ChartNoAxesCombined,
    title: { tr: "Analiz merkezi", en: "Analysis center" },
    description: {
      tr: "Nicel ve nitel analiz süreçlerini kontrollü, kayıtlı ve tekrarlanabilir şekilde yürütün.",
      en: "Run quantitative and qualitative analysis in a controlled, recorded and reproducible way.",
    },
  },
  {
    icon: FileCheck2,
    title: { tr: "Belge ve kılavuz kontrolü", en: "Document and guideline check" },
    description: {
      tr: "Tez ve makaleleri üniversite kılavuzları ile yayın kurallarına göre denetleyin.",
      en: "Check theses and articles against university guidelines and publication rules.",
    },
  },
];

type HomePageProps = {
  searchParams: Promise<{ error?: string; next?: string; bilgi?: string }>;
};

const errorMessages: Record<string, Metin> = {
  "missing-credentials": { tr: "E-posta adresi ve şifre zorunludur.", en: "Email address and password are required." },
  "invalid-credentials": { tr: "E-posta adresi veya şifre hatalı.", en: "Incorrect email address or password." },
  "email-not-confirmed": {
    tr: "E-posta adresiniz henüz doğrulanmadı. Kayıtta gönderdiğimiz bağlantıya tıklayın; e-postayı bulamıyorsanız \"Şifremi unuttum\" ile yeni bir bağlantı isteyin — o bağlantı adresinizi de doğrular.",
    en: "Your email address is not verified yet. Click the link we sent when you signed up; if you can't find the email, request a new link with \"Forgot password\" — that link also verifies your address.",
  },
  "link-invalid": {
    tr: "Bağlantı geçersiz ya da süresi dolmuş. Lütfen yeniden şifre sıfırlama isteyin.",
    en: "The link is invalid or has expired. Please request a new password reset.",
  },
  "session-missing": { tr: "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.", en: "Your session has expired. Please sign in again." },
};

/*
  Hata değil, bilgi. Silme talebi oturumu kapatıp buraya döndürüyor
  (app/actions/hesap.ts): kullanıcı ne olduğunu ve geri dönüş yolunun hâlâ
  açık olduğunu aynı ekranda görmeli, yoksa "bir şey mi bozuldu" diye
  düşünür.
*/
const bilgiMesajlari: Record<string, Metin> = {
  "hesap-silme-talebi": {
    tr: "Hesabınızın silinmesi başlatıldı ve oturumunuz kapatıldı. 30 gün içinde giriş yaparsanız silmeden vazgeçebilirsiniz.",
    en: "Deletion of your account has started and you have been signed out. Sign in within 30 days to cancel the deletion.",
  },
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const t = await ceviri();
  const hata = params.error ? errorMessages[params.error] : undefined;
  const bilgi = params.bilgi ? bilgiMesajlari[params.bilgi] : undefined;
  const errorMessage = hata ? t(hata) : null;
  const bilgiMesaji = bilgi ? t(bilgi) : null;
  const next = params.next?.startsWith("/dashboard") ? params.next : "";

  return (
    <main className="login-page">
      <section className="login-showcase" aria-label={t({ tr: "ArvoLab tanıtımı", en: "About ArvoLab" })}>
        <div className="brand-lockup">
          <Image src="/arvolab-logo.png" alt="ArvoLab" width={440} height={112} priority />
          {/* lang="en": Türkçe büyük harf dönüşümü "i"yi "İ" yapmasın */}
          <span className="eyebrow" lang="en">
            Research Operating System
          </span>
        </div>

        <div className="showcase-copy">
          <h1>
            {t({
              tr: "Akademik üretimi tek, güvenli ve izlenebilir çalışma alanında yönetin.",
              en: "Manage academic work in one secure, traceable workspace.",
            })}
          </h1>
          <p>
            {t({
              tr: "Literatür taramasından belge kontrolüne, veri analizinden akademik kalite onayına kadar tüm süreçleri ArvoLab üzerinden yürütün.",
              en: "From literature search to document checks, from data analysis to academic quality review — run the whole process in ArvoLab.",
            })}
          </p>
        </div>

        <div className="highlight-list">
          {highlights.map(({ icon: Icon, title, description }) => (
            <article className="highlight-card" key={title.tr}>
              <div className="highlight-icon" aria-hidden="true">
                <Icon size={20} strokeWidth={1.8} />
              </div>
              <div>
                <h2>{t(title)}</h2>
                <p>{t(description)}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="security-note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            {t({
              tr: "Kurumsal veriler ve akademik dosyalar yetki seviyelerine göre korunur.",
              en: "Institutional data and academic files are protected by permission level.",
            })}
          </span>
        </div>
      </section>

      <section className="login-panel" aria-label={t({ tr: "ArvoLab giriş formu", en: "ArvoLab sign-in form" })}>
        <ThemeToggle className="dashboard-icon-button login-theme-toggle" />
        {/* Çeviri bitene kadar gizli (lib/dil.ts, INGILIZCE_YAYINDA). */}
        {INGILIZCE_YAYINDA ? <DilSecici sinif="login-dil" /> : null}
        <div className="login-card">
          <div className="login-mobile-brand">
            <div className="brand-mark" aria-hidden="true">
              A
            </div>
            <div>
              <strong>ArvoLab</strong>
              <span lang="en">Research OS</span>
            </div>
          </div>

          <div className="login-heading">
            <span className="login-kicker">{t({ tr: "Çalışma alanına erişim", en: "Workspace access" })}</span>
            <h2>{t({ tr: "ArvoLab'a giriş yapın", en: "Sign in to ArvoLab" })}</h2>
            <p>{t({ tr: "E-posta adresiniz ve şifrenizle devam edin.", en: "Continue with your email address and password." })}</p>
          </div>

          {errorMessage ? (
            <p className="alert" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {bilgiMesaji ? (
            <p className="tone-text" data-tone="warning" role="status">
              {bilgiMesaji}
            </p>
          ) : null}

          <form className="login-form" action={login}>
            {next ? <input type="hidden" name="next" value={next} /> : null}
            <label htmlFor="email">{t({ tr: "E-posta adresi", en: "Email address" })}</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={t({ tr: "ornek@kurum.com", en: "name@university.edu" })}
              required
            />

            <div className="password-label-row">
              <label htmlFor="password">{t({ tr: "Şifre", en: "Password" })}</label>
              <Link href="/forgot-password">{t({ tr: "Şifremi unuttum", en: "Forgot password" })}</Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder={t({ tr: "Şifrenizi girin", en: "Enter your password" })}
              required
            />

            <button className="login-button" type="submit">
              {t({ tr: "Giriş yap", en: "Sign in" })}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>

          {/*
            Eskiden burada yalnızca "kurum yöneticinizden davet talep edin"
            yazıyordu: kurumu olmayan kişinin ArvoLab'a girmesinin hiçbir
            yolu yoktu, tanıtım sayfasındaki çağrı da bir iletişim formuydu.
          */}
          <div className="login-footer">
            <p>
              {t({ tr: "Hesabınız yok mu?", en: "No account yet?" })}{" "}
              <Link href="/kayit">{t({ tr: "Kayıt olun", en: "Sign up" })}</Link>
              {t({
                tr: " — kurumsal kullanıcıysanız kurum yöneticinizden davet isteyin.",
                en: " — if you are an institutional user, ask your institution's administrator for an invitation.",
              })}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
