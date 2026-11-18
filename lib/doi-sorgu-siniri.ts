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

  SAYAÇ ARIZASINDA KAPALI KALIR (fail-closed): yönetim istemcisi
  kurulamazsa, RPC hata verirse veya yanıt doğrulanamazsa DOI sorgusu
  Crossref'e gönderilmez. Oturum ve abonelik kontrolleri korunur.
  Arıza sunucu günlüğüne yazılır; toplu içe aktarmanın özetinde
  "sayacsiz" bilgisi yer alır. Bu bilgi sınırsız sorgu izni değildir.
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
  /** Sayaç arızası: sıfır hak verilir; Crossref sorgusu yapılmaz. */
  | { tur: "ariza"; verilen: 0 };

const tamsayi = (deger: unknown): number | null =>
  typeof deger === "number" && Number.isInteger(deger) && deger >= 0 ? deger : null;

/**
 * rate_limit_take cevabından rezervasyon. Supabase, tablo döndüren işlevin
 * sonucunu satır dizisi olarak verir. Yalnızca ŞEKLİ DOĞRU bir cevap hakkı
 * belirler. Okunamayan veya tutarsız yanıt arıza sayılır ve hiçbir
 * sorguya izin verilmez. İstenenden fazla hak veren yanıt reddedilir.
 */
export function doiRezervasyonu(girdi: { sayacVar: boolean; hata?: unknown; veri?: unknown; istenen: number }): DoiRezervasyonu {
  const istenen = Math.max(0, Math.floor(girdi.istenen));
  if (!girdi.sayacVar || girdi.hata) return { tur: "ariza", verilen: 0 };
  if (Array.isArray(girdi.veri) && girdi.veri.length !== 1) return { tur: "ariza", verilen: 0 };
  const satir = Array.isArray(girdi.veri) ? girdi.veri[0] : girdi.veri;
  if (!satir || typeof satir !== "object" || Array.isArray(satir)) return { tur: "ariza", verilen: 0 };
  const { granted, remaining, resets_at } = satir as Record<string, unknown>;
  const verilen = tamsayi(granted);
  const kalan = tamsayi(remaining);
  if (verilen === null || kalan === null || verilen > istenen || verilen + kalan > DOI_SAATLIK_HAK)
    return { tur: "ariza", verilen: 0 };
  return {
    tur: "sayacli",
    verilen: Math.min(verilen, istenen),
    kalan,
    yenilenme: typeof resets_at === "string" && !Number.isNaN(Date.parse(resets_at)) ? resets_at : null,
  };
}
