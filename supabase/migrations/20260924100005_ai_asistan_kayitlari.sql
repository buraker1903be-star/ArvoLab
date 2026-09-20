-- ============================================================
-- Asistan çalışmalarının kaydı: ai_assistant_runs
--
-- Neden: asistan yanıtları hiçbir yere yazılmıyordu. Üç sonucu vardı —
-- maliyet takip edilemiyor, "geçen hafta ne demişti" sorusunun cevabı yok
-- ve en önemlisi ArvoLab'ın KENDİ MODELİNİ eğitecek veri birikmiyor.
-- Asıl değerli varlık model değil, bu tablodur: gerçek akademik girdi,
-- asistanın çıktısı ve kullanıcının "bu işime yaradı mı" yanıtı.
--
-- Mahremiyet: context sütunu kullanıcının kendi akademik metnini tutar.
-- Kayıt kullanıcının kendi hesabına bağlıdır, RLS ile korunur ve yalnızca
-- kendisi ile iç ekip (kontrolör, akademik yönetici, sistem yöneticisi,
-- kurucu) okuyabilir. Eğitim verisi olarak kullanılacağı için silme hakkı
-- kullanıcıda kalır (hesap silinince kayıt da gider).
-- ============================================================

create table if not exists public.ai_assistant_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Hangi yetenek: analiz denetimi, kaynakça, literatür, belge geri bildirimi
  capability text not null check (capability in ('analiz', 'kaynakca', 'literatur', 'belge')),
  status text not null check (status in ('completed', 'rejected', 'failed')),
  -- rejected ise neden: uydurma sayı, künye izi ya da boş yanıt
  reject_reason text check (reject_reason in ('uydurma_sayi', 'kunye', 'bos')),
  model text,
  -- Sunucunun adresi (yalnızca kurulum ayrımı için; sır içermez)
  provider text,
  -- Modele gönderilen bağlam ve ham yanıt: eğitim verisinin kendisi
  context text,
  output text,
  findings jsonb,
  -- Maliyet göstergesi; jeton saymak için ayrı kütüphane taşımaya değmez
  prompt_chars integer,
  output_chars integer,
  duration_ms integer,
  -- Kullanıcının değerlendirmesi: ince ayarda "iyi örnek" etiketi budur
  rating text check (rating in ('faydali', 'kismen', 'faydasiz')),
  rating_note text,
  rated_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_assistant_runs_user_idx
  on public.ai_assistant_runs(user_id, created_at desc);
create index if not exists ai_assistant_runs_capability_idx
  on public.ai_assistant_runs(capability, created_at desc);
-- Eğitim kümesi derlerken en çok sorulacak soru: hangi çalışmalar faydalıydı?
create index if not exists ai_assistant_runs_rating_idx
  on public.ai_assistant_runs(rating, created_at desc) where rating is not null;

alter table public.ai_assistant_runs enable row level security;

revoke all on public.ai_assistant_runs from public, anon;
grant select, insert, update on public.ai_assistant_runs to authenticated;
grant all on public.ai_assistant_runs to service_role;

drop policy if exists "Kendi asistan kayıtlarını görür" on public.ai_assistant_runs;
create policy "Kendi asistan kayıtlarını görür"
  on public.ai_assistant_runs
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Kendi asistan kaydını oluşturur" on public.ai_assistant_runs;
create policy "Kendi asistan kaydını oluşturur"
  on public.ai_assistant_runs
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Kendi kaydını puanlar" on public.ai_assistant_runs;
create policy "Kendi kaydını puanlar"
  on public.ai_assistant_runs
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

/*
  RLS "kim yazabilir"i söyler, "neyi"yi söylemez: oturum jetonu tarayıcıda,
  UPDATE hakkı olan kullanıcı PostgREST'ten her sütunu yazabilir. Eğitim
  verisi olacak bir tabloda bu, kullanıcının kendi girdisini ve asistanın
  çıktısını sonradan değiştirebilmesi demekti — kayıt kanıt değerini
  yitirirdi. Puanlama dışındaki her sütun donuk.
*/
create or replace function public.guard_ai_run_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id is distinct from old.id
  or new.user_id is distinct from old.user_id
  or new.capability is distinct from old.capability
  or new.status is distinct from old.status
  or new.reject_reason is distinct from old.reject_reason
  or new.model is distinct from old.model
  or new.provider is distinct from old.provider
  or new.context is distinct from old.context
  or new.output is distinct from old.output
  or new.findings is distinct from old.findings
  or new.prompt_chars is distinct from old.prompt_chars
  or new.output_chars is distinct from old.output_chars
  or new.duration_ms is distinct from old.duration_ms
  or new.created_at is distinct from old.created_at
  then
    raise exception 'Asistan kaydının içeriği değiştirilemez; yalnızca değerlendirme yazılabilir.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Zaman damgası istemciden gelmez.
  if new.rating is distinct from old.rating or new.rating_note is distinct from old.rating_note then
    new.rated_at := now();
  end if;

  return new;
end;
$$;

revoke all on function public.guard_ai_run_update() from public, anon, authenticated;
grant execute on function public.guard_ai_run_update() to service_role;

drop trigger if exists guard_ai_run_update_trigger on public.ai_assistant_runs;
create trigger guard_ai_run_update_trigger
  before update on public.ai_assistant_runs
  for each row execute function public.guard_ai_run_update();

-- Abonelik kapısı (20260924100003): dış maliyet üreten her yeni satır gibi.
drop trigger if exists guard_subscription_trigger on public.ai_assistant_runs;
create trigger guard_subscription_trigger
  before insert on public.ai_assistant_runs
  for each row execute function public.guard_subscription();

notify pgrst, 'reload schema';
