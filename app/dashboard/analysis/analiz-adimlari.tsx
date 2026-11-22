"use client";

import { Check, Eye } from "lucide-react";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  "DEĞİŞKENLER → KONTROLLER → SONUÇ" (22.11.2026, onaylı "A" tasarımı).

  Öğrenci dosyayı yükledikten sonra ekranda ne yapacağını bilmiyordu:
  değişken kutuları, "Analizi Çalıştır" ve sonuç aynı yığının içindeydi.

  İŞARETİN NE ANLAMA GELDİĞİ AYRIK (22.11.2026 düzeltmesi). İlk sürümde
  analiz çalışınca üç adım da yeşil onay alıyordu; "Kontroller" adımındaki
  onay, varsayımların GEÇTİĞİ gibi okunuyordu. Oysa ArvoLab varsayımları
  hesaplayıp YAZAR, geçti/kaldı hükmü vermez — Levene düşse de sonuç
  üretilir, yanında Welch karşılığı önerilir.

  Bu yüzden iki ayrı işaret var:
    ✓ (tamam)     = o adımın işi bitti (hesap tamamlandı).
    göz (okunacak) = hesap çalıştı, okunacak bir bilgi var; hüküm yok.
  "Kontroller" adımı HİÇBİR KOŞULDA ✓ almaz.

  Adım şeridi telefonda tek satırlık kompakt bir durum şeridine iner
  (app/styles/analiz-alani.css): üç büyük dikey kart ilk ekranda
  değişken alanlarını ekrandan atıyordu.
*/
export type AdimDurumu = "bekliyor" | "sirada" | "tamam" | "okunacak";

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
        ? t({
            tr: "Varsayım şeridi sonucun yanında — okuyun. ArvoLab değerleri yazar, “geçti” hükmü vermez.",
            en: "The assumption strip is next to the result — read it. ArvoLab reports the values; it does not rule them “passed”.",
          })
        : t({ tr: "Analiz çalışınca denetlenir.", en: "Checked when the analysis runs." }),
      /* ✓ YOK: varsayımın uygunluğu kullanıcının okuyup karar vereceği şey. */
      durum: tazeSonuc ? "okunacak" : "bekliyor",
    },
    {
      ad: t({ tr: "Sonuç", en: "Result" }),
      not: tazeSonuc
        ? t({ tr: "Hesap tamamlandı. Kopyalayın ya da teze ekleme sırasına koyun.", en: "Computation finished. Copy it or queue it for your thesis." })
        : eskidi
          ? t({ tr: "Seçim değişti; yeniden çalıştırın.", en: "The selection changed; run it again." })
          : t({ tr: "Henüz hesaplanmadı.", en: "Not computed yet." }),
      durum: tazeSonuc ? "tamam" : "bekliyor",
    },
  ];

  return (
    <ol className="analiz-adimlar" aria-label={t({ tr: "Analiz adımları", en: "Analysis steps" })}>
      {adimlar.map((adim, i) => (
        <li key={adim.ad} data-durum={adim.durum} title={adim.not}>
          <span className="analiz-adim-no" aria-hidden="true">
            {adim.durum === "tamam" ? <Check size={13} /> : adim.durum === "okunacak" ? <Eye size={13} /> : i + 1}
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
