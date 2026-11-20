import AcilirKapatici from "./_components/acilir-kapatici";
import OturumGozcusu from "./_components/oturum-gozcusu";
import SozlesmeOnayi from "./_components/sozlesme-onayi";
import { sozlesmeOnayGerekli } from "@/lib/sozlesme/onay-durumu";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { getCurrentProfile } from "@/app/actions/profile";
import { ROLE_LABELS } from "@/lib/project-labels";
import { getAccessState } from "@/lib/access";
import { ceviri } from "@/lib/dil-sunucu";
import { gorunenUygulamalar, hesapUygulamalari, labUygulamalari, personelAraclari, type OsUygulama } from "@/lib/os/uygulamalar";
import AbonelikKapisi from "./_components/abonelik-kapisi";
import SubscriptionNotice from "./_components/subscription-notice";
import SilmeBekliyor from "./_components/silme-bekliyor";
import ThemeToggle from "@/app/_components/theme-toggle";
import { UstDilSecici } from "@/app/_components/dil-secici";
import { INGILIZCE_YAYINDA } from "@/lib/dil";
import HeaderTitle from "./_components/header-title";
import Toaster from "./_components/toaster";
import NotificationBell from "./_components/notification-bell";
import ActionErrorToast from "./_components/action-error-toast";
import NavProgress from "./_components/nav-progress";
import KullaniciMenusu from "./_components/kullanici-menusu";
import { OsGezinme } from "./_components/os-gezinme";
import { OsBolumSeridi } from "./_components/os-bolum-seridi";
import { OsAramaDugmesi, OsKomutPaleti } from "./_components/os-komut-paleti";

/* Menüye uygulamanın yalnızca bağlantı için gereken alanları gider (roller, yollar gitmez). */
const menuBaglantisi = ({ key, label, href, ikon }: OsUygulama) => ({ key, label, href, ikon });

function initialsOf(name: string) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
  return letters.toLocaleUpperCase("tr") || "A";
}

