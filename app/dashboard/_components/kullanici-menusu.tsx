import Link from "next/link";
import { LifeBuoy, LogOut, Settings, ShieldCheck } from "lucide-react";

/*
  KULLANICI MENÜSÜ (ArvoOS'taki OsKullaniciMenusu).

  Eskiden üst çubukta ad-rol çipi ve ayrı bir "Çıkış yap" düğmesi
  yan yana duruyordu: çubuğun sağ yarısı hesap bilgisine gidiyordu.
  Şimdi tek bir yuvarlak baş harf; tıklayınca kim olarak oturum
  açıldığı, ayarlar, destek ve çıkış. JavaScript'siz açılır (details),
  sunucuda çizilir. "Güvenli oturum aktif" süsü de buraya taşındı.
*/
export default function KullaniciMenusu({
  ad,
  rol,
  basHarf,
  cikis,
}: {
  ad: string;
  rol: string;
  basHarf: string;
  cikis: () => Promise<void>;
}) {
  return (
    <details className="os-kullanici">
      <summary aria-label={`Hesap: ${ad}`}>
        <span className="os-avatar">{basHarf}</span>
      </summary>
      <div className="os-kullanici-menu">
        <div className="os-kullanici-bas">
          <span className="os-avatar os-avatar-buyuk">{basHarf}</span>
          <div>
            <b>{ad}</b>
            <small>{rol}</small>
          </div>
        </div>
        <nav className="os-kullanici-baglantilar" aria-label="Hesap">
          <Link href="/dashboard/settings">
            <Settings size={16} aria-hidden="true" />
            Ayarlar
          </Link>
          <Link href="/dashboard/support">
            <LifeBuoy size={16} aria-hidden="true" />
            Destek
          </Link>
        </nav>
        <form action={cikis} className="os-kullanici-cikis">
          <button type="submit">
            <LogOut size={16} aria-hidden="true" />
            Çıkış yap
          </button>
        </form>
        <p className="os-kullanici-alt">
          <ShieldCheck size={13} aria-hidden="true" /> Güvenli oturum
        </p>
      </div>
    </details>
  );
}
