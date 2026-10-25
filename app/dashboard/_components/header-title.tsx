"use client";

import { usePathname } from "next/navigation";
import { etkinBolum, etkinUygulama, labUygulamalari } from "@/lib/os/uygulamalar";

/*
  Üst çubuktaki sayfa adı. Dock'la AYNI listeden okuyor: başlık bir
  listeden, dock'taki işaretli simge başkasından gelseydi ikisi
  kaçınılmaz olarak ayrışırdı (menü ve komut paletinin ArvoARC'ta
  ayrışması böyle oldu).

  Bölümü olan uygulamada bölümün adı yazılıyor: "Destek" değil
  "Uzman Desteği" — kullanıcının baktığı sayfa odur.
*/
export default function HeaderTitle() {
  const pathname = usePathname();
  const uygulamalar = labUygulamalari();
  const uygulama = etkinUygulama(uygulamalar, pathname);
  const bolum = uygulama?.bolumler ? etkinBolum(uygulama.bolumler, pathname) : null;
  const label = bolum?.label ?? uygulama?.label ?? "ArvoLab";

  return (
    <>
      <div className="dashboard-header-title">
        <span className="dashboard-header-label">ArvoLab</span>
        <strong>{label}</strong>
      </div>
      <div className="dashboard-header-brand">
        <div className="brand-mark" aria-hidden="true">
          A
        </div>
        <strong>{label}</strong>
      </div>
    </>
  );
}
