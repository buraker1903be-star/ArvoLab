/*
  TEK ANA DENEYİM VE AYRI YÖNETİM ALANI (20.11.2026, kurum sahibinin ürün
  kararı: tek üyelik kimliği, tek ana kullanıcı görünümü, tek çalışma
  oluşturma akışı).

  Eskiden Ana Sayfa ve Çalışmalarım role ve kuruma göre üç ayrı düzende
  çiziliyordu: personel kurumun bütün çalışmalarını (RLS'in gösterdiği her
  satırı) kendi listesi gibi görüyor, öğrenci tek tezini görüyordu; iç ekip
  hesap menüsünden "Personel / Öğrenci · kurum / Öğrenci · bireysel"
  arasında geçiş yapıyordu (lib/onizleme.ts, kaldırıldı). Kurucunun kendi
  tezini yazmak için öğrenci görünümünü seçmesi gerekiyordu; yönetimin
  gördüğü öğrenci tezleri kişisel listesine karışıyordu.

  Artık herkes aynı araştırma ve yazma arayüzünü kullanıyor: Ana Sayfa ve
  Çalışmalarım YALNIZCA kullanıcının KENDİ çalışmalarını gösterir
  (kisiselCalismalar). Kurumun çalışmaları, onay ve kuyruklar ayrı bir
  alanda (/dashboard/yonetim): yetkili kişi oraya
  açıkça girer. Yetkiler ve veri sınırları DEĞİŞMEDİ — Yönetim'de görülen
  satırları yine RLS seçiyor (gözetim kurumla sınırlı, kurumlar arası
  görüş yalnızca iç ekipte); burası yalnızca hangi ekranda çizileceğini
  söylüyor.

  Saf modül; testi tests/unit/yonetim.test.ts.
*/

import { STAFF_ROLES } from "./project-labels";
import type { UserRole } from "./project-labels";

export const YONETIM_ANA = "/dashboard/yonetim";
export const YONETIM_CALISMALAR = "/dashboard/yonetim/calismalar";
export const KISISEL_CALISMALAR = "/dashboard/editor";

/** Ana Sayfa ve Çalışmalarım'ın hangi kapsamda çizileceği. */
export type Kapsam = "kisisel" | "yonetim";

/**
 * Yönetim alanına kim girebilir: Üye/Öğrenci dışındaki bütün personel
 * (eskiden "personel görünümü"nü alanların aynısı, STAFF_ROLES). Rol
 * listesi elle yazılmıyor; personel akışlarının kapısıyla aynı kaynak.
 */
export function yonetimeGirebilir(rol: string | null | undefined): boolean {
  return Boolean(rol) && (STAFF_ROLES as readonly string[]).includes(rol as UserRole);
}

/**
 * Kişisel listenin kuralı: kullanıcının SAHİBİ olduğu çalışmalar.
 * Sorumlu olarak atandığı (assignee) ya da gözetim yetkisiyle gördüğü
 * çalışmalar burada yok; onlar Yönetim'de. Oturum yoksa liste boştur.
 */
export function kisiselCalismalar<T extends { owner_id: string }>(calismalar: T[], kullaniciId: string | null | undefined): T[] {
  if (!kullaniciId) return [];
  return calismalar.filter((c) => c.owner_id === kullaniciId);
}

/** Kapsama göre çalışma listesinin adresi (filtre ve seçim bağlantıları bunun üstüne kurulur). */
export const listeTabani = (kapsam: Kapsam) => (kapsam === "yonetim" ? YONETIM_CALISMALAR : KISISEL_CALISMALAR);

/**
 * Bir çalışmanın "seçili" adresi: kendi çalışması kişisel listede,
 * başkasının çalışması — kişi Yönetim'e girebiliyorsa — Yönetim'deki
 * listede. Sahip bilinmiyorsa (satır okunamadı ya da RLS göstermedi)
 * kişisel liste: yönlendirme yetki vermez, en zararsız varsayılan.
 */
export function calismaninListesi(girdi: {
  calismaId: string;
  sahipId: string | null;
  kullaniciId: string;
  rol: string | null | undefined;
  kilavuz?: boolean;
}): string {
  const baskasinin = girdi.sahipId !== null && girdi.sahipId !== girdi.kullaniciId;
  const taban = baskasinin && yonetimeGirebilir(girdi.rol) ? YONETIM_CALISMALAR : KISISEL_CALISMALAR;
  return `${taban}?sec=${encodeURIComponent(girdi.calismaId)}${girdi.kilavuz ? "&kilavuz=1" : ""}`;
}

/*
  KURUM SEÇİMİNİN GÖRÜNDÜĞÜ YERLER (20.11.2026, PR #113). İç ekibin kurum
  seçimi (lib/kurum-secimi.ts) yalnızca yönetim ekranlarını süzer: Yönetim,
  ekip, destek kuyrukları, asistan kayıtları ve kurum faturası. Seçici ve
  "Yalnızca X gösteriliyor" şeridi de yalnızca orada. Eskiden şerit HER
  sayfada, seçici hesap menüsündeydi; kişisel Ana Sayfa ve Çalışmalarım
  artık seçimden bağımsız olduğu hâlde kurucu kendi tezinin üstünde
  "yalnızca B kurumu gösteriliyor" yazısını görüyordu.
*/
const KURUM_SECIMI_YOLLARI = [YONETIM_ANA, "/dashboard/team", "/dashboard/expert-requests", "/dashboard/support", "/dashboard/asistan", "/dashboard/abonelik"];

export function kurumSecimiGorunur(yol: string | null | undefined): boolean {
  if (!yol) return false;
  return KURUM_SECIMI_YOLLARI.some((onek) => yol === onek || yol.startsWith(`${onek}/`));
}

/** Bir çalışma değişince yenilenen liste sayfaları (lib/liste-yenileme.ts; adres listesi saf modülde, test edilebilsin diye). */
export const CALISMA_LISTESI_ADRESLERI = ["/dashboard", KISISEL_CALISMALAR, YONETIM_ANA, YONETIM_CALISMALAR] as const;
