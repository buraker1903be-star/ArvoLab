"use client";

import { useEffect, useState } from "react";

/*
  Üst çubukta tarih ve saat (ArvoOS'taki OsSaat). Türkiye saatiyle;
  sunucu UTC'de. İlk çizim boş, saat hidrasyondan sonra yazılır: sunucu
  ile tarayıcı farklı dakikayı çizip uyuşmazlık vermesin.
*/
const saatBicimi = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
const tarihBicimi = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long", timeZone: "Europe/Istanbul" });

export default function OsSaat() {
  const [an, setAn] = useState<{ saat: string; tarih: string } | null>(null);
  useEffect(() => {
    const yaz = () => {
      const simdi = new Date();
      setAn({ saat: saatBicimi.format(simdi), tarih: tarihBicimi.format(simdi) });
    };
    yaz();
    const zamanlayici = window.setInterval(yaz, 15_000);
    return () => window.clearInterval(zamanlayici);
  }, []);
  return (
    <span className="os-saat" suppressHydrationWarning>
      <small>{an?.tarih ?? ""}</small>
      <time>{an?.saat ?? ""}</time>
    </span>
  );
}
