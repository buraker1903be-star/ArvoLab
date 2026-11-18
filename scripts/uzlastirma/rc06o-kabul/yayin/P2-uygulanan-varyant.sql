-- P2 Production'da UYGULANAN varyant (18.11.2026). Paket metninden tek fark: işlevsiz
-- "drop trigger if exists metin_surum_damgasi on public.project_manuscripts;" satırı çıkarıldı.
-- Neden: araç bu satır için onay sordu ve iki kez zaman aşımına düştü. Uygulamadan hemen önce
-- salt okunur sorguyla doğrulandı: fonksiyon 0, tetikleyici 0, geçmiş kaydı 0 → satır hiçbir şey silmezdi.
begin;
create or replace function public.metin_surum_damgasi()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_at := clock_timestamp();
  else
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  end if;
  return new;
end;
$$;

revoke all on function public.metin_surum_damgasi() from public, anon, authenticated;

create trigger metin_surum_damgasi
  before insert or update on public.project_manuscripts
  for each row execute function public.metin_surum_damgasi();

commit;
