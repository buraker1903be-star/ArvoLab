"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCeviri } from "@/app/_components/dil-saglayici";
import ArvoLabLogosu from "@/app/_components/arvolab-logosu";
import { etkinBolum, etkinUygulama, labUygulamalari } from "@/lib/os/uygulamalar";

/*
  ÜST ÇUBUĞUN SOLU: marka ve açık uygulama (ArvoOS'taki os-brand).

  Eskiden yalnızca "ARVOLAB" etiketi ve sayfa adı yazıyordu; marka bir
  yazı satırıydı, ana sayfaya dönmenin yolu yoktu. Şimdi işaret + ad bir
  bağlantı ve altında açık uygulamanın adı — ArvoOS'ta "AkademikMerkez /
  Ana ekran" nasılsa öyle.

  Ad dock'la AYNI listeden okunuyor: başlık bir listeden, dock'taki
  işaretli simge başkasından gelseydi ikisi ayrışırdı. Bölümü olan
  uygulamada bölümün adı yazılıyor ("Kaynaklar" değil "Kaynakça
  doğrulama") — kullanıcının baktığı sayfa odur.

  Signature OS 5 / Phase 3 (12.11.2026): kodla çizilmiş "A" işareti ve
  "Arvo<em>Lab</em>" yazısı kalktı, yerine resmî logo geldi
  (ArvoLabLogosu, temaya göre açık/koyu varyant). Logo yeniden çizilmez
  kuralı (arvolab-logosu.tsx) üst çubukta çiğneniyordu. Masaüstünde logo
  kenar çubuğunun tepesinde; burada gizlenir (os-shell.css) ve üst
  çubukta yalnızca açık sayfanın adı kalır.
*/
export default function HeaderTitle() {
  const pathname = usePathname();
  const t = useCeviri();
  const uygulamalar = labUygulamalari(t);
  const uygulama = etkinUygulama(uygulamalar, pathname);
  const bolum = uygulama?.bolumler ? etkinBolum(uygulama.bolumler, pathname) : null;
  const label = bolum?.label ?? uygulama?.label ?? t({ tr: "Çalışma alanı", en: "Workspace" });

  return (
    <div className="os-marka">
      <Link href="/dashboard" className="os-marka-logo" aria-label={t({ tr: "ArvoLab ana sayfa", en: "ArvoLab home" })}>
        <ArvoLabLogosu alt="" />
      </Link>
      <span className="os-marka-sayfa">{label}</span>
    </div>
  );
}
