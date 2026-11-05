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
