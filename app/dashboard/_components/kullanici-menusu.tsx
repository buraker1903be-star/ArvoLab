import Link from "next/link";
import { ChevronsUpDown, LifeBuoy, LogOut, ShieldCheck } from "lucide-react";
import { OsSimge } from "./os-simge";
import type { OsIkon } from "@/lib/os/uygulamalar";
import { ceviri } from "@/lib/dil-sunucu";
import { INGILIZCE_YAYINDA } from "@/lib/dil";
import DilSecici from "@/app/_components/dil-secici";
import { KomutPaletiAcOgesi } from "./os-komut-paleti";

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
  yerlesim = "ust",
  hesapBaglantilari = [],
  personelAraclari = [],
}: {
  yerlesim?: "ust" | "kenar";
  ad: string;
  rol: string;
  basHarf: string;
  cikis: () => Promise<void>;
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
        {/*
          "Görünüm" seçimi (Personel / Öğrenci · kurum / Öğrenci · bireysel)
          ve iç ekibin kurum seçicisi 20.11.2026'da kalktı: herkesin ana
          deneyimi aynı (lib/kisisel-calismalar.ts), operasyon ArvoOS'ta.
        */}
        {/* Çeviri bitene kadar yalnızca iç ekipte (lib/dil.ts, INGILIZCE_YAYINDA). */}
        {INGILIZCE_YAYINDA ? <DilSecici /> : null}
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
          {/* Üst çubuktaki arama kutusu kalktı (20.11.2026); palete buradan ve Ctrl+K ile ulaşılır. */}
          <KomutPaletiAcOgesi className="os-kullanici-komut" />
        </nav>
        {personelAraclari.length ? (
          /*
            Başlık görünür ama ekran okuyucuya nav'ın adı olarak okunur
            (aria-label): menü iki yerleşimde çizildiği için id ile
            bağlamak sayfada aynı id'yi iki kez üretirdi.
          */
          /*
            "Teknik araçlar": yalnızca asistan kayıtları (teknik iç ekip).
            20.11.2026'ya kadar başlığı önce "Yönetim", sonra "Ekip
            araçları"ydı; kurum ekranı, doçentlik puanı ve Ekip Yönetimi
            de buradaydı, üçü de kalktı (üyelik ve rol ArvoOS'ta).
          */
          <nav className="os-kullanici-baglantilar" aria-label={t({ tr: "Teknik araçlar", en: "Technical tools" })}>
            <small className="os-kullanici-bolum" aria-hidden="true">
              {t({ tr: "Teknik araçlar", en: "Technical tools" })}
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
