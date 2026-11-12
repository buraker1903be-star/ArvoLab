/*
  DOI SORGUSU HIZ SINIRI (Phase 5.0b ve T3, 12.11.2026). Saf modül: Next,
  React ve Supabase'e dokunmaz; kararı sunucu eylemleri uygular
  (app/actions/literature.ts lookupDoi, app/actions/kaynak-aktarim.ts
  doiIleEkle), testi tests/unit/doi-sorgu-siniri.test.ts.

  NEDEN: DOI sorgusu sunucudan Crossref'e gidiyor. Sınırsız bırakılırsa
  oturumu olan herkes sunucuyu bir Crossref aracına çevirebilir; Crossref
  ortak sunucu IP'sini kısarsa BÜTÜN kullanıcıların künye doğrulaması ve
  DOI ile kaynak ekleme akışı birlikte düşer.

  ORTAK BÜTÇE (T3): tekli sorgu (lookupDoi, DOI kutusu) ve toplu içe
  aktarma (doiIleEkle) aynı anahtardan, kullanıcı başına saatte 120 DOI
  harcar. Sayaç public.rate_limit_take (migration 20261112195236): N
  birimlik isteği tek ifadede, atomik olarak ve en çok KALAN hak kadar
  karşılar; kalan hakkı ve pencerenin yenileneceği anı döndürür. Eşzamanlı
  tekli/toplu çağrılar aynı satırda sıraya girer, verilen toplam sınırı
  aşmaz (tests/db, scripts/eszamanli-hiz-siniri.sh).

  SAYAÇ ARIZASINDA AÇIK KALIR (fail-open), bilerek: lib/ai/erisim.ts ve
  literatür aramasıyla aynı ilke — bir yapılandırma eksikliği ya da geçici
  veritabanı arızası, öğrencinin DOI ile kaynak eklemesini durdurmamalı.
  Bedeli: arıza süresince saatlik sınır UYGULANMAZ. Oturum ve abonelik
  kapısı yine çalışır; Crossref istekleri 8 sn zaman aşımıyla gider. Arıza
  her çağrıda günlüğe yazılır ve toplu içe aktarmanın özetinde
  ("sayacsiz") görünür.
*/

/** Kullanıcı başına saatlik DOI hakkı (kurum sahibinin kararı, 12.11.2026). */
export const DOI_SAATLIK_HAK = 120;
export const DOI_PENCERE = "1 hour";

/**
 * Sayaç anahtarı. Kullanıcı kimliği yalnızca sunucuda, service_role'a açık
 * tabloda tutulur; istemciye dönen hiçbir cevapta yer almaz.
 */
export function doiSayacAnahtari(kullaniciId: string): string {
  return `doi-sorgu:${kullaniciId}`;
}

export type DoiRezervasyonu =
  /** Sayaç çalıştı: en çok istenen kadar hak verildi (0 da olabilir). */
  | { tur: "sayacli"; verilen: number; kalan: number; yenilenme: string | null }
  /** Sayaç kurulamadı ya da cevabı okunamadı: istenen kadar sorgu yapılır, arıza günlüğe yazılır. */
  | { tur: "sayacsiz"; verilen: number };

const tamsayi = (deger: unknown): number | null =>
  typeof deger === "number" && Number.isInteger(deger) && deger >= 0 ? deger : null;

/**
 * rate_limit_take cevabından rezervasyon. Supabase, tablo döndüren işlevin
 * sonucunu satır dizisi olarak verir. Yalnızca ŞEKLİ DOĞRU bir cevap hakkı
 * kısar; okunamayan cevap "hak yok" sayılmaz (yukarıdaki ilke). Verilen hak
 * istenenden fazla görünse bile istenene kırpılır.
 */
export function doiRezervasyonu(girdi: { sayacVar: boolean; hata?: unknown; veri?: unknown; istenen: number }): DoiRezervasyonu {
  const istenen = Math.max(0, Math.floor(girdi.istenen));
  if (!girdi.sayacVar || girdi.hata) return { tur: "sayacsiz", verilen: istenen };
  const satir = Array.isArray(girdi.veri) ? girdi.veri[0] : girdi.veri;
  if (!satir || typeof satir !== "object") return { tur: "sayacsiz", verilen: istenen };
  const { granted, remaining, resets_at } = satir as Record<string, unknown>;
  const verilen = tamsayi(granted);
  const kalan = tamsayi(remaining);
  if (verilen === null || kalan === null) return { tur: "sayacsiz", verilen: istenen };
  return {
    tur: "sayacli",
    verilen: Math.min(verilen, istenen),
    kalan,
    yenilenme: typeof resets_at === "string" && !Number.isNaN(Date.parse(resets_at)) ? resets_at : null,
  };
}
