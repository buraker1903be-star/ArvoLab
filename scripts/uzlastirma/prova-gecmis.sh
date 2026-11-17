#!/bin/bash
# RELEASE CLOSURE 06 — migration GEÇMİŞİ uzlaştırma provası (yalnızca yerel yığın, 127.0.0.1:56432).
# Production'a bağlanmaz: --db-url her komutta yerel yığına sabit; "supabase link" yok.
#
# 1) Production benzeri şema + taklit; geçmiş tablosuna Production'daki 12 eski kayıt (sürüm + ad).
# 2) Yer tutucusuz depo: CLI ne görüyor? (beklenen: uzak-yalnız sürümler yüzünden durur)
# 3) Yer tutucular eklenir: CLI listesi; db push --dry-run neyi uygulayacağını söyler (109 bekleyen).
# 4) Dalga A (100 sürüm) repair; bekleyen yalnızca paket sürümleri.
# 5) P1..P6 (+P8) uygulanır, her paketten sonra kendi dalga-B sürümleri repair.
# 6) Son: bekleyen 0, uzak-yalnız 0; repair şemayı değiştirmedi (özet eşit).
# Kullanım: SUPABASE_CLI=<supabase.js yolu> scripts/uzlastirma/prova-gecmis.sh
set -euo pipefail
KOK="$(cd "$(dirname "$0")/../.." && pwd)"
CIKTI="${PROVA_CIKTI:-$KOK/scripts/uzlastirma/sonuclar}"
mkdir -p "$CIKTI"
export PGPASSWORD=yerel-yigin
PSQL=(psql -h 127.0.0.1 -p 56432 -U postgres -v ON_ERROR_STOP=1 -q)
URL="postgresql://postgres:yerel-yigin@127.0.0.1:56432/postgres?sslmode=disable"
CLI=(node "${SUPABASE_CLI:?SUPABASE_CLI ayarlı değil}")
G="$KOK/scripts/uzlastirma/gecmis"
HARIC=(20260924100026_kvkk_onayi_kaydi.sql 20260924100027_deneme_hatirlatma_isareti.sql 20260926131150_kilavuz_secimi_kararli.sql
  20261106184046_eposta_onayi_kimlik_sabitleme.sql 20261107113542_sifre_durumum.sql 20261107120542_ilk_sifre_gerekli.sql
  20261112195236_rate_limit_take.sql 20261115203504_metin_surum_damgasi.sql)
ozet() { "${PSQL[@]}" -At -F '|' -f "$KOK/scripts/uzlastirma/sema-ozeti.sql" > "$CIKTI/ozet-$1.txt"; }
fark() { { diff <(sort "$CIKTI/ozet-$1.txt") <(sort "$CIKTI/ozet-$2.txt") || true; } | { grep -E "^[<>]" || true; } | wc -l; }
W="$(mktemp -d)"; mkdir -p "$W/supabase/migrations"
cp "$KOK"/supabase/migrations/*.sql "$W/supabase/migrations/"
liste() { "${CLI[@]}" migration list --db-url "$URL" --workdir "$W" 2>&1; }
# Yerel/uzak sütunlarını say: yalnız yerelde (bekleyen), yalnız uzakta, ikisinde.
sayim() { liste | node -e 'const t=require("fs").readFileSync(0,"utf8");const j=JSON.parse(t.slice(t.indexOf("{")));let b=0,y=0,u=0;for(const m of j.migrations){if(m.local&&m.remote)b++;else if(m.local)y++;else u++}console.log(`ikisinde=${b} yalnız-yerel=${y} yalnız-uzak=${u}`)'; }
bekleyen() { "${CLI[@]}" db push --dry-run --include-all --db-url "$URL" --workdir "$W" 2>&1 | grep -cE "^\s*•\s*[0-9]{14}" || true; }

bash "$KOK/scripts/yerel-yigin/kur-depo.sh" "${HARIC[@]}" >/dev/null 2>&1
"${PSQL[@]}" -f "$KOK/scripts/uzlastirma/prova/00-production-taklidi.sql" >/dev/null 2>&1
"${PSQL[@]}" <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
 ('20260815134724','thesis_guideline_intelligence'),('20260815134754','verified_guideline_sources_batch_01'),
 ('20260815143714','bootstrap_initial_academic_managers'),('20260815145249','verified_guideline_sources_batch_02'),
 ('20260817140252','fix_academic_unit_access_and_seed_istanbul'),('20260818072457','grant_academic_units_service_role_access'),
 ('20260818073414','guideline_automatic_discovery'),('20260818084045','add_verified_guidelines_adiyaman_afyon_cukurova'),
 ('20260818085709','prioritize_verified_guidelines_for_immediate_scan'),('20260818090326','retry_pdf_guidelines_after_dommatrix_fix'),
 ('20260818090724','retry_pdf_guidelines_after_worker_fix'),('20260818091259','retry_pdf_guidelines_after_tracing_fix')
on conflict do nothing;
SQL
ozet gecmis-once

echo "== 2) Yer tutucusuz depo"
echo "   liste: $(sayim)"
r=$("${CLI[@]}" db push --dry-run --db-url "$URL" --workdir "$W" 2>&1 | grep -oE "DbPushMissingLocalError|Remote database is up to date" | head -1); echo "   db push --dry-run: ${r:-beklenmeyen çıktı}"

echo "== 3) 12 yer tutucu eklendi"
cp "$G"/yer-tutucular/*.sql "$W/supabase/migrations/"
echo "   liste: $(sayim) · dry-run bekleyen: $(bekleyen)"

echo "== 4) Dalga A repair ($(wc -l < "$G/dalga-A.txt") sürüm)"
"${CLI[@]}" migration repair --status applied $(cat "$G/dalga-A.txt") --db-url "$URL" --workdir "$W" >/dev/null 2>&1
echo "   liste: $(sayim) · dry-run bekleyen: $(bekleyen)"
ozet gecmis-A
echo "   repair şemayı değiştirdi mi: $(fark gecmis-once gecmis-A) satır"

echo "== 5) Paketler + dalga B"
for p in P1:P1_rate_limit_take P2:P2_metin_surum_damgasi P6:P6_destek_danismanlik_guard P4:P4_kilavuz_secimi P3:P3_kvkk_ve_deneme_isareti P5:P5_g1_kimlik; do
  k=${p%%:*}; d=${p#*:}
  "${PSQL[@]}" -f "$KOK/scripts/uzlastirma/paketler/$d.sql" >/dev/null 2>&1 || { echo "FAIL $d"; exit 1; }
  "${CLI[@]}" migration repair --status applied $(cat "$G/dalga-B-$k.txt") --db-url "$URL" --workdir "$W" >/dev/null 2>&1
  echo "   $k: uygulandı + $(wc -l < "$G/dalga-B-$k.txt") sürüm kaydedildi · bekleyen: $(bekleyen)"
done
"${PSQL[@]}" -f "$KOK/scripts/uzlastirma/paketler/P8_profil_rol_varsayilani.sql" >/dev/null 2>&1

echo "== 6) Son durum"
echo "   liste: $(sayim) · dry-run bekleyen: $(bekleyen)"
echo "   dry-run çıktısı: $("${CLI[@]}" db push --dry-run --db-url "$URL" --workdir "$W" 2>&1 | tail -1)"
echo "   geçmiş kaydı: $("${PSQL[@]}" -At -c 'select count(*) from supabase_migrations.schema_migrations')"
liste > "$CIKTI/gecmis-son-liste.txt"
rm -rf "$W"
