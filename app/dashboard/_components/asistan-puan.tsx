"use client";

import { useState, useTransition } from "react";
import { asistanPuanla, type Puan } from "@/app/actions/ai-puan";
import { useCeviri } from "@/app/_components/dil-saglayici";
import type { Metin } from "@/lib/dil";

/*
  Asistan çalışmasının değerlendirmesi. Üç yetenekte de aynı bileşen
  kullanılıyor: soru tek tip olmazsa toplanan veri de karşılaştırılamaz hale
  gelir ve ince ayar için işe yaramaz.

  Kayıt tutulamamışsa (kayitId yok) hiç gösterilmiyor: tıklanınca "kayıt
  bulunamadı" demek kullanıcıya bir şey anlatmıyor.
*/

const SECENEKLER: { puan: Puan; etiket: Metin }[] = [
  { puan: "faydali", etiket: { tr: "Faydalı", en: "Helpful" } },
  { puan: "kismen", etiket: { tr: "Kısmen", en: "Partly" } },
  { puan: "faydasiz", etiket: { tr: "Faydasız", en: "Not helpful" } },
];

export default function AsistanPuan({ kayitId }: { kayitId?: string | null }) {
  const t = useCeviri();
  const [secilen, setSecilen] = useState<Puan | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekleniyor, basla] = useTransition();

  if (!kayitId) return null;

  if (secilen)
    return (
      <p className="asistan-puan-tesekkur text-base mt-sm">
        {t({ tr: "Değerlendirmeniz kaydedildi — asistanı bununla geliştiriyoruz.", en: "Your rating was saved — we use it to improve the assistant." })}
      </p>
    );

  return (
    <div className="asistan-puan mt-sm">
      <span className="text-base">{t({ tr: "Bu denetim işinize yaradı mı?", en: "Was this check useful?" })}</span>
      <span className="asistan-puan-dugmeler">
        {SECENEKLER.map((secenek) => (
          <button
            type="button"
            key={secenek.puan}
            className="asistan-puan-dugme"
            disabled={bekleniyor}
            onClick={() =>
              basla(async () => {
                setHata(null);
                const sonuc = await asistanPuanla(kayitId, secenek.puan);
                if (sonuc.hata) setHata(sonuc.hata);
                else setSecilen(secenek.puan);
              })
            }
          >
            {t(secenek.etiket)}
          </button>
        ))}
      </span>
      {hata && <span className="tone-text text-base" data-tone="danger" role="alert">{hata}</span>}
    </div>
  );
}
