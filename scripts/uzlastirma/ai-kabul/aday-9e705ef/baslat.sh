#!/bin/bash
# Gerçek AI kabulü: sayaç vekili (SINIR=7) + next start 3124. Anahtar yalnızca next sürecinin AI_ANAHTAR'ına.
set -euo pipefail
set +x
O="${CIKTI:?CIKTI (depo dışı çıktı dizini) gerekli}"; mkdir -p "$O"; SP=${SP:-/tmp}
cd "$(git rev-parse --show-toplevel)"
[ "$(git rev-parse --short HEAD)" = "9e705ef" ] || { echo "HEAD aday değil"; exit 2; }
[ -n "${ARVOLAB_KABUL_AI_ANAHTAR:-}" ] || { echo "anahtar yok"; exit 2; }
pkill -f "next-server" || true; pkill -f sayac-vekili || true
SINIR=7 PORT=54950 YUKARI_ADRES=https://api.anthropic.com GUNLUK="$O/saglayici-istekleri.jsonl" NODE_USE_ENV_PROXY=1 \
  nohup node scripts/uzlastirma/ai-kabul/sayac-vekili.mjs > "$O/vekil.log" 2>&1 &
. "${ORTAM:?ORTAM (yerel yığın ortam dosyası) gerekli}"
(
  set +x
  export AI_ANAHTAR="$ARVOLAB_KABUL_AI_ANAHTAR"
  unset ARVOLAB_KABUL_AI_ANAHTAR OPENAI_API_KEY OPENAI_TABAN_URL
  export AI_TABAN_URL=http://127.0.0.1:54950/v1 AI_BICIM=anthropic AI_MODEL=claude-sonnet-5 AI_MODEL_LITERATUR=claude-haiku-4-5-20251001
  nohup npx next start -p 3124 > "$O/next-start.log" 2>&1 &
)
curl -s -o /dev/null --retry 15 --retry-connrefused --retry-delay 2 http://localhost:3124/
echo "hazır"
