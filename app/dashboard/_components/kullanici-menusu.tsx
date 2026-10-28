import Link from "next/link";
import { Building2, Check, Eye, LifeBuoy, LogOut, Settings, ShieldCheck, CreditCard } from "lucide-react";
import ActionForm from "../action-form";
import { gorunumSec } from "@/app/actions/onizleme";
import { kurumSec } from "@/app/actions/kurum-secimi";
import { GORUNUMLER, GORUNUM_ETIKETI, type Gorunum } from "@/lib/onizleme";
import { ceviri } from "@/lib/dil-sunucu";
import { INGILIZCE_YAYINDA } from "@/lib/dil";
import DilSecici from "@/app/_components/dil-secici";

/*
  KULLANICI MENÜSÜ (ArvoOS'taki OsKullaniciMenusu).

  Eskiden üst çubukta ad-rol çipi ve ayrı bir "Çıkış yap" düğmesi
  yan yana duruyordu: çubuğun sağ yarısı hesap bilgisine gidiyordu.
  Şimdi tek bir yuvarlak baş harf; tıklayınca kim olarak oturum
  açıldığı, ayarlar, destek ve çıkış. JavaScript'siz açılır (details),
  sunucuda çizilir. "Güvenli oturum aktif" süsü de buraya taşındı.
*/
export default async function KullaniciMenusu({
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
  const t = await ceviri();
  return (
    <details className="os-kullanici">
      <summary aria-label={`${t({ tr: "Hesap", en: "Account" })}: ${ad}`}>
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
              <Eye size={13} aria-hidden="true" /> {t({ tr: "Görünüm", en: "View" })}
            </small>
            {GORUNUMLER.map((secenek) => (
              <ActionForm key={secenek} action={gorunumSec}>
                <input type="hidden" name="gorunum" value={secenek} />
                <button type="submit" aria-pressed={gorunum === secenek}>
                  {t(GORUNUM_ETIKETI[secenek])}
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
              <Building2 size={13} aria-hidden="true" /> {t({ tr: "Kurum", en: "Institution" })}
            </small>
            {[{ id: "", name: t({ tr: "Bütün kurumlar", en: "All institutions" }) }, ...kurumlar].map((k) => (
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
        {/* Çeviri bitene kadar yalnızca iç ekipte (lib/dil.ts, INGILIZCE_YAYINDA). */}
        {INGILIZCE_YAYINDA || gorunum ? <DilSecici /> : null}
        <nav className="os-kullanici-baglantilar" aria-label={t({ tr: "Hesap", en: "Account" })}>
          <Link href="/dashboard/settings">
            <Settings size={16} aria-hidden="true" />
            {t({ tr: "Ayarlar", en: "Settings" })}
          </Link>
          <Link href="/dashboard/abonelik">
            <CreditCard size={16} aria-hidden="true" />
            {t({ tr: "Abonelik ve kredi", en: "Subscription and credits" })}
          </Link>
          <Link href="/dashboard/expert-requests">
            <LifeBuoy size={16} aria-hidden="true" />
            {t({ tr: "Destek", en: "Support" })}
          </Link>
        </nav>
        <form action={cikis} className="os-kullanici-cikis">
          <button type="submit">
            <LogOut size={16} aria-hidden="true" />
            {t({ tr: "Çıkış yap", en: "Sign out" })}
          </button>
        </form>
        <p className="os-kullanici-alt">
          <ShieldCheck size={13} aria-hidden="true" /> {t({ tr: "Güvenli oturum", en: "Secure session" })}
        </p>
      </div>
    </details>
  );
}
