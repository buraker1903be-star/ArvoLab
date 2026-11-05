/*
  AI ÖNERİSİ KARARLARI — YALNIZCA OTURUMDA (Signature OS 4.3, 05.11.2026).

  Eskiden "İmlece ekle" ve satır içi önerinin Tab ile kabulü, asistan
  kaydına OTOMATİK olarak "faydalı" puanı yazıyordu (ai_assistant_runs.
  rating). Oysa bir öneriyi belgeye almak ile onu "faydalı" bulmak ayrı
  şeyler: öğrenci metni alıp tamamen yeniden yazabilir, ya da reddettiği
  öneri yine de işine yarayabilir. Kurum sahibinin kararı (4.3): işlem
  kararı memnuniyet puanı olarak kaydedilmez. Puan yalnızca kullanıcının
  AÇIKÇA verdiği değerlendirmedir ("Beğenmedim").

  Mevcut tabloda kararı puandan ayrı tutacak bir sütun yok ve bu aşamada
  migration yapılmıyor. Bu yüzden kararlar yalnızca bu tarayıcı
  sekmesinin oturumunda (sessionStorage) tutulur; kalıcı DEĞİL, sunucuya
  gitmez. Kalıcı kayıt ayrı bir migration ile önerildi (4.3 raporu).
*/
export type AiKarari = "kabul" | "duzenleyerek_kabul" | "altina_eklendi" | "reddedildi" | "geri_alindi" | "satir_ici_kabul";
export type KararKaydi = { kayitId: string | null; karar: AiKarari; zaman: string };

const ANAHTAR = "arvolab.ai-kararlari";
const EN_FAZLA = 200;

export function kararKaydet(kayitId: string | null | undefined, karar: AiKarari): void {
  try {
    const liste = oturumKararlari();
    liste.push({ kayitId: kayitId ?? null, karar, zaman: new Date().toISOString() });
    sessionStorage.setItem(ANAHTAR, JSON.stringify(liste.slice(-EN_FAZLA)));
  } catch {
    // Gizli pencere ya da kapalı depolama: karar kaydı akışı düşürmez.
  }
}

export function oturumKararlari(): KararKaydi[] {
  try {
    const ham = JSON.parse(sessionStorage.getItem(ANAHTAR) ?? "[]");
    return Array.isArray(ham) ? ham : [];
  } catch {
    return [];
  }
}

/*
  SAYFA YENİLENİNCE AI GERİ ALMASI (4.3 ek, kurum sahibinin talebi).
  Panelin "Geri al" düğmesi ve AI adımının Ctrl+Z ile ayrı geri alınması
  yalnızca o sayfa yüklemesinde var: ikisi de bellekte (eklenti durumu ve
  ProseMirror geçmişi), belgeyle kaydedilmiyor. Sayfa yenilenince ikisi de
  kaybolur; Ctrl+Z eski AI işlemine ULAŞAMAZ. Eskiden bu sessizdi:
  kullanıcı Ctrl+Z'ye basıp hiçbir şey olmadığını görüyor ya da kart
  kaybolduğu için geri almanın yolunu bulamıyordu.

  Uygulanan her AI değişikliğinin yalnızca İZİ (zaman, sürüm alındı mı)
  bu sekmenin oturumuna yazılır, metni değil. Sonraki yüklemede bu izler
  "önceki yüklemeden" sayılır ve editör kullanıcıyı Sürümler'e yönlendirir.
  Geri alınan değişikliğin izi silinir. Sunucuya gitmez, belgeye girmez.
*/
export type UygulamaIzi = { projeId: string; id: string; yukleme: string; zaman: string; surumAlindi: boolean };
const IZ_ANAHTARI = "arvolab.ai-uygulamalari";
/** Bu sayfa yüklemesinin kimliği: modül her yüklemede yeniden değerlendirilir. */
export const BU_YUKLEME = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function izler(): UygulamaIzi[] {
  try {
    const ham = JSON.parse(sessionStorage.getItem(IZ_ANAHTARI) ?? "[]");
    return Array.isArray(ham) ? ham : [];
  } catch {
    return [];
  }
}
function izleriYaz(liste: UygulamaIzi[]) {
  try {
    sessionStorage.setItem(IZ_ANAHTARI, JSON.stringify(liste.slice(-EN_FAZLA)));
  } catch {
    // Depolama kapalıysa yalnızca yenileme uyarısı çıkmaz; akış düşmez.
  }
}
export function uygulamaIziEkle(projeId: string, id: string, surumAlindi: boolean, yukleme = BU_YUKLEME) {
  izleriYaz([...izler(), { projeId, id, yukleme, zaman: new Date().toISOString(), surumAlindi }]);
}
export function uygulamaIziSil(projeId: string, id: string) {
  izleriYaz(izler().filter((i) => !(i.projeId === projeId && i.id === id)));
}
/** Bu çalışmada, ÖNCEKİ sayfa yüklemelerinde uygulanmış ve geri alınmamış AI değişiklikleri. */
export function oncekiUygulamalar(projeId: string, yukleme = BU_YUKLEME): UygulamaIzi[] {
  return izler().filter((i) => i.projeId === projeId && i.yukleme !== yukleme);
}
/** Kullanıcı uyarıyı gördü ("Anladım"): önceki yüklemelerin izleri silinir, bu yüklemeninkiler kalır. */
export function oncekiUygulamalariUnut(projeId: string, yukleme = BU_YUKLEME) {
  izleriYaz(izler().filter((i) => !(i.projeId === projeId && i.yukleme !== yukleme)));
}
