/*
  TEK ANA DENEYİM (20.11.2026, kurum sahibinin ürün kararı: ArvoLab tek
  tip, editör odaklı bir akademik araştırma ve yazma ürünü; kurucu,
  personel ve bireysel kullanıcı aynı ana deneyimi kullanır. ArvoLab başka
  kurumlara kiralanmayacak, çok kurumlu yönetim ürünü geliştirilmeyecek).

  Ana Sayfa ve Çalışmalarım YALNIZCA kullanıcının KENDİ çalışmalarını
  gösterir. Eskiden personel kurumun bütün çalışmalarını (RLS'in gösterdiği
  her satırı) kendi listesi gibi görüyordu ve iç ekip kurum seçiciyle
  kurumlar arasında geçiş yapıyordu. PR #113 kurum ekranını önce ayrı bir
  "Yönetim" sayfasına taşıdı; karar güncellenince o sayfa, kurum seçici ve
  personel görünümü tamamen kalktı. Görevlendirme ve operasyon ArvoOS'ta
  (Talepler, İşler).

  Yetkiler ve veri sınırları DEĞİŞMEDİ: RLS'in gözetim rolüne açtığı okuma
  (public.gozetim_kapsami) yerinde; yalnızca ArvoLab ekranları onu
  kullanmıyor.

  Saf modül; testi tests/unit/kisisel-calismalar.test.ts. 20.11.2026'ya
  kadar adı lib/yonetim.ts idi.
*/

import { STAFF_ROLES } from "./project-labels";
import type { UserRole } from "./project-labels";

export const KISISEL_CALISMALAR = "/dashboard/editor";

/**
 * Personel rollerinden biri mi (Üye/Öğrenci dışındakiler, STAFF_ROLES).
 * Ana deneyimi DEĞİŞTİRMİYOR; yalnızca Destek sayfasındaki geçici uzman
 * kuyruğu ve Ayarlar'daki iç ekip bölümü buna bakıyor.
 */
export function personelRolu(rol: string | null | undefined): boolean {
  return Boolean(rol) && (STAFF_ROLES as readonly string[]).includes(rol as UserRole);
}

/**
 * Kişisel listenin kuralı: kullanıcının SAHİBİ olduğu çalışmalar.
 * Sorumlu olarak atandığı (assignee) ya da gözetim yetkisiyle gördüğü
 * çalışmalar burada yok. Oturum yoksa liste boştur.
 */
export function kisiselCalismalar<T extends { owner_id: string }>(calismalar: T[], kullaniciId: string | null | undefined): T[] {
  if (!kullaniciId) return [];
  return calismalar.filter((c) => c.owner_id === kullaniciId);
}

/** Bir çalışma değişince yenilenen liste sayfaları (lib/liste-yenileme.ts; adres listesi saf modülde, test edilebilsin diye). */
export const CALISMA_LISTESI_ADRESLERI = ["/dashboard", KISISEL_CALISMALAR] as const;
