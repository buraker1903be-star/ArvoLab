/*
  EDİTÖRDE Esc: KİM İŞLER? (18.11.2026, son kabul)

  ProseMirror, imleç belgedeyken Esc'i HER ZAMAN işlenmiş sayar ve
  preventDefault çağırır (prosemirror-view, captureKeyDown: "Enter, Esc").
  Odak modu ve PDF çekmecesi "başkası işlediyse dokunma" kuralıyla
  defaultPrevented'a bakıyordu: imleç belgedeyken Esc ikisinde de hiç
  çalışmıyordu (tarayıcıda ölçüldü; ayrıca kapalı ortak pencereleri de
  "açık pencere" saydıkları için gövdedeyken de çalışmıyordu).

  Kural: belgeden gelen Esc YAKALAMA aşamasında, ProseMirror'dan ÖNCE
  değerlendirilir; o anda kendi Esc'ini kullanan bir şey (açık pencere,
  açık atıf kartı, gri satır içi öneri) varsa ona bırakılır. Belgenin
  dışından gelen Esc eskisi gibi KABARCIK aşamasında ve defaultPrevented
  gözetilerek değerlendirilir (menü, seçici, tarih kutusu Esc'i kendisi
  kullanır). Aynı olay iki aşamada da gelir; yalnızca biri "işle" der.

  Saf modül; testi tests/unit/editor-esc.test.ts.
*/
export type EscDurumu = {
  /** Olayın hedefi belgenin (.ProseMirror) içinde mi. */
  belgeden: boolean;
  /** Dinleyici yakalama aşamasında mı çağrıldı (window, capture: true). */
  yakalama: boolean;
  /** Olay daha önce işlenmiş mi (event.defaultPrevented). */
  islenmis: boolean;
  /** Açık bir pencere var mı (dialog[open], .drawer-root.open). */
  acikPencere: boolean;
  /** Açık bir atıf kartı var mı (kart kendi Esc'iyle kapanır). */
  atifKarti: boolean;
  /** Belgede gri satır içi öneri var mı (Esc öneriyi siler). */
  oneri: boolean;
};

export function escIsle(d: EscDurumu): boolean {
  if (d.acikPencere || d.atifKarti) return false;
  if (d.belgeden) return d.yakalama && !d.oneri;
  return !d.yakalama && !d.islenmis;
}
