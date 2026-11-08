import { closeHistory } from "@tiptap/pm/history";
import type { Slice } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { diffTexts } from "@/lib/text-diff";
import { aralikMetni, araligiBirak, araligiDogrula, izlenenAralik } from "@/lib/tiptap-asistan-araligi";
import { gorevKuyrugu, type EklemeSonucu, type KuyrukGorevi } from "@/lib/ai-gorev-kuyrugu";

/*
  AI DÜZENLEMESİ — KARARLAR (Signature OS 4.3, 05.11.2026).

  Yazım asistanının önerisi belgeye YALNIZCA kullanıcının kararıyla girer
  (kabul et / düzenleyerek kabul et). Bu dosya o kararın güvenlik
  kurallarını tutar; panel (write/yazim-paneli.tsx) çağırır, editör
  testleri (tests/editor/asistan-araligi.test.ts) tarayıcısız sınar.

  1) Hedef aralık izlenir ve uygulamadan önce doğrulanır
     (lib/tiptap-asistan-araligi.ts).
  2) AI değişikliği KENDİ geri alma adımıdır: öncesindeki ve sonrasındaki
     kullanıcı yazımıyla birleşmez (closeHistory). Eskiden ekleme, yarım
     saniye içinde yazılan harflerle aynı geçmiş olayına düşebiliyordu;
     Ctrl+Z ikisini birden geri alıyordu.
  3) "Geri al" düğmesi yalnızca AI'ın yazdığını geri alır: eklenen aralık
     izlenir; aralıktaki metin hâlâ asistanın yazdığıyla BİREBİR aynıysa
     özgün içerik geri konur. Kullanıcı o metni düzenlediyse geri alma
     yapılmaz (kullanıcının sonraki emeği silinmesin); belge geçmişine
     yönlendirilir. Belgenin başka yerlerindeki değişikliklere dokunulmaz.
  4) Büyük değişiklikten önce adlı sürüm alınır (SURUM_ESIGI).
*/

/** AI değişikliğinin işlemi: yeni bir geri alma adımı başlatır. */
export const aiAdimiBaslat = (tr: Transaction): Transaction => closeHistory(tr);

/** Değişiklikten SONRA gönderilen boş işlem: sonraki yazım AI adımına eklenmesin. */
export const aiAdiminiKapat = (state: EditorState): Transaction => closeHistory(state.tr);

/** Değiştirilen ya da eklenen [from, to] aralığının, işlemdeki adımlardan sonra kapladığı yer. */
export const yeniAralik = (tr: Transaction, from: number, to: number) => ({ from: tr.mapping.map(from, -1), to: tr.mapping.map(to, 1) });

export type GeriAlmaSonucu = { tr: Transaction } | { hata: "izlenmiyor" | "silindi" | "duzenlendi" };

/*
  AI değişikliğini geri alan işlem. `eklenenMetin`: kabul anında aralıkta
  duran metin (aralikMetni ile okunmuş). `ozgun`: değişiklikten önce o
  aralıktaki dilim (ekleme ise boş dilim).
*/
export function geriAlmaIslemi(state: EditorState, eklenenId: string, eklenenMetin: string, ozgun: Slice): GeriAlmaSonucu {
  const a = izlenenAralik(state, eklenenId);
  if (!a) return { hata: "izlenmiyor" };
  if (a.silindi || a.to <= a.from) return { hata: "silindi" };
  if (aralikMetni(state.doc, a.from, a.to) !== eklenenMetin) return { hata: "duzenlendi" };
  const tr = aiAdimiBaslat(state.tr.replace(a.from, a.to, ozgun));
  return { tr: araligiBirak(tr, eklenenId) };
}

/** Değişimin kelime cinsinden büyüklüğü (eklenen + silinen); ekleme için eski metin boş. */
export function degisimOzeti(eski: string, yeni: string) {
  const fark = diffTexts(eski, yeni);
  return { eklenen: fark.stats.addedWords, silinen: fark.stats.removedWords, toplam: fark.stats.addedWords + fark.stats.removedWords, ayni: fark.identical };
}

/* Kurum sahibinin onayladığı eşik (4.3): bunu aşan değişiklikten ve her ana hattan önce adlı sürüm. */
export const SURUM_ESIGI = 150;

export function surumGerekir(gorev: string, eski: string, yeni: string): boolean {
  return gorev === "anahat" || degisimOzeti(eski, yeni).toplam > SURUM_ESIGI;
}

