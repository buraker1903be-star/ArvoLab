import Image from "next/image";
import Link from "next/link";
import { BookOpenCheck, ChartNoAxesCombined, FileCheck2, PenLine, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import ThemeToggle from "@/app/_components/theme-toggle";
import DilSecici from "@/app/_components/dil-secici";
import GirisFormu from "@/app/_components/giris-formu";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { INGILIZCE_YAYINDA, type Metin } from "@/lib/dil";
import { yasalAdres } from "@/lib/yasal-baglantilar";

/*
  GİRİŞ SAYFASI (02.11.2026'da baştan yazıldı, kurum sahibinin isteği).

  Eskiden sayfa kurumlara hitap ediyordu ("akademik üretimi tek, güvenli ve
  izlenebilir çalışma alanında yönetin") ve kayıt bağlantısı formun altındaki
  küçük bir dipnottaydı. Kayıt artık herkese açık ve ücretsiz denemeyle
  başlıyor (lib/ai/deneme-hakki.ts): sayfaya gelenlerin çoğu henüz hesabı
  olmayan öğrenci ve araştırmacı. Bu yüzden:
   - kayıt, girişin hemen altında kendi kartında ve düğme olarak duruyor;
   - tanıtım, ekranın NE YAPTIĞINI somut olarak anlatıyor ve ürünün iki
     temel sözünü (asistan yazmaz, kaynak uydurmaz) açıkça söylüyor.
  Telefonda eski sürümde logo yerine boş bir "A" kutusu çıkıyor, dil
  düğmeleri markanın üstüne biniyordu; üst çubuk artık her genişlikte aynı.

  Deneme süresinin GÜN SAYISI yazılmıyor: ArvoOS'ta ayarlanıyor
  (product_plans.trial_days) ve ArvoLab'ın okuyacağı bir uç nokta yok —
  burada yazılan sayı bir gün ayarla çelişirdi.
*/

const OZELLIKLER: { ikon: typeof PenLine; baslik: Metin; aciklama: Metin }[] = [
  {
    ikon: PenLine,
    baslik: { tr: "Kılavuza göre yazım", en: "Writing to your guideline" },
    aciklama: {
      tr: "Üniversitenizin kılavuzunu yükleyin; zorunlu bölümler, sayfa düzeni ve atıf sistemi editöre uygulanır.",
      en: "Upload your university's guideline; required sections, page layout and citation style are applied to the editor.",
    },
  },
  {
    ikon: BookOpenCheck,
    baslik: { tr: "Doğrulanmış kaynaklar", en: "Verified sources" },
    aciklama: {
      tr: "Kaynaklarınızı Crossref ve OpenAlex dizinlerinde bulun, kaynakçanızı metindeki atıflarla karşılaştırın.",
      en: "Find sources in the Crossref and OpenAlex indexes and check your reference list against your in-text citations.",
    },
  },
  {
    ikon: ChartNoAxesCombined,
    baslik: { tr: "Analiz Merkezi", en: "Analysis Center" },
    aciklama: {
      tr: "T testinden faktör analizine; hesap tarayıcınızda yapılır, veri dosyanız sunucuya gönderilmez.",
      en: "From t-tests to factor analysis; computed in your browser, your data file is never sent to the server.",
    },
  },
  {
    ikon: FileCheck2,
    baslik: { tr: "Teslime hazırlık", en: "Ready to submit" },
    aciklama: {
      tr: "Teslim kontrol listesi, Word ve PDF çıktısı, danışmanınız için salt okunur paylaşım bağlantısı.",
      en: "Submission checklist, Word and PDF export, and a read-only share link for your advisor.",
    },
  },
];

const ILKELER: Metin[] = [
  { tr: "Asistan metninizi yazmaz, denetler", en: "The assistant reviews your text, it doesn't write it" },
  { tr: "Kaynak uydurmaz, gerçek dizinlerde arar", en: "It never invents sources; it searches real indexes" },
  { tr: "Çalışmanız yalnızca size ve yetki verdiklerinize açık", en: "Your work is visible only to you and those you authorize" },
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
  const dil = await aktifDil();
  const hata = params.error ? errorMessages[params.error] : undefined;
  const bilgi = params.bilgi ? bilgiMesajlari[params.bilgi] : undefined;
  const next = params.next?.startsWith("/dashboard") ? params.next : "";

  return (
    <div className="giris">
      <header className="giris-ust">
        <Image className="giris-logo" src="/arvolab-logo.png" alt="ArvoLab" width={1920} height={1080} priority />
        <div className="giris-ust-araclar">
          {/* Çeviri bitene kadar gizli (lib/dil.ts, INGILIZCE_YAYINDA). */}
          {INGILIZCE_YAYINDA ? <DilSecici sinif="giris-dil" /> : null}
          <ThemeToggle className="dashboard-icon-button" />
        </div>
      </header>

      <main className="giris-govde">
        <section className="giris-panel" aria-labelledby="giris-baslik">
          <div className="login-card">
            <div className="login-heading">
              <span className="login-kicker">{t({ tr: "Çalışma alanınız", en: "Your workspace" })}</span>
              <h1 id="giris-baslik">{t({ tr: "ArvoLab'a giriş yapın", en: "Sign in to ArvoLab" })}</h1>
              <p>{t({ tr: "E-posta adresiniz ve şifrenizle devam edin.", en: "Continue with your email address and password." })}</p>
            </div>

            {hata ? (
              <p className="alert" role="alert">
                {t(hata)}
              </p>
            ) : null}
            {bilgi ? (
              <p className="tone-text" data-tone="warning" role="status">
                {t(bilgi)}
              </p>
            ) : null}

            <GirisFormu next={next} />
          </div>

          {/*
            Kayıt kartı girişin hemen altında ve bir DÜĞME: sayfaya gelenlerin
            çoğu henüz hesabı olmayanlar. Kurumsal kullanıcı notu da burada —
            kurumu ArvoLab kullanan biri kendi başına kayıt olursa bireysel
            denemeye düşer, kurum lisansına bağlanmaz.
          */}
          <aside className="giris-kayit" aria-labelledby="giris-kayit-baslik">
            <div className="giris-kayit-ikon" aria-hidden="true">
              <Sparkles size={18} />
            </div>
            <div className="giris-kayit-govde">
              <h2 id="giris-kayit-baslik">{t({ tr: "ArvoLab'da yeni misiniz?", en: "New to ArvoLab?" })}</h2>
              <p>
                {t({
                  tr: "Ücretsiz deneme ile hemen başlayın; kart bilgisi istenmez.",
                  en: "Start right away with a free trial; no card details required.",
                })}
              </p>
              <Link href="/kayit" className="giris-kayit-dugme">
                <UserPlus size={16} aria-hidden="true" />
                {t({ tr: "Ücretsiz hesap oluştur", en: "Create a free account" })}
              </Link>
              <small>
                {t({
                  tr: "Kurumunuz ArvoLab kullanıyorsa kayıt olmak yerine kurum yöneticinizden davet isteyin.",
                  en: "If your institution uses ArvoLab, ask your institution's administrator for an invitation instead of signing up.",
                })}
              </small>
            </div>
          </aside>
        </section>

        <section className="giris-tanitim" aria-labelledby="tanitim-baslik">
          <span className="giris-ust-yazi" lang="en">
            Research Operating System
          </span>
          <h2 id="tanitim-baslik">
            {t({
              tr: "Tezinizi kılavuza uygun yazın, kaynaklarınızı doğrulayın, güvenle teslim edin.",
              en: "Write your thesis to the guideline, verify your sources, submit with confidence.",
            })}
          </h2>
          <p className="giris-tanitim-ozet">
            {t({
              tr: "ArvoLab, yazdığınızı üniversitenizin kılavuzuna ve kaynakça kurallarına göre denetleyen akademik çalışma alanıdır.",
              en: "ArvoLab is an academic workspace that checks what you write against your university's guideline and citation rules.",
            })}
          </p>

          <ul className="giris-ozellikler">
            {OZELLIKLER.map(({ ikon: Ikon, baslik, aciklama }) => (
              <li key={baslik.tr}>
                <span className="giris-ozellik-ikon" aria-hidden="true">
                  <Ikon size={18} strokeWidth={1.8} />
                </span>
                <span>
                  <b>{t(baslik)}</b>
                  {t(aciklama)}
                </span>
              </li>
            ))}
          </ul>

          <ul className="giris-ilkeler" aria-label={t({ tr: "İlkelerimiz", en: "Our principles" })}>
            {ILKELER.map((ilke) => (
              <li key={ilke.tr}>
                <ShieldCheck size={15} aria-hidden="true" />
                {t(ilke)}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="giris-alt">
        <span>© {new Date().getFullYear()} ArvoCulture Group</span>
        <a href={yasalAdres("gizlilik", dil)} target="_blank" rel="noreferrer">
          {t({ tr: "Gizlilik ve KVKK", en: "Privacy" })}
        </a>
        <a href="https://arvo-os.com" target="_blank" rel="noreferrer">
          arvo-os.com
        </a>
      </footer>
    </div>
  );
}
