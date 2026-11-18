#!/bin/bash
# GERÇEK AI KABULÜ BAŞLATICISI (RC06h, 17.11.2026). HAZIRLANDI, ÇALIŞTIRILMADI.
# Gerçek sağlayıcı çağrısı yapar: yalnızca kullanıcının AÇIK onayından sonra ve birleşik aday
# hazır olduğunda koşulur. Anahtar yalnızca next start sürecinin AI_ANAHTAR'ına aktarılır;
# ekrana, günlüğe, sonuç dosyasına ve git'e yazılmaz (set -x yasak, env/printenv yok).
#
# Kullanım (depo kökünde, birleşik adayın temiz ağacında):
#   ONAY=evet ADAY_SHA=<design/os5 birleşik aday SHA'sı> bash <bu dosya> <çıktı dizini (depo dışı)>
set -euo pipefail
set +x
CIKTI="${1:?çıktı dizini gerekli (depo dışı)}"
[ "${ONAY:-}" = "evet" ] || { echo "ONAY=evet verilmedi: gerçek çağrı başlatılmaz"; exit 2; }
[ -n "${ARVOLAB_KABUL_AI_ANAHTAR:-}" ] || { echo "ARVOLAB_KABUL_AI_ANAHTAR yok"; exit 2; }
KOK="$(git rev-parse --show-toplevel)"
cd "$KOK"
HEAD="$(git rev-parse HEAD)"
[ "$HEAD" = "${ADAY_SHA:?ADAY_SHA gerekli}" ] || { echo "HEAD ($HEAD) birleşik aday değil"; exit 2; }
[ -z "$(git status --porcelain -- app lib proxy.ts next.config.ts package.json package-lock.json)" ] || { echo "uygulama ağacı temiz değil"; exit 2; }
case "$(cd "$CIKTI" 2>/dev/null && pwd || echo "$CIKTI")" in "$KOK"*) echo "çıktı dizini depo içinde olamaz"; exit 2;; esac
mkdir -p "$CIKTI"

# Model kimlikleri SABİT (Production kayıtlarında görülenler); sessizce değiştirilmez.
MODEL=claude-sonnet-5
MODEL_LITERATUR=claude-haiku-4-5-20251001

# 1) Kalıcı sayaç vekili: en çok 30 sağlayıcı isteği (yeniden deneme, paralel, başarısız dahil).
SINIR=30 PORT=54950 YUKARI_ADRES=https://api.anthropic.com GUNLUK="$CIKTI/saglayici-istekleri.jsonl" \
  nohup node scripts/uzlastirma/ai-kabul/sayac-vekili.mjs > "$CIKTI/vekil.log" 2>&1 &

# 2) next start: anahtar YALNIZCA bu sürecin AI_ANAHTAR'ına. `env VAR=değer komut` biçimi değeri
#    kısa süre süreç argümanlarında (ps, /proc/*/cmdline) gösterirdi; alt kabukta export edilir,
#    kaynak değişken ve OPENAI_* yedekleri silinir (yerel taklidin değeri karışmasın).
(
  set +x
  export AI_ANAHTAR="$ARVOLAB_KABUL_AI_ANAHTAR"
  unset ARVOLAB_KABUL_AI_ANAHTAR OPENAI_API_KEY OPENAI_TABAN_URL
  export AI_TABAN_URL=http://127.0.0.1:54950/v1 AI_BICIM=anthropic AI_MODEL="$MODEL" AI_MODEL_LITERATUR="$MODEL_LITERATUR"
  nohup npx next start -p 3124 > "$CIKTI/next-start.log" 2>&1 &
)
echo "başlatıldı: aday $HEAD · vekil sınırı 30 · modeller $MODEL / $MODEL_LITERATUR · günlükler $CIKTI"
