/*
  ERİŞİM YOLU: kim hangi kapıdan geçer (20.11.2026). Saf modül; testi
  tests/unit/erisim-yolu.test.ts. Okuma ve karar lib/access.ts'te.

  Üç yol var ve ROL değil KURUM BAĞI belirler:
  - "ic-ekip": system_admin, founder. Hiçbir koşulda engellenmez.
  - "kurum": profilde organization_id varsa. Hak kurumun lisansından gelir;
    lisansı ArvoOS yazar (organizations: license_status, current_period_end,
    synced_at), karar lib/license-decision.ts. Bireysel abonelik ve ödeme
    ekranı bu yolda HİÇ sorulmaz — personel de öğrenci de.
  - "bireysel": kurumu olmayan herkes; kendi aboneliği (ArvoOS köprüsü).

  AKADEMİKMERKEZ PERSONELİ (ürün kararı, 20.11.2026): normal kullanıcı
  arayüzünü kullanır, bireysel ödeme engeline takılmaz, hakkını kurumun
  lisansından alır. Bu kural ZATEN "kurum" yolunun kendisi: personelin
  profili AkademikMerkez'e bağlıysa (organization_id) ve kurumun lisansı
  açıksa kapı açıktır. E-posta istisnası ya da rol istisnası YOK; personel
  rolü tek başına hak vermez. Bağ, ArvoOS'un yansıttığı üye listesinden
  (arvoos_members, e-posta) sunucuda kurulur: arvoos_uyeligini_bagla
  (onaylı e-posta şartı) — kullanıcı kendi kurumunu seçemez.

  Bağsız personel: rolü personel olup profili hiçbir kuruma bağlı olmayan
  hesap. Hak doğrulanamadığı için bireysel yola düşer; ekran bunu açıkça
  söyler (subscription-notice.tsx) ki "neden ödeme istiyor" sorusu
  cevapsız kalmasın. Çözüm ArvoOS'ta: üyelik ve e-posta eşleşmesi.
*/
import { ADMIN_ROLES, STAFF_ROLES } from "./project-labels";
import type { UserRole } from "./project-labels";

export type ErisimYolu = "ic-ekip" | "kurum" | "bireysel";

export function erisimYolu(rol: string | null | undefined, kurumId: string | null | undefined): ErisimYolu {
  if (rol && (ADMIN_ROLES as readonly string[]).includes(rol)) return "ic-ekip";
  if (kurumId) return "kurum";
  return "bireysel";
}

/** Rolü personel (iç ekip dışı) ama profili hiçbir kuruma bağlı değil: hakkı doğrulanamıyor. */
export function bagsizPersonel(rol: string | null | undefined, kurumId: string | null | undefined): boolean {
  return erisimYolu(rol, kurumId) === "bireysel" && Boolean(rol) && (STAFF_ROLES as readonly string[]).includes(rol as UserRole);
}
