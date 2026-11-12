#!/usr/bin/env bash
# Hız sınırı sayacının GERÇEK eşzamanlılık sınaması (Phase 5.0b, 12.11.2026).
#
# CI'DA DEĞİL, elle çalıştırılır: yerel bir PostgreSQL ikili dosyası ister.
# tests/db PGlite kullanıyor ve PGlite tek bağlantılı; orada "aynı anda"
# gönderilen çağrılar sıraya girer, yani yarış koşulu sınanamaz. Burada
# geçici bir küme kurulur (yalnızca bu betiğin dizininde, hiçbir projeye
# bağlanmadan), yalnızca sayacın migration'ı uygulanır ve her biri ayrı
# bağlantı olan yüzlerce psql süreci aynı anda public.rate_limit_hit'i
# çağırır. Beklenen: her anahtar için TAM OLARAK sınır kadar izin; iki
# anahtar birbirinin hakkını yemez; tablodaki sayaç gönderilen çağrı
# sayısına eşit (kayıp güncelleme yok). Sonunda küme durdurulur ve silinir.
#
# İkinci senaryo (T3, 12.11.2026): tekli ve TOPLU rezervasyon aynı anda.
# Aynı anahtara eşzamanlı olarak 20 × rate_limit_take(50) (toplu içe
# aktarma), 100 × rate_limit_take(1) (tekli sorgu) ve 50 × rate_limit_hit
# gönderilir; talep sınırın çok üstünde. Beklenen: verilen toplam TAM
# OLARAK sınır kadar, hiçbir toplu çağrı istediğinden fazla almıyor ve
# başka bir anahtar etkilenmiyor.
#
#   bash scripts/eszamanli-hiz-siniri.sh            # 250 çağrı × 2 anahtar + karışık senaryo, sınır 120
#   CAGRI=400 SINIR=120 bash scripts/eszamanli-hiz-siniri.sh
#   MIGRATION_TAKE=… bash …                          # toplu işlevin başka bir gövdesiyle (ör. bilerek yarışlı)
set -euo pipefail

KOK="$(cd "$(dirname "$0")/.." && pwd)"
# Kanıt için başka bir gövde denenebilir (ör. bilerek yarışlı bir sürüm): MIGRATION=… bash …
MIGRATION="${MIGRATION:-$KOK/supabase/migrations/20260924100002_hiz_siniri.sql}"
MIGRATION_TAKE="${MIGRATION_TAKE:-$KOK/supabase/migrations/20261112195236_rate_limit_take.sql}"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
CAGRI="${CAGRI:-250}"
SINIR="${SINIR:-120}"

if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then
  echo "PostgreSQL ikili dosyaları bulunamadı (PGBIN=…/bin verin)." >&2
  exit 2
fi

DIZIN="$(mktemp -d)"
# initdb root ile çalışmaz: root isek kümeyi postgres kullanıcısı kurar.
calistir() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}
[ "$(id -u)" = "0" ] && chown postgres "$DIZIN"

temizle() {
  calistir "$PGBIN/pg_ctl" -D "$DIZIN/veri" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$DIZIN"
}
trap temizle EXIT

calistir "$PGBIN/initdb" -D "$DIZIN/veri" -A trust -U postgres >/dev/null
calistir "$PGBIN/pg_ctl" -D "$DIZIN/veri" -w -l "$DIZIN/gunluk" \
  -o "-k $DIZIN -c listen_addresses='' -c max_connections=$((CAGRI * 2 + 200))" start >/dev/null

PSQL=("$PGBIN/psql" -h "$DIZIN" -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq)
# Migration'daki revoke/grant satırları Supabase rollerini bekliyor.
"${PSQL[@]}" -c "create role anon; create role authenticated; create role service_role;"
"${PSQL[@]}" -f "$MIGRATION" >/dev/null
"${PSQL[@]}" -f "$MIGRATION_TAKE" >/dev/null

SONUC="$DIZIN/sonuc"
for i in $(seq 1 "$CAGRI"); do
  "${PSQL[@]}" -c "select 'A:' || public.rate_limit_hit('doi-sorgu:A', $SINIR, interval '1 hour')" >>"$SONUC" &
  "${PSQL[@]}" -c "select 'B:' || public.rate_limit_hit('doi-sorgu:B', $SINIR, interval '1 hour')" >>"$SONUC" &
done
wait

