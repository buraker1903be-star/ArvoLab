begin transaction read only;
select current_setting('transaction_read_only') as ro, json_build_object(
 'fn',(select json_object_agg(k, v) from (select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' k,
   json_build_array(md5(regexp_replace(pg_get_functiondef(p.oid),'\s+',' ','g')), p.prosecdef, coalesce(array_to_string(p.proconfig,','),''), coalesce(p.proacl::text,'DEFAULT')) v
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind in ('f','p')) a),
 'tg',(select json_object_agg(k, v) from (select n.nspname||'.'||c.relname||'.'||t.tgname k, json_build_array(md5(pg_get_triggerdef(t.oid)), t.tgenabled) v
   from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','auth','storage')) b),
 'pol',(select json_object_agg(schemaname||'.'||tablename||'.'||policyname, md5(permissive||cmd||roles::text||coalesce(qual,'')||'|'||coalesce(with_check,''))) from pg_policies where schemaname in ('public','storage')),
 'col',(select json_object_agg(table_name||'.'||column_name, data_type||'|'||is_nullable||'|'||coalesce(column_default,'')) from information_schema.columns where table_schema='public'),
 'con',(select json_object_agg(conrelid::regclass::text||'.'||conname, md5(pg_get_constraintdef(oid))) from pg_constraint where connamespace='public'::regnamespace),
 'idx',(select json_object_agg(indexname, md5(indexdef)) from pg_indexes where schemaname='public'),
 'tbl',(select json_object_agg(c.relname, json_build_array(c.relkind, c.relrowsecurity, c.relforcerowsecurity, coalesce(c.relacl::text,'DEFAULT'))) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','v','m','p')),
 'view',(select json_object_agg(viewname, md5(definition)) from pg_views where schemaname='public'),
 'enum',(select json_object_agg(t.typname, (select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid)) from pg_type t where t.typnamespace='public'::regnamespace and t.typtype='e'),
 'bucket',(select json_object_agg(id, json_build_array(public, file_size_limit, allowed_mime_types)) from storage.buckets),
 'ext',(select json_object_agg(extname, extversion) from pg_extension),
 'pub',(select json_object_agg(pubname||'.'||schemaname||'.'||tablename, 1) from pg_publication_tables)
) as snap;
rollback;
