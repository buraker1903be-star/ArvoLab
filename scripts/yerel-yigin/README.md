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
| `kur-depo.sh [hariç.sql …]` | `kur.sh` + storage-api (55000) ve özel `project-files` kovası: dosya isteyen akışlar (kaynak PDF'leri) için. Argüman olarak verilen migration atlanır (Production benzeri şema: `scripts/uzlastirma/prova.sh`). |
| `gecit.mjs` | Tek adres `127.0.0.1:54401`: `/auth/v1` → GoTrue, `/rest/v1` → PostgREST, `/storage/v1` → storage-api. `/__gecit/kanca`: eşleşen ilk isteğin cevabı dönmeden önce başka bir oturumun isteğini çalıştırır (yedekle yazma arasındaki yarışı belirlenimci kurmak için). |
| `kayit-butunlugu.mjs <yeni\|eski>` | 14 senaryo; `lib/metin-yazimi.ts`'i (sunucu eylemlerinin kodu) gerçek PostgREST'e karşı koşturur. `eski` = 97a2943'teki eylem gövdelerinin birebir aktarımı. |
| `kimlik-kabul.mjs <adres>` | Gerçek Next + GoTrue: mevcut kullanıcı, Ayarlar'da mevcut şifre (yanlış/doğru), 12 karakter, diğer oturumların düşmesi, kurtarma, kurtarma sayfası atlatması, davetli kapısı (proxy + panel dışından sunucu işlemi), kayıt, telefon/masaüstü. Sonuç `sonuclar/kimlik-kabul.json`. |
| `sentetik-pdf.mjs` | Bağımlılıksız, metni bilinen PDF üretici (tek/iki sütun). |
| `model-taklidi.mjs` | OpenAI uyumlu yerel model taklidi (54900); asistan hattını (kapı, istem, doğrulama, kayıt) sağlayıcısız sınamak için. Cevap KALİTESİNİ ölçmez. Gelen istemleri `STUDYO_ISTEM_KAYDI`'na yazar. |
| `studyo-kabul.mjs <adres>` | Yazım Stüdyosu: PDF uç noktasının yetkisi, editör + PDF yan yana, sayfa/yakınlaştırma/arama, panel genişliği, AI paneliyle çakışma, seçim doğrulaması (uydurma/yanlış sayfa/kısa/sayfa aşan), DOI ile kesin / belirsiz / eşleşmeyen kaynak, atıf ekleme, otomatik kayıt, asistan analizi (model taklidiyle), büyük PDF, yazdırma ve Word çıktısı, telefon. **`STUDYO_DERLEME=uretim|gelistirme` zorunlu**: işlem bildirimi o derlemeden okunur, üretimde sunucunun HTML'indeki BUILD_ID ile eşleşmezse koşu başlamaz (çıkış 2). Sonuç `sonuclar/studyo-kabul.json`; sınanan derleme (git HEAD, BUILD_ID, bildirim yolu ve SHA-256) `sonuclar/studyo-kabul-derleme.json`. |
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
| `kimlik-kabul.mjs` | 2/10 (`sonuclar/kimlik-kabul-eski-19ff715.json`) | 15/15 (`sonuclar/kimlik-kabul.json`) |

Eski kodda: şifreyle açılmış oturum `/reset-password`'ten mevcut şifresiz
şifre değiştirdi (K6); davetli şifre belirlemeden panele girdi (K8) ve
hesap silme işlemi panel dışı bir yoldan çalıştı (K9); kayıt şifre aldı ve
doğrulanan kullanıcı doğrudan panele düştü (K11). Ayarlar'da mevcut şifre
alanı olmadığı için K2–K5 ve K12 koşamadı.

Son kabul koşusu, Production/Test'teki uygulama sırasıyla: güncel design/os5
şeması önce, ardından üç G1 migration'ı SIRA DIŞI ve iki kez (tekrar
güvenli). Yeni işlev eklendikten sonra PostgREST şema önbelleği yenilenmeli
(burada `docker restart p52rest`; Supabase'te DDL olayıyla kendiliğinden):
yenilenmezse `ilk_sifre_gerekli` "bulunamadı" döner ve ilk şifre kapısı
tasarım gereği AÇIK kalır (kimse kilitlenmez ama kapı da çalışmaz).

G1 tetikleyicisi ve yönetici API'si: GoTrue v2.197.0 yönetici kaydını tek
işlemde açıp onaylıyor ve şifre verilmese de rastgele bir özet yazıyor.
Tetikleyici onay anında bu özeti (ve yöneticinin verdiği şifreyi) siler;
hesap ilk şifreye düşer. Bilerek böyle (gerekçe:
`tests/db/eposta-onayi-kimlik.test.mjs`). Panelden şifreyle açılan hesap
"şifremi unuttum" ile şifresini belirler (K13). Betik mevcut kullanıcıyı bu
yüzden önce onaylı açıp şifreyi ayrı bir güncellemeyle koyar.

## 16.11.2026 sonucu (Yazım Stüdyosu: PDF + Arvo AI)

`studyo-kabul.mjs`: 43/43 PASS (`sonuclar/studyo-kabul.json`). Koşturma:

```bash
scripts/yerel-yigin/kur-depo.sh
node scripts/yerel-yigin/gecit.mjs &
STUDYO_ISTEM_KAYDI=/tmp/istem.jsonl node scripts/yerel-yigin/model-taklidi.mjs &
PDF_ISLEM_SAATLIK=12 AI_TABAN_URL=http://127.0.0.1:54900/v1 AI_MODEL=taklit \
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54401 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon JWT> \
  SUPABASE_SERVICE_ROLE_KEY=<service_role JWT> npx next dev -p 3124
PDF_ISLEM_SAATLIK=12 STUDYO_ISTEM_KAYDI=/tmp/istem.jsonl STUDYO_DERLEME=gelistirme node scripts/yerel-yigin/studyo-kabul.mjs http://localhost:3124
```

Kabul sırasında bulunup düzeltilenler: PDF paneli kapatılıp yeniden
açılınca görüntüleyici "PDF açılamadı" veriyordu (pdf.js işçisi belgeyle
birlikte yok ediliyordu); panel en genişe çekilince editör sütunu 420 yerine
392 px'e iniyordu (ayırıcı ve sütun aralığı hesaba girmiyordu); tek
sayfalık seçimde asistana gereksiz bir sayfa daha gidiyordu.

## 17.11.2026 sonucu (RELEASE CLOSURE 05)

`studyo-kabul.mjs`: 57/57 PASS (önceki 43 + yeni 14). Yeni senaryolar: PDF işlem
sınırı (R1: 12 yeni PDF kabul, 13. reddedilir; önbellekteki PDF sınırdan sonra
da çalışır; sınır dolunca kaynak sohbeti modele gitmez), sayaç arızası (R2:
`rate_limit_hit` yetkisi geçici alınır, işlem yapılmaz), 19 MB / 300 sayfa
PDF (R3: 10 eşzamanlı seçim tek çözümlemeye iner, sayaç +1, sıcak yanıt
~0,2 sn; önbellek kullanıcılar arasında sızmaz; görüntüleyicide açılış
~2,4 sn), PDF panelinin konumu (U1), asistan açıkken araç çubuğu (U2: 1440/
1280/1200 px, U3: 1024 px ve telefon; U4: sayfa aşağıdayken açılış, yukarı dönüş,
boyut değişimi ve kapat/aç — dört genişlikte, kendi kullanıcısıyla, K0'dan sonra). R3'ün
"tek çözümleme" iddiası yalnızca SÜREÇ İÇİNDE geçerli; her sunucu örneği kendi önbelleğini tutar.
`PDF_ISLEM_SAATLIK` next dev ile
kabul betiğine aynı verilmeli (varsayılan 60).

## 17.11.2026 sonucu (RC06e, `next build` + `next start`)

`STUDYO_DERLEME=uretim`: 67 PASS · 0 FAIL · 1 UNVERIFIED (U5-dokunma: dokunmatik kaydırma başsız
tarayıcıda üretilemiyor). Sınanan derleme `sonuclar/studyo-kabul-derleme.json`'da. Birleşik aday
kabulünde bu dosya, adayın commit SHA'sı ve şema özetiyle birlikte rapora geçer.
