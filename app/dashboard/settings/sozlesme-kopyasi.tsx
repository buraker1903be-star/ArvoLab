"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { sozlesmeKopyasiniGonder } from "@/app/actions/sozlesme";

/*
  Onaylanan sözleşmenin kopyasını yeniden gönderir (29.10.2026). Onay
  anındaki e-posta gereksiz klasörüne düşebiliyor ya da hiç ulaşmayabiliyor;
  kullanıcının kopyasını alabilmesinin tek yolu destek ekibine yazmak
  olmamalı.
*/
export default function SozlesmeKopyasi() {
  const t = useCeviri();
  const [bekliyor, basla] = useTransition();
  const [sonuc, setSonuc] = useState<{ ton: "success" | "danger"; metin: string } | null>(null);

  const gonder = () => {
    setSonuc(null);
    basla(async () => {
      const yanit = await sozlesmeKopyasiniGonder();
      setSonuc(
        "error" in yanit
          ? { ton: "danger", metin: yanit.error }
          : {
              ton: "success",
              metin: t({
                tr: "Kopya e-posta adresinize gönderildi. Birkaç dakika içinde gelmezse gereksiz klasörünü de kontrol edin.",
                en: "A copy has been sent to your email address. If it doesn't arrive within a few minutes, check your spam folder.",
              }),
            },
      );
    });
  };

  return (
    <div className="sozlesme-kopyasi">
      <button type="button" className="projects-filter-button button-compact" onClick={gonder} disabled={bekliyor}>
        <Mail size={14} aria-hidden="true" />{" "}
        {bekliyor ? t({ tr: "Gönderiliyor…", en: "Sending…" }) : t({ tr: "Kopyayı e-postama gönder", en: "Email me a copy" })}
      </button>
      {sonuc ? (
        <p className="alert" data-tone={sonuc.ton} role={sonuc.ton === "danger" ? "alert" : "status"}>
          {sonuc.metin}
        </p>
      ) : null}
    </div>
  );
}
