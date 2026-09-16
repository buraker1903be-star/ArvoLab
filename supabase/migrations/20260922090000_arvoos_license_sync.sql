-- ArvoOS lisans yansıması.
--
-- ArvoLab aboneliği ArvoOS üzerinden tahsil ediliyor ama ArvoLab ayrı bir
-- Supabase projesinde. Her istekte ArvoOS'a sormak yerine ArvoOS lisans
-- değiştikçe (kurucu ekranı ya da PayTR ödeme bildirimi) buraya yazar;
-- ArvoLab kendi tablosundaki sütuna bakar. Böylece ArvoOS erişilemese bile
-- ArvoLab son bilinen duruma göre çalışmaya devam eder.
--
-- Kurum kimliği iki tarafta aynı: organizations.id = ArvoOS kurum kimliği.
-- Yazma ArvoOS'un servis anahtarıyla yapılır (RLS'i atlar), bu yüzden ek bir
-- politika gerekmiyor; kullanıcılar bu sütunları yalnızca okur.

alter table public.organizations
  add column if not exists license_status text not null default 'inactive',
  add column if not exists plan_code text,
  add column if not exists current_period_end timestamptz,
  add column if not exists synced_at timestamptz;

alter table public.organizations drop constraint if exists organizations_license_status_check;
alter table public.organizations add constraint organizations_license_status_check
  check (license_status in ('inactive','trialing','active','past_due','suspended','canceled'));

comment on column public.organizations.license_status is 'ArvoOS tarafından yansıtılır; elle değiştirmeyin.';
comment on column public.organizations.synced_at is 'Son yansıtma zamanı. Eski bir tarih ArvoOS ile bağlantının koptuğunu gösterir.';
