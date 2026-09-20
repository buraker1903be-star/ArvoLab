-- ============================================================
-- Abonelik kapısı veritabanında.
--
-- Kapı bugüne kadar yalnızca server action'ların içindeydi (lib/access.ts).
-- Oturum jetonu tarayıcıda olduğu için aboneliği biten kullanıcı PostgREST'e
-- doğrudan istek atıp metin yazmaya, paylaşım bağlantısı açmaya, kayıt ve
-- dosya eklemeye devam edebiliyordu (20.09.2026 denetimi). Artık yeni içerik
-- yazan yollar veritabanında da kapanıyor.
--
-- İlke değişmiyor (AGENTS.md): kapıyı yalnızca net bir "aboneliğin yok"
-- cevabı kapatır. Profil okunamazsa, kurum ArvoOS tarafından hiç
-- bildirilmediyse (synced_at boş) ya da bireysel abonenin yerel aynası yoksa
-- kimse engellenmez. İç ekip (system_admin, founder) hiçbir koşulda
-- engellenmez. Okuma, silme ve mevcut kaydı güncelleme açık kalır: kullanıcı
-- kendi verisini görebilmeli ve yönetebilmeli.
--
-- Bireysel abonelik ArvoOS'ta tutuluyor; buraya yalnızca son bilinen durumun
-- aynası yazılır (lib/subscription.ts, servis anahtarıyla).
-- ============================================================

-- ---------- 1) Bireysel aboneliğin yerel aynası ----------
create table if not exists public.individual_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'unknown',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  synced_at timestamptz not null default now()
);

comment on table public.individual_subscriptions is 'ArvoOS''taki bireysel aboneliğin aynası; ArvoLab yazmaz, yalnızca köprü (servis anahtarı) yazar.';

alter table public.individual_subscriptions enable row level security;
revoke all on public.individual_subscriptions from public, anon, authenticated;
grant select on public.individual_subscriptions to authenticated;
grant all on public.individual_subscriptions to service_role;

drop policy if exists "Kendi aboneliğini görür" on public.individual_subscriptions;
create policy "Kendi aboneliğini görür"
  on public.individual_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------- 2) Kapı ----------
create or replace function public.subscription_open()
returns boolean
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_role public.user_role;
  v_org uuid;
  v_status text;
  v_trial timestamptz;
  v_period timestamptz;
  v_synced timestamptz;
begin
  -- Servis anahtarı, SQL Editor ve cron: kapı yok.
  if auth.uid() is null then
    return true;
  end if;

  select role, organization_id into v_role, v_org from public.profiles where id = auth.uid();
  if v_role is null then
    return true; -- profil okunamadı: bilgisizlik kapatmaz
  end if;
  if v_role in ('system_admin', 'founder') then
    return true;
  end if;

  if v_org is not null then
    select license_status, current_period_end, synced_at
      into v_status, v_period, v_synced
      from public.organizations where id = v_org;
    if v_status is null or v_synced is null then
      return true; -- ArvoOS bu kurumu hiç bildirmedi
    end if;
    return v_status in ('active', 'trialing') and (v_period is null or v_period > now());
  end if;

  select status, trial_ends_at, current_period_end
    into v_status, v_trial, v_period
    from public.individual_subscriptions where user_id = auth.uid();
  if v_status is null then
    return true; -- ayna yok: ArvoOS'a hiç sorulmamış
  end if;
  if v_status = 'trialing' then
    return v_trial is null or v_trial > now();
  end if;
  if v_status = 'active' then
    return v_period is null or v_period > now();
  end if;
  return false;
end;
$$;

revoke all on function public.subscription_open() from public, anon, authenticated;
-- RLS politikası çağıranın yetkisiyle çalışır; tetikleyiciler için yetki aranmaz.
grant execute on function public.subscription_open() to anon, authenticated, service_role;

-- ---------- 3) Yeni içerik yazan yollar ----------
create or replace function public.guard_subscription()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.subscription_open() then
    return new;
  end if;
  raise exception 'Aboneliğiniz sona erdi. Devam etmek için planınızı yenileyin.' using errcode = '42501';
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      -- (tablo, tetikleyicinin kapsadığı işlemler)
      ('academic_projects', 'insert'),
      ('project_manuscripts', 'insert or update'),
      ('project_manuscript_versions', 'insert'),
      ('manuscript_comments', 'insert'),
      ('manuscript_share_links', 'insert'),
      ('document_uploads', 'insert'),
      ('citation_checks', 'insert'),
      ('originality_checks', 'insert'),
      ('literature_sources', 'insert'),
      ('academic_score_entries', 'insert'),
      ('ai_feedback_requests', 'insert')
    ) as x(tablo, islem)
  loop
    if to_regclass('public.' || t.tablo) is not null then
      execute format('drop trigger if exists guard_subscription_trigger on public.%I', t.tablo);
      execute format(
        'create trigger guard_subscription_trigger before %s on public.%I for each row execute function public.guard_subscription()',
        t.islem, t.tablo);
    end if;
  end loop;
end
$$;

-- Depoya yükleme: tetikleyici kurulamadığı için politikaya eklenir.
drop policy if exists "Users can upload to their own folder" on storage.objects;
create policy "Users can upload to their own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.subscription_open())
  );

notify pgrst, 'reload schema';
