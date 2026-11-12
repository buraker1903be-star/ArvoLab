#!/bin/bash
# P1'i, Production'a denk getirilmiş ve hiç sentetik hesap açılmamış hâline döndürür.
# Yalnızca yerel docker kapsayıcıları (p1db, p1auth, p1rest). Gerçek bir ortama bağlanmaz.
set -euo pipefail
BAZ="${1:?kullanım: sifirla.sh <p1-baz-dokum.sql>}"
docker rm -f p1rest p1auth p1db >/dev/null 2>&1 || true
docker run -d --name p1db --network p1ag -e POSTGRES_PASSWORD=p1-yerel -p 55432:5432 postgres:17 >/dev/null
for i in $(seq 1 30); do PGPASSWORD=p1-yerel psql -h 127.0.0.1 -p 55432 -U postgres -c "select 1" >/dev/null 2>&1 && break; sleep 1; done
PGPASSWORD=p1-yerel psql -h 127.0.0.1 -p 55432 -U postgres -q -f "$BAZ" >/dev/null 2>&1 || true
docker run -d --name p1auth --network p1ag -p 59999:9999 \
 -e GOTRUE_API_HOST=0.0.0.0 -e PORT=9999 -e API_EXTERNAL_URL=http://127.0.0.1:59999 \
 -e GOTRUE_DB_DRIVER=postgres -e DATABASE_URL="postgres://supabase_auth_admin:p1-yerel@p1db:5432/postgres?search_path=auth&sslmode=disable" \
 -e GOTRUE_SITE_URL=http://localhost:3000 -e GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**" \
 -e GOTRUE_JWT_SECRET=p1-yerel-jwt-gizli-degil-yalnizca-prova-0123456789 -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated \
 -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_ADMIN_ROLES=service_role \
 -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=false -e GOTRUE_PASSWORD_MIN_LENGTH=6 \
 supabase/gotrue:v2.197.0 >/dev/null
docker run -d --name p1rest --network p1ag -p 53000:3000 -e PGRST_DB_URI="postgres://authenticator:p1-yerel@p1db:5432/postgres" \
 -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET=p1-yerel-jwt-gizli-degil-yalnizca-prova-0123456789 \
 -e PGRST_DB_CHANNEL_ENABLED=true postgrest/postgrest:v12.2.3 >/dev/null
for i in $(seq 1 40); do curl -s --noproxy '*' http://127.0.0.1:59999/health | grep -q version && break; sleep 1; done
echo "P1 sıfırlandı"
