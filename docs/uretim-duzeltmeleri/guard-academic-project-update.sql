-- ÜRETİM DÜZELTMESİ TASLAĞI — guard_academic_project_update (05.11.2026)
--
-- BU BİR MIGRATION DEĞİL ve hiçbir ortama UYGULANMADI. Kurum sahibinin
-- ayrı onayı olmadan çalıştırılmaz. Gerekçe, karşılaştırma ve kontrol
-- listesi: docs/uretim-duzeltmeleri/guard-academic-project-update.md
--
-- Neden: depodaki 20260913120000_phase1_role_guards.sql bu tetikleyiciyi
-- kuruyor, canlı veritabanında ise yok (migration geçmişi 12 satır, depo
-- 104 dosya). Eksikken sıradan bir kullanıcı KENDİ çalışmasına sahte onay
-- yazabiliyor, durumu ready/delivered yapabiliyor, kurumu ve atananı
-- değiştirebiliyor, sahipliği devredebiliyor (UPDATE politikası satırı
-- kimin değiştireceğini sınırlıyor, hangi sütunu değil).
--
-- Fonksiyon gövdesi migration'dakiyle BİREBİR aynıdır;
-- tests/db/calisma-guncelleme-korumasi.test.mjs bunu sınar. Tek ek, yetki
-- satırı: migration yalnızca `from public` kaldırıyordu; burada canlıdaki
-- eşi guard_academic_project_insert ile aynı yetki durumu kuruluyor
-- (anon/authenticated çalıştıramaz). Tetikleyici fonksiyonu zaten doğrudan
-- çağrılamaz; satır, AGENTS.md'deki "her yeni fonksiyonun ardından revoke"
-- kuralının gereği.
--
-- Uygulama yolu: Supabase SQL Editor. `supabase db push` ve MCP
-- `apply_migration` KULLANILMAZ — ikisi de supabase_migrations.schema_migrations
-- tablosuna satır yazar ve 12/104 tutarsızlığını değiştirir.
begin;

create or replace function public.guard_academic_project_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null
     or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[]) then
    return new;
  end if;

  if new.controller_approved_by is distinct from old.controller_approved_by
     or new.controller_approved_at is distinct from old.controller_approved_at
     or new.assignee_id is distinct from old.assignee_id
     or new.assignee_name is distinct from old.assignee_name
     or new.owner_id is distinct from old.owner_id
     or new.organization_id is distinct from old.organization_id
     or (new.status is distinct from old.status and new.status in ('ready', 'delivered')) then
    raise exception 'Onay, atama ve teslim alanlarını yalnızca Kontrolör ve üzeri roller değiştirebilir.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_academic_project_update() from public, anon, authenticated;

drop trigger if exists guard_academic_project_update_trigger on public.academic_projects;
create trigger guard_academic_project_update_trigger
  before update on public.academic_projects
  for each row execute function public.guard_academic_project_update();

commit;

-- ---------------------------------------------------------------------
-- DOĞRULAMA (yalnızca okuma; uygulamadan SONRA ayrı çalıştırılır)
-- ---------------------------------------------------------------------
-- 1) Tetikleyici var ve etkin ('O'):
--   select tgname, tgenabled from pg_trigger
--   where tgrelid = 'public.academic_projects'::regclass and not tgisinternal order by 1;
--   Beklenen: guard_academic_project_insert_trigger, guard_academic_project_update_trigger,
--             guard_subscription_trigger, notify_project_changes_trigger,
--             sync_academic_project_guideline_trigger — hepsi 'O'.
-- 2) Yetki:
--   select has_function_privilege('anon', 'public.guard_academic_project_update()', 'execute') as anon,
--          has_function_privilege('authenticated', 'public.guard_academic_project_update()', 'execute') as auth;
--   Beklenen: false, false.
-- 3) Gövde depodakiyle aynı:
--   select md5(regexp_replace(prosrc, '\s+', ' ', 'g')) from pg_proc
--   where oid = 'public.guard_academic_project_update()'::regprocedure;
--   Beklenen: test projesinde alınan özetle aynı (belgedeki adım 3).
-- 4) Migration geçmişi değişmedi:
--   select count(*), max(version) from supabase_migrations.schema_migrations;
--   Beklenen: 12, 20260818091259 (uygulamadan önceki değerle aynı).

-- ---------------------------------------------------------------------
-- GERİ ALMA (yalnızca düzeltme bir meşru akışı kırarsa)
-- ---------------------------------------------------------------------
--   begin;
--   drop trigger if exists guard_academic_project_update_trigger on public.academic_projects;
--   drop function if exists public.guard_academic_project_update();
--   commit;
-- Veri değişmediği için geri almada veri kurtarma adımı yoktur; sonuç,
-- düzeltmeden önceki (korumasız) hâldir.
