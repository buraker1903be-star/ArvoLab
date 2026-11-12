-- Production'ın fonksiyon gövdeleri, tetikleyici ve politika tanımları,
-- tablo/sütun/fonksiyon yetkileri ve varsayılan yetkileri. SALT OKUNUR
-- (begin transaction read only ... rollback); kullanıcı verisi okumaz.
-- Çıktı prodize.py'nin girdisidir. Sonucu depoya KOYMAYIN: tam fonksiyon
-- gövdeleri bir sonraki karşılaştırmada yeniden alınmalı.
begin transaction read only;
select current_setting('transaction_read_only') ro, json_build_object(
 'fn', (select json_object_agg(p.proname||'('||pg_get_function_identity_arguments(p.oid)||')', json_build_object('def', pg_get_functiondef(p.oid), 'acl', coalesce(p.proacl::text,'DEFAULT'), 'owner', p.proowner::regrole::text)) from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f'),
 'tg', (select json_object_agg(n.nspname||'.'||c.relname||'.'||t.tgname, pg_get_triggerdef(t.oid)) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','auth')),
 'pol', (select json_object_agg(schemaname||'.'||tablename||'.'||policyname, json_build_object('permissive',permissive,'roles',roles::text,'cmd',cmd,'qual',qual,'with_check',with_check)) from pg_policies where schemaname='public'),
 'tblacl', (select json_object_agg(c.relname, coalesce(c.relacl::text,'DEFAULT')) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','v')),
 'colacl', (select json_object_agg(c.relname||'.'||a.attname, a.attacl::text) from pg_attribute a join pg_class c on c.oid=a.attrelid where c.relnamespace='public'::regnamespace and a.attacl is not null),
 'coldefault', (select json_object_agg(table_name||'.'||column_name, column_default) from information_schema.columns where table_schema='public' and column_default is not null),
 'defacl', (select json_agg(json_build_array(defaclrole::regrole::text, defaclnamespace::regnamespace::text, defaclobjtype, defaclacl::text)) from pg_default_acl)
) as d;
rollback;
