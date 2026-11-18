import { ArrowRight } from "lucide-react";
import KimlikYerlesimi from "@/app/_components/kimlik/kimlik-yerlesimi";
import GirisFormu from "@/app/_components/giris-formu";
import KayitPenceresi from "@/app/_components/kayit-penceresi";
import { Bildirim } from "@/app/_components/ui/bildirim";
import { dugmeSinifi } from "@/lib/os5/bilesen";
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
     temel sözünü (asistan yazmaz, kaynak uydurmaz) açıkça söylüyor.
  Telefonda eski sürümde logo yerine boş bir "A" kutusu çıkıyor, dil
  düğmeleri markanın üstüne biniyordu; üst çubuk artık her genişlikte aynı.

  Signature OS 5 / Phase 2 (12.11.2026): tanıtım alanı (özellik kartları,
  üç adım, ilkeler) kaldırıldı; sayfa ortak kimlik yerleşimine geçti
  (app/_components/kimlik/kimlik-yerlesimi.tsx). Kurum sahibinin kararı:
  giriş ekranında pazarlama metni yok. Kayıt girişin hemen altında ve hâlâ
  bir düğme. Tanıtımdaki "asistan metninizi yazmaz" ilkesi 03.11.2026'dan
  beri doğru değildi (yazım asistanı sohbette yazıyor); kaldırılınca o
  çelişki de gitti. Hata/bilgi eşlemeleri ve `next` süzgeci aynen duruyor.

  Deneme süresinin GÜN SAYISI yazılmıyor: ArvoOS'ta ayarlanıyor
  (product_plans.trial_days) ve ArvoLab'ın okuyacağı bir uç nokta yok —
  burada yazılan sayı bir gün ayarla çelişirdi.
*/

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
    <KimlikYerlesimi>
      <header className="os5-kimlik-baslik">
        <h1 id="giris-baslik">{t({ tr: "ArvoLab'a giriş yapın", en: "Sign in to ArvoLab" })}</h1>
        <p>{t({ tr: "E-posta adresiniz ve şifrenizle devam edin.", en: "Continue with your email address and password." })}</p>
      </header>

      {hata || bilgi ? (
        <div className="os5-kimlik-bildirimler">
          {hata ? (
            <Bildirim ton="hata" rol="alert">
              {t(hata)}
            </Bildirim>
          ) : null}
          {bilgi ? (
            <Bildirim ton="uyari" rol="status">
              {t(bilgi)}
            </Bildirim>
          ) : null}
        </div>
      ) : null}

      <GirisFormu next={next} />

      {/*
        Kayıt girişin hemen altında ve bir DÜĞME: sayfaya gelenlerin çoğu
        henüz hesabı olmayanlar. Kurumsal kullanıcı notu da burada — kurumu
        ArvoLab kullanan biri kendi başına kayıt olursa bireysel denemeye
        düşer, kurum lisansına bağlanmaz.
      */}
      <section className="os5-kimlik-kayit" aria-labelledby="giris-kayit-baslik">
        <h2 id="giris-kayit-baslik">{t({ tr: "ArvoLab'da yeni misiniz?", en: "New to ArvoLab?" })}</h2>
        <p>{t({ tr: "Ücretsiz deneme ile hemen başlayın.", en: "Start right away with a free trial." })}</p>
        {/* Açılır pencere (02.11.2026); JavaScript'siz /kayit sayfasına gider. */}
        <KayitPenceresi acik={params.kayit === "1"} sinif={dugmeSinifi({ tur: "ikincil", tamGenislik: true })} sonEk={<ArrowRight size={16} aria-hidden="true" />} />
        <small>
          {t({
            tr: "Kurumunuz ArvoLab kullanıyorsa kayıt olmak yerine kurum yöneticinizden davet isteyin.",
            en: "If your institution uses ArvoLab, ask your institution's administrator for an invitation instead of signing up.",
          })}
        </small>
      </section>
    </KimlikYerlesimi>
  );
}
