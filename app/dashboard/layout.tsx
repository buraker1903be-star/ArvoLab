import AcilirKapatici from "./_components/acilir-kapatici";
import { Suspense } from "react";
import { logout } from "@/app/actions/auth";
import { getCurrentProfile } from "@/app/actions/profile";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/project-labels";
import { sayfaGorunumu } from "@/lib/onizleme-sunucu";
import { GORUNUM_ETIKETI, onizleyebilir } from "@/lib/onizleme";
import { gorunumSec } from "@/app/actions/onizleme";
import ActionForm from "./action-form";
import { getAccessState } from "@/lib/access";
import { gorunenUygulamalar, labUygulamalari } from "@/lib/os/uygulamalar";
import SubscriptionNotice from "./_components/subscription-notice";
import SilmeBekliyor from "./_components/silme-bekliyor";
import ThemeToggle from "@/app/_components/theme-toggle";
import HeaderTitle from "./_components/header-title";
import Toaster from "./_components/toaster";
import NotificationBell from "./_components/notification-bell";
import ActionErrorToast from "./_components/action-error-toast";
import NavProgress from "./_components/nav-progress";
import OsSaat from "./_components/os-saat";
import KullaniciMenusu from "./_components/kullanici-menusu";
import { OsDock } from "./_components/os-dock";
import { OsBolumSeridi } from "./_components/os-bolum-seridi";
import { OsAramaDugmesi, OsKomutPaleti } from "./_components/os-komut-paleti";
import { seciliKurum } from "@/lib/kurum-secimi-sunucu";
import { kurumSec } from "@/app/actions/kurum-secimi";
import { getOrganizations } from "@/app/actions/team";
import { ADMIN_ROLES } from "@/lib/project-labels";

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
  DOCK KABUĞU (25.10.2026, kurum sahibinin isteği). Kenar çubuğu ve
  mobil sekme çubuğu kalktı; her iş alanı artık bir "uygulama" ve
  hepsi tek listeden besleniyor (lib/os/uygulamalar.ts) — ArvoOS ile
  ArvoARC'taki düzenin aynısı.

  Daraltma tercihi (NAV_COOKIE) da gitti: dock'un daraltılacak bir
  hâli yok. Çerez okunmuyor, yazan bileşen de kaldırıldı.
*/
export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await getCurrentProfile();
  const userName = profile?.full_name?.trim() || "Kullanıcı";
  const roleLabel = profile ? ROLE_LABELS[profile.role] : "";
  const initials = initialsOf(userName);
  // Kim girebilir: kurum lisansı ya da bireysel abonelik (lib/access.ts).
  const access = await getAccessState(profile);
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
  const uygulamalar = gorunenUygulamalar(labUygulamalari(), gorunum.onizleme ? undefined : profile?.role);
  /*
    Kurum seçici yalnızca iç ekipte (lib/kurum-secimi.ts): kurucu birden çok
    kurumun sahibi ve ekranlar kurumları karışık listeliyordu. Kurum listesi
    okunamazsa seçici çizilmez; seçim görünümü süzer, yetkiyi değil.
  */
  const icEkip = Boolean(profile?.role && ADMIN_ROLES.includes(profile.role));
  const [kurumListesi, kurum] = icEkip ? await Promise.all([getOrganizations(), seciliKurum()]) : [null, null];
  const kurumlar = kurumListesi && !kurumListesi.okunamadi ? kurumListesi.satirlar : [];

  return (
    <div className="dashboard-shell os-root">
      {/* Klavye kullanıcısı her sayfada dock'taki bağlantıları geçmek
          zorunda kalmasın; bağlantı yalnızca odaklanınca görünür. */}
      <a href="#panel-icerik" className="skip-link">
        İçeriğe atla
      </a>

      <div className="dashboard-content-shell">
        <header className="dashboard-header">
          <HeaderTitle />
          <OsAramaDugmesi />
          <div className="dashboard-header-actions">
            <OsSaat />
            <NotificationBell />
            <ThemeToggle />
            <KullaniciMenusu
              ad={userName}
              rol={roleLabel}
              basHarf={initials}
              cikis={logout}
              gorunum={onizleyebilir(profile?.role) ? (gorunum.onizleme ?? "personel") : undefined}
              kurumlar={icEkip && kurumlar.length > 1 ? kurumlar : undefined}
              seciliKurumId={kurum?.id ?? null}
            />
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
              Yalnızca <b>{kurum.ad}</b> gösteriliyor: çalışmalar, ekip, destek kuyrukları ve ana sayfa bu kuruma göre süzülü.
            </span>
            <ActionForm action={kurumSec}>
              <input type="hidden" name="kurum" value="" />
              <button type="submit" className="projects-filter-button button-compact">
                Bütün kurumları göster
              </button>
            </ActionForm>
          </div>
        ) : null}
        {gorunum.onizleme ? (
          <div className="onizleme-serit" role="status">
            <span>
              <b>{GORUNUM_ETIKETI[gorunum.onizleme]}</b> görünümünü önizliyorsunuz. Veriler sizin; rolünüz ve
              yetkileriniz değişmedi.
            </span>
            <ActionForm action={gorunumSec}>
              <input type="hidden" name="gorunum" value="personel" />
              <button type="submit" className="projects-filter-button button-compact">
                Personel görünümüne dön
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
          ) : access.blocked ? (
            <SubscriptionNotice access={access} />
          ) : (
            children
          )}
        </div>
      </div>

      <Suspense>
        <OsDock uygulamalar={uygulamalar} />
      </Suspense>
      {/* Çıkış bir sunucu eylemi: istemci bileşenine referans olarak geçilebiliyor. */}
      <OsKomutPaleti uygulamalar={uygulamalar} cikis={logout} />
      {/* Kullanıcı menüsü ve kart menüleri dışarı tıklayınca kapansın. */}
      <AcilirKapatici />
      <Toaster />
    </div>
  );
}
