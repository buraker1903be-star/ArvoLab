"use client";

import { useState } from "react";
import type { AyarlarVerisi } from "@/app/actions/ayarlar";
import AyarlarIcerik, { type Sekme } from "@/app/dashboard/_components/ayarlar-icerik";

/*
  /dashboard/settings SAYFASI (24.11.2026).

  Ayarlar artık her yerden açılan bir pencere, ama adres DOĞRUDAN
  açıldığında (yer imi, eski bağlantı, yeni sekme, JavaScript kapalıyken
  menüdeki bağlantı) aynı içeriğe sayfa olarak ulaşılabiliyor. İçerik
  tek bileşenden (ayarlar-icerik.tsx): iki yerde iki ayrı ayar ekranı
  tutulsaydı biri eskirdi.

  Sayfada "kaydedilmemiş taslak" sorusu yok: kapatılacak bir pencere yok
  ve sayfadan ayrılmayı tarayıcı kendi soruyor.
*/
export default function AyarlarSayfasi({ veri }: { veri: AyarlarVerisi }) {
  const [sekme, setSekme] = useState<Sekme>("hesap");
  return (
    <div className="ayarlar-sayfa">
      <AyarlarIcerik veri={veri} sekme={sekme} sekmeDegis={setSekme} />
    </div>
  );
}
