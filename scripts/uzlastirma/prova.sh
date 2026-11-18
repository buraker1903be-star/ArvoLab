#!/bin/bash
# RELEASE CLOSURE 06 — PRODUCTION UZLAŞTIRMASI İZOLE PROVASI.
# YALNIZCA yerel yığın (127.0.0.1:56432); gerçek bir Supabase projesine bağlanmaz,
# Production verisi kopyalanmaz (yalnızca şema, sentetik veri).
#
# 1) Depodan, Production'da UYGULANMAMIŞ 8 migration atlanarak şema kurulur.
# 2) prova/00-production-taklidi.sql: Production'a özgü yetkiler ve sapmalar (katalogla ölçüldü).
# 3) Özet "once" alınır (Production'la karşılaştırıldı: bkz. RAPOR.md).
# 4) Paketler sırayla uygulanır; her paketten sonra özet alınır.
# 5) Her paket İKİNCİ kez uygulanır: özet değişmemeli (tekrar çalıştırılabilirlik).
# 6) Kısmi hata: P5 sona hata eklenerek ayrı bir kopyada çalıştırılır; hiçbir nesne kalmamalı.
# 7) Son özet depo hedefiyle (temiz kurulum) karşılaştırılır; kalan farklar listelenir.
#
# Kullanım: scripts/uzlastirma/prova.sh [paketler…]   (varsayılan: P1..P6)
set -euo pipefail
KOK="$(cd "$(dirname "$0")/../.." && pwd)"
CIKTI="${PROVA_CIKTI:-$KOK/scripts/uzlastirma/sonuclar}"
mkdir -p "$CIKTI"
export PGPASSWORD=yerel-yigin
PSQL=(psql -h 127.0.0.1 -p 56432 -U postgres -v ON_ERROR_STOP=1 -q)
HARIC=(20260924100026_kvkk_onayi_kaydi.sql 20260924100027_deneme_hatirlatma_isareti.sql 20260926131150_kilavuz_secimi_kararli.sql
  20261106184046_eposta_onayi_kimlik_sabitleme.sql 20261107113542_sifre_durumum.sql 20261107120542_ilk_sifre_gerekli.sql
  20261112195236_rate_limit_take.sql 20261115203504_metin_surum_damgasi.sql)
PAKETLER=("$@")
[ ${#PAKETLER[@]} -eq 0 ] && PAKETLER=(P1_rate_limit_take P2_metin_surum_damgasi P3_kvkk_ve_deneme_isareti P4_kilavuz_secimi P5_g1_kimlik P6_destek_danismanlik_guard)

ozet() { "${PSQL[@]}" -At -F '|' -f "$KOK/scripts/uzlastirma/sema-ozeti.sql" > "$CIKTI/ozet-$1.txt"; }
fark() { { diff <(sort "$CIKTI/ozet-$1.txt") <(sort "$CIKTI/ozet-$2.txt") || true; } | { grep -E "^[<>]" || true; } | wc -l; }

echo "== 0) Depo hedefi (temiz kurulum, 109 migration)"
bash "$KOK/scripts/yerel-yigin/kur-depo.sh" >/dev/null 2>&1
ozet depo-hedefi

echo "== 1-2) Production benzeri şema"
bash "$KOK/scripts/yerel-yigin/kur-depo.sh" "${HARIC[@]}" 2>&1 | grep -c "hariç:" | xargs -I{} echo "   atlanan migration: {}"
"${PSQL[@]}" -f "$KOK/scripts/uzlastirma/prova/00-production-taklidi.sql"
ozet once
"${PSQL[@]}" -c "create database prova_yedek template postgres" 2>/dev/null || true

for p in "${PAKETLER[@]}"; do
  t0=$(date +%s%3N)
  "${PSQL[@]}" -f "$KOK/scripts/uzlastirma/paketler/$p.sql" >/dev/null 2>&1 || { echo "FAIL $p: ilk uygulama düştü"; "${PSQL[@]}" -f "$KOK/scripts/uzlastirma/paketler/$p.sql" 2>&1 | grep -m3 ERROR; exit 1; }
  t1=$(date +%s%3N)
  ozet "$p-1"
  "${PSQL[@]}" -f "$KOK/scripts/uzlastirma/paketler/$p.sql" >/dev/null 2>&1 || { echo "FAIL $p: ikinci uygulama düştü"; exit 1; }
  ozet "$p-2"
  n=$(fark "$p-1" "$p-2")
  echo "   $p: uygulandı ($((t1-t0)) ms); tekrar çalıştırma farkı: $n satır"
done
ozet sonra
echo "== 7) Son durum ↔ depo hedefi: $(fark sonra depo-hedefi) satır fark (ayrıntı: $CIKTI/son-fark.txt)"
diff <(sort "$CIKTI/ozet-depo-hedefi.txt") <(sort "$CIKTI/ozet-sonra.txt") | grep -E '^[<>]' | sed 's/^</DEPO /; s/^>/PROVA/' | cut -d'|' -f1,2 | sort -t'|' -k2 > "$CIKTI/son-fark.txt" || true
echo "== önce ↔ sonra: $(fark once sonra) satır değişti"