say() { grep -c "^$1$" "$SONUC" || true; }
A_IZIN=$(say "A:true"); A_RED=$(say "A:false")
B_IZIN=$(say "B:true"); B_RED=$(say "B:false")
A_SAYAC=$("${PSQL[@]}" -c "select count from public.auth_rate_limits where key = 'doi-sorgu:A'")
B_SAYAC=$("${PSQL[@]}" -c "select count from public.auth_rate_limits where key = 'doi-sorgu:B'")

echo "Anahtar A: izin $A_IZIN · ret $A_RED · sayaç $A_SAYAC (beklenen: izin $SINIR, ret $((CAGRI - SINIR)), sayaç $CAGRI)"
echo "Anahtar B: izin $B_IZIN · ret $B_RED · sayaç $B_SAYAC (beklenen: izin $SINIR, ret $((CAGRI - SINIR)), sayaç $CAGRI)"

BIRINCI=0
if [ "$A_IZIN" = "$SINIR" ] && [ "$B_IZIN" = "$SINIR" ] \
  && [ "$A_RED" = "$((CAGRI - SINIR))" ] && [ "$B_RED" = "$((CAGRI - SINIR))" ] \
  && [ "$A_SAYAC" = "$CAGRI" ] && [ "$B_SAYAC" = "$CAGRI" ]; then
  echo "GEÇTİ (1): eşzamanlı çağrılar sınırı aşamadı, anahtarlar birbirinden bağımsız, kayıp güncelleme yok."
else
  echo "KALDI (1)" >&2
  BIRINCI=1
fi

# --- İkinci senaryo: tekli + toplu, aynı anahtar, aynı anda ---
KARISIK="$DIZIN/karisik"
# Türler iç içe başlatılıyor: her turda bir tekli, iki turda bir eski işlev,
# beş turda bir toplu — biri ötekinin önüne dizilip bütün hakkı tek başına
# almasın, gerçekten birbirine karışsın.
for i in $(seq 1 100); do
  "${PSQL[@]}" -c "select 'T1:' || granted from public.rate_limit_take('doi-sorgu:C', $SINIR, interval '1 hour', 1)" >>"$KARISIK" &
  if [ $((i % 2)) = 0 ]; then
    "${PSQL[@]}" -c "select 'H:' || public.rate_limit_hit('doi-sorgu:C', $SINIR, interval '1 hour')" >>"$KARISIK" &
  fi
  if [ $((i % 5)) = 0 ]; then
    "${PSQL[@]}" -c "select 'T50:' || granted from public.rate_limit_take('doi-sorgu:C', $SINIR, interval '1 hour', 50)" >>"$KARISIK" &
  fi
done
"${PSQL[@]}" -c "select 'D:' || granted from public.rate_limit_take('doi-sorgu:D', $SINIR, interval '1 hour', 50)" >>"$KARISIK" &
wait

satir_sayisi=$(wc -l <"$KARISIK")
T50_TOPLAM=$(grep '^T50:' "$KARISIK" | cut -d: -f2 | paste -sd+ - | bc)
T50_EN_COK=$(grep '^T50:' "$KARISIK" | cut -d: -f2 | sort -n | tail -1)
T1_TOPLAM=$(grep '^T1:' "$KARISIK" | cut -d: -f2 | paste -sd+ - | bc)
H_IZIN=$(grep -c '^H:true$' "$KARISIK" || true)
D_VERILEN=$(grep '^D:' "$KARISIK" | cut -d: -f2)
TOPLAM=$((T50_TOPLAM + T1_TOPLAM + H_IZIN))
echo "Karışık (C): toplu $T50_TOPLAM (tek çağrıda en çok $T50_EN_COK) + tekli $T1_TOPLAM + eski işlev $H_IZIN = $TOPLAM (beklenen: $SINIR) · yanıt $satir_sayisi/171"
echo "Bağımsız anahtar (D): $D_VERILEN (beklenen: 50)"

if [ "$satir_sayisi" = "171" ] && [ "$TOPLAM" = "$SINIR" ] && [ "$T50_EN_COK" -le 50 ] && [ "$D_VERILEN" = "50" ] && [ "$BIRINCI" = "0" ]; then
  echo "GEÇTİ (2): tekli ve toplu çağrılar aynı anda sınırı aşamadı; verilen toplam tam $SINIR."
else
  echo "KALDI" >&2
  exit 1
fi
