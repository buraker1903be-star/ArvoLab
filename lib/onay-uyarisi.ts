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
import type { Dil } from "@/lib/dil";
import type { SubmissionChecklist } from "@/lib/submission-checklist";

/**
 * Onaylanan çalışmada kontrolörün bilmesi gereken durum varsa metnini döner.
 * Sorun yoksa null — temiz onayda bildirim gürültüsü olmamalı.
 */
export function onayUyarisi(input: {
  tutarsizliklar: Tutarsizlik[];
  hazirlik: SubmissionChecklist | null;
  /* Tutarsızlık ve madde başlıkları da çağıran tarafından AYNI dilde verilmeli. */
  dil?: Dil;
}): string | null {
  const parcalar: string[] = [];
  const en = input.dil === "en";
  const kucuk = (metin: string) => metin.toLocaleLowerCase(en ? "en-US" : "tr-TR");

  if (input.tutarsizliklar.length)
    parcalar.push(
      input.tutarsizliklar.length === 1
        ? kucuk(input.tutarsizliklar[0].baslik)
        : en
          ? `${input.tutarsizliklar.length} inconsistencies`
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
        ? en
          ? `missing from the submission checklist: ${kucuk(eksik[0].label)}`
          : `teslim listesinde eksik: ${kucuk(eksik[0].label)}`
        : en
          ? `${eksik.length} missing items in the submission checklist`
          : `teslim listesinde ${eksik.length} eksik madde`,
    );

  if (!parcalar.length) return null;
  if (en) return `The work was approved, but there are issues: ${parcalar.join(" and ")}. Review them in the work overview.`;
  return `Çalışma onaylandı, ancak ${parcalar.join(" ve ")} var. Çalışma özetinden inceleyin.`;
}
