/*
  "Bu çalışmaya bağlı kılavuz yok" bandının gizleme tercihi: tarayıcıda,
  ÇALIŞMA başına (Aşama 1 takip R2, 08.11.2026). Saf modül; testi
  tests/unit/kilavuz-bandi.test.ts. Kullanan: manuscript-editor.tsx.

  ESKİ DAVRANIŞ: tek bir genel anahtar (arvolab:kilavuz-bandi-dar) vardı;
  bir tezde bandı gizleyen öğrenci, kılavuzu olmayan BÜTÜN tezlerinde de
  uyarıyı görmüyordu. Yeni anahtar çalışma kimliğini taşır. Eski genel
  anahtar bilerek OKUNMAZ (yeni davranışa taşınmaz): onu gizlemiş olan
  öğrenci her çalışmada bandı bir kez daha görür ve o çalışma için
  yeniden karar verir. Veritabanı alanı yok; tercih yalnız bu tarayıcıda.

  Yalnızca bu bilgi bandı içindir: "yeni sürüm uygulandı", "kılavuza göre
  güncelle", "kılavuz okunamadı" gibi akademik uyumluluk uyarıları bu
  tercihi okumaz.
*/

/** Eski, genel anahtar. Yalnızca "artık okunmuyor" testinde anılır. */
export const ESKI_KILAVUZ_BANDI_ANAHTARI = "arvolab:kilavuz-bandi-dar";

const ONEK = "arvolab:kilavuz-bandi-gizli:";

/** Çalışmaya özgü anahtar; kimlik yoksa null (tercih tutulmaz, bant görünür). */
export function kilavuzBandiAnahtari(calismaId: string | null | undefined): string | null {
  const id = (calismaId ?? "").trim();
  return id ? `${ONEK}${id}` : null;
}
