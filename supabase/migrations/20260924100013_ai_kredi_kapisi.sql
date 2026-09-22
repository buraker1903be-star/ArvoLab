-- AI kredi kapısı: tüketim hakkı aşınca asistan durur.
--
-- Ölçüm 20260924100012'de geldi ama limit hâlâ süstü: kredi bitiyor,
-- hiçbir şey olmuyordu. Kota satılan bir üründe uygulanmayan limit,
-- limit değil temennidir.
--
-- Limit ArvoOS'tan yansıtılıyor (organizations.ai_credit_limit), tüketim
-- burada ölçülüyor. Böylece karar ArvoOS'a gitmeden veriliyor: ArvoOS
-- erişilemese bile asistan son bilinen hakka göre çalışmaya devam eder —
-- lisans yansımasındaki kuralın aynısı.
--
-- KAPIYI YALNIZCA NET BİR "HAYIR" KAPATIR (AGENTS.md):
--   - Limit hiç bildirilmemişse (null) kimse engellenmez. Sütun yeni;
--     yansıtma başlamadan önce her kurum "0 kredi" görünürdü ve bu bir
--     cevap değil, cevabın henüz gelmemiş olmasıdır.
--   - Kurumu olmayan kullanıcı engellenmez: bireysel kullanıcının kurum
--     kotasıyla işi yok.
--   - İç ekip (system_admin, founder) hiçbir koşulda engellenmez.

alter table public.organizations
  add column if not exists ai_credit_limit bigint;

comment on column public.organizations.ai_credit_limit is
  'ArvoOS tarafından yansıtılır (1 kredi = 1.000 karakter); elle değiştirmeyin. null = henüz bildirilmedi, kapı kapanmaz.';

-- ---------------------------------------------------------------------------
-- Çağıranın kendi kurumunun kredi durumu
-- ---------------------------------------------------------------------------
-- PARAMETRE ALMIYOR: kimlik auth.uid()'den okunuyor. Kurum kimliğini
-- parametre alsaydı, herhangi bir kullanıcı başka bir kurumun tüketimini
-- okuyabilirdi (arvoos_ai_kullanimi bu yüzden yalnızca service_role'a açık).
create or replace function public.ai_kredi_durumum()
returns table (
  kullanilan_karakter bigint,
  limit_kredi bigint,
  bildirildi boolean,
  ic_ekip boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_rol public.user_role;
  v_ay_basi timestamptz;
begin
  select p.organization_id, p.role into v_org, v_rol
    from public.profiles p where p.id = auth.uid();

  /*
    Ayın ilk günü TÜRKİYE saatiyle. Sunucu UTC'de çalışıyor; ayın 1'inde
    gece 00:00–03:00 arasında UTC hâlâ önceki ayda olurdu ve o saatlerdeki
    tüketim geçen aya yazılırdı.
  */
  v_ay_basi := date_trunc('month', (now() at time zone 'Europe/Istanbul')) at time zone 'Europe/Istanbul';

  return query
  select
    coalesce((
      select sum(coalesce(r.prompt_chars, 0) + coalesce(r.output_chars, 0))
        from public.ai_assistant_runs r
        join public.profiles p2 on p2.id = r.user_id
       where p2.organization_id = v_org
         and r.status = 'completed'
         and r.created_at >= v_ay_basi
    ), 0)::bigint,
    (select o.ai_credit_limit from public.organizations o where o.id = v_org),
    (select o.synced_at is not null from public.organizations o where o.id = v_org),
    coalesce(v_rol in ('system_admin', 'founder'), false);
end;
$$;

revoke all on function public.ai_kredi_durumum() from public, anon;
grant execute on function public.ai_kredi_durumum() to authenticated;
