"use client";

import { Check } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  "DEĞİŞKENLER → KONTROLLER → SONUÇ" (22.11.2026, onaylı "A" tasarımı).

  Öğrenci dosyayı yükledikten sonra ekranda ne yapacağını bilmiyordu:
  değişken kutuları, "Analizi Çalıştır" ve sonuç aynı yığının içindeydi.

  BAŞARI İŞARETİ ÖNCEDEN VERİLMEZ. "Kontroller" adımı analiz
  çalışmadan önce "uygun" ya da "geçti" demez — varsayım denetimleri
  hesabın içinde yapılıyor, öncesinde hiçbir bilgi yok. Yeşil bir onay,
  normallik hiç sınanmamışken sınanmış gibi görünür; bu, yanlış testi
  savunulabilir sanmaya yol açar.
*/
export type AdimDurumu = "bekliyor" | "sirada" | "tamam";

export default function AnalizAdimlari({
  veriYuklu,
  sonucVar,
  eskidi,
}: {
  veriYuklu: boolean;
  sonucVar: boolean;
  /* Sonuç ekrandaki seçimle uyuşmuyorsa adımlar "tamam" göstermez. */
  eskidi: boolean;
}) {
  const t = useCeviri();
  const tazeSonuc = sonucVar && !eskidi;

  const adimlar: { ad: string; not: string; durum: AdimDurumu }[] = [
    {
      ad: t({ tr: "Değişkenler", en: "Variables" }),
      not: veriYuklu
        ? t({ tr: "Analizin istediği alanları seçin.", en: "Choose the fields the analysis requires." })
        : t({ tr: "Önce veri yükleyin.", en: "Upload data first." }),
      durum: !veriYuklu ? "bekliyor" : tazeSonuc ? "tamam" : "sirada",
    },
    {
      ad: t({ tr: "Kontroller", en: "Checks" }),
      not: tazeSonuc
        ? t({ tr: "Varsayım şeridi sonucun yanında.", en: "The assumption strip is next to the result." })
        : t({ tr: "Analiz çalışınca denetlenir.", en: "Checked when the analysis runs." }),
      durum: tazeSonuc ? "tamam" : "bekliyor",
    },
    {
      ad: t({ tr: "Sonuç", en: "Result" }),
      not: tazeSonuc
        ? t({ tr: "Kopyalayın ya da teze ekleme sırasına koyun.", en: "Copy it or queue it for your thesis." })
        : eskidi
          ? t({ tr: "Seçim değişti; yeniden çalıştırın.", en: "The selection changed; run it again." })
          : t({ tr: "Henüz hesaplanmadı.", en: "Not computed yet." }),
      durum: tazeSonuc ? "tamam" : "bekliyor",
    },
  ];

  return (
    <ol className="analiz-adimlar" aria-label={t({ tr: "Analiz adımları", en: "Analysis steps" })}>
      {adimlar.map((adim, i) => (
        <li key={adim.ad} data-durum={adim.durum}>
          <span className="analiz-adim-no" aria-hidden="true">
            {adim.durum === "tamam" ? <Check size={13} /> : i + 1}
          </span>
          <span className="analiz-adim-govde">
            <b>{adim.ad}</b>
            <small>{adim.not}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}
