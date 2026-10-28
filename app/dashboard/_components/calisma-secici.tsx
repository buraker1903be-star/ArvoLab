"use client";

import { useRouter } from "next/navigation";
import { useCeviri } from "@/app/_components/dil-saglayici";
import Secici from "./secici";

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
}: {
  calismalar: { id: string; title: string }[];
  secili: string;
  /** Sayfanın adresi; seçim ?calisma= ile ona eklenir. */
  yol: string;
}) {
  const router = useRouter();
  const t = useCeviri();
  if (calismalar.length < 2) return null;
  return (
    <div className="kaynaklar-secici">
      <Secici
        deger={secili}
        etiket={t({ tr: "Çalışma", en: "Work" })}
        onEk={t({ tr: "Çalışma", en: "Work" })}
        gruplar={[{ secenekler: calismalar.map((c) => ({ deger: c.id, etiket: c.title })) }]}
        degisince={(id) => router.push(`${yol}?calisma=${id}`, { scroll: false })}
      />
    </div>
  );
}
