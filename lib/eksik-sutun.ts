/*
  Eksik sütunun adı (29.10.2026). Saf modül; testi tests/unit/eksik-sutun.test.ts.

  saveManuscript sonradan eklenen sütunlar (kâğıt boyutu, içindekiler,
  başlık numarası, kılavuz damgası) için "migration henüz çalışmadıysa
  onlarsız yeniden dene" yapıyordu — ama HEPSİNİ birden düşürüyordu. Tek
  bir yeni sütun eksik olduğunda (ör. page_size, kod migration'dan önce
  dağıtılınca) içindekiler, başlık numarası ve "elle değiştirildi" damgası
  da sessizce düşüyor, editör yine "Kaydedildi" diyordu. Artık yalnızca
  hata mesajında adı geçen sütun düşüyor.
*/

/** PostgREST (PGRST204) ve Postgres (42703) mesajlarından sütun adı; okunamazsa null. */
export function eksikSutunAdi(hata: { code?: string; message?: string } | null | undefined): string | null {
  const mesaj = hata?.message ?? "";
  const postgrest = /Could not find the '([^']+)' column/i.exec(mesaj);
  if (postgrest) return postgrest[1];
  const postgres = /column "([^"]+)"(?: of relation "[^"]+")? does not exist/i.exec(mesaj);
  return postgres ? postgres[1] : null;
}
