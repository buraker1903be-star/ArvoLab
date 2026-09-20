/*
  Onay anında kontrolöre gösterilecek uyarı.

  Kontrolör bir çalışmayı "hazır" ilan ederken ekosistemin bütün denetimleri
  zaten yapılmış durumda: metinle literatür karşılaştırıldı, teslim listesi
  hesaplandı. Ama bu bilgiler çalışma merkezinde duruyor ve onay listeden
  veriliyor — kontrolör merkeze girmediyse hiçbirini görmemiş oluyor.

  Uyarı ENGELLEMEZ. Kontrolör kuralın dışına çıkmayı bilerek seçebilir
  (öğrencinin kaynakçayı teslimde ekleyeceğini biliyor olabilir); onayı
  reddetmek onun yargısının yerine geçmek olurdu. Söylemek yeterli.

  Saf modül; testi tests/unit/onay-uyarisi.test.ts.
*/

import type { Tutarsizlik } from "@/lib/calisma-tutarlilik";
import type { SubmissionChecklist } from "@/lib/submission-checklist";

/**
 * Onaylanan çalışmada kontrolörün bilmesi gereken durum varsa metnini döner.
 * Sorun yoksa null — temiz onayda bildirim gürültüsü olmamalı.
 */
export function onayUyarisi(input: {
  tutarsizliklar: Tutarsizlik[];
  hazirlik: SubmissionChecklist | null;
}): string | null {
  const parcalar: string[] = [];

  if (input.tutarsizliklar.length)
    parcalar.push(
      input.tutarsizliklar.length === 1
        ? input.tutarsizliklar[0].baslik.toLocaleLowerCase("tr-TR")
        : `${input.tutarsizliklar.length} tutarsızlık`,
    );

  /*
    Yalnızca "todo" sayılır. "warning" maddeleri bakılması iyi olan şeyler;
    onay anında hepsini saymak her onayda uyarı çıkarır ve uyarı anlamını
    yitirir.
  */
  const eksik = (input.hazirlik?.items ?? []).filter((madde) => madde.status === "todo");
  if (eksik.length)
    parcalar.push(
      eksik.length === 1
        ? `teslim listesinde eksik: ${eksik[0].label.toLocaleLowerCase("tr-TR")}`
        : `teslim listesinde ${eksik.length} eksik madde`,
    );

  if (!parcalar.length) return null;
  return `Çalışma onaylandı, ancak ${parcalar.join(" ve ")} var. Çalışma merkezinden inceleyin.`;
}
