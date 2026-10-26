"use client";

import { useRouter } from "next/navigation";

/*
  Kaynaklar sayfasının çalışma seçicisi: iki kart da seçili çalışmanın
  kaynaklarını ve kaynakçasını gösteriyor. Seçim adreste (?calisma=);
  sayfa sunucuda yeniden okunuyor. Tek çalışması olan öğrencide çizilmiyor.
*/
export default function CalismaSecici({
  calismalar,
  secili,
}: {
  calismalar: { id: string; title: string }[];
  secili: string;
}) {
  const router = useRouter();
  if (calismalar.length < 2) return null;
  return (
    <label className="kaynaklar-secici">
      <span>Çalışma</span>
      <select value={secili} onChange={(e) => router.push(`/dashboard/literature?calisma=${e.target.value}`, { scroll: false })}>
        {calismalar.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </label>
  );
}
