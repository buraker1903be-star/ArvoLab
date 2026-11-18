#!/bin/bash
# RELEASE CLOSURE 06 — geri dönüş provası (yalnızca yerel yığın, 127.0.0.1:56432).
# Production benzeri şemaya P1..P8 uygulanır, ardından geri/R8..R1 TERS sırayla (tam=1) uygulanır.
# Ölçüt: son şema özeti, paketlerden ÖNCEKİ özetle birebir aynı olmalı (0 satır fark).
# Her geri dönüş iki kez çalıştırılır (tekrar çalıştırılabilirlik). Ayrıca R3'ün varsayılan
# (sütunları koruyan) kipi ayrı sınanır: handle_new_user döner, kvkk_onay_at yerinde kalır.
set -euo pipefail
KOK="$(cd "$(dirname "$0")/../.." && pwd)"
CIKTI="${PROVA_CIKTI:-$KOK/scripts/uzlastirma/sonuclar}"
mkdir -p "$CIKTI"
export PGPASSWORD=yerel-yigin
PSQL=(psql -h 127.0.0.1 -p 56432 -U postgres -v ON_ERROR_STOP=1 -q)
HARIC=(20260924100026_kvkk_onayi_kaydi.sql 20260924100027_deneme_hatirlatma_isareti.sql 20260926131150_kilavuz_secimi_kararli.sql
  20261106184046_eposta_onayi_kimlik_sabitleme.sql 20261107113542_sifre_durumum.sql 20261107120542_ilk_sifre_gerekli.sql
  20261112195236_rate_limit_take.sql 20261115203504_metin_surum_damgasi.sql)
PAKET="$KOK/scripts/uzlastirma/paketler"
ozet() { "${PSQL[@]}" -At -F '|' -f "$KOK/scripts/uzlastirma/sema-ozeti.sql" > "$CIKTI/ozet-$1.txt"; }
fark() { { diff <(sort "$CIKTI/ozet-$1.txt") <(sort "$CIKTI/ozet-$2.txt") || true; } | { grep -E "^[<>]" || true; } | wc -l; }

bash "$KOK/scripts/yerel-yigin/kur-depo.sh" "${HARIC[@]}" >/dev/null 2>&1
"${PSQL[@]}" -f "$KOK/scripts/uzlastirma/prova/00-production-taklidi.sql" >/dev/null 2>&1
ozet geri-once
for p in P1_rate_limit_take P2_metin_surum_damgasi P3_kvkk_ve_deneme_isareti P4_kilavuz_secimi P5_g1_kimlik P6_destek_danismanlik_guard P7_akademik_birim_tetikleyicileri P8_profil_rol_varsayilani; do
  "${PSQL[@]}" -f "$PAKET/$p.sql" >/dev/null 2>&1 || { echo "FAIL paket $p"; exit 1; }
done
ozet geri-paketli
echo "paketler (P1..P8) uygulandı: önceye göre $(fark geri-once geri-paketli) satır değişti"

# R3 varsayılan kip: sütunlar kalır.
"${PSQL[@]}" -f "$PAKET/geri/R3_kvkk_ve_deneme_isareti.sql" >/dev/null 2>&1 || { echo "FAIL R3 (varsayılan)"; exit 1; }
sut=$("${PSQL[@]}" -At -c "select count(*) from information_schema.columns where table_schema='public' and column_name in ('kvkk_onay_at','deneme_hatirlatildi_at')")
echo "R3 varsayılan kip: KVKK/deneme sütunu kalan = $sut (beklenen 2)"

for r in R8_profil_rol_varsayilani R7_akademik_birim_tetikleyicileri R6_destek_danismanlik_guard R5_g1_kimlik R4_kilavuz_secimi R3_kvkk_ve_deneme_isareti R2_metin_surum_damgasi R1_rate_limit_take; do
  for tur in 1 2; do
    "${PSQL[@]}" -v tam=1 -f "$PAKET/geri/$r.sql" >/dev/null 2>&1 || { echo "FAIL $r ($tur. çalıştırma)"; "${PSQL[@]}" -v tam=1 -f "$PAKET/geri/$r.sql" 2>&1 | grep -m3 ERROR; exit 1; }
  done
done
ozet geri-sonra
n=$(fark geri-once geri-sonra)
echo "geri dönüş (R8..R1, her biri iki kez): paketlerden önceki özete göre fark = $n satır"
diff <(sort "$CIKTI/ozet-geri-once.txt") <(sort "$CIKTI/ozet-geri-sonra.txt") | grep -E '^[<>]' | cut -d'|' -f1,2 > "$CIKTI/geri-fark.txt" || true
[ "$n" -eq 0 ] && echo "PASS geri dönüş" || { echo "FAIL geri dönüş (ayrıntı: $CIKTI/geri-fark.txt)"; exit 1; }
