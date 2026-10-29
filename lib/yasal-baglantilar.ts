/*
  ARVO'NUN YASAL METİNLERİ (29.10.2026). Saf modül; testi
  tests/unit/yasal-baglantilar.test.ts.

  Metinler arvo-os.com'da, dile göre ayrı adreste: Türkçe "/tr/…", İngilizce
  kökte (ArvoOS lib/site/routes.ts). Eskiden kayıt formu her dilde
  "/gizlilik"e bağlanıyordu: o adres Türkçe sayfaya yönleniyor, yani
  İngilizce kayıt olan kullanıcı okuyamadığı bir metne "okudum, onaylıyorum"
  diyordu. Ödeme formlarında ise mesafeli satış sözleşmesine ve iptal-iade
  koşullarına hiç bağlantı yoktu.

  Adresler ArvoOS'ta değişirse burası da değişmeli; iki depo arasında ortak
  kod yok, liste kısa tutuldu.
*/

import type { Dil } from "@/lib/dil";

export type YasalSayfa = "gizlilik" | "mesafeli-satis" | "iptal-iade";

const KOK = "https://arvo-os.com";

const ADRESLER: Record<YasalSayfa, Record<Dil, string>> = {
  gizlilik: { tr: "/tr/gizlilik", en: "/privacy" },
  "mesafeli-satis": { tr: "/tr/mesafeli-satis-sozlesmesi", en: "/distance-sales-agreement" },
  "iptal-iade": { tr: "/tr/iptal-ve-iade", en: "/cancellation-and-refund" },
};

export const yasalAdres = (sayfa: YasalSayfa, dil: Dil): string => `${KOK}${ADRESLER[sayfa][dil]}`;
