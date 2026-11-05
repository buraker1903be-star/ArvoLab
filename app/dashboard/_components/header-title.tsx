"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { etkinBolum, etkinUygulama, labUygulamalari } from "@/lib/os/uygulamalar";
import ArvoLabLogosu from "@/app/_components/arvolab-logosu";

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
/*
  Signature OS (04.11.2026): bu bileşen artık YALNIZCA TELEFONDA görünür
  (shell.css). Tablet ve masaüstünde marka kenar çubuğunun başında,
  üst çubukta konum yolu (konum-yolu.tsx) duruyor; telefonda üç öğelik
  bir yol sığmıyor ve kenar çubuğu yok.

  Logo (05.11.2026): kodla çizilmiş "A" işareti ve "ArvoLab" yazısı
  kalktı; yerinde orijinal logo (app/_components/arvolab-logosu.tsx).
  Altında açık uygulamanın adı kalıyor: telefonda kullanıcının nerede
  olduğunu söyleyen tek yer.
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
      <ArvoLabLogosu alt="" />
      <small aria-hidden="true">{label}</small>
    </Link>
  );
}
