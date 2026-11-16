# Yerel yığın: gerçek Postgres + PostgREST + GoTrue (P52a2)

Metin kaydının veri bütünlüğü (eşzamanlı oturumlar, eski sürümden yazma,
zorla kayıt, sürüm geri yükleme, yedek hatası) **gerçek** bir veritabanında
sınanır. PGlite (`tests/db/`) tek bağlantılı ve PostgREST'siz olduğu için
yarışları ve uygulamanın HTTP dizisini göremez. Önizlemenin sahte istemcisi
(`ARVOLAB_ONIZLEME=1`) de yazmaları uygulamaz.

**Gerçek bir Supabase projesine bağlanmaz.** Bütün adresler `127.0.0.1`; veri
ve hesaplar sentetik; JWT sırrı yalnızca bu yığına ait. CI'da koşmaz (docker
ister).

| Dosya | Ne |
|---|---|
| `kur.sh [hariç.sql …]` | Docker'da Postgres 17 (56432), GoTrue (59998), PostgREST (53001). `supabase/schema.sql` + bütün migration'lar. Argüman olarak verilen migration atlanır (düzeltmeden önceki davranışı yeniden üretmek için). |
| `roller.sql`, `kabuk.sql` | Supabase rollerinin, `auth.jwt()`'nin ve storage'ın en küçük taklidi. |
| `gecit.mjs` | Tek adres `127.0.0.1:54401`: `/auth/v1` → GoTrue, `/rest/v1` → PostgREST. `/__gecit/kanca`: eşleşen ilk isteğin cevabı dönmeden önce başka bir oturumun isteğini çalıştırır (yedekle yazma arasındaki yarışı belirlenimci kurmak için). |
| `kayit-butunlugu.mjs <yeni\|eski>` | 14 senaryo; `lib/metin-yazimi.ts`'i (sunucu eylemlerinin kodu) gerçek PostgREST'e karşı koşturur. `eski` = 97a2943'teki eylem gövdelerinin birebir aktarımı. |
| `kimlik-kabul.mjs <adres>` | Gerçek Next + GoTrue: mevcut kullanıcı, Ayarlar'da mevcut şifre (yanlış/doğru), 12 karakter, diğer oturumların düşmesi, kurtarma, kurtarma sayfası atlatması, davetli kapısı (proxy + panel dışından sunucu işlemi), kayıt, telefon/masaüstü. Sonuç `sonuclar/kimlik-kabul.json`. |
| `kayit-tarayici-kabul.mjs <adres>` | Gerçek Next uygulaması (`next dev`) yığına bağlıyken tarayıcıda: zorla kayıt (yedek düşerken ve meşru), sürüm geri yükleme (yarış ve meşru). |

## Koşturma

```bash
scripts/yerel-yigin/kur.sh                         # damga tetikleyicisi dahil
node scripts/yerel-yigin/gecit.mjs &
node --import ./tests/register.mjs scripts/yerel-yigin/kayit-butunlugu.mjs yeni

# Düzeltmeden önceki davranış (tetikleyicisiz veritabanı + eski yazma dizisi):
scripts/yerel-yigin/kur.sh 20261115203504_metin_surum_damgasi.sql
node --import ./tests/register.mjs scripts/yerel-yigin/kayit-butunlugu.mjs eski

# Tarayıcı: uygulamayı yığına bağla (anahtarlar sırdan üretilir, bkz. betiğin başı)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54401 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon JWT> \
  SUPABASE_SERVICE_ROLE_KEY=<service_role JWT> npx next dev -p 3124
node scripts/yerel-yigin/kayit-tarayici-kabul.mjs http://localhost:3124
```

Çıkış kodları: 0 hepsi PASS, 1 en az bir FAIL, 2 ön koşul yok.

`next dev` AGENTS.md'yi yeniden yazar; commit'ten önce `git checkout -- AGENTS.md`.

## 15.11.2026 sonucu

| | Eski kod, tetikleyicisiz | Yeni kod, tetikleyicisiz | Yeni kod + tetikleyici |
|---|---|---|---|
| `kayit-butunlugu.mjs` | 9/14 (S4, S5, S6, S7, S11 düşüyor) | 12/14 (S4, S11 tetikleyiciye bağlı) | 14/14 |
| `kayit-tarayici-kabul.mjs` | 2/4 (T1, T3: öteki sekmenin metni kayboluyor) | — | 4/4 |

## 16.11.2026 sonucu (G1 kimlik, RELEASE CLOSURE 03)

| | design/os5 `19ff715` (G1 yok) | Bu dal |
|---|---|---|
| `kimlik-kabul.mjs` | 2/10 (`sonuclar/kimlik-kabul-eski-19ff715.json`) | 13/13 (`sonuclar/kimlik-kabul.json`) |

Eski kodda: şifreyle açılmış oturum `/reset-password`'ten mevcut şifresiz
şifre değiştirdi (K6); davetli şifre belirlemeden panele girdi (K8) ve
hesap silme işlemi panel dışı bir yoldan çalıştı (K9); kayıt şifre aldı ve
doğrulanan kullanıcı doğrudan panele düştü (K11). Ayarlar'da mevcut şifre
alanı olmadığı için K2–K5 ve K12 koşamadı.

Not: G1 tetikleyicisi (`20261106184046`) onay anında, onaydan ÖNCE konmuş
şifreyi siler. GoTrue yönetici API'si `email_confirm: true` + `password` ile
açarken onayı ayrı bir güncellemeyle yazdığı için şifre de düşer; betik bu
yüzden şifreyi onaydan sonra koyar. Uygulama kodunda bu biçimde hesap açan
yol yok (kayıt ve davet şifreyi bağlantıdan sonra alıyor).
