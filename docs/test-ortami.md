# Güvenli test ortamı ve Supabase ortam güvenliği

Aşama 1 (05.11.2026). Kod hazır; **hiçbir ortama dağıtılmadı, hiçbir betik
çalıştırılmadı.** Bu belge, kodu kesinti olmadan devreye almanın sırasını
anlatır. Sıra önemlidir: kod, panel adımlarından ÖNCE önizlemeye giderse
önizleme derlemesi (bilerek) durur.

## Neden

Vercel'de Supabase adresi, publishable key ve sunucu gizli anahtarı
Production **ve** Preview için aynıydı. Her dal önizlemesi canlı
veritabanına bağlanıyordu. Önizlemede `OPENAI_API_KEY` ve `CRON_SECRET`
de üretim değerlerini alıyordu.

## Kural (kodda: `lib/supabase/ortam-guvenligi.ts`)

| Ortam | Kabul edilen bağlantı | Reddedilen |
|---|---|---|
| Preview, Development, yerel | Yalnızca `ARVOLAB_TEST_SUPABASE_REF` projesi; `ARVOLAB_SUPABASE_ORTAMI=test`; iki kimlik de tanımlı ve farklı. Yerel Supabase (localhost) yalnızca Vercel dışında. | Üretim projesi, bilinmeyen proje, eksik değişken (fail-closed) |
| Production | Adres `ARVOLAB_URETIM_SUPABASE_REF` projesi | Test projesi, bilinmeyen proje, etiket `test`, geçersiz kimlik biçimi |
| Production, kimlik henüz tanımlı DEĞİL | Bağlantı sürer, uyarı yazılır (geriye dönük uyumluluk) | — |
| Sahte önizleme (`ARVOLAB_ONIZLEME=1`, üretim dışı) | Gerçek bağlantı yok | — |

Ortam etiketi tek başına yetmez: adresteki **gerçek proje kimliği**
(`https://<kimlik>.supabase.co`) beklenen kimlikle karşılaştırılır.
Sunucu anahtarı eski (JWT) biçimdeyse anahtarın projesi de adresle
karşılaştırılır.

Üretim dışında `AI_ANAHTAR`, `OPENAI_API_KEY`, `RESEND_API_KEY`,
`CRON_SECRET` ya da `PRODUCT_BRIDGE_SECRET` tanımlıysa, Vercel'de
`ARVOLAB_TEST_ANAHTARLARI=1` ile "bunlar test anahtarı" diye beyan
edilmiş olmalı; yoksa derleme durur. Önerilen: önizlemede bu anahtarları
hiç tanımlamamak; AI denemesi gerekiyorsa ayrı, harcama sınırlı bir test
anahtarı ve beyan.

## Denetimin kapsadığı bağlantı yolları

1. **Derleme** (`next.config.ts`): ret → `next build` / `next dev` durur.
   Vercel'de başarısız dağıtım öncekini canlıda bırakır.
2. **Tarayıcı istemcisi** (`lib/supabase/client.ts`): derlemede gömülen
   gizli olmayan değerlerle aynı karar.
3. **Sunucu istemcisi** (`lib/supabase/server.ts`): her istemci kurulumunda.
4. **Servis anahtarlı yönetim istemcisi** (`lib/supabase/admin.ts`): karar
   + anahtar–proje uyumu. Cron, yetkilendirme, dışa aktarma, paylaşım,
   kayıt ve kota yolları buradan geçer.
5. **Ara katman** (`proxy.ts`): ret → 503, ayrıntı yalnızca sunucu günlüğünde.
6. **Migration ve betikler** (`scripts/supabase-hedef.mjs`): `db:push:test`,
   `test-ortami:kur`, `test-ortami:veri`. Üretime migration yalnızca
   `--uretim` + `ARVOLAB_URETIM_ONAYI="ÜRETİME UYGULA <üretim kimliği>"`;
   şema kurulumu ve sentetik veri üretimde hiçbir koşulda.

Birim testi `tests/unit/supabase-ortam-guvenligi.test.ts` istemci kuran
dosyaların bu dördüyle sınırlı kaldığını da denetler.

## Üretime test verisi yazılmasını önleyen kontroller

