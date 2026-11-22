"use client";

import { useCeviri } from "@/app/_components/dil-saglayici";
import { SAG_PANEL_SINIRI } from "@/lib/calisma-alani-yerlesimi";
import type { SagPanel } from "@/lib/os/uygulamalar";
import YatayAyirici from "@/app/dashboard/_components/yatay-ayirici";

/*
  BELGE | SAĞ PANEL AYIRICISI. 16.11.2026'da yalnızca PDF için yazıldı
  (pdf-panel-ayirici.tsx): asistan paneli sabit 400 px'lik yüzen bir
  kutuydu ve boyutlanamıyordu. 19.11.2026'dan (bağlamlı çalışma alanı)
  beri Arvo AI ve PDF AYNI yuvayı ve bu ayırıcıyı paylaşır; sınırlar panel
  türüne göre (AI 360–420, PDF 440–600; lib/calisma-alani-yerlesimi.ts).

  22.11.2026: sürükleme ve klavye mantığı ortak bileşene taşındı
  (_components/yatay-ayirici.tsx), çünkü Kaynaklar araştırma alanı da
  liste ile kaynak paneli arasında aynı davranışı istiyor. Buradaki iş
  değişmedi: panel türüne göre sınırları ve ekran okuyucu adını vermek.
  Sınıf adı da aynı (.pdf-panel-ayirici) — editörün yerleşim kuralları
  (sticky konum, yükseklik) ona bağlı.
*/
export default function SagPanelAyirici({
  panel,
  genislik,
  enCok,
  onDegis,
  yerlesim,
}: {
  panel: SagPanel;
  genislik: number;
  enCok: number;
  onDegis: (genislik: number, kaydet: boolean) => void;
  yerlesim: () => HTMLElement | null;
}) {
  const t = useCeviri();
  const sinir = SAG_PANEL_SINIRI[panel];
  return (
    <YatayAyirici
      genislik={genislik}
      enAz={sinir.enAz}
      enCok={Math.max(sinir.enAz, Math.min(sinir.enCok, enCok))}
      onDegis={onDegis}
      yerlesim={yerlesim}
      etiket={
        panel === "pdf"
          ? t({ tr: "Belge ile PDF arasındaki genişliği ayarla", en: "Resize between document and PDF" })
          : t({ tr: "Belge ile Arvo AI arasındaki genişliği ayarla", en: "Resize between document and Arvo AI" })
      }
    />
  );
}
