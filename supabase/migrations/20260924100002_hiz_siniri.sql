-- ============================================================
-- Hız sınırı (şifre sıfırlama).
--
-- requestPasswordReset herkese açık: oturum gerekmiyor. Sınır olmadığı için
-- biri döngüyle çağırdığında kayıtlı bir adrese sınırsız e-posta gidiyor
-- (Resend maliyeti ve gönderici itibarı) ve her yeni bağlantı kurbanın
-- önceki bağlantısını geçersiz kıldığı için şifre sıfırlama pratikte
-- kilitleniyordu. Sayaç veritabanında: sunucu isteği her seferinde başka bir
-- örnekte (lambda) çalışabildiği için bellekteki sayaç işe yaramaz.
--
-- Tablo yalnızca service_role'a açık; uygulama bunu sunucu anahtarıyla çağırır.
-- ============================================================

create table if not exists public.auth_rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from public, anon, authenticated;
grant all on public.auth_rate_limits to service_role;

/*
  Bir denemeyi sayar ve izin verilip verilmediğini döner. Pencere dolduysa
  sayaç sıfırlanır. Aynı anda gelen istekler aynı satırı kilitler (upsert),
  böylece sayaç kaçırmaz.
*/
create or replace function public.rate_limit_hit(p_key text, p_limit integer, p_window interval)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.auth_rate_limits as l (key, window_start, count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case when l.window_start < now() - p_window then now() else l.window_start end,
        count = case when l.window_start < now() - p_window then 1 else l.count + 1 end
  returning count into v_count;

  return v_count <= greatest(1, p_limit);
end;
$$;

-- Yeni fonksiyon herkese açık oluşur; yalnızca sunucu çağırsın (AGENTS.md).
revoke all on function public.rate_limit_hit(text, integer, interval) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, interval) to service_role;

-- Eski kayıtlar birikmesin; temizlik de yalnızca sunucuda.
create or replace function public.prune_auth_rate_limits(p_older_than interval default interval '1 day')
returns integer
language sql
security definer set search_path = public
as $$
  with silinen as (
    delete from public.auth_rate_limits where window_start < now() - p_older_than returning 1
  )
  select count(*)::int from silinen;
$$;

revoke all on function public.prune_auth_rate_limits(interval) from public, anon, authenticated;
grant execute on function public.prune_auth_rate_limits(interval) to service_role;

notify pgrst, 'reload schema';