/*
  Panelin dışından (seçim üstündeki Arvo AI düğmesi) asistana görev
  göndermek. Panel dinamik yüklenir: düğmeye ilk basıldığında panel henüz
  kurulmamış olabilir, olayı dinleyen yoktur. Bu yüzden görev BEKLETİLİR;
  panel kurulunca (ya da zaten kuruluysa olayla) alır. Sabit burada, çünkü
  düğme paneli içe aktarırsa panel ilk açılıştan önce yüklenirdi.

  V4.3-0 (P0-1): bekletme tek bir değişkendi; panel görevi alıp sildikten
  sonra önceki yanıt beklendiği için gönderemiyordu ve görev sessizce
  kayboluyordu. Artık sıra (lib/ai-gorev-kuyrugu.ts): panel yalnızca boşken
  alır, kalanlar sırasını bekler.
*/
export const ASISTAN_GOREV_OLAYI = "arvolab:asistan-gorev";
export type { DisGorev, KuyrukGorevi, EklemeSonucu } from "@/lib/ai-gorev-kuyrugu";
const kuyruk = gorevKuyrugu();
export function asistanaGorevGonder(gorev: KuyrukGorevi): EklemeSonucu {
  const sonuc = kuyruk.ekle(gorev);
  if (sonuc === "eklendi") window.dispatchEvent(new Event(ASISTAN_GOREV_OLAYI));
  return sonuc;
}
/** Sıradaki görevi alır ve siler: aynı görev iki kez gönderilmesin. Panel yalnızca boşken çağırır. */
export const siradakiGorev = (): KuyrukGorevi | null => kuyruk.al();
export const siradakiSayisi = (): number => kuyruk.uzunluk();
/** Panel kapanırken (editörden çıkılırken) sırayı boşaltır; çağıran izlenen aralıkları bırakır. */
export const kuyruguBosalt = (): KuyrukGorevi[] => kuyruk.bosalt();

/*
  Öneri kimliği: izlenen aralığın anahtarı. Panel ile seçim menüsü AYNI
  üreteci kullanır; menü görevi aralığı panel kurulmadan izlemeye alıyor.
  Kimlik yüklemeler arasında da tekil (lib/ai-kararlari.ts uygulama izi).
*/
let oneriSayaci = 0;
export const yeniOneriId = () => `oneri-${Date.now().toString(36)}-${++oneriSayaci}`;

/*
  "Paragrafın altına ekle" hedefi (V4.3-0 P0-2).

  ESKİ HATA: ekleme yalnızca izlenen aralığın SONUNU kullanıyordu; aralığın
  silinip silinmediğine ve seçili metnin hâlâ orada olup olmadığına
  bakmıyordu. Kullanıcı yanıtı beklerken seçtiği paragrafı sildiyse ya da
  değiştirdiyse öneri, aralığın çöktüğü komşu paragrafın altına giriyordu:
  eski bağlama ait metin yanlış yere.

  ŞİMDİ: seçimle istenmiş öneride aralık istekteki metni BİREBİR taşımalı
  (değiştirmeyle aynı kural). Seçimsiz (imleçte) istekte imlecin bulunduğu
  yer silinmemiş olmalı (nokta aralığın silinmesi:
  lib/tiptap-asistan-araligi.ts). Değilse ekleme yapılmaz.
*/
export type EklemeHedefi = { tamam: true; from: number; to: number } | { tamam: false; neden: "izlenmiyor" | "silindi" | "degisti" };

export function altinaEklemeHedefi(
  state: EditorState,
  oneriId: string,
  secim: { vardi: boolean; metin: string },
  /** Boş paragraftaysa onun YERİNE yaz (ana hatta değil: başlıklar boş satırı korur). */
  bosParagrafaYaz: boolean,
): EklemeHedefi {
  let son: number;
  if (secim.vardi) {
    const d = araligiDogrula(state, oneriId, secim.metin);
    if (!d.tamam) return d;
    son = d.to;
  } else {
    const a = izlenenAralik(state, oneriId);
    if (!a) return { tamam: false, neden: "izlenmiyor" };
    if (a.silindi || a.to > state.doc.content.size) return { tamam: false, neden: "silindi" };
    son = a.to;
  }
  /* İmlecin bulunduğu bloğun SONUNA: paragrafın ortasına blok eklemek onu ikiye bölerdi. */
  const $pos = state.doc.resolve(Math.min(son, state.doc.content.size));
  const blok = $pos.depth >= 1 ? $pos.node(1) : null;
  if (bosParagrafaYaz && blok?.type.name === "paragraph" && blok.textContent.trim() === "") {
    return { tamam: true, from: $pos.before(1), to: $pos.after(1) };
  }
  const yer = $pos.depth >= 1 ? $pos.after(1) : $pos.pos;
  return { tamam: true, from: yer, to: yer };
}
