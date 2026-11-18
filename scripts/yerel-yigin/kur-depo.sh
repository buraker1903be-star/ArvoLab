#!/bin/bash
# Yazım Stüdyosu (16.11.2026; P52b-1 kurulumundan uyarlandı): yerel yığın + GERÇEK Supabase Storage (supabase/storage-api, dosya
# arka ucu). Gerçek depolama politikaları (calisma_klasoru) storage.objects
# üzerinde, Storage API'nin kendi RLS uygulamasıyla çalışır.
# YALNIZCA 127.0.0.1; gerçek bir Supabase projesine bağlanmaz.
set -euo pipefail
KOK="$(cd "$(dirname "$0")/../.." && pwd)"
SIR="yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789"
PSQL=(psql -h 127.0.0.1 -p 56432 -U postgres -v ON_ERROR_STOP=1 -q)
export PGPASSWORD=yerel-yigin
jwt() { node -e 'const c=require("crypto"),b=o=>Buffer.from(JSON.stringify(o)).toString("base64url"),g=b({alg:"HS256",typ:"JWT"})+"."+b({iss:"yerel-yigin",iat:1763200000,exp:2079000000,role:process.argv[1]});console.log(g+"."+c.createHmac("sha256",process.argv[2]).update(g).digest("base64url"))' "$1" "$SIR"; }
docker network inspect p52ag >/dev/null 2>&1 || docker network create p52ag >/dev/null
docker rm -f p52rest p52auth p52db p52depo >/dev/null 2>&1 || true
docker run -d --name p52db --network p52ag -e POSTGRES_PASSWORD=yerel-yigin -p 127.0.0.1:56432:5432 postgres:17 >/dev/null
for i in $(seq 1 40); do "${PSQL[@]}" -c "select 1" >/dev/null 2>&1 && break; sleep 1; done
"${PSQL[@]}" -f "$KOK/scripts/yerel-yigin/roller.sql"
"${PSQL[@]}" -c "create role supabase_storage_admin login createrole bypassrls noinherit password 'yerel-yigin'; grant anon, authenticated, service_role to supabase_storage_admin; grant create on database postgres to supabase_storage_admin; create schema storage authorization supabase_storage_admin; grant usage on schema storage to anon, authenticated, service_role;"
docker run -d --name p52auth --network p52ag -p 127.0.0.1:59998:9999 \
 -e GOTRUE_API_HOST=0.0.0.0 -e PORT=9999 -e API_EXTERNAL_URL=http://127.0.0.1:59998 \
 -e GOTRUE_DB_DRIVER=postgres -e DATABASE_URL="postgres://supabase_auth_admin:yerel-yigin@p52db:5432/postgres?search_path=auth&sslmode=disable" \
 -e GOTRUE_SITE_URL=http://localhost:3123 -e GOTRUE_URI_ALLOW_LIST="http://localhost:3123/**" \
 -e GOTRUE_JWT_SECRET="$SIR" -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated \
 -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_ADMIN_ROLES=service_role \
 -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=true -e GOTRUE_PASSWORD_MIN_LENGTH=6 \
 supabase/gotrue:v2.197.0 >/dev/null
for i in $(seq 1 60); do curl -s --noproxy '*' http://127.0.0.1:59998/health | grep -q version && break; sleep 1; done
docker run -d --name p52depo --network p52ag -p 127.0.0.1:55000:5000 \
 -e ANON_KEY="$(jwt anon)" -e SERVICE_KEY="$(jwt service_role)" -e AUTH_JWT_SECRET="$SIR" -e PGRST_JWT_SECRET="$SIR" \
 -e DATABASE_URL="postgres://supabase_storage_admin:yerel-yigin@p52db:5432/postgres" \
 -e STORAGE_BACKEND=file -e STORAGE_FILE_BACKEND_PATH=/var/lib/storage -e FILE_STORAGE_BACKEND_PATH=/var/lib/storage \
 -e TENANT_ID=stub -e REGION=local -e GLOBAL_S3_BUCKET=stub -e FILE_SIZE_LIMIT=52428800 -e DB_INSTALL_ROLES=false \
 supabase/storage-api:v1.11.13 >/dev/null
for i in $(seq 1 90); do curl -s --noproxy '*' -o /dev/null -w '%{http_code}' http://127.0.0.1:55000/status | grep -q 200 && break; sleep 1; done
"${PSQL[@]}" -c "select count(*) from storage.migrations" >/dev/null || { docker logs p52depo | tail -20; exit 1; }
# Supabase'in barındırılan kurulumundaki depo yetkileri (Storage API rolleri kurmadığında vermiyor).
"${PSQL[@]}" -c "grant usage on schema storage to anon, authenticated, service_role; grant all on all tables in schema storage to anon, authenticated, service_role; grant execute on all functions in schema storage to anon, authenticated, service_role;"
# kabuk.sql'in depo dışı kısmı (storage şemasını artık Storage API kurdu).
"${PSQL[@]}" <<'SQL'
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
SQL
"${PSQL[@]}" -f "$KOK/supabase/schema.sql" >/dev/null
# Argüman olarak verilen migration'lar atlanır (kur.sh ile aynı): Production'da uygulanmamış olanları
# dışarıda bırakıp Production benzeri bir şema kurmak için (scripts/uzlastirma/prova.sh).
for f in "$KOK"/supabase/migrations/*.sql; do
  ad="$(basename "$f")"
  for h in "$@"; do [ "$ad" = "$h" ] && { echo "hariç: $ad"; continue 2; }; done
  "${PSQL[@]}" -f "$f" >/dev/null 2>&1 || { echo "migration düştü: $ad"; "${PSQL[@]}" -f "$f" 2>&1 | grep -m3 ERROR; exit 1; }
done
"${PSQL[@]}" -c "insert into storage.buckets (id, name, public) values ('project-files','project-files',false) on conflict do nothing"
docker run -d --name p52rest --network p52ag -p 127.0.0.1:53001:3000 -e PGRST_DB_URI="postgres://authenticator:yerel-yigin@p52db:5432/postgres" \
 -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$SIR" -e PGRST_DB_MAX_ROWS=1000 \
 postgrest/postgrest:v12.2.3 >/dev/null
for i in $(seq 1 40); do curl -s --noproxy '*' -o /dev/null -w '%{http_code}' http://127.0.0.1:53001/ | grep -q 200 && break; sleep 1; done
echo "yerel yığın + gerçek depo hazır: db :56432, auth :59998, rest :53001, storage :55000"
