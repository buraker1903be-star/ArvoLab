import Link from "next/link";
import { ChevronsUpDown, Gauge, LifeBuoy, LogOut, ShieldCheck } from "lucide-react";
import { OsSimge } from "./os-simge";
import type { OsIkon } from "@/lib/os/uygulamalar";
import { ceviri, tarihler } from "@/lib/dil-sunucu";
import type { Metin } from "@/lib/dil";
import { kisaOzet, type HakDurumu, type KullanimHakki } from "@/lib/kullanim-ozeti";

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

/* Hakların adı ve değeri: sayı uydurulmuyor, üç özel durum ayrı yazılıyor. */
const HAK_ADI: Record<KullanimHakki["anahtar"], Metin> = {
  asistanKredisi: { tr: "Asistan kredisi", en: "Assistant credits" },
  denemeHakki: { tr: "Deneme hakkı", en: "Trial uses" },
};
const sayi = (x: number) => new Intl.NumberFormat("tr-TR").format(x);
const HAK_DEGERI: Record<HakDurumu, (h: KullanimHakki) => Metin> = {
  sayili: (h) => ({
    tr: h.toplam ? `${sayi(h.kalan ?? 0)} / ${sayi(h.toplam)} kaldı` : `${sayi(h.kalan ?? 0)} kaldı`,
    en: h.toplam ? `${h.kalan ?? 0} of ${h.toplam} left` : `${h.kalan ?? 0} left`,
  }),
  tukendi: () => ({ tr: "Tükendi", en: "Used up" }),
  sinirsiz: () => ({ tr: "Sınırsız", en: "Unlimited" }),
  bilinmiyor: () => ({ tr: "Bilgi alınamadı", en: "Not available" }),
};
const HAK_OZETI: Record<HakDurumu, (h: KullanimHakki) => Metin> = {
  sayili: (h) => ({ tr: `${sayi(h.kalan ?? 0)} kaldı`, en: `${h.kalan ?? 0} left` }),
  tukendi: () => ({ tr: "Tükendi", en: "Used up" }),
  sinirsiz: () => ({ tr: "Sınırsız", en: "Unlimited" }),
  bilinmiyor: () => ({ tr: "Bilgi yok", en: "No data" }),
};

/** Menüde bir bağlantı: merkezi listeden, layout'ta rolle süzülmüş olarak gelir. */
export type MenuBaglantisi = { key: string; label: string; href: string; ikon: OsIkon };
export default async function KullaniciMenusu({
  ad,
  rol,
  basHarf,
  cikis,
  yerlesim = "ust",
  hesapBaglantilari = [],
  kullanim = [],
}: {
  yerlesim?: "ust" | "kenar";
  ad: string;
  rol: string;
  basHarf: string;
  cikis: () => Promise<void>;
  hesapBaglantilari?: MenuBaglantisi[];
  /** Kalan haklar (lib/kullanim-haklarim.ts); boşsa satır çizilmez. */
  kullanim?: KullanimHakki[];
}) {
  const t = await ceviri();
  const { tarih } = await tarihler();
  const ozet = kisaOzet(kullanim);
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
        {/*
          DİL SEÇİCİ MENÜDEN KALKTI (23.11.2026): dil, sağ üstteki kendi
          düğmesinde. İki yerde iki ayrı seçici olması "hangisi geçerli"
          sorusunu doğuruyordu. Telefonda da üst çubuktaki seçici
          görünüyor (app/styles/shell.css).
        */}
        {/*
          KULLANIM (23.11.2026): kalan hak menüden görünüyor; eskiden
          yalnızca Abonelik ve Kredi sayfasına gidince öğreniliyordu.
          Aynı menünün içinde açılıp kapanıyor (iç içe details): sayfa
          değişmiyor, menü kapanmıyor. Sayılar Abonelik ve Kredi
          ekranıyla AYNI kaynaklardan (lib/kullanim-haklarim.ts).
        */}
        {kullanim.length ? (
          <details className="os-kullanici-kullanim">
            <summary>
              <Gauge size={16} aria-hidden="true" />
              <span className="os-kullanici-kullanim-ad">{t({ tr: "Kullanım", en: "Usage" })}</span>
              {ozet ? <span className="os-kullanici-kullanim-ozet">{t(HAK_OZETI[ozet.durum](ozet))}</span> : null}
            </summary>
            <ul className="os-kullanici-hak">
              {kullanim.map((h) => (
                <li key={h.anahtar}>
                  <span className="os-kullanici-hak-ad">{t(HAK_ADI[h.anahtar])}</span>
                  <span className="os-kullanici-hak-deger" data-durum={h.durum}>
                    {t(HAK_DEGERI[h.durum](h))}
                  </span>
                  {h.yenilenme ? (
                    <small>{t({ tr: `${tarih(h.yenilenme)} tarihinde yenilenir`, en: `Renews on ${tarih(h.yenilenme)}` })}</small>
                  ) : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
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
          {/*
            KOMUT PALETİ SATIRI KALKTI (23.11.2026). Menü kişinin kendi
            hesabı için; palet Ctrl+K / ⌘K ile ve gezinmedeki "Daha
            fazla" penceresinden açılıyor (os-komut-paleti.tsx).
          */}
        </nav>
        {/*
          "Teknik araçlar" (Asistan Kayıtları) 23.11.2026'da menüden
          kalktı: hesap menüsü kişinin KENDİ hesabı için. Sayfa
          başlatıcıda ve Ctrl+K'da duruyor, erişim kuralı değişmedi
          (lib/os/uygulamalar.ts, sayfanın kendi kapısı ve RLS).
        */}
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
