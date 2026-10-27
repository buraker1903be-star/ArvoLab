-- ============================================================
-- Destek talepleri YAZIŞMA oldu.
--
-- Eskiden ikisi de tek yönlüydü:
--   - Uzman talebinde uzman yalnızca "Üstlen" ve "Tamamla" diyebiliyordu;
--     öğrenci ne bir cevap ne de talebini kimin üstlendiğini görüyordu.
--   - Uygulama desteğinde tek bir yanıt alanı vardı (admin_note).
--     Öğrenci "hâlâ olmuyor" diye geri yazamıyor, yeni talep açıyordu.
--
-- Tek tablo, iki talep türü: her satır ya bir uzman talebine ya bir
-- destek talebine bağlı (ikisi birden ya da hiçbiri değil). İki ayrı
-- tablo aynı ekranı ve aynı kuralları iki kez yazmak olurdu.
--
-- YAZANIN ADI SATIRDA. Bireysel öğrenci, talebini üstlenen iç ekip
-- uzmanının profilini okuyamaz (profiles kurumla sınırlı) ve okuyabilmesi
-- için profili açmak, adın ötesinde her şeyi açmak olurdu. Ad ve taraf
-- yazılırken tetikleyiciyle konuyor; istemci yazamaz.
--
-- admin_note KALDIRILMADI: bugüne kadar yazılmış yanıtlar orada. Ekran
-- onu yazışmanın ilk yanıtı olarak gösteriyor; yeni yanıtlar buraya.
-- ============================================================

create table if not exists public.destek_mesajlari (
  id uuid primary key default gen_random_uuid(),
  uzman_talebi_id uuid references public.consultancy_requests(id) on delete cascade,
  destek_talebi_id uuid references public.app_support_requests(id) on delete cascade,
  yazan uuid not null default auth.uid() references auth.users(id) on delete cascade,
  yazan_adi text,
  -- talep_sahibi | uzman | destek — ekranda baloncuğun hangi tarafta duracağı.
  taraf text not null default 'talep_sahibi' check (taraf in ('talep_sahibi', 'uzman', 'destek')),
  metin text not null check (char_length(btrim(metin)) between 1 and 4000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(uzman_talebi_id, destek_talebi_id) = 1)
);

create index if not exists destek_mesajlari_uzman_idx
  on public.destek_mesajlari (uzman_talebi_id, created_at) where uzman_talebi_id is not null;
create index if not exists destek_mesajlari_destek_idx
  on public.destek_mesajlari (destek_talebi_id, created_at) where destek_talebi_id is not null;

alter table public.destek_mesajlari enable row level security;

revoke all on public.destek_mesajlari from public, anon, authenticated;
-- Mesaj düzeltilmez ve silinmez: yazışma iki tarafın kaydı.
grant select, insert on public.destek_mesajlari to authenticated;

/*
  OKUMA. Uzman talebinde: talebi açan, üstlenen uzman ve talep sahibinin
  kurumundaki Kontrolör/Yönetici (iç ekip her kurumu görür;
  gozetim_kapsami). Üstlenmemiş uzmanlar OKUMAZ: talep listesini görmeleri
  "üstleneyim mi" kararı içindir, yazışma ikisinin arasında.
  Destek talebinde: talebi açan ve iç ekip.
*/
drop policy if exists "Yazışmayı taraflar okur" on public.destek_mesajlari;
create policy "Yazışmayı taraflar okur"
  on public.destek_mesajlari
  for select
  to authenticated
  using (
    exists (
      select 1 from public.consultancy_requests r
       where r.id = uzman_talebi_id
         and (r.requested_by = (select auth.uid())
              or r.assigned_expert_id = (select auth.uid())
              or public.gozetim_kapsami(public.kullanici_kurumu(r.requested_by),
                   array['controller','academic_manager']::public.user_role[]))
    )
    or exists (
      select 1 from public.app_support_requests s
       where s.id = destek_talebi_id
         and (s.requested_by = (select auth.uid())
              or public.has_role(array['system_admin','founder']::public.user_role[]))
    )
  );

