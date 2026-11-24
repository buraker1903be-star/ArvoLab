/*
  İSTEĞE BAĞLI İLETİŞİM TELEFONU (24.11.2026).

  Telefon ne girişte ne faturada kullanılıyor; kurumun ulaşması gerektiğinde
  bakılan bir profil bilgisi. Bu yüzden ZORUNLU DEĞİL ve boş bırakılması bir
  hata değil.

  Numara ülke koduyla birlikte TEK METİN olarak saklanıyor ("+90 532 000 00
  00"). Parçalı saklamak, ülkeden ülkeye değişen alan kodu uzunluklarını
  veritabanına taşırdı; birleşik metin hem gösterilebiliyor hem aranabiliyor.

  Numaranın GERÇEKLİĞİ doğrulanmıyor. Ülke başına numara planı tutmak ayrı
  bir iş ve yanlış bir kural, geçerli numarası olan kullanıcıyı kaydetmekten
  alıkoyar — kaçırılan hatalı numaradan daha pahalıya gelir. Denetim yalnızca
  biçimsel: ülke kodu listeden, kalanı rakam ve ayırıcı.

  Saf modül; testi tests/unit/telefon.test.ts.
*/

import type { Metin } from "./dil";

export type UlkeKodu = { kod: string; ad: Metin };

/*
  Liste kısa ve bilerek: ArvoLab'ın kullanıcıları Türkiye'de ve Türkiye
  dışındaki üniversitelerde. Dünyanın bütün ülkelerini listelemek seçiciyi
  kullanılmaz yapardı; "Diğer" yok, çünkü kod serbest yazılamıyor —
  eksikse eklenir.
*/
export const ULKE_KODLARI: UlkeKodu[] = [
  { kod: "+90", ad: { tr: "Türkiye", en: "Türkiye" } },
  { kod: "+1", ad: { tr: "ABD / Kanada", en: "USA / Canada" } },
  { kod: "+44", ad: { tr: "Birleşik Krallık", en: "United Kingdom" } },
  { kod: "+49", ad: { tr: "Almanya", en: "Germany" } },
  { kod: "+33", ad: { tr: "Fransa", en: "France" } },
  { kod: "+31", ad: { tr: "Hollanda", en: "Netherlands" } },
  { kod: "+39", ad: { tr: "İtalya", en: "Italy" } },
  { kod: "+34", ad: { tr: "İspanya", en: "Spain" } },
  { kod: "+41", ad: { tr: "İsviçre", en: "Switzerland" } },
  { kod: "+46", ad: { tr: "İsveç", en: "Sweden" } },
  { kod: "+43", ad: { tr: "Avusturya", en: "Austria" } },
  { kod: "+32", ad: { tr: "Belçika", en: "Belgium" } },
  { kod: "+45", ad: { tr: "Danimarka", en: "Denmark" } },
  { kod: "+358", ad: { tr: "Finlandiya", en: "Finland" } },
  { kod: "+47", ad: { tr: "Norveç", en: "Norway" } },
  { kod: "+48", ad: { tr: "Polonya", en: "Poland" } },
  { kod: "+351", ad: { tr: "Portekiz", en: "Portugal" } },
  { kod: "+30", ad: { tr: "Yunanistan", en: "Greece" } },
  { kod: "+353", ad: { tr: "İrlanda", en: "Ireland" } },
  { kod: "+61", ad: { tr: "Avustralya", en: "Australia" } },
  { kod: "+81", ad: { tr: "Japonya", en: "Japan" } },
  { kod: "+971", ad: { tr: "BAE", en: "UAE" } },
  { kod: "+994", ad: { tr: "Azerbaycan", en: "Azerbaijan" } },
  { kod: "+7", ad: { tr: "Rusya / Kazakistan", en: "Russia / Kazakhstan" } },
];

export const VARSAYILAN_ULKE_KODU = "+90";

const KODLAR = new Set(ULKE_KODLARI.map((u) => u.kod));

/** Ülke kodu listede mi? */
export const ulkeKoduVarMi = (kod: string): boolean => KODLAR.has(kod);

/** Yerel numaradan rakam dışındaki her şeyi (boşluk, parantez, tire hariç) atar. */
const yereliTemizle = (yerel: string): string => yerel.replace(/[^\d ()-]/g, "").replace(/\s+/g, " ").trim();

/**
 * Ülke kodu ve yerel numaradan saklanacak metni kurar.
 * Yerel numara boşsa null döner: telefon isteğe bağlı.
 */
export function telefonuBirlestir(ulkeKodu: string, yerel: string): string | null {
  const temiz = yereliTemizle(yerel);
  if (!temiz) return null;
  const kod = ulkeKoduVarMi(ulkeKodu) ? ulkeKodu : VARSAYILAN_ULKE_KODU;
  return `${kod} ${temiz}`;
}

/**
 * Saklanan metni seçici ve kutu için ayırır. Tanınmayan ya da boş değerde
 * varsayılan ülke kodu ve boş numara döner.
 */
export function telefonuAyir(telefon: string | null | undefined): { ulkeKodu: string; yerel: string } {
  const metin = String(telefon ?? "").trim();
  if (!metin.startsWith("+")) return { ulkeKodu: VARSAYILAN_ULKE_KODU, yerel: yereliTemizle(metin) };
  /* En UZUN eşleşen kod kazanır: "+1" ile "+90" karışmasın diye değil
     ("+9" yok), "+7" ile "+90" gibi önek çakışmaları için. */
  let eslesen = "";
  for (const kod of KODLAR) {
    if (metin.startsWith(kod) && kod.length > eslesen.length) eslesen = kod;
  }
  if (!eslesen) return { ulkeKodu: VARSAYILAN_ULKE_KODU, yerel: yereliTemizle(metin.slice(1)) };
  return { ulkeKodu: eslesen, yerel: yereliTemizle(metin.slice(eslesen.length)) };
}

export const TELEFON_EN_AZ_RAKAM = 6;
export const TELEFON_EN_FAZLA_RAKAM = 15;

/**
 * Saklanacak telefon biçimsel olarak geçerli mi? null (girilmemiş) geçerli:
 * alan isteğe bağlı.
 */
export function telefonGecerliMi(telefon: string | null): boolean {
  if (telefon === null) return true;
  if (!/^\+[0-9]{1,4}[0-9 ()-]{4,20}$/.test(telefon)) return false;
  const rakam = telefon.replace(/\D/g, "").length;
  return rakam >= TELEFON_EN_AZ_RAKAM && rakam <= TELEFON_EN_FAZLA_RAKAM;
}
