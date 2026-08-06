import Image from "next/image";
import { ArrowRight, BookOpenCheck, ChartNoAxesCombined, FileCheck2, ShieldCheck } from "lucide-react";
import { login } from "@/app/actions/auth";

const highlights = [
  {
    icon: BookOpenCheck,
    title: "Literatür ve kaynak doğrulama",
    description: "Akademik kaynakları doğrulayın, atıf ve kaynakça uyumunu tek merkezden yönetin.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Analiz merkezi",
    description: "Nicel ve nitel analiz süreçlerini kontrollü, kayıtlı ve tekrarlanabilir şekilde yürütün.",
  },
  {
    icon: FileCheck2,
    title: "Belge ve kılavuz kontrolü",
    description: "Tez ve makaleleri üniversite kılavuzları ile yayın kurallarına göre denetleyin.",
  },
];

type HomePageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  "missing-credentials": "E-posta adresi ve şifre zorunludur.",
  "invalid-credentials": "E-posta adresi veya şifre hatalı.",
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] : null;

  return (
    <main className="login-page">
      <section className="login-showcase" aria-label="ArvoLab tanıtımı">
        <div className="brand-lockup">
          <Image
            src="/arvolab-logo.png"
            alt="ArvoLab"
            width={220}
            height={56}
            priority
            style={{ height: "40px", width: "auto", filter: "brightness(0) invert(1)" }}
          />
          <div>
            <p className="brand-subtitle" style={{ marginTop: 6 }}>
              Akademik Araştırma ve Analiz İşletim Sistemi
            </p>
          </div>
        </div>

        <div className="showcase-copy">
          <span className="eyebrow">Research Operating System</span>
          <h1 className="brand-type">Akademik üretimi tek, güvenli ve izlenebilir çalışma alanında yönetin.</h1>
          <p>
            Literatür taramasından belge kontrolüne, veri analizinden akademik kalite onayına kadar tüm süreçleri ArvoLab üzerinden yürütün.
          </p>
        </div>

        <div className="highlight-list">
          {highlights.map(({ icon: Icon, title, description }) => (
            <article className="highlight-card" key={title}>
              <div className="highlight-icon" aria-hidden="true">
                <Icon size={20} strokeWidth={1.8} />
              </div>
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="security-note">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Kurumsal veriler ve akademik dosyalar yetki seviyelerine göre korunur.</span>
        </div>
      </section>

      <section className="login-panel" aria-label="ArvoLab giriş formu">
        <div className="login-card">
          <div className="login-heading">
            <span className="login-kicker">Çalışma alanına erişim</span>
            <h2 className="brand-type">ArvoLab&apos;a giriş yapın</h2>
            <p>Kurumsal e-posta adresiniz ve şifrenizle devam edin.</p>
          </div>

          {errorMessage ? <p className="login-error" role="alert">{errorMessage}</p> : null}

          <form className="login-form" action={login}>
            <label htmlFor="email">E-posta adresi</label>
            <input id="email" name="email" type="email" autoComplete="email" placeholder="ornek@kurum.com" required />

            <div className="password-label-row">
              <label htmlFor="password">Şifre</label>
              <a href="#">Şifremi unuttum</a>
            </div>
            <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Şifrenizi girin" required />

            <button className="login-button" type="submit">
              Giriş yap
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </form>

          <div className="login-footer">
            <p>Hesabınız yoksa kurum yöneticinizden davet talep edin.</p>
            <div>
              <a href="#">Gizlilik</a><span aria-hidden="true">•</span>
              <a href="#">Destek</a><span aria-hidden="true">•</span>
              <a href="#">Sistem durumu</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
