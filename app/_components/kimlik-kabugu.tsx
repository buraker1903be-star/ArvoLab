import type { ReactNode } from "react";
import Link from "next/link";
import ArvoLabLogosu from "@/app/_components/arvolab-logosu";
import ThemeToggle from "@/app/_components/theme-toggle";
import DilSecici from "@/app/_components/dil-secici";
import { aktifDil, ceviri } from "@/lib/dil-sunucu";
import { INGILIZCE_YAYINDA } from "@/lib/dil";
import { yasalAdres } from "@/lib/yasal-baglantilar";

/*
  GİRİŞ AİLESİNİN ORTAK KABUĞU (Signature OS, 05.11.2026).

  Eskiden yalnızca giriş sayfasında logo, dil seçici ve alt bilgi vardı;
  kayıt, şifremi unuttum, yeni şifre ve e-posta doğrulama sayfaları
  markasız tek bir kart ve sağ üst köşede yüzen bir tema düğmesinden
  ibaretti. E-postadaki bağlantıyla doğrudan doğrulama sayfasına gelen
  kullanıcı hangi sitede olduğunu yalnızca adres çubuğundan anlıyordu ve
  dili DEĞİŞTİREMİYORDU. Beş sayfa artık aynı üst çubuğu ve alt bilgiyi
  bu kabuktan alıyor; kabuk yalnızca görünüş, hiçbir yönlendirme ya da
  oturum kararı vermez (onlar proxy.ts ve app/actions/auth.ts'te).
*/
export default async function KimlikKabugu({ children, govde = "kimlik-tek" }: { children: ReactNode; govde?: string }) {
  const t = await ceviri();
  const dil = await aktifDil();
  return (
    <div className="giris">
      <header className="giris-ust">
        <Link href="/" className="giris-logo-baglanti" aria-label={t({ tr: "ArvoLab giriş sayfası", en: "ArvoLab sign-in page" })}>
          <ArvoLabLogosu className="giris-logo" alt="" oncelikli />
        </Link>
        <div className="giris-ust-araclar">
          {/* Çeviri bitene kadar gizli (lib/dil.ts, INGILIZCE_YAYINDA). */}
          {INGILIZCE_YAYINDA ? <DilSecici sinif="giris-dil" /> : null}
          <ThemeToggle className="dashboard-icon-button giris-tema" />
        </div>
      </header>

      <main className={govde}>{children}</main>

      <footer className="giris-alt">
        <span>© {new Date().getFullYear()} ArvoCulture Group</span>
        <a href={yasalAdres("gizlilik", dil)} target="_blank" rel="noreferrer">
          {t({ tr: "Gizlilik ve KVKK", en: "Privacy" })}
        </a>
        <a href="https://arvo-os.com" target="_blank" rel="noreferrer">
          arvo-os.com
        </a>
      </footer>
    </div>
  );
}
