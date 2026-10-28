/*
  ARAYÜZ DİLİ TERCİHİ PROFİLDE (28.10.2026, kurum sahibinin isteği:
  "Türk öğrenciler İngilizce kullanmak isteyebilir").

  Dil seçimi yalnızca tarayıcının çerezindeydi (lib/dil.ts): telefonda
  İngilizce seçen öğrenci bilgisayarda yeniden Türkçe görüyordu, e-postalar
  ve zamanlanmış hatırlatmalar da tercihi bilmiyordu. Sütun girişte çereze
  aktarılıyor (app/actions/auth.ts) ve e-postaların dilini belirliyor.

  NULL = tercih yok: mevcut kullanıcılar Türkçe'de kalır (proxy.ts),
  yeni ziyaretçiye tarayıcının dili. Değer listesi lib/dil.ts DILLER ile
  aynı tutulmalı.

  Yazma kullanıcının kendi satırında mevcut "Users can update their own
  profile" politikasıyla; rol koruması (prevent_self_role_escalation)
  yalnızca rol ve kurum sütunlarına bakıyor. Yeni fonksiyon yok.
*/

alter table public.profiles
  add column if not exists arayuz_dili text
  check (arayuz_dili is null or arayuz_dili in ('tr', 'en'));

comment on column public.profiles.arayuz_dili is
  'Kullanıcının seçtiği arayüz dili (tr/en). NULL: tercih yok, Türkçe.';

notify pgrst, 'reload schema';
