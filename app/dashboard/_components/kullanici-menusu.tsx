import Link from "next/link";
import { Building2, Check, Eye, LifeBuoy, LogOut, Settings, ShieldCheck, CreditCard } from "lucide-react";
import ActionForm from "../action-form";
import { gorunumSec } from "@/app/actions/onizleme";
import { kurumSec } from "@/app/actions/kurum-secimi";
import { GORUNUMLER, GORUNUM_ETIKETI, type Gorunum } from "@/lib/onizleme";

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
  gorunum,
  kurumlar,
  seciliKurumId = null,
}: {
  ad: string;
  rol: string;
  basHarf: string;
  cikis: () => Promise<void>;
  /*
    Yalnızca iç ekipte verilir (lib/onizleme.ts): seçili görünüm.
    Verilmezse menüde görünüm bölümü yok.
  */
  gorunum?: Gorunum;
  /* Yalnızca iç ekipte ve birden çok kurum varsa verilir (lib/kurum-secimi.ts). */
  kurumlar?: { id: string; name: string }[];
  seciliKurumId?: string | null;
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
        {gorunum ? (
          /*
            GÖRÜNÜM ÖNİZLEMESİ: ana sayfa ve Çalışmalarım'ı öğrencinin
            düzeninde gösterir. Yalnızca düzen; veriler ve yetkiler aynı.
          */
          <div className="os-kullanici-gorunum">
            <small>
              <Eye size={13} aria-hidden="true" /> Görünüm
            </small>
            {GORUNUMLER.map((secenek) => (
              <ActionForm key={secenek} action={gorunumSec}>
                <input type="hidden" name="gorunum" value={secenek} />
                <button type="submit" aria-pressed={gorunum === secenek}>
                  {GORUNUM_ETIKETI[secenek]}
                  {gorunum === secenek ? <Check size={15} aria-hidden="true" /> : null}
                </button>
              </ActionForm>
            ))}
          </div>
        ) : null}
        {kurumlar ? (
          /*
            KURUM SEÇİMİ: çalışmalar, ekip, destek kuyrukları ve ana sayfa
            seçilen kuruma göre süzülür. Yalnızca görünüm; yetki aynı.
          */
          <div className="os-kullanici-gorunum">
            <small>
              <Building2 size={13} aria-hidden="true" /> Kurum
            </small>
            {[{ id: "", name: "Bütün kurumlar" }, ...kurumlar].map((k) => (
              <ActionForm key={k.id || "tumu"} action={kurumSec}>
                <input type="hidden" name="kurum" value={k.id} />
                <button type="submit" aria-pressed={(seciliKurumId ?? "") === k.id}>
                  {k.name}
                  {(seciliKurumId ?? "") === k.id ? <Check size={15} aria-hidden="true" /> : null}
                </button>
              </ActionForm>
            ))}
          </div>
        ) : null}
        <nav className="os-kullanici-baglantilar" aria-label="Hesap">
          <Link href="/dashboard/settings">
            <Settings size={16} aria-hidden="true" />
            Ayarlar
          </Link>
          <Link href="/dashboard/abonelik">
            <CreditCard size={16} aria-hidden="true" />
            Abonelik ve kredi
          </Link>
          <Link href="/dashboard/expert-requests">
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
