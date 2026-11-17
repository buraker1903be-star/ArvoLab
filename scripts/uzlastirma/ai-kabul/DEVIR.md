# Devir notu — gerçek AI kabulü (RC06h, 17.11.2026)

Production **HOLD**. Onay YOK: merge, Onay K, P9, Production, paylaşılan Test, gerçek AI çağrısı.
Bu not yeni oturumun başlangıcıdır; ayrıntı `../RAPOR-RC06c.md` (§6 plan, §8 panel, §9 AI).

## Durum

| | Dal | HEAD | CI |
|---|---|---|---|
| PR #101 (hazırlık belgeleri) | `hazirlik/os5-prod-uzlastirma` | bu notu içeren commit (`git log -1`) | `ec86302`'de yeşil |
| PR #102 (uygulama düzeltmeleri) | `duzeltme/os5-rc06-son` | `0942b86` (uygulama kodu `0036569`'dan beri aynı) | yeşil |
| `design/os5` (taban) | — | `11044d6` | — |
| `main` | — | `b62bfcf` | — |

İkisi de Draft, birleştirilmedi.

**Tamamlananlar:**
- Production'da salt okunur uzlaştırma, manifesto, Dalga A (97) / A-K (3, Onay K) / B, P1–P9 ve
  geri dönüşleri, yerel geçmiş provası (121/0/0, kabul edilen 142 satır fark).
- Panel kontrolleri (§8): Supabase entegrasyonu kapalı, PITR yok, son yedek 17.11 05:00:49 UTC.
- PR #102 kabulü `next build` + `next start` ile:
  - tam koşu 67 PASS / 0 FAIL / 1 UNVERIFIED (dokunma);
  - U3K eski kodda 3/3 FAIL, yeni kodda 10/10 PASS;
  - derleme sabitleme (`STUDYO_DERLEME`, BUILD_ID, `studyo-kabul-derleme.json`).
- AI hazırlığı: sayaç vekili (`sayac-vekili.mjs`, 30 iletim, yerel taklitle sınandı) ve başlatıcı
  (`baslat.sh`, hazırlandı, çalıştırılmadı).

**Açık:**
- Karar A1 (Auth API mevcut şifre).
- Vercel/GitHub Actions otomatik Production işlemi: UNVERIFIED.
- Gerçek AI kabulü.
- Dokunmatik kaydırma: UNVERIFIED.

## Anahtar (kullanıcı tanımlar; Claude değeri istemez, görmez)

Ortam: **ArvoLab Preview testleri** (kişisel). Değişken adı: **`ARVOLAB_KABUL_AI_ANAHTAR`**.
Production anahtarı DEĞİL; harcama sınırı olan ayrı bir test anahtarı.

**Yeni oturumda yalnızca var olup olmadığına bakılır.** Değer, bir parçası, uzunluğu ya da özeti yazdırılmaz:

```bash
[ -n "${ARVOLAB_KABUL_AI_ANAHTAR:-}" ] && echo "ARVOLAB_KABUL_AI_ANAHTAR: var" || echo "ARVOLAB_KABUL_AI_ANAHTAR: yok"
```

`env`, `printenv`, `set -x`, `declare -p` ve `/proc/*/environ` okuması yasak.

## Kalan kabul adımları (sırayla; her biri kendi onayıyla)

1. **0b/0c/0d** — #102 incelemesi, ardından #102 → `design/os5`, #101 → `design/os5`, sonra yer
   tutucular PR'ı. Hepsi kullanıcı onayıyla. **Onay yokken birleşik aday YOKTUR ve gerçek kabul
   başlamaz.** Yerelde birleştirme commit'i üretmek aday sayılmaz: SHA farklı olur.
2. Birleşik aday SHA'sı `design/os5`'ten alınır, temiz bir çalışma ağacına çıkarılır
   (`git status` uygulama dosyalarında boş).
3. Yerel yığın (yeni kapsayıcıda yeniden kurulur):
   - `scripts/yerel-yigin/kur-depo.sh` (P1–P6 kapsamındaki 8 migration hariç) +
     `scripts/uzlastirma/prova/00-production-taklidi.sql` + P1, P2, P6, P4, P3, P5, P8;
   - şema özeti md5 kaydedilir (önceki: `358efe9c…`);
   - `gecit.mjs` başlatılır. Model taklidi BAŞLATILMAZ.
4. `next build` (yerel yığının JWT'leriyle; anahtarlar `scripts/yerel-yigin/`deki sırdan üretilir).
5. **Kullanıcının açık "gerçek çağrı" onayıyla:**
   `ONAY=evet ADAY_SHA=<aday> bash scripts/uzlastirma/ai-kabul/baslat.sh <depo dışı çıktı dizini>`
   - vekil: en çok 30 sağlayıcı isteği (yeniden deneme, paralel, başarısız dahil); sayaç günlükten
     devam eder;
   - anahtar yalnızca `next start` sürecinin `AI_ANAHTAR`'ına alt kabukta export edilir; kaynak
     değişken ve `OPENAI_*` silinir;
   - modeller sabit: `claude-sonnet-5`, `claude-haiku-4-5-20251001`.
6. `STUDYO_DERLEME=uretim` ile stüdyo kabulü ve uçtan uca zincir:
   kayıt → doğrulama → ilk şifre → çalışma → DOI → PDF → AI → atıf/kaynakça → Word/PDF →
   yeniden giriş → veri bütünlüğü. Vekil sınıra ulaşırsa kalan AI adımları UNVERIFIED yazılır;
   sınır artırılmaz.
7. Rapor şunları içerir:
   - aday SHA, `studyo-kabul-derleme.json`, şema özeti;
   - vekil günlüğü (sıra, model, durum, jeton; başlık ve metin yok);
   - toplam istek sayısı ve tahmini maliyet.
   Anahtar hiçbir dosyada, günlükte ya da commit'te olmaz; commit'ten önce
   `git grep -n "sk-ant"` boş dönmelidir.
8. Kabulden sonra kullanıcı değişkeni ortamdan siler ve test anahtarını iptal eder.
