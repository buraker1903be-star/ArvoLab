/*
  EDİTÖR RESİM YOLLARI — saf kararlar (Security Hardening S1.1, 06.11.2026).
  lib/manuscript-images.ts'ten ayrıldı: o dosya yönetici istemcisini içe
  aktarıyor ve birim testi (tests/unit, Supabase'e dokunmaz) onu
  yükleyemiyordu. Hangi yolun imzalanabileceği kararı burada; testi
  tests/unit/editor-resim-yolu.test.ts.
*/
/* Dosya adı "." ya da ".." olamaz: depo nesne adı olarak yorumlanışı istemciye göre değişebilir; bilerek reddedilir. */
export const EDITOR_IMAGE_PATH = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/editor-images\/(?!\.{1,2}$)[^/]+$/i;

/** Kendi Supabase depomuzdaki dosya bağlantısından depo yolunu çıkarır (başka adresler: null) */
export function storagePathFromUrl(src: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  try {
    const url = new URL(src);
    if (url.origin !== new URL(base).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:sign|public|authenticated)\/project-files\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

/*
  İMZALANABİLECEK KLASÖRLER (Security Hardening S1.1, 06.11.2026). Tek yerde:
  editör, yazdırma, Word çıktısı ve paylaşım sayfası bu listeyi kullanır.

  Eskiden ATANAN KİŞİNİN klasörü de kabul ediliyordu. İmzalama yönetici
  istemcisiyle (RLS'siz) yapıldığı için bu, metne yazılan yolun sahibine
  bakmadan başka bir kullanıcının dosyasını imzalamak demekti: sahibin
  assignee_id'yi kendisi yazabildiği bir veritabanında (Production'da
  guard_academic_project_update eksik, 06.11.2026'da salt okumayla
  doğrulandı) A, B'yi kendi çalışmasına atayıp B'nin editor-images
  klasöründeki dosyaları imzalatabilir, paylaşım bağlantısıyla dışarıya
  açabilirdi. Ön koşulu B'nin kimliğini ve dosya adını bilmek.

  Kalan iki klasör saldırgana yabancı bir dosya açmaz: çalışma klasörü
  (yeni yükleme yolu) çalışmanın kendisidir; sahibin klasörü (eski yol:
  yükleyenin kimliği) sahibin KENDİ dosyalarıdır. Atanan kişinin eski
  yükleme yolundan bir resim kırılabilir; Production'da öyle bir resim yok
  (06.11.2026: tek editör resmi çalışma klasöründe, metinlerdeki bütün
  bağlantılar kendi çalışma klasörüne gidiyor).
*/
export function calismaResimKlasorleri(calisma: { id: string; owner_id: string | null | undefined }): string[] {
  return [calisma.id, calisma.owner_id].filter((k): k is string => typeof k === "string" && k.length > 0);
}

/** writerIds: bu çalışmanın kabul edilen klasörleri (calismaResimKlasorleri) */
export function isWriterImagePath(path: string, writerIds: (string | null | undefined)[]): boolean {
  const match = path.match(EDITOR_IMAGE_PATH);
  if (!match) return false;
  const owner = match[1].toLowerCase();
  return writerIds.some((id) => id?.toLowerCase() === owner);
}
