/*
  SIGNATURE OS 5 — KABUK GEZİNMESİNİN SAF KARARLARI (Phase 3, 12.11.2026).

  Gezinme bileşeni (app/dashboard/_components/os-gezinme.tsx) React'e
  bağlı; burada yalnızca "bu alt menü açık mı" ve masaüstü dar/açık
  tercihinin kararları durur ki test üretimle aynı kodu sınasın.

  Liste, roller ve etkin uygulama kararı burada DEĞİL: onlar
  lib/os/uygulamalar.ts'te kaldı (tek liste kuralı). Bu modül yalnızca
  sunum durumunu yönetir; kimin neyi göreceğine karar vermez.
*/

/*
  Alt menü (bugün yalnızca açık çalışmanın bölümleri) açık mı:
   1. Bu oturumdaki seçim. Kullanıcı elle kapattıysa saygı gösterilir;
      sayfa değişince seçim sıfırlanır (bileşende).
   2. Etkin sayfa grubun içindeyse AÇIK: kullanıcı bulunduğu sayfayı
      gezinmede görmeli; kapalı bir grubun içinde kalan "etkin" işareti
      görünmez olurdu.
   3. Varsayılan.

  Eskiden (5.1d-4'e kadar) kenar çubuğunun "Diğer" grubu da bu kuralla
  açılıyordu ve tarayıcıda kayıtlı bir açık/kapalı tercihi vardı
  ("arvolab.gezinme.diger"; kayitliTercih, tercihDegeri). Grup 5.1d-3'te
  kalktı, tercih de onunla. Eski anahtar kullanıcıların tarayıcısında
  kalabilir; okunmaz, silinmez, başka bir şeye dönüştürülmez.
*/
export function grupAcikMi({
  secim,
  etkinIcinde,
  varsayilan,
}: {
  secim: boolean | null;
  etkinIcinde: boolean;
  varsayilan: boolean;
}): boolean {
  if (secim !== null) return secim;
  if (etkinIcinde) return true;
  return varsayilan;
}

/*
  ═══ MASAÜSTÜ KENAR ÇUBUĞU: DAR / AÇIK TERCİHİ (Phase 5.1b, 13.11.2026) ═══

  Kurum sahibinin kararı: masaüstünde kenar çubuğu varsayılan olarak 240 px
  AÇIK; kullanıcı 64 px'lik raya daraltabilir, tercih tarayıcıda saklanır.
  Tablet her zaman ray, telefon alt çubuk: bu tercih yalnızca masaüstü
  görünümünü değiştirir (CSS kuralları `min-width: 1200px` içinde yazılır;
  tests/unit/gezinme-tercihi.test.ts bunu her CSS dosyasında denetler).

  Neden <html> özniteliği ve ön boyama betiği: tercih tarayıcıda, sunucu
  onu bilmiyor. React çizdikten sonra uygulansaydı dar tercihli kullanıcı
  her sayfa açılışında 240 px'lik çubuğun 64 px'e kaydığını görürdü; yavaş
  bağlantıda saniyelerce. Tema aynı sorunu 04.11.2026'da yaşadı ve çözümü
  aynı: <head>'de gerçek bir satır içi betik (app/layout.tsx), ilk
  boyamadan önce <html data-gezinme="dar"> yazar. Görünüm yalnızca CSS'te
  olduğu için React ağacı iki durumda da AYNI çizilir; <html> zaten
  suppressHydrationWarning taşıyor, hydration uyuşmazlığı doğmaz.

  Karar tek yerde: `darMi`. Betik aynı kuralı ES5 metin olarak taşır ve
  test ikisini aynı değer matrisiyle birbirine karşı sınar; kural
  değişirse ikisi birlikte değişmeli.
*/

/** Kayıtlı tercihin anahtarı (tarayıcıda, kişiye özel). */
export const GEZINME_DAR_ANAHTARI = "arvolab.gezinme.dar";
/** Ön boyama betiğinin <html>'e yazdığı öznitelik ve dar durumdaki değeri. */
export const GEZINME_OZNITELIGI = "data-gezinme";
export const GEZINME_DAR = "dar";

/**
 * Kayıtlı değer dar mı? YALNIZCA "1" dar; boş, okunamayan, eski ya da
 * tanınmayan her değer AÇIK sayılır. Varsayılanın açık olması bilinçli:
 * yanlış okunan bir tercih kullanıcının adları görmediği bir rayla
 * karşılaşmasına değil, alışık olduğu tam çubuğa yol açmalı.
 */
export function darMi(deger: unknown): boolean {
  return deger === "1";
}

/** Saklanacak değer. Açık için "0" yazılır; okuyan taraf yalnızca "1"e bakar. */
export const darDegeri = (dar: boolean): "1" | "0" => (dar ? "1" : "0");

/*
  Ön boyama betiği. ES5 ve her adım try/catch içinde (tema betiğiyle aynı
  kural): depolama kapalıysa (gizli sekme, engellenmiş site verisi) ya da
  bir API eksikse betik DÜŞMEZ ve sayfa açık çubukla açılır. Başka bir
  sekmede tercih değişince (storage olayı) bu sekme de izler; `key === null`
  depo tamamen temizlendi demektir ve o da yeniden okunur.
*/
export const GEZINME_BETIGI = `(function(){try{var K=${JSON.stringify(GEZINME_DAR_ANAHTARI)},A=${JSON.stringify(GEZINME_OZNITELIGI)},D=${JSON.stringify(GEZINME_DAR)},d=document.documentElement;function uygula(){var v=null;try{v=window.localStorage.getItem(K)}catch(e){}try{if(v==="1")d.setAttribute(A,D);else d.removeAttribute(A)}catch(e){}}uygula();try{window.addEventListener("storage",function(o){if(!o||o.key===K||o.key===null)uygula()})}catch(e){}}catch(e){}})()`;
