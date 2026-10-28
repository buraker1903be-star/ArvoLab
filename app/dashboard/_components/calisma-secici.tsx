"use client";

import { useRouter } from "next/navigation";
import { useCeviri } from "@/app/_components/dil-saglayici";

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
    <label className="kaynaklar-secici">
      <span>{t({ tr: "Çalışma", en: "Work" })}</span>
      <select value={secili} onChange={(e) => router.push(`${yol}?calisma=${e.target.value}`, { scroll: false })}>
        {calismalar.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </label>
  );
}
