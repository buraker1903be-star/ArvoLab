/*
  EDİTÖRDE TAB VE SHIFT+TAB (27.10.2026, kurum sahibinin bildirimi:
  "editörün içinde klavyenin özelliklerini kullanamıyorum, örneğin Tab
  çalışmıyor").

  Eskiden Tab'ın editörde bir karşılığı yoktu: tarayıcı odağı bir sonraki
  düğmeye taşıyordu, öğrenci yazarken imleç editörden çıkıyordu. Liste ve
  tablo kendi Tab'larını (girinti, sonraki hücre) zaten işliyor; bu karar
  geri kalan her yer için ve Word'ün davranışını izliyor:

  - Paragrafın BAŞINDA Tab: ilk satır girintisi (Word de satır başındaki
    Tab'ı girintiye çevirir). Girinti zaten varsa sekme karakteri.
  - Paragrafın içinde Tab: sekme karakteri.
  - Shift+Tab paragraf başında: ilk satır girintisini kaldırır.
  - Listede ve tabloda Tab ASLA editörden çıkmaz: liste öğesi daha fazla
    içeri alınamıyorsa bile tuş yutulur, yoksa odak kaçardı.

  Saf modül; testi tests/unit/klavye-karari.test.ts.
*/

export type TabDurumu = { listede: boolean; tabloda: boolean; satirBasinda: boolean; girintili: boolean };
export type TabKarari = "girinti-ekle" | "girinti-kaldir" | "sekme" | "yut";

export function tabKarari(durum: TabDurumu, shift: boolean): TabKarari {
  if (durum.listede || durum.tabloda) return "yut";
  if (shift) return durum.satirBasinda && durum.girintili ? "girinti-kaldir" : "yut";
  return durum.satirBasinda && !durum.girintili ? "girinti-ekle" : "sekme";
}

/** Ctrl+] / Ctrl+[: yazı boyutunu bir punto büyüt/küçült (Word); 8–72 pt arası. */
export function puntoAdimi(simdiki: string | null | undefined, varsayilanPt: number, yon: 1 | -1): string {
  const pt = parseFloat(String(simdiki ?? "")) || varsayilanPt;
  return `${Math.min(72, Math.max(8, Math.round(pt) + yon))}pt`;
}
