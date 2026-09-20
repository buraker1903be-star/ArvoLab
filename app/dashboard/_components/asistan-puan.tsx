"use client";

import { useState, useTransition } from "react";
import { asistanPuanla, type Puan } from "@/app/actions/ai-puan";

/*
  Asistan çalışmasının değerlendirmesi. Üç yetenekte de aynı bileşen
  kullanılıyor: soru tek tip olmazsa toplanan veri de karşılaştırılamaz hale
  gelir ve ince ayar için işe yaramaz.

  Kayıt tutulamamışsa (kayitId yok) hiç gösterilmiyor: tıklanınca "kayıt
  bulunamadı" demek kullanıcıya bir şey anlatmıyor.
*/

const SECENEKLER: { puan: Puan; etiket: string }[] = [
  { puan: "faydali", etiket: "Faydalı" },
  { puan: "kismen", etiket: "Kısmen" },
  { puan: "faydasiz", etiket: "Faydasız" },
];

export default function AsistanPuan({ kayitId }: { kayitId?: string | null }) {
  const [secilen, setSecilen] = useState<Puan | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekleniyor, basla] = useTransition();

  if (!kayitId) return null;

  if (secilen)
    return (
      <p className="asistan-puan-tesekkur text-base mt-sm">
        Değerlendirmeniz kaydedildi — asistanı bununla geliştiriyoruz.
      </p>
    );

  return (
    <div className="asistan-puan mt-sm">
      <span className="text-base">Bu denetim işinize yaradı mı?</span>
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
            {secenek.etiket}
          </button>
        ))}
      </span>
      {hata && <span className="tone-text text-base" data-tone="danger" role="alert">{hata}</span>}
    </div>
  );
}
