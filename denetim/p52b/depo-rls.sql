-- P52b denetimi: storage.objects politikaları GERÇEK yerel Postgres'te, Supabase rolleriyle.
-- Yalnızca yerel yığın (127.0.0.1:56432). Sentetik kimlikler; işlem sonunda geri alınır.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email, aud, role) values
 ('00000000-0000-4000-8000-0000000b0001','sahip@yerel.test','authenticated','authenticated'),
 ('00000000-0000-4000-8000-0000000b0002','yabanci@yerel.test','authenticated','authenticated'),
 ('00000000-0000-4000-8000-0000000b0003','kontrolor@yerel.test','authenticated','authenticated');
insert into public.organizations (id, name) values ('00000000-0000-4000-8000-0000000b00a1','Kurum A'),('00000000-0000-4000-8000-0000000b00a2','Kurum B');
update public.profiles set organization_id='00000000-0000-4000-8000-0000000b00a1' where id='00000000-0000-4000-8000-0000000b0001';
update public.profiles set organization_id='00000000-0000-4000-8000-0000000b00a2', role='controller' where id='00000000-0000-4000-8000-0000000b0003';
insert into public.academic_projects (id, owner_id, organization_id, title, project_type)
  values ('00000000-0000-4000-8000-0000000b00b1','00000000-0000-4000-8000-0000000b0001','00000000-0000-4000-8000-0000000b00a1','A tezi','thesis');
insert into storage.buckets (id, name) values ('project-files','project-files') on conflict do nothing;
insert into storage.objects (bucket_id, name, owner) values
 ('project-files','00000000-0000-4000-8000-0000000b00b1/kaynak-pdf/a.pdf','00000000-0000-4000-8000-0000000b0001');

create temp table sonuc(aktor text, islem text, deger text) on commit drop;
grant all on sonuc to authenticated;

-- Sahip
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000b0001","role":"authenticated"}',true);
set local role authenticated;
insert into sonuc select 'sahip','okur', count(*)::text from storage.objects where name like '00000000-0000-4000-8000-0000000b00b1/%';
reset role;
-- Yabancı (başka kurum, rolsüz)
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000b0002","role":"authenticated"}',true);
set local role authenticated;
insert into sonuc select 'yabanci','okur', count(*)::text from storage.objects where name like '00000000-0000-4000-8000-0000000b00b1/%';
with s as (delete from storage.objects where name like '00000000-0000-4000-8000-0000000b00b1/%' returning 1) insert into sonuc select 'yabanci','siler', count(*)::text from s;
savepoint y;
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('project-files','00000000-0000-4000-8000-0000000b00b1/kaynak-pdf/kotu.pdf');
    insert into sonuc values ('yabanci','yazar (A klasörüne)','KABUL EDİLDİ');
  exception when insufficient_privilege then insert into sonuc values ('yabanci','yazar (A klasörüne)','reddedildi');
  end;
end $$;
-- Yol oyunu: '..' ile kendi klasöründen A'ya
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('project-files','00000000-0000-4000-8000-0000000b0002/../00000000-0000-4000-8000-0000000b00b1/kaynak-pdf/x.pdf');
    insert into sonuc values ('yabanci','yazar (kendi/../A, düz anahtar)','kabul (anahtar düz metin; A klasörüne düşmez)');
  exception when insufficient_privilege then insert into sonuc values ('yabanci','yazar (kendi/../A)','reddedildi');
  end;
end $$;
reset role;
-- Başka kurumun kontrolörü
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000b0003","role":"authenticated"}',true);
set local role authenticated;
insert into sonuc select 'B-kurumu-kontrolor','okur', count(*)::text from storage.objects where name like '00000000-0000-4000-8000-0000000b00b1/%';
reset role;
-- '..' anahtarı A'nın foldername[1] kontrolünü kandırıyor mu?
insert into sonuc select 'kontrol','foldername(kendi/../A)[1]', (storage.foldername('00000000-0000-4000-8000-0000000b0002/../00000000-0000-4000-8000-0000000b00b1/kaynak-pdf/x.pdf'))[1];
select aktor, islem, deger from sonuc;
rollback;
