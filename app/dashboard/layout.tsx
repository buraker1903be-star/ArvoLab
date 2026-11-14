import AcilirKapatici from "./_components/acilir-kapatici";
import OturumGozcusu from "./_components/oturum-gozcusu";
import SozlesmeOnayi from "./_components/sozlesme-onayi";
import { sozlesmeOnayGerekli } from "@/lib/sozlesme/onay-durumu";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { getCurrentProfile } from "@/app/actions/profile";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/project-labels";
import { sayfaGorunumu } from "@/lib/onizleme-sunucu";
import { GORUNUM_ETIKETI, onizleyebilir } from "@/lib/onizleme";
import { gorunumSec } from "@/app/actions/onizleme";
import ActionForm from "./action-form";
import { getAccessState } from "@/lib/access";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { gorunenUygulamalar, hesapUygulamalari, labUygulamalari, personelAraclari, type OsUygulama } from "@/lib/os/uygulamalar";
import AbonelikKapisi from "./_components/abonelik-kapisi";
import SubscriptionNotice from "./_components/subscription-notice";
import SilmeBekliyor from "./_components/silme-bekliyor";
import ThemeToggle from "@/app/_components/theme-toggle";
import HeaderTitle from "./_components/header-title";
import Toaster from "./_components/toaster";
import NotificationBell from "./_components/notification-bell";
import ActionErrorToast from "./_components/action-error-toast";
import NavProgress from "./_components/nav-progress";
import KullaniciMenusu from "./_components/kullanici-menusu";
import { OsGezinme } from "./_components/os-gezinme";
import { OsBolumSeridi } from "./_components/os-bolum-seridi";
import { OsAramaDugmesi, OsKomutPaleti } from "./_components/os-komut-paleti";
import { seciliKurum } from "@/lib/kurum-secimi-sunucu";
import { kurumSec } from "@/app/actions/kurum-secimi";
import { getOrganizations } from "@/app/actions/team";
import { ADMIN_ROLES } from "@/lib/project-labels";

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
  // Görünüm önizlemesi yalnızca iç ekipte (lib/onizleme.ts).
  const gorunum = await sayfaGorunumu({
    rol: profile?.role,
    personelRolu: profile?.role ? STAFF_ROLES.includes(profile.role) : false,
    kurumVar: Boolean(profile?.organization_id),
  });
  /*
    Rolü yetmeyen uygulamalar dock'tan da başlatıcıdan da düşer. Öğrenci
    önizlemesinde ROL YOK sayılır: eskiden önizlemede de Ekip Yönetimi,
    Ürün Ölçümü ve Kılavuz Kataloğu başlatıcıda görünüyordu, öğrencinin
    göremeyeceği şeyler. Yetki değişmiyor; sayfaların kendi kapısı gerçek rolle.
  */
  const uygulamalar = gorunenUygulamalar(labUygulamalari(t), gorunum.onizleme ? undefined : profile?.role, await aktifDil());
  /*
    Kurum seçici yalnızca iç ekipte (lib/kurum-secimi.ts): kurucu birden çok
    kurumun sahibi ve ekranlar kurumları karışık listeliyordu. Kurum listesi
    okunamazsa seçici çizilmez; seçim görünümü süzer, yetkiyi değil.
  */
  const icEkip = Boolean(profile?.role && ADMIN_ROLES.includes(profile.role));
  const [kurumListesi, kurum] = icEkip ? await Promise.all([getOrganizations(), seciliKurum()]) : [null, null];
  const kurumlar = kurumListesi && !kurumListesi.okunamadi ? kurumListesi.satirlar : [];
  // Hesap menüsü iki yerde çizilir (üst çubuk ve kenar çubuğu); ikisi AYNI değerleri alır.
  const hesapMenusu = {
    ad: userName,
    rol: roleLabel,
    basHarf: initials,
    cikis: logout,
    gorunum: onizleyebilir(profile?.role) ? (gorunum.onizleme ?? "personel") : undefined,
    kurumlar: icEkip && kurumlar.length > 1 ? kurumlar : undefined,
    seciliKurumId: kurum?.id ?? null,
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
          <OsAramaDugmesi />
          <div className="dashboard-header-actions">
            <NotificationBell />
            <ThemeToggle />
            <KullaniciMenusu {...hesapMenusu} yerlesim="ust" />
          </div>
        </header>

        <Suspense>
          <OsBolumSeridi uygulamalar={uygulamalar} />
        </Suspense>

        {/*
          Önizleme açıkken her sayfada görünür: unutulan bir önizleme
          yöneticiye kendi işlerinin (onay, atama) kaybolduğunu düşündürürdü.
        */}
        {/* Seçili kurum her sayfada görünür: unutulan bir süzgeç diğer kurumun işlerini "kaybolmuş" gösterirdi. */}
        {kurum ? (
          <div className="onizleme-serit" role="status">
            <span>
              {t({ tr: "Yalnızca", en: "Showing only" })} <b>{kurum.ad}</b>
              {t({
                tr: " gösteriliyor: çalışmalar, ekip, destek kuyrukları ve ana sayfa bu kuruma göre süzülü.",
                en: ": works, team, support queues and the home page are filtered to this institution.",
              })}
            </span>
            <ActionForm action={kurumSec}>
              <input type="hidden" name="kurum" value="" />
              <button type="submit" className="projects-filter-button button-compact">
                {t({ tr: "Bütün kurumları göster", en: "Show all institutions" })}
              </button>
            </ActionForm>
          </div>
        ) : null}
        {gorunum.onizleme ? (
          <div className="onizleme-serit" role="status">
            <span>
              {t({ tr: "", en: "You are previewing the " })}
              <b>{t(GORUNUM_ETIKETI[gorunum.onizleme])}</b>
              {t({
                tr: " görünümünü önizliyorsunuz. Veriler sizin; rolünüz ve yetkileriniz değişmedi.",
                en: " view. The data is yours; your role and permissions are unchanged.",
              })}
            </span>
            <ActionForm action={gorunumSec}>
              <input type="hidden" name="gorunum" value="personel" />
              <button type="submit" className="projects-filter-button button-compact">
                {t({ tr: "Personel görünümüne dön", en: "Back to staff view" })}
              </button>
            </ActionForm>
          </div>
        ) : null}

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