/*
  YAZMA. Uzman talebinde yalnızca iki taraf: talebi açan (açık ya da
  üstlenilmiş talepte) ve üstlenen uzman (üstlendiği talepte). Tamamlanan
  ya da iptal edilen talebe yazılmaz — yeni bir soru yeni talep.
  Destek talebinde talebi açan ve iç ekip; çözülmüş talebe de yazılabilir,
  talebi açan yazınca talep yeniden açılır (aşağıdaki tetikleyici).
*/
drop policy if exists "Yazışmaya taraflar yazar" on public.destek_mesajlari;
create policy "Yazışmaya taraflar yazar"
  on public.destek_mesajlari
  for insert
  to authenticated
  with check (
    yazan = (select auth.uid())
    and (
      exists (
        select 1 from public.consultancy_requests r
         where r.id = uzman_talebi_id
           and ((r.requested_by = (select auth.uid()) and r.status in ('open', 'accepted'))
                or (r.assigned_expert_id = (select auth.uid()) and r.status = 'accepted'))
      )
      or exists (
        select 1 from public.app_support_requests s
         where s.id = destek_talebi_id
           and (s.requested_by = (select auth.uid())
                or public.has_role(array['system_admin','founder']::public.user_role[]))
      )
    )
  );

/*
  Ad ve taraf sunucuda konuyor. İstemciden gelseydi öğrenci kendi
  mesajını "Destek ekibi" diye yazabilirdi.
*/
create or replace function public.destek_mesaji_hazirla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sahip uuid;
begin
  new.yazan := coalesce(auth.uid(), new.yazan);
  new.created_at := now();
  select nullif(btrim(p.full_name), '') into new.yazan_adi
    from public.profiles p where p.id = new.yazan;

  if new.uzman_talebi_id is not null then
    select r.requested_by into v_sahip from public.consultancy_requests r where r.id = new.uzman_talebi_id;
    new.taraf := case when new.yazan = v_sahip then 'talep_sahibi' else 'uzman' end;
  else
    select s.requested_by into v_sahip from public.app_support_requests s where s.id = new.destek_talebi_id;
    new.taraf := case when new.yazan = v_sahip then 'talep_sahibi' else 'destek' end;
  end if;
  return new;
end;
$$;

revoke all on function public.destek_mesaji_hazirla() from public, anon, authenticated;

drop trigger if exists destek_mesaji_hazirla on public.destek_mesajlari;
create trigger destek_mesaji_hazirla
  before insert on public.destek_mesajlari
  for each row execute function public.destek_mesaji_hazirla();

/*
  Çözülmüş talebe talep sahibi yazınca talep yeniden AÇILIR. Yoksa
  "hâlâ olmuyor" mesajı, yalnızca çözülmemiş talepleri listeleyen destek
  kuyruğunda hiç görünmezdi.

  Durumu yalnızca iç ekip değiştirebiliyor (guard_support_request_update);
  bu tetikleyici onun DAR bir istisnası: bayrak yalnızca burada, yalnızca
  resolved → open geçişi için açılıp kapanıyor (arvo.uyelik_baglama ile
  aynı kalıp, 20260924100011).
*/
create or replace function public.destek_talebini_yeniden_ac()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.destek_talebi_id is null or new.taraf <> 'talep_sahibi' then
    return new;
  end if;
  perform set_config('arvo.destek_yeniden_ac', '1', true);
  update public.app_support_requests
     set status = 'open', updated_at = now()
   where id = new.destek_talebi_id and status = 'resolved';
  perform set_config('arvo.destek_yeniden_ac', '', true);
  return new;
end;
$$;

revoke all on function public.destek_talebini_yeniden_ac() from public, anon, authenticated;

drop trigger if exists destek_talebini_yeniden_ac on public.destek_mesajlari;
create trigger destek_talebini_yeniden_ac
  after insert on public.destek_mesajlari
  for each row execute function public.destek_talebini_yeniden_ac();

-- Gövde 20260924100022'deki canlı sürümün aynısı; yalnızca yeniden açma istisnası eklendi.
create or replace function public.guard_support_request_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null
     or public.has_role(array['system_admin','founder']::public.user_role[]) then
    return new;
  end if;

  -- Yazışma tetikleyicisinin yeniden açması: yalnızca resolved → open, başka hiçbir sütun.
  if current_setting('arvo.destek_yeniden_ac', true) = '1'
     and old.status = 'resolved' and new.status = 'open'
     and new.requested_by is not distinct from old.requested_by
     and new.admin_note is not distinct from old.admin_note
     and new.answered_at is not distinct from old.answered_at then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.requested_by is distinct from old.requested_by then
    raise exception 'Destek talebinin durumunu yalnızca Sistem Yöneticisi değiştirebilir.' using errcode = '42501';
  end if;

  -- Yanıt alanları: kullanıcı kendi talebine cevap yazamaz.
  if new.admin_note is distinct from old.admin_note
     or new.answered_at is distinct from old.answered_at then
    raise exception 'Destek yanıtını yalnızca Sistem Yöneticisi yazabilir.' using errcode = '42501';
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
