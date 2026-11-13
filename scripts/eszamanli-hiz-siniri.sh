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
# Üçüncü bölüm (sertleştirme, 13.11.2026): sırayla tekli ve toplu hakkın
# tam sınırda tükenmesi, sınırdan sonra granted = 0, anahtar izolasyonu,
# NULL/sıfır/negatif pencerenin ve NULL/boş anahtarın açık hatayla
# reddedilmesi, search_path = '' (çağıranın yolunda gölge tablo varken)
# ve anon/authenticated'ın işlevi çağıramaması.
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

IKINCI=0
if [ "$satir_sayisi" = "171" ] && [ "$TOPLAM" = "$SINIR" ] && [ "$T50_EN_COK" -le 50 ] && [ "$D_VERILEN" = "50" ]; then
  echo "GEÇTİ (2): tekli ve toplu çağrılar aynı anda sınırı aşamadı; verilen toplam tam $SINIR."
else
  echo "KALDI (2)" >&2
  IKINCI=1
fi

# --- Üçüncü bölüm: sıralı kurallar (sertleştirme, 13.11.2026) ---
# search_path = '', geçersiz anahtar/pencere için açık hata, rol yetkileri
# ve tekli/toplu hakkın sırayla tükenişi; gerçek PostgreSQL üzerinde.
UCUNCU=0
gecti() { echo "  ✓ $1"; }
kaldi() { echo "  ✗ $1" >&2; UCUNCU=1; }
esit() { if [ "$2" = "$3" ]; then gecti "$1"; else kaldi "$1 (beklenen '$3', gelen '$2')"; fi; }
q() { "${PSQL[@]}" -c "$1"; }
# Reddedilmesi beklenen çağrı: psql başarısız dönmeli ve hata metni desene uymalı.
reddedilir() {
  local cikti
  if cikti=$("${PSQL[@]}" -c "$2" 2>&1); then
    kaldi "$1 (reddedilmedi: $cikti)"
  elif printf '%s' "$cikti" | grep -q "$3"; then
    gecti "$1"
  else
    kaldi "$1 (beklenmeyen hata: $cikti)"
  fi
}
take() { echo "select granted from public.rate_limit_take('$1', $SINIR, interval '1 hour', $2);"; }

echo "Kurallar (3):"
# 1 + 4 + 5: tekli sorgular, sınır+1 kez, ayrı ifadeler.
TEKLI=$(for i in $(seq 1 $((SINIR + 1))); do take doi-sorgu:E 1; done | "${PSQL[@]}")
esit "tekli: ilk $SINIR sorgu birer hak alır" "$(printf '%s\n' "$TEKLI" | head -n "$SINIR" | paste -sd+ - | bc)" "$SINIR"
esit "tekli: sınır aşılınca granted = 0" "$(printf '%s\n' "$TEKLI" | tail -n 1)" "0"
esit "tekli: sayaç tam sınırda" "$(q "select count from public.auth_rate_limits where key = 'doi-sorgu:E'")" "$SINIR"
# 2 + 4 + 5: toplu sorgular (50'şer), kısmi verme ve tükeniş.
TOPLU=$(for i in 1 2 3 4; do take doi-sorgu:F 50; done | "${PSQL[@]}" | paste -sd, -)
esit "toplu: 50, 50, kalan $((SINIR - 100)), sonra 0" "$TOPLU" "50,50,$((SINIR - 100)),0"
esit "toplu: sayaç tam sınırda" "$(q "select count from public.auth_rate_limits where key = 'doi-sorgu:F'")" "$SINIR"
esit "toplu: tükenince kalan 0" "$(q "select remaining from public.rate_limit_take('doi-sorgu:F', $SINIR, interval '1 hour', 1)")" "0"
# 6: tükenmiş anahtarlar yeni anahtarı etkilemez.
esit "izolasyon: tükenmiş E/F yanında yeni anahtar tam hak alır" "$(q "$(take doi-sorgu:G 50)")" "50"
# 7: geçersiz pencere.
for p in "NULL" "interval '0'" "interval '-1 hour'" "interval '-1 second'"; do
  reddedilir "pencere $p reddedilir" "select * from public.rate_limit_take('doi-sorgu:E', $SINIR, $p, 1)" "pencere pozitif"
done
esit "reddedilen pencere sayacı değiştirmez" "$(q "select count from public.auth_rate_limits where key = 'doi-sorgu:E'")" "$SINIR"
# 8: geçersiz anahtar.
for k in "NULL" "''" "'   '"; do
  reddedilir "anahtar $k reddedilir" "select * from public.rate_limit_take($k, $SINIR, interval '1 hour', 1)" "anahtar boş olamaz"
done
esit "boş anahtarlı satır yazılmadı" "$(q "select count(*) from public.auth_rate_limits where key is null or btrim(key) = ''")" "0"
# 9: search_path = '' ve çağıranın yolunda gölge tablo.
esit "işlev ayarı search_path=\"\"" "$(q "select array_to_string(proconfig, ',') from pg_proc where oid = 'public.rate_limit_take(text, integer, interval, integer)'::regprocedure")" 'search_path=""'
esit "işlev SECURITY DEFINER" "$(q "select prosecdef from pg_proc where oid = 'public.rate_limit_take(text, integer, interval, integer)'::regprocedure")" "t"
q "create schema golge; create table golge.auth_rate_limits (key text primary key, window_start timestamptz, count int);" >/dev/null
esit "gölge yolda çağrı gerçek tabloyu sayar" "$(q "set search_path = golge; $(take doi-sorgu:H 3)")" "3"
esit "gölge tabloya yazılmadı" "$(q "select count(*) from golge.auth_rate_limits")" "0"
esit "gerçek tabloda sayaç 3" "$(q "select count from public.auth_rate_limits where key = 'doi-sorgu:H'")" "3"
# 10: rol yetkileri.
reddedilir "anon çağıramaz" "set role anon; $(take doi-sorgu:I 1)" "permission denied for function rate_limit_take"
reddedilir "authenticated çağıramaz" "set role authenticated; $(take doi-sorgu:I 1)" "permission denied for function rate_limit_take"
esit "service_role çağırabilir" "$(q "set role service_role; $(take doi-sorgu:I 1)")" "1"
esit "işlev yetkisi yalnızca sahip ve service_role" "$(q "select proacl::text from pg_proc where oid = 'public.rate_limit_take(text, integer, interval, integer)'::regprocedure")" "{postgres=X/postgres,service_role=X/postgres}"

if [ "$UCUNCU" = "0" ]; then echo "GEÇTİ (3): sıralı kurallar."; else echo "KALDI (3)" >&2; fi

if [ "$BIRINCI" = "0" ] && [ "$IKINCI" = "0" ] && [ "$UCUNCU" = "0" ]; then
  echo "HEPSİ GEÇTİ."
else
  echo "KALDI" >&2
  exit 1
fi