/*
  KABUK. 25.10.2026'da kenar çubuğu yerine ArvoOS'taki dock geldi; Phase 3'te
  (04.11.2026, kurum sahibinin kararı: "tek ve tutarlı ana gezinme") dock ve
  "Tüm uygulamalar" ızgarası kalktı, yerine uyarlanır gezinme geldi
  (os-gezinme.tsx): masaüstünde kenar çubuğu, tablette ray, telefonda alt
  çubuk. Liste yine tek (lib/os/uygulamalar.ts); daraltma tercihi yok,
  biçimi ekran boyu belirliyor.
*/
export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [profile, t] = await Promise.all([getCurrentProfile(), ceviri()]);
  const userName = profile?.full_name?.trim() || t({ tr: "Kullanıcı", en: "User" });
  const roleLabel = profile ? t(ROLE_LABELS[profile.role]) : "";
  const initials = initialsOf(userName);
  // Kim girebilir: kurum lisansı ya da bireysel abonelik (lib/access.ts).
  /*
    Kullanım Sözleşmesi'nin yürürlükteki sürümü onaylanmamışsa panel bir
    onay penceresinin arkasında etkisiz kalır (lib/sozlesme). Silme talebi
    bekleyen hesapta sorulmaz: o ekranın tek işi geri dönüş.
  */
  const [access, sozlesmeGerekli] = await Promise.all([
    getAccessState(profile),
    profile && !profile.silme_talebi_at ? sozlesmeOnayGerekli({ id: profile.id, role: profile.role }) : Promise.resolve(false),
  ]);
  /*
    Rolü yetmeyen uygulamalar gezinmeden ve başlatıcıdan düşer. Eskiden iç
    ekip "öğrenci görünümünü önizlerken" rol yok sayılıyordu; önizleme
    20.11.2026'da kalktı (lib/kisisel-calismalar.ts): herkesin ana deneyimi
    aynı. Kurum seçici (iç ekip kurumlar arasında geçiş yapıyordu) ve
    Yönetim sayfası da aynı gün kalktı: ArvoLab tek tip bir araştırma ve
    yazma ürünü; operasyon ArvoOS'ta.
  */
  const uygulamalar = gorunenUygulamalar(labUygulamalari(t), profile?.role);
  // Hesap menüsü iki yerde çizilir (üst çubuk ve kenar çubuğu); ikisi AYNI değerleri alır.
  const hesapMenusu = {
    ad: userName,
    rol: roleLabel,
    basHarf: initials,
    cikis: logout,
    /*
      Hesap menüsünün bağlantıları gezinmeyle AYNI süzülmüş listeden
      (uygulamalar): menü ile kenar çubuğu ayrı ayrı rol kararı verip
      birbirinden sapmasın. Menüde görünmemek erişim yasağı değildir; her
      sayfa kendi sunucu kapısını uygular.
    */
    hesapBaglantilari: hesapUygulamalari(uygulamalar).map(menuBaglantisi),
    personelAraclari: personelAraclari(uygulamalar).map(menuBaglantisi),
  };

  return (
    <div className="dashboard-shell os-root">
      {/* Klavye kullanıcısı her sayfada dock'taki bağlantıları geçmek
          zorunda kalmasın; bağlantı yalnızca odaklanınca görünür. */}
      <a href="#panel-icerik" className="skip-link">
        {t({ tr: "İçeriğe atla", en: "Skip to content" })}
      </a>

      {sozlesmeGerekli ? <SozlesmeOnayi olay="giris" cikis={logout} /> : null}

      <div className="dashboard-content-shell" inert={sozlesmeGerekli || undefined}>
        {/*
          ÜST ÇUBUK (Signature OS 5 / Phase 3, 12.11.2026): sayfa adı, arama
          (Ctrl+K), bildirim ve tema. Logo ve hesap menüsü masaüstünde kenar
          çubuğuna taşındı; tarih-saat göstergesi kaldırıldı (kurum sahibinin
          "üst çubuk sadeleşsin" kararı; saat işletim sisteminde zaten var).
          Tablet ve telefonda logo ve hesap menüsü burada kalır.
        */}
        <header className="dashboard-header">
          <HeaderTitle />
          {/*
            Sayfaya özel eylemlerin yuvası (görsel uyum, 19.11.2026). Yazım
            ekranı ölçek, kayıt durumu, Kontroller ve Dışa aktar'ı buraya
            portal ile koyar (manuscript-editor.tsx); prototipteki gibi tek
            üst bant. Öteki sayfalarda boş kalır ve yer kaplamaz.
          */}
          <div id="ust-cubuk-yuva" className="cluster yazma-eylemleri ust-cubuk-yuva" />
          <OsAramaDugmesi />
          <div className="dashboard-header-actions">
            <NotificationBell />
            <ThemeToggle />
            {/* Dil seçici üst çubukta (onaylı tasarım); İngilizce yayında değilken çizilmez. */}
            {INGILIZCE_YAYINDA ? <UstDilSecici /> : null}
            <KullaniciMenusu {...hesapMenusu} yerlesim="ust" />
          </div>
        </header>

        <Suspense>
          <OsBolumSeridi uygulamalar={uygulamalar} />
        </Suspense>

        <div className="dashboard-main-content" id="panel-icerik" tabIndex={-1}>
          <Suspense>
            <ActionErrorToast />
            <NavProgress />
          </Suspense>
          {/*
            Sıra önemli: silme talebi aboneliğin ÖNÜNDE geliyor. Aboneliği de
            bitmiş bir kullanıcıya önce ödeme ekranını göstermek, "geri dön"
            düğmesini parasını ödemeden ulaşılamaz bir yere koyardı.
          */}
          {profile?.silme_talebi_at ? (
            <SilmeBekliyor talep={profile.silme_talebi_at} />
          ) : (
            /* Destek, Abonelik ve Ayarlar kapalı erişimde de açık (lib/abonelik-kapisi.ts). */
            <AbonelikKapisi kapali={access.blocked} uyari={<SubscriptionNotice access={access} />}>
              {children}
            </AbonelikKapisi>
          )}
        </div>
      </div>

      {/* Onay penceresi açıkken gezinme ve komut paleti (Ctrl+K) çizilmez: pencerenin üstüne açılıp odağı çalmasınlar. */}
      {sozlesmeGerekli ? null : (
        <>
          <Suspense>
            <OsGezinme uygulamalar={uygulamalar} hesap={<KullaniciMenusu {...hesapMenusu} yerlesim="kenar" />} />
          </Suspense>
          {/* Çıkış bir sunucu eylemi: istemci bileşenine referans olarak geçilebiliyor. */}
          <OsKomutPaleti uygulamalar={uygulamalar} cikis={logout} />
        </>
      )}
      {/* Kullanıcı menüsü ve kart menüleri dışarı tıklayınca kapansın. */}
      <AcilirKapatici />
      {/* Başka cihazdan girişle kapatılan oturumu bekleyen sekmede de fark eder (lib/tek-oturum.ts). */}
      <OturumGozcusu />
      <Toaster />
    </div>
  );
}
