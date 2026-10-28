/** Sayfa başına ortalama bu kadar karakterden azsa belge taranmış sayılır. */
const SAYFA_BASINA_ESIK = 100;

/**
 * Belge taranmış (görüntü) bir PDF mi?
 *
 * Metin PDF'i sayfa başına binlerce karakter verir; taranmış olan neredeyse
 * hiç vermez. Eşik ortada tutuldu: kapağı metin, gövdesi görüntü olan
 * karma belgeler de OCR'a girsin.
 */
export function taranmisBelgeMi(metin: string, sayfaSayisi: number): boolean {
  if (sayfaSayisi <= 0) return false;
  return metin.trim().length / sayfaSayisi < SAYFA_BASINA_ESIK;
}
