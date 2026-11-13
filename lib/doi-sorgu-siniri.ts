/*
  DOI SORGUSU HIZ SINIRI (Phase 5.0b, 12.11.2026). Saf modül: Next, React
  ve Supabase'e dokunmaz; kararı sunucu eylemi (app/actions/literature.ts,
  lookupDoi) uygular, testi tests/unit/doi-sorgu-siniri.test.ts.

  NEDEN: lookupDoi yalnızca oturuma bakıyordu. Oturumu olan herkes sunucuyu
  sınırsız bir Crossref aracına çevirebiliyordu; Crossref ortak sunucu
  IP'sini kısarsa BÜTÜN kullanıcıların künye doğrulaması ve DOI ile kaynak
  ekleme akışı birlikte düşerdi. Maliyet bizde değil, risk ortak.

  SAYAÇ: public.rate_limit_hit (migration 20260924100002). Tek bir
  "insert … on conflict do update … returning" ifadesi: eşzamanlı iki
  çağrı aynı satırda sıraya girer, sayaç kaybolmaz (tests/db ve
  scripts/eszamanli-hiz-siniri.sh ile sınandı). Tablo ve işlev yalnızca
  service_role'a açık; anahtar istemciye hiç gitmez.

  SAYAÇ ARIZASINDA AÇIK KALIR (fail-open), bilerek: lib/ai/erisim.ts ve
  literatür aramasıyla aynı ilke — bir yapılandırma eksikliği ya da geçici
  veritabanı arızası, öğrencinin DOI ile atıf eklemesini durdurmamalı.
  Bedeli: arıza süresince saatlik sınır UYGULANMAZ. Oturum ve abonelik
  kapısı yine çalışır; Crossref isteği 8 sn zaman aşımıyla tek tek gider.
  Arıza her çağrıda günlüğe yazılır (sessiz değil).
*/

/** Kullanıcı başına saatlik DOI sorgusu hakkı (kurum sahibinin kararı, 12.11.2026). */
export const DOI_SAATLIK_HAK = 120;
export const DOI_PENCERE = "1 hour";

/**
 * Sayaç anahtarı. Kullanıcı kimliği yalnızca sunucuda, service_role'a açık
 * tabloda tutulur; istemciye dönen hiçbir cevapta yer almaz.
 */
export function doiSayacAnahtari(kullaniciId: string): string {
  return `doi-sorgu:${kullaniciId}`;
}

export type DoiHakKarari =
  /** Sayaç çalıştı ve hak var. */
  | "izin"
  /** Sayaç çalıştı ve hak bitti: Crossref'e gidilmez. */
  | "sinir"
  /** Sayaç kurulamadı ya da okunamadı: sorgu yapılır, arıza günlüğe yazılır. */
  | "sayacsiz";

/**
 * rate_limit_hit cevabından karar. Yalnızca NET bir `false` sınırı
 * kapatır; okunamayan bir cevap "hak bitti" sayılmaz (yukarıdaki ilke).
 */
export function doiHakKarari(girdi: { sayacVar: boolean; hata?: unknown; izin?: unknown }): DoiHakKarari {
  if (!girdi.sayacVar || girdi.hata) return "sayacsiz";
  if (girdi.izin === false) return "sinir";
  if (girdi.izin === true) return "izin";
  return "sayacsiz";
}
