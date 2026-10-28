"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCeviri } from "@/app/_components/dil-saglayici";
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
*/
export default function HeaderTitle() {
  const pathname = usePathname();
  const t = useCeviri();
  const uygulamalar = labUygulamalari(t);
  const uygulama = etkinUygulama(uygulamalar, pathname);
  const bolum = uygulama?.bolumler ? etkinBolum(uygulama.bolumler, pathname) : null;
  const label = bolum?.label ?? uygulama?.label ?? t({ tr: "Çalışma alanı", en: "Workspace" });

  return (
    <Link href="/dashboard" className="os-marka" aria-label={`${t({ tr: "ArvoLab ana sayfa", en: "ArvoLab home" })} · ${label}`}>
      <ArvoLabIsareti />
      <span>
        <b>
          Arvo<em>Lab</em>
        </b>
        <small>{label}</small>
      </span>
    </Link>
  );
}

/*
  Markanın kare işareti: logodaki lacivert "A" ve yeşil nokta. Logonun
  kendisi (public/arvolab-logo.png) 16:9 yatay; 34 piksellik kareye
  sığdırınca okunmuyordu. Renkler CSS'ten (tokens.css), TSX'te ham renk yok.
*/
export function ArvoLabIsareti() {
  return (
    <svg className="os-marka-isaret" viewBox="0 0 34 34" aria-hidden="true">
      <rect className="os-marka-zemin" width="34" height="34" rx="10" />
      <path className="os-marka-harf" d="M10.2 25 15.4 9h3.2L23.8 25h-3.3l-1.2-3.8h-4.6L13.5 25Zm5.4-6.6h2.8L17 13.8Z" />
      <circle className="os-marka-nokta" cx="26.2" cy="23.6" r="2.2" />
    </svg>
  );
}
