# Güvenli test ortamı ve Supabase ortam güvenliği

Aşama 1 ve Durak 0 düzeltmeleri (05.11.2026). Kod hazır; **hiçbir ortama
dağıtılmadı, hiçbir betik bir Supabase projesine karşı çalıştırılmadı.** Bu
belge, kodu kesinti olmadan devreye almanın sırasını anlatır. Sıra önemlidir:
kod, panel adımlarından ÖNCE önizlemeye giderse önizleme derlemesi (bilerek)
durur.

## Neden

Vercel'de Supabase adresi, publishable key ve sunucu gizli anahtarı
Production **ve** Preview için aynıydı. Her dal önizlemesi canlı
veritabanına bağlanıyordu. Önizlemede `OPENAI_API_KEY` ve `CRON_SECRET`
de üretim değerlerini alıyordu.

## Güncel karar: tek proje (05.11.2026)

Kurum sahibi ayrı bir test projesi açmamaya karar verdi. Önizleme ve yerel
geliştirme bilerek ÜRETİM projesine (`zpfpocyajnxcketdjbxm`) bağlanıyor;
projede gerçek müşteri yok, iki deneme çalışması var. Kod bunu ancak açık
bir beyanla kabul eder:

| Değişken (Vercel, yalnızca **Preview**) | Değer |
|---|---|
| `ARVOLAB_TEK_PROJE` | `1` |
| `ARVOLAB_URETIM_SUPABASE_REF` | `zpfpocyajnxcketdjbxm` |

- Beyan yalnızca adres bu kimliği gösteriyorsa geçerli; kimlik tanımlı
  değilse ya da adres başka bir projeyi gösteriyorsa ret sürer.
- Beyan üretim anahtarlarının (OpenAI, cron) önizlemede kullanılmasını da
  kabul eder ve derleme günlüğüne uyarı yazar. Bu bir "test anahtarıdır"
  beyanı değildir.
- Betik kuralları değişmez: şema kurulumu ve sentetik veri üretimde hiçbir
  koşulda çalışmaz; üretime migration yine `--uretim` + onay cümlesi ister.
- İki değişken eklenmeden dala gönderilen kodun önizleme derlemesi bilerek
  durur (`uretim-disi-uretime-bagli`); canlı site etkilenmez.
- Önizlemede yapılan her işlem canlı veriye yazılır. Önizlemede gerçek
  hesaplarla deneme yapılmaz; tasarım doğrulaması yerel sahte önizlemede
  (`npm run onizleme`) yapılır.

Aşağıdaki test projesi planı, ileride ayrı bir test projesi açılırsa
geçerlidir; o gün `ARVOLAB_TEK_PROJE` Preview'dan kaldırılır.

### Migration geçmişi (05.11.2026, salt okunur ölçüm)

Üretimin `supabase_migrations.schema_migrations` tablosunda 12 kayıt var
(Ağustos 2026); depoda 104 migration var ve son migration'ın nesneleri
veritabanında mevcut. Migration'lar geçmiş kaydı tutulmadan uygulanmış.
Supabase GitHub entegrasyonunda "deploy to production" AÇILMAMALI: açılırsa
104 migration'ı yeniden uygulamaya kalkar. Yeni bir migration uygulamadan
önce geçmiş, gerçekte uygulanmış olanlarla eşitlenmeli (ayrı onayla).
Şema da depodan kurulana göre farklı: üretimde 50 tablo / 121 politika,
depodan kurulumda 47 / 122.

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

## Hangi ortamda olduğumuz nasıl anlaşılır (Durak 0)

Ortam Vercel'in `VERCEL_ENV` değişkeninden okunur. Değer iki yerden gelir:

- **Derleme anı:** `next build` sırasındaki `VERCEL_ENV`. Derleme denetimi
  onunla karar verir ve değer koda gömülür (`ARVOLAB_DAGITIM_ORTAMI`,
  `next.config.ts` → `env`).
- **Çalışma anı:** sunucu, yönetim istemcisi ve ara katman o anki
  `VERCEL_ENV`'e bakar; yoksa gömülü değeri yedek olarak kullanır.

Eskiden yalnızca çalışma anındaki değere bakılıyordu: o değer bir gün
gelmeseydi üretim kendini önizleme sanacak, test yapılandırması arayacak ve
her isteğe 503 dönecekti. Önizleme bu hatayı gösteremezdi; orada "yok" ile
"preview" aynı sonucu verir.

