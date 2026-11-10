/*
  AKADEMİK KÂĞIT GÖRÜNÜMÜ: AÇIK / LOŞ (Phase 4.6 D4, 10.11.2026).

  Kurum sahibinin kararı: uygulama teması ile kâğıdın görünümü birbirinden
  bağımsız. Açık temada kâğıt her zaman açık; koyu temada VARSAYILAN açık
  kâğıt, kullanıcı isterse loş kâğıda geçer. Eskiden (V4.3-A2-3,
  09.11.2026'dan beri) kâğıt temaya bağlıydı: koyu temada herkes loş
  kâğıdı görüyordu ve seçim yoktu.

  YALNIZCA GÖRÜNÜM: tercih tarayıcıda (localStorage) durur, belgeye,
  veritabanına ya da çıktılara girmez. Yazdırma, PDF ve Word kendi
  yollarından çizilir (lib/tiptap-html.ts, lib/tiptap-docx.ts); loş kâğıt
  kuralı zaten yalnızca @media screen içinde.

  Tema gibi BOYAMADAN ÖNCE uygulanır (<html data-kagit>): React yüklenince
  uygulansaydı loş kâğıt seçen kullanıcı her açılışta önce açık kâğıdı
  görüp sonra kararmasını izlerdi (ve tersi). Betik app/layout.tsx'te tema
  ve kenar betiklerinin yanında.

  GERİYE UYUMLULUK (tek seferlik göç): bu sürümden önce koyu temayı AÇIKÇA
  seçmiş (arvolab.theme = "dark") kullanıcı loş kâğıdı bilerek seçmiş
  sayılır; kâğıt tercihi henüz yoksa bir kez "los" yazılır. Göç bir
  işaretle (arvolab.kagit-gocu) bir kez çalışır: bu sürümden SONRA koyu
  temayı seçen kullanıcı yeni varsayılanı (açık kâğıt) alır. Temayı
  "Sistem"de bırakıp cihazı koyu olan kullanıcı tercih bildirmemiştir:
  o da yeni varsayılanı görür (davranış değişikliği, raporda yazılı).
  Tercih cihaz başınadır (tema gibi).

  Bu dosya saf: DOM'a dokunan iki yer (ön boyama betiği ve
  app/_components/kagit.ts) buradaki kararları kullanır, birim testi de
  onları sınar (tests/unit/kagit-gorunumu.test.ts).
*/

import { TEMA_ANAHTARI, type Tema } from "@/lib/tema";

export const KAGIT_ANAHTARI = "arvolab.kagit";
export const KAGIT_GOC_ANAHTARI = "arvolab.kagit-gocu";
export type KagitTercihi = "acik" | "los";

/** Depodan gelen ham değer → tercih. Bilinmeyen her şey "acik" (varsayılan). */
export function kagitOku(ham: unknown): KagitTercihi {
  return ham === "los" ? "los" : "acik";
}

/** Ekrana uygulanan kâğıt: açık temada her zaman açık; koyu temada tercih. */
export function kagitCoz(tercih: KagitTercihi, tema: Tema): KagitTercihi {
  return tema === "dark" && tercih === "los" ? "los" : "acik";
}

/**
 * Tek seferlik göç kararı: yazılacak tercih ya da null.
 * Göç işareti varsa hiçbir şey yapılmaz; kâğıt tercihi zaten varsa
 * ezilmez; yalnızca açıkça "dark" seçmiş kullanıcıya "los" yazılır.
 */
export function kagitGocu(kayitliTema: unknown, kayitliKagit: unknown, gocYapildi: unknown): KagitTercihi | null {
  if (gocYapildi) return null;
  if (kayitliKagit === "acik" || kayitliKagit === "los") return null;
  return kayitliTema === "dark" ? "los" : null;
}

/*
  Ön boyama betiği. ES5 ve try/catch: eski tarayıcıyı ve kapalı depolamayı
  (gizli sekme) düşürmesin; depolama yoksa açık kâğıt. Öznitelik HER ZAMAN
  yazılır ("acik" ya da "los"): CSS yalnızca "los"u okur, ama testler ve
  ekran okuyucu olmayan durum gözlemi için değer açık olsun. "storage"
  olayı başka sekmede yapılan seçimi bu sekmeye taşır. Göç kararı
  kagitGocu ile aynı kural; ikisi birim testinde karşılaştırılır.
*/
export const KAGIT_BETIGI = `(function(){var K=${JSON.stringify(KAGIT_ANAHTARI)},G=${JSON.stringify(KAGIT_GOC_ANAHTARI)},T=${JSON.stringify(TEMA_ANAHTARI)},d=document.documentElement;try{if(!localStorage.getItem(G)){var k=localStorage.getItem(K);if(k!=="acik"&&k!=="los"&&localStorage.getItem(T)==="dark")localStorage.setItem(K,"los");localStorage.setItem(G,"1")}}catch(e){}function uygula(){var v=null;try{v=localStorage.getItem(K)}catch(e){}d.setAttribute("data-kagit",v==="los"?"los":"acik")}uygula();try{window.addEventListener("storage",function(o){if(o.key===K||o.key===null)uygula()})}catch(e){}})()`;
