import { closeHistory } from "@tiptap/pm/history";
import type { Slice } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { diffTexts } from "@/lib/text-diff";
import { aralikMetni, araligiBirak, izlenenAralik } from "@/lib/tiptap-asistan-araligi";

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
  kurulmamış olabilir, olayı dinleyen yoktur. Bu yüzden görev bir kez
  BEKLETİLİR; panel kurulunca (ya da zaten kuruluysa olayla) alır. Sabit
  burada, çünkü düğme paneli içe aktarırsa panel ilk açılıştan önce
  yüklenirdi.
*/
export const ASISTAN_GOREV_OLAYI = "arvolab:asistan-gorev";
export type DisGorev = "akademik" | "kisalt" | "genislet";
let bekleyenGorev: DisGorev | null = null;
export function asistanaGorevGonder(gorev: DisGorev) {
  bekleyenGorev = gorev;
  window.dispatchEvent(new Event(ASISTAN_GOREV_OLAYI));
}
/** Bekleyen görevi alır ve siler: aynı görev iki kez gönderilmesin. */
export function bekleyenGoreviAl(): DisGorev | null {
  const g = bekleyenGorev;
  bekleyenGorev = null;
  return g;
}