- Sentetik veri betiği üç kapıdan geçer: proje kimliği (test olmalı,
  üretim olmamalı), anahtarın projesi, veritabanındaki ortam işareti
  (`public.arvolab_test_ortami()` — yalnızca `kur.mjs` test projesinde
  oluşturur; üretimde yok).
- Kurulum betiği dolu bir veritabanına (academic_projects var) kurmaz.
- Test hesapları `arvolab-test-*@example.com`, `test_hesabi: true`; veriler
  `[TEST]` başlıklı ve `[test verisi]` notlu.
- Tasarım (uygulanmadı, migration ister): üretimde `@example.com`
  kayıtlarını reddeden bir Auth kancası.

## Kesintisiz devreye alma sırası

1. **[SİZ · Supabase]** `arvolab-test` projesini açın (üretimle aynı
   bölge). Auth → URL Configuration: Site URL = önizleme adresi;
   Redirect URLs = önizleme alan adı deseni, `http://localhost:3000/**`,
   `http://localhost:3123/**`. E-posta onayı kapalı ya da yerleşik e-posta;
   üretimin SMTP/Resend bilgileri GİRİLMEZ.
2. **[SİZ · kendi makineniz]** Test projesinin bağlantı adresi ve kimliklerle:
   `npm run test-ortami:kur` (psql gerekir). Ardından
   `TEST_HESAP_PAROLASI=… npm run test-ortami:veri`.
3. **[SİZ · Vercel]** Preview ve Development için (Production'a
   DOKUNMADAN) şunları **ekleyin**:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SECRET_KEY` → TEST projesinin değerleri;
   `ARVOLAB_SUPABASE_ORTAMI=test`; `ARVOLAB_TEST_SUPABASE_REF`;
   `ARVOLAB_URETIM_SUPABASE_REF`.
4. **[SİZ · Vercel]** Bugün Production + Preview hedefli olan Supabase
   üçlüsü, `OPENAI_API_KEY`, `CRON_SECRET` ve diğer paylaşılan değişkenleri
   düzenleyip hedefini yalnızca **Production** yapın (değer DEĞİŞMEZ).
   Önizlemede AI gerekiyorsa ayrı test anahtarı + `ARVOLAB_TEST_ANAHTARLARI=1`.
5. **[SİZ · Vercel]** Preview için Deployment Protection açık.
6. **[BEN, sizin onayınızla]** Kodu dala gönderirim → otomatik önizleme
   dağıtımı. Beklenen: derleme geçer, önizleme TEST projesine bağlanır.
   Duman testi + "önizleme üretime bağlanamıyor" negatif testi.
7. **[SİZ · Vercel]** Production'a yalnızca iki gizli olmayan değişken
   ekleyin: `ARVOLAB_SUPABASE_ORTAMI=uretim`,
   `ARVOLAB_URETIM_SUPABASE_REF=<üretim kimliği>` (isterseniz
   `ARVOLAB_TEST_SUPABASE_REF` de). Bu adım kod üretime gitmeden önce de
   sonra da güvenlidir: kod yokken değişkenler etkisiz; kod varken üretim
   zaten doğru projeye bağlı olduğu için karar "izin".
8. **[SİZ, ayrı onay]** main'e birleştirme ve üretim dağıtımı. Üretim
   derlemesi bir uyuşmazlık görürse durur ve önceki dağıtım canlıda kalır.

Geri dönüş: kod değişikliği tek commit dizisi; geri almak için önceki
dağıtıma dönmek yeterli. Değişken değişiklikleri Vercel panelinden
geri alınabilir; üretim değerleri hiçbir adımda değiştirilmez.

## Kapsanmayan riskler

- Opak (yeni biçim) Supabase anahtarlarının hangi projeye ait olduğu
  koddan doğrulanamaz; adres doğrulanır, anahtar–adres uyumsuzluğu
  Supabase'in kendisi tarafından reddedilir.
- Bir anahtarın üretim mi test mi olduğu değerinden anlaşılamaz;
  `ARVOLAB_TEST_ANAHTARLARI` bir beyandır.
- ArvoOS tarafındaki köprü üretim ArvoLab veritabanına kendi anahtarıyla
  yazar; bu denetim ArvoOS'u kapsamaz.
- Supabase panelinde (SQL Editor) elle yapılan işlemler bu denetimin dışında.
