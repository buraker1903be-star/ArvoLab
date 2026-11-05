import { BookOpenCheck, ChartNoAxesCombined, ChevronDown, FileCheck2, PenLine, ShieldCheck, Sparkles } from "lucide-react";
import KimlikKabugu from "@/app/_components/kimlik-kabugu";
import GirisFormu from "@/app/_components/giris-formu";
import KayitPenceresi from "@/app/_components/kayit-penceresi";
import { ceviri } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";
import { BASKA_CIHAZ_BILGISI } from "@/lib/tek-oturum";

/*
  GİRİŞ SAYFASI (02.11.2026'da baştan yazıldı, kurum sahibinin isteği).

  Eskiden sayfa kurumlara hitap ediyordu ("akademik üretimi tek, güvenli ve
  izlenebilir çalışma alanında yönetin") ve kayıt bağlantısı formun altındaki
  küçük bir dipnottaydı. Kayıt artık herkese açık ve ücretsiz denemeyle
  başlıyor (lib/ai/deneme-hakki.ts): sayfaya gelenlerin çoğu henüz hesabı
  olmayan öğrenci ve araştırmacı. Bu yüzden:
   - kayıt, girişin hemen altında kendi kartında ve düğme olarak duruyor;
   - tanıtım, ekranın NE YAPTIĞINI somut olarak anlatıyor ve ürünün iki
     temel sözünü (öneriyi belgeye ekleme kararı kullanıcının, kaynak
     uydurulmaz) açıkça söylüyor.
  Telefonda eski sürümde logo yerine boş bir "A" kutusu çıkıyor, dil
  düğmeleri markanın üstüne biniyordu; üst çubuk artık her genişlikte aynı.

  Deneme süresinin GÜN SAYISI yazılmıyor: ArvoOS'ta ayarlanıyor
  (product_plans.trial_days) ve ArvoLab'ın okuyacağı bir uç nokta yok —
  burada yazılan sayı bir gün ayarla çelişirdi.
*/

/*
  TANITIM METNİ (02.11.2026, kurum sahibinin isteği: "biraz pazarlama dili").
  Dil satış odaklı ama her cümle ürünün GERÇEKTEN yaptığını söylüyor: sayı,
  kullanıcı sayısı ya da müşteri yorumu yok (uydurma bir rakam en kötü
  pazarlamadır), "jüriden geçer" gibi bir söz de yok — ArvoLab onay vermiyor,
  denetliyor. Özellikler "ne var" değil "size ne kazandırır" diye yazıldı.
*/
const OZELLIKLER: { ikon: typeof PenLine; baslik: Metin; aciklama: Metin }[] = [
  {
    ikon: PenLine,
    baslik: { tr: "Kılavuzunuz hep önünüzde", en: "Your guideline, always in view" },
    aciklama: {
      tr: "Üniversitenizin kılavuzunu bir kez yükleyin; zorunlu bölümler, sayfa düzeni ve atıf sistemi siz yazarken editöre uygulanır.",
      en: "Upload your university's guideline once; required sections, page layout and citation style are applied as you write.",
    },
  },
  {
    ikon: BookOpenCheck,
    baslik: { tr: "Kaynakçanız kendiliğinden tutarlı", en: "A reference list that stays consistent" },
    aciklama: {
      tr: "Crossref ve OpenAlex'te arayın, atfı tek tıkla ekleyin; metindeki atıfla kaynakça eşleşmezse anında görün.",
      en: "Search Crossref and OpenAlex, cite in one click, and see instantly when a citation and your reference list don't match.",
    },
  },
  {
    ikon: ChartNoAxesCombined,
    baslik: { tr: "Ayrı istatistik programı gerekmez", en: "No separate stats package needed" },
    aciklama: {
      tr: "T testinden faktör analizine, sonuç tablosu hazır; SPSS, R ve Python sözdizimi de yanında. Veri dosyanız bilgisayarınızdan çıkmaz.",
      en: "From t-tests to factor analysis, with ready result tables plus SPSS, R and Python syntax. Your data file never leaves your computer.",
    },
  },
  {
    ikon: FileCheck2,
    baslik: { tr: "Teslim gününe hazır", en: "Ready for submission day" },
    aciklama: {
      tr: "Teslim kontrol listesi, Word ve PDF çıktısı, danışmanınıza salt okunur paylaşım bağlantısı — son gece sürprizi yok.",
      en: "Submission checklist, Word and PDF export, a read-only link for your advisor — no last-night surprises.",
    },
  },
];

const ADIMLAR: Metin[] = [
  { tr: "Ücretsiz hesabınızı açın", en: "Create your free account" },
  { tr: "Kılavuzunuzu yükleyin", en: "Upload your guideline" },
  { tr: "Yazmaya başlayın", en: "Start writing" },
];

/*
  ARVO AI CÜMLESİ (05.11.2026, kurum sahibinin metni). Eskiden ilkelerin
  ilki "Asistan metninizi yazmaz, denetler" idi; 03.11.2026'dan beri yazım
  asistanı sohbette taslak yazıyor (AGENTS.md, "Asistan yalnızca SOHBETTE
  yazar") ve cümle ürünün yaptığını yanlış anlatıyordu. Değişmeyen söz son
  cümlede: metin belgeye kendiliğinden girmez, eklemek kullanıcının eylemi.
*/
const ARVO_AI: Metin = {
  tr: "Arvo AI, araştırma ve yazım sürecinizde yanınızda. Taslak oluşturabilir, metninizi geliştirebilir ve akademik inceleme yapabilir. Önerileri belgenize ekleme kararı size aittir.",
  en: "Arvo AI is with you throughout your research and writing. It can draft, improve your text and carry out an academic review. The decision to add its suggestions to your document is yours.",
};