### Eksik ya da çelişkili yapılandırma

| Çalışma anı `VERCEL_ENV` | Derlemede gömülü | Karar |
|---|---|---|
| `production` | `production` | Üretim kuralları |
| yok | `production` | Üretim kuralları (yedek) — eskiden 503 |
| `preview` / `development` | aynısı | Üretim dışı kuralları |
| yok | `preview` / `development` | Üretim dışı kuralları (yedek) |
| yok | yok | Üretim dışı (yerel geliştirme); yerel Supabase serbest |
| **farklı** (ör. `preview` / `production`) | — | **RET** (`dagitim-ortami-celiskili`): paket başka bir ortam için derlenmiş, hangi tarafın doğru olduğu bilinemez; 503, sunucu günlüğünde nedeni |
| herhangi bir Vercel değeri + yerel Supabase adresi | | RET (`yerel-supabase-vercelde`) |

Boş metin "yok" sayılır. Yedek, kuralları gevşetmez: üretim için derlenmiş
bir paket test projesine bağlıysa yine reddedilir. Bu davranış üretim
derlemesiyle (`next build` + `next start`) uçtan uca denendi: çalışma
anında `VERCEL_ENV` yokken 200, `preview` iken 503 (çelişki), `production`
iken 200.

`next start` evresinde `next.config.ts` denetim YAPMAZ: o dosya gömülü
değeri göremiyor ve çalışma anı kararıyla ayrışıyordu (üretim paketi
`VERCEL_ENV`'siz başlatılınca açılmayı reddediyordu). Çalışma anının tek
sahibi yedeği gören üç yol. Vercel bu dosyayı çalışma anında zaten
çalıştırmaz.

## Denetimin kapsadığı bağlantı yolları

1. **Derleme ve `next dev`** (`next.config.ts`): ret → `next build` /
   `next dev` durur. Vercel'de başarısız dağıtım öncekini canlıda bırakır.
2. **Tarayıcı istemcisi** (`lib/supabase/client.ts`): derlemede gömülen
   gizli olmayan değerlerle aynı karar.
3. **Sunucu istemcisi** (`lib/supabase/server.ts`): her istemci kurulumunda,
   derleme yedeğiyle.
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

## Test projesi kurulumu ve migration geçmişi (Durak 0)

`npm run test-ortami:kur` (kur.mjs → `scripts/test-ortami/kurulum.mjs`):
hedef denetimi, boş veritabanı denetimi, `schema.sql`, `project-files`
kovası, ardından her migration **Supabase CLI'ın geçmiş tablosuna
(`supabase_migrations.schema_migrations`) kaydıyla birlikte, tek işlemde**.

Eskiden geçmiş yazılmıyordu: kurulumdan sonraki ilk `npm run
db:push:test` tabloyu boş görüp 104 migration'ın hepsini yeniden uygulamaya
kalkar ve ilk `create table`'da düşerdi. Artık kurulumun son adımı geçmişi
dosyalarla karşılaştırır; tek bir bekleyen ya da fazladan sürüm varsa durur.

Sınandığı yerler (hiçbiri bir Supabase projesine bağlanmaz):

- `tests/db/test-ortami-kurulum.test.mjs` (CI): gerçek kurulum çekirdeği
  PGlite'ta; 104 kayıt, bekleyen yok, yeni migration yalnızca kendisi
  bekleyen, ikinci kurulum reddedilir, migration düşerse kaydı da yazılmaz.
- Tek seferlik (05.11.2026): yerel Postgres 16 + kur.mjs'in psql yürütücüsü
  + gerçek Supabase CLI (2.122) `db push --dry-run` → "Remote database is
  up to date". Geçmişi boşaltılmış aynı şemada CLI 104 migration'ı yeniden
  uygulamaya kalkıyor (eski davranış).

Kurulum yarıda hata verirse betik ikinci kez kurmayı reddeder (dolu
veritabanı). En temiz çözüm: boş test projesini silip yeniden açmak.

## Üretime test verisi yazılmasını önleyen kontroller

- **Kodda sabit üretim kimliği** (`SABIT_URETIM_SUPABASE_REF`,
  `lib/supabase/ortam-guvenligi.ts`, 05.11.2026): ortam değişkenlerinden
  bağımsızdır. `ARVOLAB_TEST_SUPABASE_REF` üretimi gösteriyorsa (kimlikler
  yer değiştirmiş) her betik durur; adres, `--ref`, `NEXT_PUBLIC_SUPABASE_URL`
  ya da `supabase link` dosyasından biri üretimi gösteriyorsa şema kurulumu
  ve sentetik veri durur. `kur.mjs` ve `sentetik-veri.mjs` aynı denetimi
  hedef kararından ayrı olarak bir kez daha yapar. Üretime migration
  yalnızca eski açık yoldan (doğru değişkenler + `--uretim` + onay cümlesi)
  gider. Eskiden kimlikler yer değiştirince üretim "test" sayılıyordu ve
  zararı yalnızca dolu veritabanı / ortam işareti denetimleri önlüyordu.
  Not: makinede eski bir `supabase link` üretime bağlıysa kurulum da
  durur; `supabase/.temp/project-ref` dosyasını kontrol edin.
- Sentetik veri betiği üç kapıdan geçer: proje kimliği (test olmalı,
  üretim olmamalı), anahtarın projesi, veritabanındaki ortam işareti
  (`public.arvolab_test_ortami()` — yalnızca kurulum betiği test projesinde
  oluşturur; üretimde yok).
- Kurulum betiği dolu bir veritabanına (academic_projects var) kurmaz.
- Test hesapları `arvolab-test-*@example.com`, `test_hesabi: true`; veriler
  `[TEST]` başlıklı ve `[test verisi]` notlu.
- Tasarım (uygulanmadı, migration ister): üretimde `@example.com`
  kayıtlarını reddeden bir Auth kancası.

## Vercel'in değişken kuralları (geçiş sırasını bunlar belirler)

- **Aynı ad aynı ortamda iki kez olamaz.** Bugün Supabase üçlüsü
  Production + Preview hedefli tek kayıt; Preview'a test değeri eklemek
  için ÖNCE mevcut kayıttan Preview işareti kaldırılmalı. (Belgenin ilk
  sürümü test değerlerini önce eklemeyi söylüyordu; Vercel bunu "zaten
  var" diye reddeder.)
- **Değişken değişikliği çalışan dağıtımı etkilemez**, yalnızca sonraki
  dağıtımı. Yeniden dağıtım (Redeploy) yapılmadıkça canlı site aynı
  değerlerle çalışır.
- Projedeki değişkenlerin hepsi **Sensitive**: değer sonradan görüntülenemez
  ve Sensitive değişken Development ortamına verilemez.
- Preview zaten Vercel Authentication ile korumalı ("custom domain dışında
  hepsi").

Bugünkü Production listesi (05.11.2026, yalnızca adlar): **12 değişken.**
Yalnızca Production: `AI_ANAHTAR`, `AI_MODEL`, `AI_MODEL_LITERATUR`,
`AI_TABAN_URL`, `RESEND_API_KEY`, `ARVOOS_BRIDGE_URL`,
`PRODUCT_BRIDGE_SECRET`. Production + Preview (daraltılacak):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`, `CRON_SECRET`, `OPENAI_API_KEY`.

## Kesintisiz devreye alma sırası

Her ⏸ işaretinde durulur ve onay alınır.

1. **[SİZ · Supabase]** `arvolab-test` projesini açın (üretimle aynı
   bölge). Auth → URL Configuration: Site URL `http://localhost:3000`;
   Redirect URLs `http://localhost:3000/**`, `http://localhost:3123/**`,
   `https://arvo-lab-*-arvo-os.vercel.app/**`. E-posta onayı kapalı;
   üretimin SMTP/Resend bilgileri GİRİLMEZ.
2. **[SİZ · kendi makineniz]** Depoyu yedekten geri yükleyin; test
   projesinin "Session pooler" bağlantı adresi ve iki kimlikle
   `npm run test-ortami:kur` (psql gerekir), ardından
   `TEST_HESAP_PAROLASI=… npm run test-ortami:veri`.
   **Kontrol:** "Kurulum tamam … 104 migration" ve özet satırında
   `geçmiş` = 104. ⏸
3. **[SİZ · Vercel] Önce fotoğraf.** Settings → Environment Variables,
   süzgeç "Production": 12 değişken (yukarıdaki liste). Bu listeyi not
   edin. İsterseniz bana "kontrol et" deyin, değer okumadan (yalnızca ad ve
   hedef) aynı listeyi doğrularım.
4. **[SİZ · Vercel] Daraltma.** Production + Preview olan beş değişkenin
   her birinde ⋯ → Edit → yalnızca **Preview** işaretini kaldırın;
   **Production işaretli kalsın, değere dokunmayın** → Save.
   - Pencere değeri yeniden girmenizi isterse: İPTAL edin, durun, bana
     yazın (özellikle `CRON_SECRET`'ın değeri hiçbir yerden geri alınamaz).
   - Delete'e basmayın; Redeploy'a basmayın.
   **Kontrol (her değişkenden sonra):** süzgeç "Production" → hâlâ 12;
   süzgeç "Preview" → bu beşi yok. lab.arvo-os.com normal açılıyor
   (değişiklik çalışan dağıtımı etkilemez). Bir şey eksikse: aynı
   değişkende Edit → Production'ı yeniden işaretleyin. ⏸
5. **[SİZ · Vercel] Preview'a test değerleri.** Add New, Environment
   yalnızca **Preview**:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SECRET_KEY` (Sensitive) → TEST projesinin değerleri;
   `ARVOLAB_SUPABASE_ORTAMI=test`; `ARVOLAB_TEST_SUPABASE_REF`;
   `ARVOLAB_URETIM_SUPABASE_REF`. AI, e-posta, cron eklenmez; Development
   seçilmez (yerel çalışma `.env.local` ile).
   **Kontrol:** süzgeç "Preview" → tam bu 6; süzgeç "Production" → hâlâ
   12 ve değişmemiş. ⏸
6. **[SİZ · Vercel]** Settings → Deployment Protection: Vercel
   Authentication açık (bugün açık; yalnızca bakın).
7. **[BEN, ayrı onayla]** Kodu dala gönderirim → otomatik önizleme
   dağıtımı. Beklenen: derleme geçer, önizleme TEST projesine bağlanır.
   Duman testi + "önizleme üretime bağlanamıyor" negatif testi. ⏸
8. **[SİZ · Vercel]** Production'a yalnızca gizli olmayan üç değişken:
   `ARVOLAB_SUPABASE_ORTAMI=uretim`,
   `ARVOLAB_URETIM_SUPABASE_REF=<üretim kimliği>`,
   `ARVOLAB_TEST_SUPABASE_REF=<test kimliği>`. Redeploy yok.
   Bu adım kod üretime gitmeden önce de sonra da güvenlidir: kod yokken
   değişkenler etkisiz; yanlış yazılırsa yalnızca sonraki üretim derlemesi
   durur ve canlı sürüm yerinde kalır.
   **Kontrol:** süzgeç "Production" → 15. ⏸
9. **[SİZ, ayrı onay]** Güvenlik commit'lerinin main'e bağımsız taşınması
   (aşağıdaki plan), main'e birleştirme ve üretim dağıtımı. Üretim
   derlemesi bir uyuşmazlık görürse durur ve önceki dağıtım canlıda kalır.
   Önizleme dağıtımını "Promote to Production" ile üretime TAŞIMAYIN;
   üretime çıkış yalnızca main üzerinden.

Geri dönüş: kod değişikliği tek commit dizisi; geri almak için önceki
dağıtıma dönmek yeterli. Değişken değişiklikleri Vercel panelinden
geri alınabilir; üretim değerleri hiçbir adımda değiştirilmez.

## Güvenlik değişikliklerinin main'e bağımsız taşınması

Bu dal (`claude/signature-os-phase-1`) main'in önünde ve tamamlanmamış
Signature OS commit'lerini taşıyor; dalı main'e birleştirmek tasarımı da
üretime çıkarır. Güvenlik değişiklikleri dört commit ve Signature OS'a
bağımlı değil:

```
git switch -c guvenli-test-ortami origin/main
git cherry-pick 9a093dd 6f4bb32 f0e6dc0 <Durak 0 commit'i>
```

Tek çakışma `next.config.ts`'te ve mekanik: main'de sahte önizleme
takmaları satır içinde (`ONIZLEME` + `resolveAlias`), bu dalda
`lib/onizleme-takmalari.ts`'ten geliyor (Signature OS 4.3). Çözüm: main'in
takma kodunu OLDUĞU GİBİ bırakıp yalnızca güvenlik parçalarını eklemek —
ortam modülünün içe aktarımı, `DENETLENEN_EVRELER` + `ortamDenetimi()`,
`env` bloğu ve `export default function yapilandirma(evre)`. Ardından:
`npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm run test:db`.
Bu plan 05.11.2026'da main üzerinde geçici bir çalışma kopyasında prova
edildi (sonuç rapordadır); main'e hiçbir şey yazılmadı.

## Ortak dizin kotası ortama göre (DOI kotası, 07.11.2026)

Kaynaklar araması, DOI ile künye getirme (`lookupDoi`) ve toplu DOI ekleme
(`doiIleEkle`) kullanıcı başına AYNI saatlik 60 hakkı paylaşır
(`lib/dizin-kotasi-kurali.ts`, sayaç `rate_limit_hit`, anahtar
`literatur-arama:<kullanıcı>`). Hak yalnızca dış dizine gidecek istek için
ve istekten ÖNCE düşer. Sayaç servis anahtarıyla çağrılır; anahtar yoksa
ya da sayaç hata verirse davranış ortama göre değişir:

| Ortam | `VERCEL_ENV` / `ARVOLAB_DAGITIM_ORTAMI` | Sayaç yok / hata verirse |
|---|---|---|
| Üretim | `production` | **Dış istek gönderilmez** ("hak denetlenemedi"). Fail-closed. |
| Vercel Preview (Test) | `preview` | İstek gider, günlüğe `[dizin-kotasi] üretim dışı ortam` uyarısı. Servis anahtarı tanımlıysa sayaç GERÇEKTEN çalışır ve 60 sınırı uygulanır. |
| Yerel geliştirme | (yok) | İstek gider, günlüğe uyarı. |
| Sahte önizleme (`npm run onizleme`) | (yok) | Servis anahtarı hiç yok: her deneme uyarı yazar; kabul betiği (`scripts/onizleme/doi-kotasi-kabul.mjs`) hak denemelerini bu satırlardan sayar. Ağ kapalı olduğundan dış istek "Crossref'e ulaşılamadı" ile döner. |
| Çelişki | iki değer farklı | ÜRETİM sayılır (fail-closed). |

Üretimdeki davranış bilerek gevşetilmedi: eskiden Kaynaklar araması sayaç
olmadan üretimde de açık geçiyordu. Üretim dışındaki açıklık yalnızca
geliştirmenin denenebilmesi için; Preview'da sınır sınanacaksa servis
anahtarının Preview kapsamında tanımlı olduğu dağıtımdan önce doğrulanır.

Yerelde gerçek sayaçla sınanamayanlar ve neden: servis anahtarını yerel
sunucuya vermek bütün isteklerini servis rolüne yükseltir; bu yüzden
60 sınırı, eşzamanlı sayım ve üretimde fail-closed yerelde birim
(`tests/unit/dizin-kotasi`, `doi-sorgu`, `toplu-doi`) ve veritabanı
(`tests/db/dizin-kotasi.test.mjs`, PGlite: sorgular sıralı işler, gerçek
eşzamanlı bağlantı ölçülmez) testleriyle sınanır.

## Kapsanmayan riskler

- Opak (yeni biçim) Supabase anahtarlarının hangi projeye ait olduğu
  koddan doğrulanamaz; adres doğrulanır, anahtar–adres uyumsuzluğu
  Supabase'in kendisi tarafından reddedilir.
- Bir anahtarın üretim mi test mi olduğu değerinden anlaşılamaz;
  `ARVOLAB_TEST_ANAHTARLARI` bir beyandır.
- Production'da kimlik değişkenleri eklenene kadar (adım 8) yalnızca uyarı
  vardır; bu süre kısa tutulmalı.
- Test şeması depodaki `schema.sql` + migration'lardan kurulur; üretime
  panelden elle yapılmış bir değişiklik varsa test şeması onu içermez.
  Kurulum özetindeki sayılar üretimdeki salt okunur bir sayımla
  karşılaştırılarak sapma görülebilir.
- ArvoOS tarafındaki köprü üretim ArvoLab veritabanına kendi anahtarıyla
  yazar; bu denetim ArvoOS'u kapsamaz.
- Supabase panelinde (SQL Editor) elle yapılan işlemler bu denetimin dışında.
- Ayar yapılmamış bir makinede `npm run dev` açılmaz; yerelde test
  değişkenleri ya da `ARVOLAB_ONIZLEME=1` gerekir.
