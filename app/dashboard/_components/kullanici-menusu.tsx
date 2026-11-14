import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Eye, LifeBuoy, LogOut, ShieldCheck } from "lucide-react";
import { OsSimge } from "./os-simge";
import type { OsIkon } from "@/lib/os/uygulamalar";
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

  Signature OS 5 / Phase 3 (12.11.2026): masaüstünde menü kenar
  çubuğunun dibinde (yerlesim="kenar"): ad ve rol yazılı bir satır,
  menü YUKARI açılır. Tablet ve telefonda üst çubuktaki yuvarlak baş
  harf kalır (yerlesim="ust"). İkisi de layout'ta çizilir, hangisinin
  görüneceğini CSS seçer; gizli olan display:none olduğu için ekran
  okuyucu tek menü okur. İçerik ve eylemler (çıkış, görünüm, kurum)
  iki yerleşimde birebir aynı.

  Phase 5.1d-3 (14.11.2026): hesap bağlantıları (Ayarlar, Kullanım
  Kılavuzu, Abonelik ve Kredi) ve "Personel Araçları" merkezi listeden
  gelir (lib/os/uygulamalar.ts: hesapUygulamalari, personelAraclari);
  eskiden bağlantılar burada elle yazılıydı ve personel sayfaları kenar
  çubuğunun "Diğer" grubundaydı.
*/

/** Menüde bir bağlantı: merkezi listeden, layout'ta rolle süzülmüş olarak gelir. */
export type MenuBaglantisi = { key: string; label: string; href: string; ikon: OsIkon };
export default async function KullaniciMenusu({
  ad,
  rol,
  basHarf,
  cikis,
  gorunum,
  kurumlar,
  seciliKurumId = null,
  yerlesim = "ust",
  hesapBaglantilari = [],
  personelAraclari = [],
}: {
  yerlesim?: "ust" | "kenar";
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
  hesapBaglantilari?: MenuBaglantisi[];
  /*
    Rolüne açık personel araçları; öğrencide boş gelir ve bölüm hiç
    çizilmez. Bu bir GÖRÜNÜRLÜK kararıdır, güvenlik denetimi değil: her
    sayfa erişimi kendi sunucu kapısında ve RLS'te denetler.
  */
  personelAraclari?: MenuBaglantisi[];
}) {
  const t = await ceviri();
  return (
    <details className={yerlesim === "kenar" ? "os-kullanici os-kullanici--kenar" : "os-kullanici os-kullanici--ust"}>
      <summary aria-label={`${t({ tr: "Hesap", en: "Account" })}: ${ad}`}>
        <span className="os-avatar">{basHarf}</span>
        {yerlesim === "kenar" ? (
          <>
            <span className="os-kullanici-kimlik" aria-hidden="true">
              <b>{ad}</b>
              <small>{rol}</small>
            </span>
            <ChevronsUpDown size={16} aria-hidden="true" />
          </>
        ) : null}
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
          {hesapBaglantilari.map((b) => (
            <Link key={b.key} href={b.href}>
              <OsSimge ad={b.ikon} boyut={16} />
              {b.label}
            </Link>
          ))}
          {/* Destek ana gezinmede de var; yardım isteyen kişi önce kendi menüsüne bakıyor. */}
          <Link href="/dashboard/expert-requests">
            <LifeBuoy size={16} aria-hidden="true" />
            {t({ tr: "Destek", en: "Support" })}
          </Link>
        </nav>
        {personelAraclari.length ? (
          /*
            Başlık görünür ama ekran okuyucuya nav'ın adı olarak okunur
            (aria-label): menü iki yerleşimde çizildiği için id ile
            bağlamak sayfada aynı id'yi iki kez üretirdi.
          */
          <nav className="os-kullanici-baglantilar" aria-label={t({ tr: "Personel Araçları", en: "Staff tools" })}>
            <small className="os-kullanici-bolum" aria-hidden="true">
              {t({ tr: "Personel Araçları", en: "Staff tools" })}
            </small>
            {personelAraclari.map((b) => (
              <Link key={b.key} href={b.href}>
                <OsSimge ad={b.ikon} boyut={16} />
                {b.label}
              </Link>
            ))}
          </nav>
        ) : null}
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
