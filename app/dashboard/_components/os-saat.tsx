"use client";

import { useEffect, useState } from "react";
import { useDil } from "@/app/_components/dil-saglayici";
import { YEREL } from "@/lib/dil";

/*
  Üst çubukta tarih ve saat (ArvoOS'taki OsSaat). Türkiye saatiyle;
  sunucu UTC'de. İlk çizim boş, saat hidrasyondan sonra yazılır: sunucu
  ile tarayıcı farklı dakikayı çizip uyuşmazlık vermesin.
*/
/*
  Türkçede Türkiye saati; İngilizcede kullanıcının KENDİ saat dilimi (tarayıcı).
  Yurt dışındaki kullanıcıya İstanbul saatini göstermek, köşedeki saati
  yanlış saate çevirirdi.
*/
export default function OsSaat() {
  const dil = useDil();
  const [an, setAn] = useState<{ saat: string; tarih: string } | null>(null);
  useEffect(() => {
    const timeZone = dil === "tr" ? "Europe/Istanbul" : undefined;
    const saatBicimi = new Intl.DateTimeFormat(YEREL[dil], { hour: "2-digit", minute: "2-digit", timeZone });
    const tarihBicimi = new Intl.DateTimeFormat(YEREL[dil], { day: "numeric", month: "long", weekday: "long", timeZone });
    const yaz = () => {
      const simdi = new Date();
      setAn({ saat: saatBicimi.format(simdi), tarih: tarihBicimi.format(simdi) });
    };
    yaz();
    const zamanlayici = window.setInterval(yaz, 15_000);
    return () => window.clearInterval(zamanlayici);
  }, [dil]);
  return (
    <span className="os-saat" suppressHydrationWarning>
      <small>{an?.tarih ?? ""}</small>
      <time>{an?.saat ?? ""}</time>
    </span>
  );
}
