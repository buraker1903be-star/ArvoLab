#!/bin/bash
# Yerel, sentetik Supabase yığını: Postgres 17 + GoTrue + PostgREST (docker).
# YALNIZCA 127.0.0.1; gerçek bir Supabase projesine (Production/Test) bağlanmaz.
# Kullanım: scripts/yerel-yigin/kur.sh [hariç-tutulacak-migration-dosyası ...]
#   MEVCUT_SIFRE_ZORUNLU=true|false — GoTrue'nun "Require current password when
#   updating" ayarı (GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD).
#   Varsayılan Production'daki değerdir; ikisi ayrı düşerse yerel kabul
#   Production'da olmayan bir korumayı sınar (Auth A1, 18.11.2026).
#   GoTrue sürümü (v2.198.0) ve en kısa şifre (8) de Production'la aynı
#   (18.11.2026, /auth/v1/health ve Auth ayarları). Eskiden v2.197.0 ve 6 idi.
#   Hariç tutma, bir düzeltmenin migration'ı OLMADAN eski davranışı yeniden
#   üretmek içindir (ör. P52a2 öncesi updated_at davranışı).
set -euo pipefail
KOK="$(cd "$(dirname "$0")/../.." && pwd)"
SIR="yerel-yigin-jwt-gizli-degil-yalnizca-yerel-0123456789"
PSQL=(psql -h 127.0.0.1 -p 56432 -U postgres -v ON_ERROR_STOP=1 -q)
export PGPASSWORD=yerel-yigin
docker network inspect p52ag >/dev/null 2>&1 || docker network create p52ag >/dev/null
docker rm -f p52rest p52auth p52db >/dev/null 2>&1 || true
docker run -d --name p52db --network p52ag -e POSTGRES_PASSWORD=yerel-yigin -p 127.0.0.1:56432:5432 postgres:17 >/dev/null
for i in $(seq 1 40); do "${PSQL[@]}" -c "select 1" >/dev/null 2>&1 && break; sleep 1; done
"${PSQL[@]}" -f "$KOK/scripts/yerel-yigin/roller.sql"
docker run -d --name p52auth --network p52ag -p 127.0.0.1:59998:9999 \
 -e GOTRUE_API_HOST=0.0.0.0 -e PORT=9999 -e API_EXTERNAL_URL=http://127.0.0.1:59998 \
 -e GOTRUE_DB_DRIVER=postgres -e DATABASE_URL="postgres://supabase_auth_admin:yerel-yigin@p52db:5432/postgres?search_path=auth&sslmode=disable" \
 -e GOTRUE_SITE_URL=http://localhost:3123 -e GOTRUE_URI_ALLOW_LIST="http://localhost:3123/**" \
 -e GOTRUE_JWT_SECRET="$SIR" -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated \
 -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_ADMIN_ROLES=service_role \
 -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=true -e GOTRUE_PASSWORD_MIN_LENGTH=8 \
 -e GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD="${MEVCUT_SIFRE_ZORUNLU:-false}" \
 supabase/gotrue:v2.198.0 >/dev/null
for i in $(seq 1 60); do curl -s --noproxy '*' http://127.0.0.1:59998/health | grep -q version && break; sleep 1; done
"${PSQL[@]}" -f "$KOK/scripts/yerel-yigin/kabuk.sql"
"${PSQL[@]}" -f "$KOK/supabase/schema.sql" >/dev/null
for f in "$KOK"/supabase/migrations/*.sql; do
  ad="$(basename "$f")"
  for h in "$@"; do [ "$ad" = "$h" ] && { echo "hariç: $ad"; continue 2; }; done
  "${PSQL[@]}" -f "$f" >/dev/null || { echo "migration düştü: $ad"; exit 1; }
done
docker run -d --name p52rest --network p52ag -p 127.0.0.1:53001:3000 -e PGRST_DB_URI="postgres://authenticator:yerel-yigin@p52db:5432/postgres" \
 -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$SIR" -e PGRST_DB_MAX_ROWS=1000 \
 postgrest/postgrest:v12.2.3 >/dev/null
for i in $(seq 1 40); do curl -s --noproxy '*' -o /dev/null -w '%{http_code}' http://127.0.0.1:53001/ | grep -q 200 && break; sleep 1; done
echo "yerel yığın hazır: db 127.0.0.1:56432, auth :59998, rest :53001"