const ILKELER: Metin[] = [
  { tr: "Kaynak uydurmaz, gerçek dizinlerde arar", en: "It never invents sources; it searches real indexes" },
  { tr: "Çalışmanız yalnızca size ve yetki verdiklerinize açık", en: "Your work is visible only to you and those you authorize" },
];

type HomePageProps = {
  searchParams: Promise<{ error?: string; next?: string; bilgi?: string; kayit?: string }>;
};

const errorMessages: Record<string, Metin> = {
  "missing-credentials": { tr: "E-posta adresi ve şifre zorunludur.", en: "Email address and password are required." },
  "invalid-credentials": { tr: "E-posta adresi veya şifre hatalı.", en: "Incorrect email address or password." },
  "too-many-attempts": {
    tr: "Çok fazla hatalı deneme yapıldı. 15 dakika sonra tekrar deneyin ya da şifrenizi sıfırlayın.",
    en: "Too many failed attempts. Try again in 15 minutes or reset your password.",
  },
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
  /* Tek cihazda oturum (lib/tek-oturum.ts). "Siz değilseniz" cümlesi bilerek: beklenmeyen giriş, ele geçirilmiş şifrenin ilk işaretidir. */
  [BASKA_CIHAZ_BILGISI]: {
    tr: "Hesabınıza başka bir cihazdan giriş yapıldığı için bu cihazdaki oturumunuz kapatıldı. Bu giriş size ait değilse şifrenizi hemen değiştirin.",
    en: "You were signed out on this device because your account was signed in on another device. If that wasn't you, change your password right away.",
  },
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
  const next = params.next?.startsWith("/dashboard") ? params.next : "";

  return (
    /* Üst çubuk ve alt bilgi ortak kabukta (kimlik-kabugu.tsx): beş giriş sayfası aynı. */
    <KimlikKabugu govde="giris-govde">
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
            <p className="alert" data-tone="warning" role="status">
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
                tr: "Ücretsiz deneme ile hemen başlayın.",
                en: "Start right away with a free trial.",
              })}
            </p>
            {/* Açılır pencere (02.11.2026); JavaScript'siz /kayit sayfasına gider. */}
            <KayitPenceresi acik={params.kayit === "1"} />
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
        <span className="giris-ust-yazi">
          {t({ tr: "Tez ve makale yazanlar için", en: "For thesis and article writers" })}
        </span>
        <h2 id="tanitim-baslik">
          {t({ tr: "Siz yazın, ArvoLab kontrol etsin.", en: "You write. ArvoLab checks." })}
        </h2>
        <p className="giris-tanitim-ozet">
          {t({
            tr: "Kılavuza uymayan bir başlık, kaynakçada eksik bir künye, numarası kaymış bir tablo… Hepsini teslimden önce görün; danışmanınıza ve jüriye daha hazır bir metinle gidin.",
            en: "A heading that breaks the guideline, a missing reference, a table numbered out of order… Catch them all before you submit, and go to your advisor and committee with a stronger draft.",
          })}
        </p>

        {/*
          Özellikler iki biçimde (05.11.2026). Geniş ekranda onaylanmış liste;
          telefonda (auth.css, ≤640px) aynı dört özellik başlık olarak görünür,
          açıklama <details> ile isteğe bağlı açılır. Eskiden telefonda
          tanıtım dört uzun paragrafla 1100px'i aşıyordu. Biri display:none
          olduğu için ekran okuyucu yalnızca görünen biçimi okur; <details>
          klavyeyle ve JavaScript'siz açılır.
        */}
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
        <ul className="giris-ozellikler-kisa" aria-label={t({ tr: "Neler sunar", en: "What it offers" })}>
          {OZELLIKLER.map(({ ikon: Ikon, baslik, aciklama }) => (
            <li key={baslik.tr}>
              <details>
                <summary>
                  <span className="giris-ozellik-ikon" aria-hidden="true">
                    <Ikon size={16} strokeWidth={1.8} />
                  </span>
                  <b>{t(baslik)}</b>
                  <ChevronDown className="giris-ozellik-ok" size={16} aria-hidden="true" />
                </summary>
                <p>{t(aciklama)}</p>
              </details>
            </li>
          ))}
        </ul>

        <div className="giris-baslangic">
          <ol className="giris-adimlar" aria-label={t({ tr: "Üç adımda başlayın", en: "Get started in three steps" })}>
            {ADIMLAR.map((adim, sira) => (
              <li key={adim.tr}>
                <span aria-hidden="true">{sira + 1}</span>
                {t(adim)}
              </li>
            ))}
          </ol>
          {/* Aynı kayıt penceresi; tanıtımı okuyup ikna olan, forma geri dönmeden başlasın. */}
          <KayitPenceresi sinif="giris-tanitim-dugme" etiket={{ tr: "Ücretsiz denemeye başla", en: "Start your free trial" }} />
        </div>

        <p className="giris-ai-notu">
          <Sparkles size={16} aria-hidden="true" />
          <span>{t(ARVO_AI)}</span>
        </p>

        <ul className="giris-ilkeler" aria-label={t({ tr: "İlkelerimiz", en: "Our principles" })}>
          {ILKELER.map((ilke) => (
            <li key={ilke.tr}>
              <ShieldCheck size={15} aria-hidden="true" />
              {t(ilke)}
            </li>
          ))}
        </ul>
      </section>
    </KimlikKabugu>
  );
}
