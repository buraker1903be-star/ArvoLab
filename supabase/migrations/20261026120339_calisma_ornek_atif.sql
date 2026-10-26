/*
  ÇALIŞMANIN ÖRNEK ATIFI (26.10.2026).

  Tez yazım kılavuzunun (TYK) atıf örneği, örn. "(Yılmaz, 2020: 14)".
  Stil adı (APA, Chicago) noktalamayı belirlemiyor: aynı "APA" diyen iki
  kılavuzdan biri "s. 14", öteki ": 14" istiyor. Kılavuzdan otomatik
  çıkarım yanlış örnek yakalayabildiği için örneği öğrenci ya da çalışmaya
  yazabilen kurum çalışanı bir kez yapıştırıyor; kaynakça denetimi
  atıfları ona göre denetliyor, editörün atıf penceresi ona göre yazıyor
  (lib/atif/tyk.ts).

  Çalışmanın kaydında: katalogdaki kılavuz da öğrencinin yüklediği de
  aynı yerden okunuyor. Yazma academic_projects'in mevcut güncelleme
  politikasıyla (sahip, atanan, kendi kurumunun gözetim rolleri);
  guard_academic_project_update bu sütuna karışmıyor.
*/
alter table public.academic_projects
  add column if not exists ornek_atif text
  check (ornek_atif is null or char_length(ornek_atif) between 1 and 300);
