#!/usr/bin/env bash
# PR #112 canlı kontrolünün test verisini siler (test düzeneği, uygulama kodu DEĞİL).
# 20.11.2026'da çalıştırılan komutların aynısı; kimlikler o koşunun kayıtları (sonuclar/iz.json).
# Silme hesabın KENDİ oturumuyla yapılır, RLS altında: service_role kullanılmaz.
# Önce Node'un fetch'iyle denendi; bu ortamda vekil sunucudan geçmediği için (ENOTFOUND)
# vekili kullanan curl'e geçildi.
#
# Gerekenler (hiçbiri depoda değil):
#   ERISIM_BELIRTECI   hesabın oturum belirteci (access_token)
#   SUPABASE_URL       https://<proje>.supabase.co
#   SUPABASE_ANAHTAR   projenin yayımlanabilir (publishable) anahtarı
set -euo pipefail
: "${ERISIM_BELIRTECI:?}" "${SUPABASE_URL:?}" "${SUPABASE_ANAHTAR:?}"
H=(-H "apikey: $SUPABASE_ANAHTAR" -H "Authorization: Bearer $ERISIM_BELIRTECI")

# 1) Storage nesnesi önce: veritabanı satırı silinince yolu kaybetmeyelim.
curl -s -w ' [%{http_code}]\n' -X DELETE "$SUPABASE_URL/storage/v1/object/project-files" "${H[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"prefixes":["0c676cbf-1e84-495b-acd4-a94dcbad035f/kaynak-pdf/y-3e51abaa-1822-41ac-abd0-91a7709e10cc-e7563b18-86b6-4a03-a19c-3160d108ecd7.pdf"]}'

# 2) Satırlar: PDF kaydı kaynağa bağlı olduğu için önce o; çalışma en son
#    (müsvedde ve otomatik sürüm çalışmayla birlikte CASCADE silinir).
for x in kaynak_pdfleri:0d378d7c-188f-4959-bdb7-0710ac15c101 \
         citation_checks:03281eed-413d-426e-91c5-f38537aa61dd \
         literature_sources:cef24e38-4ff6-4e73-a042-6f4641a0dd2a \
         academic_projects:0c676cbf-1e84-495b-acd4-a94dcbad035f; do
  t=${x%%:*}; i=${x#*:}
  printf '%s: ' "$t"
  curl -s -o /dev/null -w '[%{http_code}]\n' -X DELETE "$SUPABASE_URL/rest/v1/$t?id=eq.$i" "${H[@]}" -H 'Prefer: return=representation'
done

# 3) Hesabın bütün oturumlarını kapat.
curl -s -o /dev/null -w 'logout [%{http_code}]\n' -X POST "$SUPABASE_URL/auth/v1/logout?scope=global" "${H[@]}"
