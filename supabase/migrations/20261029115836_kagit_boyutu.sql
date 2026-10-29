/*
  KÂĞIT BOYUTU (29.10.2026).

  Bütün çıktılar A4'e sabitti. ABD ve Kanada'da tezler US Letter
  basılıyor; A4'te dizilen tez orada yanlış kâğıtta çıkıyor, sayfa
  tahmini ve sayfa sınırı denetimi kayıyordu (Letter daha kısa). Değer
  listesi lib/kagit-boyutu.ts KAGIT_BOYUTLARI ile aynı tutulmalı.

  Varsayılan 'a4': mevcut bütün belgeler A4'te dizildi, hiçbiri
  değişmemeli. Yazma mevcut project_manuscripts politikalarıyla (kenar
  boşlukları gibi); yeni fonksiyon yok.
*/

alter table public.project_manuscripts
  add column if not exists page_size text not null default 'a4'
  check (page_size in ('a4', 'letter'));

comment on column public.project_manuscripts.page_size is
  'Kâğıt boyutu (a4/letter); yazdırma, Word ve sayfa tahmini buna göre.';

notify pgrst, 'reload schema';
