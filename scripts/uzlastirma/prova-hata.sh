#!/bin/bash
# RELEASE CLOSURE 06 — kısmi başarısızlık ve bağımlılık sırası provası (yalnızca yerel yığın).
# 1) Production benzeri şema + taklit.
# 2) P5 (G1), commit'ten hemen önce bilerek düşürülür: işlem geri alınmalı, hiçbir G1 nesnesi
#    ve veri değişikliği kalmamalı (özet, düşürmeden önceki özetle aynı olmalı).
# 3) Paketler önerilen sıranın TERSİNE yakın bir sırayla uygulanır (P8, P5, P3, P7, P6, P1, P4, P2):
#    paketler arasında gizli bağımlılık varsa burada düşer; son özet olağan sıradakiyle aynı olmalı.
set -euo pipefail
KOK="$(cd "$(dirname "$0")/../.." && pwd)"
CIKTI="${PROVA_CIKTI:-$KOK/scripts/uzlastirma/sonuclar}"
export PGPASSWORD=yerel-yigin
PSQL=(psql -h 127.0.0.1 -p 56432 -U postgres -v ON_ERROR_STOP=1 -q)
HARIC=(20260924100026_kvkk_onayi_kaydi.sql 20260924100027_deneme_hatirlatma_isareti.sql 20260926131150_kilavuz_secimi_kararli.sql
  20261106184046_eposta_onayi_kimlik_sabitleme.sql 20261107113542_sifre_durumum.sql 20261107120542_ilk_sifre_gerekli.sql
  20261112195236_rate_limit_take.sql 20261115203504_metin_surum_damgasi.sql)
ozet() { "${PSQL[@]}" -At -F '|' -f "$KOK/scripts/uzlastirma/sema-ozeti.sql" > "$CIKTI/ozet-$1.txt"; }
fark() { { diff <(sort "$CIKTI/ozet-$1.txt") <(sort "$CIKTI/ozet-$2.txt") || true; } | { grep -E "^[<>]" || true; } | wc -l; }

bash "$KOK/scripts/yerel-yigin/kur-depo.sh" "${HARIC[@]}" >/dev/null 2>&1
"${PSQL[@]}" -f "$KOK/scripts/uzlastirma/prova/00-production-taklidi.sql" >/dev/null 2>&1
# Sentetik veri: onaysız, kuruma bağlı bir profil (G1'in veri adımının hedefi) — geri alınınca bağ yerinde kalmalı.
"${PSQL[@]}" <<'SQL'
insert into public.organizations (id, name) values ('00000000-0000-4000-8000-0000000000aa', 'Sentetik Kurum') on conflict do nothing;
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000bb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'onaysiz@yerel.test', '{}', now(), now())
on conflict do nothing;
update public.profiles set organization_id = '00000000-0000-4000-8000-0000000000aa' where id = '00000000-0000-4000-8000-0000000000bb';
SQL
ozet hata-once
BOZUK="$(mktemp)"
sed 's/^commit;$/select 1\/0; -- bilerek düşür\ncommit;/' "$KOK/scripts/uzlastirma/paketler/P5_g1_kimlik.sql" > "$BOZUK"
if "${PSQL[@]}" -f "$BOZUK" >/dev/null 2>&1; then echo "FAIL kısmi hata: bozuk paket düşmedi"; exit 1; fi
ozet hata-sonra
bag=$("${PSQL[@]}" -At -c "select coalesce(organization_id::text,'NULL') from public.profiles where id='00000000-0000-4000-8000-0000000000bb'")
g1=$("${PSQL[@]}" -At -c "select count(*) from pg_proc where proname in ('ilk_sifre_gerekli','eposta_onayinda_profili_kur','eposta_onayinda_sifreyi_temizle')")
echo "kısmi hata: şema farkı $(fark hata-once hata-sonra) satır · G1 fonksiyonu $g1 · sentetik onaysız profilin kurum bağı: $bag"

for p in P8_profil_rol_varsayilani P5_g1_kimlik P3_kvkk_ve_deneme_isareti P7_akademik_birim_tetikleyicileri P6_destek_danismanlik_guard P1_rate_limit_take P4_kilavuz_secimi P2_metin_surum_damgasi; do
  "${PSQL[@]}" -f "$KOK/scripts/uzlastirma/paketler/$p.sql" >/dev/null 2>&1 || { echo "FAIL sıra: $p düştü"; exit 1; }
done
bag2=$("${PSQL[@]}" -At -c "select coalesce(organization_id::text,'NULL') from public.profiles where id='00000000-0000-4000-8000-0000000000bb'")
ozet ters-sira
echo "ters sıra: hepsi uygulandı · olağan sırayla son özet farkı: $(fark sonra ters-sira) satır · sentetik onaysız profilin kurum bağı (G1 veri adımı): $bag2"
