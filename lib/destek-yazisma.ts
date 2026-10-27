/*
  Destek yazışmasının saf kuralları (tablo: destek_mesajlari,
  migration 20261027074716). Ekran, sunucu işlemi ve test aynı kararı
  okusun diye burada; Next/Supabase'e dokunmaz.
*/

export type Taraf = "talep_sahibi" | "uzman" | "destek";

export type YazismaMesaji = {
  id: string;
  taraf: Taraf;
  yazanAdi: string | null;
  metin: string;
  zaman: string;
};

/*
  Yazışma eskiden tek bir yanıt alanıydı (app_support_requests.admin_note).
  O alana yazılmış yanıtlar kaybolmasın diye yazışmanın içinde, kendi
  zamanında gösteriliyor. Aynı anda yazılmış iki mesajda sıra kimliğe göre
  sabit: yenilemede yer değiştirmesin.
*/
export function yazismaKur(
  mesajlar: YazismaMesaji[],
  eskiYanit: { metin: string | null | undefined; zaman: string | null | undefined } | null = null,
): YazismaMesaji[] {
  const hepsi = [...mesajlar];
  const metin = eskiYanit?.metin?.trim();
  if (metin) {
    hepsi.push({ id: "eski-yanit", taraf: "destek", yazanAdi: null, metin, zaman: eskiYanit?.zaman ?? "" });
  }
  return hepsi.sort((a, b) => a.zaman.localeCompare(b.zaman) || a.id.localeCompare(b.id));
}

/** Son söz talep sahibindeyse karşı taraf cevap borçlu. */
export const yanitBekliyor = (mesajlar: YazismaMesaji[]) =>
  mesajlar.length > 0 && mesajlar[mesajlar.length - 1].taraf === "talep_sahibi";

/** Son söz uzmanda ya da destekteyse talep sahibine yeni bir cevap var. */
export const yanitGeldi = (mesajlar: YazismaMesaji[]) =>
  mesajlar.length > 0 && mesajlar[mesajlar.length - 1].taraf !== "talep_sahibi";

/*
  Uzman yazışmasına kim yazabilir — RLS'teki kuralın aynısı (yazışma
  politikası). Ekran bu kararla formu gösterir ya da gerekçesini yazar;
  asıl denetim veritabanında.
*/
export function uzmanYazismaDurumu(
  durum: string,
  ben: "talep_sahibi" | "uzman",
): { yazabilir: true } | { yazabilir: false; neden: string } {
  if (durum === "completed") return { yazabilir: false, neden: "Talep tamamlandı. Yeni bir sorunuz varsa yeni talep açın." };
  if (durum === "cancelled") return { yazabilir: false, neden: "Talep iptal edildi." };
  if (ben === "uzman" && durum !== "accepted") return { yazabilir: false, neden: "Yazışma talebi üstlenince açılır." };
  return { yazabilir: true };
}

/** Baloncuğun başlığı: kendi mesajında "Siz", karşı tarafta ad ya da rol. */
export function yazanEtiketi(m: YazismaMesaji, benimTarafim: Taraf): string {
  if (m.taraf === benimTarafim) return "Siz";
  if (m.taraf === "talep_sahibi") return m.yazanAdi ?? "Talep sahibi";
  if (m.taraf === "uzman") return m.yazanAdi ? `${m.yazanAdi} · Uzman` : "Uzman";
  return m.yazanAdi ? `${m.yazanAdi} · Destek ekibi` : "Destek ekibi";
}
