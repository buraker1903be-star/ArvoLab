# Üretim uzlaştırması provası (P1)

Production (`zpfpocyajnxcketdjbxm`) şeması elle kuruldu, migration geçmişi
depoyla eşleşmiyor. Production'a dokunan her şema değişikliği önce burada,
**Production'ın birebir kopyası olan bir şemada, sentetik hesaplarla** sınanır.
CI'da koşmaz; gerçek bir Supabase projesine bağlanmaz (betik yalnızca
`127.0.0.1` adreslerini kabul eder). Kullanıcı verisi, şifre hash'i ya da
yedek indirilmez.

Mantığın CI'daki karşılığı: `tests/db/uretim-uzlastirma.test.mjs` (PGlite).
PGlite'ın göremediği iki şey burada sınanır: gerçek GoTrue'nun şifre/oturum
davranışı ve Production'ın dar yetki düzeni.

## Dosyalar

| Dosya | Ne |
|---|---|
| `katalog-ozeti.sql` | Salt okunur katalog özeti (fonksiyon/tetikleyici/politika/sütun/kısıt/dizin özetleri ve yetkiler). Production'da, Test'te ve P1'de AYNI sorgu. |
| `uretim-tanimlari.sql` | Production'ın tam fonksiyon gövdeleri ve yetkileri (salt okunur). Çıktısı `prodize.py`'nin girdisi; depoya konmaz. |
| `prodize.py` | Depo şemasını Production'a denk getiren SQL'i üretir (eksik nesneleri kaldırır, gövdeleri ve yetkileri Production'ınkiyle değiştirir). |
| `roller.sql`, `storage-kabugu.sql` | Supabase rollerinin ve storage şemasının yerel taklidi. |
| `sifirla.sh` | P1'i Production'a denk, sentetik hesapsız temel hâline döndürür. |
| `prova.mjs` | Senaryolar: R1 iki kez, KVKK, cron, koruma tetikleyicileri, `client` rolü, R3 (G1), eski hesapların şifre/onay/oturum korunumu, API duman testi, geri dönüş. |

## Adımlar

1. `docker` ile `postgres:17`, `supabase/gotrue:v2.197.0`, `postgrest/postgrest:v12.2.3`.
   Ağ `p1ag`; kapsayıcılar `p1db` (55432), `p1auth` (59999), `p1rest` (53000).
   Komutlar `sifirla.sh` içinde.
2. `roller.sql` → GoTrue'yu başlat (auth şemasını kendisi kurar) → `storage-kabugu.sql`
   → `supabase/schema.sql` ve `supabase/migrations/*.sql` (uzlaştırma dosyası HARİÇ).
3. Production'da `uretim-tanimlari.sql` (salt okunur) → `prodize.py <çıktı.json> prodize.sql` → P1'e uygula.
4. `katalog-ozeti.sql` P1'de ve Production'da; `prova.mjs` ilk adımda ikisini
   karşılaştırır ve fark varsa **2 ile çıkar** (P1 Production'a denk değilse prova anlamsızdır).
   Bilinçli kabul edilen tek fark: Production'a özgü akademik dizin hattı ve storage'ın platform nesneleri.
5. Temel hâlin dökümünü al (`pg_dumpall`; yalnızca sentetik), sonra:
   `node scripts/uretim-provasi/prova.mjs docs/uretim-duzeltmeleri/uretim-katalog-ozeti-20261112.json <test-ozeti.json> <cikti>`

Çıkış kodu: 0 hepsi PASS, 1 en az bir FAIL, 2 ön koşul yok.

## 12.11.2026 sonucu

33/33 PASS (temel hâlden temiz koşu). Provada bir gerçek hata yakalandı ve
düzeltildi: geri dönüş betiğinin ikinci koşusu, kaldırılmış sütunu statik
sorguladığı için düşüyordu (`tests/db/uretim-uzlastirma.test.mjs` artık bunu sabitliyor).
