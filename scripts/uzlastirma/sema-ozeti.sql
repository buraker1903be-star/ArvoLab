-- ŞEMA ÖZETİ (RELEASE CLOSURE 06). Yalnızca katalog okur; hiçbir şey yazmaz.
-- Production'da ve yerel/izole veritabanında AYNI sorgu çalışır; her nesne için
-- tanımının md5 özeti döner. İki tarafın özetleri karşılaştırılır
-- (scripts/uzlastirma/karsilastir.mjs). Rol adları yalnızca uygulamanın
-- rolleriyle (anon, authenticated, service_role, PUBLIC) sınırlı: Supabase'in
-- iç rolleri (supabase_admin, …) yerelde yok ve fark gürültüsü üretir.
with
tab as (
  select c.oid, c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p','v','m')
    and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
),
fn as (
  select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.prosrc, p.prosecdef,
         p.proconfig, p.proacl, p.provolatile, p.prolang
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private') and p.prokind = 'f'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
k(kategori, nesne, ayrinti, tanim) as (
  select 'tablo', relname, relkind::text, relkind::text from tab
  union all
  select 'sutun', tab.relname || '.' || a.attname, format_type(a.atttypid, a.atttypmod),
         format_type(a.atttypid, a.atttypmod) || '|nn=' || a.attnotnull || '|def=' || coalesce(pg_get_expr(ad.adbin, ad.adrelid), '') || '|gen=' || a.attgenerated::text
  from tab join pg_attribute a on a.attrelid = tab.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
  union all
  select 'kisit', tab.relname || '.' || co.conname, co.contype::text, pg_get_constraintdef(co.oid)
  from tab join pg_constraint co on co.conrelid = tab.oid
  union all
  select 'indeks', tab.relname || '.' || i.relname, '', pg_get_indexdef(i.oid)
  from tab join pg_index x on x.indrelid = tab.oid join pg_class i on i.oid = x.indexrelid
  union all
  select 'rls', tab.relname, '', c.relrowsecurity::text || '/' || c.relforcerowsecurity::text
  from tab join pg_class c on c.oid = tab.oid where tab.relkind in ('r','p')
  union all
  select 'politika', schemaname || '.' || tablename || ':' || policyname, cmd,
         cmd || '|' || permissive || '|' || array_to_string(array(select unnest(roles) order by 1), ',') || '|q=' || coalesce(qual, '') || '|c=' || coalesce(with_check, '')
  from pg_policies where schemaname in ('public','storage')
  union all
  select 'tablo_yetki', g.table_name || '@' || g.grantee, '', string_agg(g.privilege_type, ',' order by g.privilege_type)
  from information_schema.role_table_grants g
  where g.table_schema = 'public' and g.grantee in ('anon','authenticated','service_role','PUBLIC')
  group by g.table_name, g.grantee
  union all
  -- Sütun düzeyi yetkiler (tablo düzeyinin ÜSTÜNE verilenler; pg_attribute.attacl).
  -- Eskiden ölçülmüyordu: paylaşım bağlantısının INSERT'i yalnızca beş sütuna açık
  -- (20261029133812) ve taklit katmanı bunu sessizce silip "eşit" diyordu.
  select 'sutun_yetki', c.relname || '.' || a.attname, '', a.attacl::text
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and a.attacl is not null and a.attnum > 0 and not a.attisdropped
  union all
  select 'fonksiyon', fn.nspname || '.' || fn.proname || '(' || fn.args || ')', '',
         md5(regexp_replace(fn.prosrc, '\s+', '', 'g')) || '|secdef=' || fn.prosecdef || '|cfg=' || coalesce(array_to_string(fn.proconfig, ','), '')
         || '|ret=' || pg_get_function_result(fn.oid) || '|vol=' || fn.provolatile::text::text
  from fn
  union all
  select 'fonksiyon_yetki', fn.nspname || '.' || fn.proname || '(' || fn.args || ')', '',
         case when fn.proacl is null then 'VARSAYILAN(PUBLIC)'
              else coalesce((select string_agg(distinct case when e.grantee = 0 then 'PUBLIC' else r.rolname end, ',' order by case when e.grantee = 0 then 'PUBLIC' else r.rolname end)
                             from aclexplode(fn.proacl) e left join pg_roles r on r.oid = e.grantee
                             where e.privilege_type = 'EXECUTE' and (e.grantee = 0 or r.rolname in ('anon','authenticated','service_role'))), '-') end
  from fn
  union all
  select 'tetikleyici', n.nspname || '.' || c.relname || ':' || t.tgname, '', pg_get_triggerdef(t.oid)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  join pg_proc tp on tp.oid = t.tgfoid join pg_namespace tpn on tpn.oid = tp.pronamespace
  where not t.tgisinternal and (n.nspname = 'public' or (n.nspname in ('auth','storage') and tpn.nspname in ('public','private')))
)
select kategori, nesne, md5(tanim) as ozet from k order by 1, 2;
