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

/*
  "KILAVUZ KURALLARI UYGULANDI" BİLDİRİMİNİN KAPATMA TERCİHİ (Phase 4.5 V2).
  Çalışma VE kılavuz sürümü başına: aynı sürümde kapatılan bildirim
  yeniden yüklemede gelmez; yeni bir sürüm uygulandığında anahtar değişir,
  bildirim yeniden görünür. ESKİDEN bildirim kapatılamıyordu ve uygulanan
  ayarların listesiyle 157–184 px yazının üstünde duruyordu. Kılavuzun
  uygulanma mantığı bu tercihi OKUMAZ; yalnızca bildirimin görünürlüğü.
*/
const UYGULANDI_ONEK = "arvolab:kilavuz-uygulandi-kapali:";

export function kilavuzUygulandiAnahtari(calismaId: string | null | undefined, surum: string | null | undefined): string | null {
  const id = (calismaId ?? "").trim();
  const s = (surum ?? "").trim();
  return id && s ? `${UYGULANDI_ONEK}${id}:${s}` : null;
}
