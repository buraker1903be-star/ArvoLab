import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";

/*
  ASİSTAN ARALIKLARI — AI DÜZENLEMESİNİN KONUM GÜVENLİĞİ (Signature OS 4.3,
  05.11.2026).

  ESKİ HATA: yazım asistanı "Seçilenin yerine koy" için seçimin konumunu
  (from, to) İSTEK ANINDA bir sayı olarak saklıyor, cevap gelip kullanıcı
  düğmeye bastığında o sayılarla insertContentAt({from, to}) çağırıyordu.
  Arada belge değiştiyse (öğrenci cevabı beklerken seçimin önüne bir
  cümle yazdı ya da bir paragraf sildi) sayılar başka bir metni
  gösteriyordu ve YANLIŞ METİN değiştiriliyordu. Sayılar yalnızca belge
  boyuna kırpılıyordu.

  ŞİMDİ: istek anındaki aralık bu eklentinin durumuna yazılır ve HER
  işlemde tr.mapping ile güncellenir (belgedeki yazma, silme, yapıştırma
  aralığı kaydırır). Uygulamadan önce aralıktaki metin istekteki seçimle
  BİREBİR karşılaştırılır; farklıysa, silinmişse ya da izlenmiyorsa
  değiştirme YAPILMAZ ve çağıran kullanıcıya yeniden seçmesini söyler.
  Eşleşme "yaklaşık" değil: güvenilir eşleştirilemeyen metin değişmez.

  Aynı izleme, kabul edilen önerinin belgedeki yerini de tutar: "Geri al"
  yalnızca o aralıktaki metin hâlâ asistanın yazdığıyla aynıysa çalışır
  (lib/ai-duzenleme.ts).

  Şema DEĞİŞMEZ: bu bir eklentinin durumu, belgenin düğümü ya da işareti
  değil; kaydedilen JSON'a, sürümlere ve hiçbir çıktıya girmez.
  Testi: tests/editor/asistan-araligi.test.ts (tarayıcısız).
*/

export type IzlenenAralik = { from: number; to: number; silindi: boolean };
type Durum = Record<string, IzlenenAralik>;
type Meta = { izle: { id: string; from: number; to: number } } | { birak: string };

export const asistanAraligiAnahtari = new PluginKey<Durum>("asistanAraligi");

export function asistanAraligiEklentisi() {
  return new Plugin<Durum>({
    key: asistanAraligiAnahtari,
    state: {
      init: () => ({}),
      apply(tr, onceki) {
        let durum = onceki;
        if (tr.docChanged && Object.keys(durum).length) {
          durum = {};
          for (const [id, a] of Object.entries(onceki)) {
            // Başa yazılan metin aralığa katılmaz (assoc 1), sona yazılan da (assoc -1).
            const bas = tr.mapping.mapResult(a.from, 1);
            const son = tr.mapping.mapResult(a.to, -1);
            const bosaldi = a.to > a.from && son.pos <= bas.pos;
            /*
              Nokta aralık (seçimsiz, imleçte istenen öneri): içinde metin
              olmadığı için "boşaldı" hiç doğru olmaz. V4.3-0'a kadar imlecin
              bulunduğu paragraf silinse bile nokta komşu paragrafa kayıyor
              ve "Paragrafın altına ekle" oraya ekliyordu. Noktanın İKİ
              yanı birden silindiyse (deletedAcross: bulunduğu yer silindi)
              silinmiş sayılır. Önüne yazmak ya da tek harf silmek saymaz.
            */
            const noktaSilindi = a.to === a.from && bas.deletedAcross;
            durum[id] = { from: bas.pos, to: Math.max(bas.pos, son.pos), silindi: a.silindi || bosaldi || noktaSilindi };
          }
        }
        const meta = tr.getMeta(asistanAraligiAnahtari) as Meta | undefined;
        if (meta && "izle" in meta) durum = { ...durum, [meta.izle.id]: { from: meta.izle.from, to: meta.izle.to, silindi: false } };
        if (meta && "birak" in meta && meta.birak in durum) {
          durum = { ...durum };
          delete durum[meta.birak];
        }
        return durum;
      },
    },
  });
}

export const AsistanAraligi = Extension.create({
  name: "asistanAraligi",
  addProseMirrorPlugins() {
    return [asistanAraligiEklentisi()];
  },
});

/** Aralığı izlemeye alan işlem (meta). Belgeyi değiştirmez. */
export const araligiIzle = (tr: Transaction, id: string, from: number, to: number): Transaction =>
  tr.setMeta(asistanAraligiAnahtari, { izle: { id, from, to } } satisfies Meta);

/** İzlemeyi bırakan işlem (öneri reddedildi, kabul edildi ya da kart kapandı). */
export const araligiBirak = (tr: Transaction, id: string): Transaction => tr.setMeta(asistanAraligiAnahtari, { birak: id } satisfies Meta);

export const izlenenAralik = (state: EditorState, id: string): IzlenenAralik | null => asistanAraligiAnahtari.getState(state)?.[id] ?? null;

/** Seçimin metni: istekte ve doğrulamada AYNI biçimde okunur (paragraf sınırı boş satır). */
export const aralikMetni = (doc: ProseMirrorNode, from: number, to: number) => doc.textBetween(from, to, "\n\n");

export type AralikDogrulamasi =
  | { tamam: true; from: number; to: number }
  | { tamam: false; neden: "izlenmiyor" | "silindi" | "degisti" };

/*
  Aralık hâlâ beklenen metni mi taşıyor? Yalnızca BİREBİR eşitlik kabul:
  boşluk farkı bile "değişti" sayılır. Yanlış metni değiştirmektense
  kullanıcıya yeniden seçtirmek her zaman güvenli yön.
*/
export function araligiDogrula(state: EditorState, id: string, beklenenMetin: string): AralikDogrulamasi {
  const a = izlenenAralik(state, id);
  if (!a) return { tamam: false, neden: "izlenmiyor" };
  if (a.silindi || (beklenenMetin.length > 0 && a.to <= a.from)) return { tamam: false, neden: "silindi" };
  if (a.to > state.doc.content.size) return { tamam: false, neden: "silindi" };
  if (aralikMetni(state.doc, a.from, a.to) !== beklenenMetin) return { tamam: false, neden: "degisti" };
  return { tamam: true, from: a.from, to: a.to };
}
