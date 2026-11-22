"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCeviri } from "@/app/_components/dil-saglayici";
import Secici from "./secici";
import { ayrilabilirMi } from "@/lib/ayrilma-koruma";

/*
  Modül sayfalarının (Kaynaklar, Analiz Merkezi) çalışma seçicisi: iki
  kart da seçili çalışmanın verisini gösteriyor. Seçim adreste
  (?calisma=); sayfa sunucuda yeniden okunuyor. Tek çalışması olan
  öğrencide çizilmiyor.
*/
export default function CalismaSecici({
  calismalar,
  secili,
  yol,
  hepGoster = false,
}: {
  calismalar: { id: string; title: string }[];
  secili: string;
  /** Sayfanın adresi; seçim ?calisma= ile ona eklenir. */
  yol: string;
  /*
    Tek çalışması olanda da çizilsin (22.11.2026, Kaynaklar araştırma
    alanı): orada "hangi çalışmanın kaynaklarına bakıyorum" sorusunun
    cevabı ekranda GÖRÜNMELİ. Seçici tek seçenekle de aynı bileşen;
    öteki sayfalarda davranış değişmedi.
  */
  hepGoster?: boolean;
}) {
  const router = useRouter();
  const t = useCeviri();
  /*
    Seçici seçilen etiketi KENDİ durumunda tutuyor (secici.tsx) ve aynı
    seçeneği ikinci kez yok sayıyor. Gezinme iptal edilirse etiket yanlış
    çalışmayı gösterir ve ikinci deneme hiç tepki vermezdi; iptalde
    seçiciyi yeniden kuruyoruz (anahtar değişiyor), böylece görünen değer
    gerçekten seçili olan çalışmaya döner.
  */
  const [surum, setSurum] = useState(0);
  if (calismalar.length < 2 && !hepGoster) return null;
  if (!calismalar.length) return null;
  return (
    <div className="kaynaklar-secici">
      <Secici
        key={surum}
        deger={secili}
        etiket={t({ tr: "Çalışma", en: "Work" })}
        onEk={t({ tr: "Çalışma", en: "Work" })}
        gruplar={[{ secenekler: calismalar.map((c) => ({ deger: c.id, etiket: c.title })) }]}
        /*
          Gezinmeden önce ayrılma koruması sorulur (lib/ayrilma-koruma.ts):
          Kaynaklar'da kaydedilmemiş bir not varken çalışma değiştirmek onu
          sessizce atıyordu. Koruma kurulu değilse davranış aynı.
        */
        degisince={(id) => {
          void ayrilabilirMi().then((devam) => {
            if (devam) router.push(`${yol}?calisma=${id}`, { scroll: false });
            else setSurum((n) => n + 1);
          });
        }}
      />
    </div>
  );
}
