# P52b-1 — PDF kayıt bütünlüğü ve güvenli telafi

Başlangıç: `174dbac` (design/os5). Denetim düzeneği: `denetim/p52b/` (P52b raporu).
Production/Test Supabase'e bağlanılmadı, migration uygulanmadı, ArvoOS'a dokunulmadı.

## Ne değişti

| Dosya | Değişiklik |
|---|---|
| `lib/kaynak-pdf-yolu.ts` (yeni, saf) | Depo yolunun TAM kalıbı: otomatik `<çalışma>/kaynak-pdf/<16hex>-<13 hane>.pdf`, yükleme `<çalışma>/kaynak-pdf/y-<kullanıcı>-<13 hane>.pdf`. Önek denetimi kalktı; `..`, `\`, `//`, büyük harf, fazladan bölüm, ek reddedilir. |
| `lib/kaynak-pdf-yazimi.ts` (yeni) | Koşullu yazma ve dosya temizliği: `otomatikSonucuYaz` (yoksa ekle → yalnızca hazır DEĞİLSE güncelle → oku), `yuklemeyiYaz` (okunan eski yola koşullu, ≤3 deneme), `sahipsizseSil` (kalıp + "hiçbir kayıt göstermiyor" doğrulaması; silinemeyen dosya `YETIM_DOSYA` iziyle, yoluyla günlüğe). |
| `app/actions/kaynak-pdf.ts` | `kaynakPdfleriniBul`: koşulsuz upsert yerine `otomatikSonucuYaz`; yazma düşerse ya da satır korunursa yalnızca bu çağrının dosyası temizlenir; ölü "eski yol silme" kaldırıldı. `kaynakPdfiYuklendi`: yol kullanıcıya ve çalışmaya bağlı kalıpta olmalı; başka künyenin gösterdiği dosya reddedilir; kayıt `yuklemeyiYaz` ile; yerine geçilen dosya ancak artık kimse göstermiyorsa silinir; kayıt düşerse yüklenen dosya telafi edilir. |
| `app/dashboard/citations/kaynak-pdf-satiri.tsx` | Yükleme yolu `yuklemeYolu(çalışma, oturumdaki kullanıcı)`. |
| `tests/unit/kaynak-pdf-yolu.test.ts`, `tests/unit/kaynak-pdf-yazimi.test.ts` | Kalıp ve karar testleri (17). |
| `tests/db/kaynak-pdf-kosullu-yazma.test.mjs` | PostgREST'in ürettiği koşullu SQL'in anlamı, Supabase rolleri ve RLS ile (5). |
| `denetim/p52b1/*` | Gerçek PG/PostgREST senaryoları, gerçek Storage kabulü, tarayıcı kabulü, sonuç JSON'ları. |
| `denetim/p52b/yigin/gecit.mjs` | Yalnızca test altyapısı: `/storage/v1` yönlendirmesi ve CORS. |

Migration YOK. Arayüz akışı aynı: "PDF'leri bul", "PDF yükle", "Değiştir", "PDF'i aç", "Kaynağa sor".

## Neden migration gerekmedi

PostgREST upsert'ü WHERE taşıyamıyor; koşul iki ayrı ama her biri atomik ifadeyle kuruldu:
1. `INSERT … ON CONFLICT (project_id, kunye_anahtari) DO NOTHING` — satır varsa hiçbir şey yazılmaz.
2. `UPDATE … WHERE … AND NOT (durum IN ('indirildi','yuklendi'))` — Postgres satırı kilitler ve
   READ COMMITTED'da koşulu kilit sonrası GÜNCEL sürüme göre yeniden değerlendirir.

S0a bunu iki gerçek oturumla ölçer: öğrencinin yüklemesi satırı tutarken otomatik aramanın
koşullu UPDATE'i 1,2 sn BEKLER ve 0 satır günceller; aynı yarışta koşulsuz UPDATE (eski kodun
upsert'i) yüklemeyi ezer (S0a-kontrol). S0b aynı yarışı supabase-js → PostgREST → PG yolundan
kurar: `otomatikSonucuYaz` → `korundu`.

**Kalan dar pencere (isteğe bağlı migration, UYGULANMADI):** iki ayrı künye satırının aynı
`depo_yolu`'nu göstermesi uygulamada iki yerden engelleniyor (yükleme ön denetimi ve
`sahipsizseSil`'in "kimse göstermiyor" şartı), ama veritabanında kısıt yok: oturum jetonuyla
PostgREST'e doğrudan yazan biri bunu kurabilir (S6b). O durumda bile BAŞKA künyenin dosyası
silinmiyor (S6b, G5 PASS). Tam kapatmak için önerilecek migration:
`create unique index on public.kaynak_pdfleri (depo_yolu) where depo_yolu is not null;`
— öncesinde canlıda çakışan satır olmadığı salt okunur sorguyla doğrulanmalı. Bu PR'da yok.

## Senaryolar — önce (3d02235) / sonra

Gerçek Postgres 17 + PostgREST v12 + GoTrue, RLS gerçek. **Storage SAHTE** (bellekte, hata
enjeksiyonlu): bu tablodaki depo sonuçları gerçek Storage kabulü DEĞİLDİR; gerçek Storage için
aşağıdaki G tablosu.

| # | Senaryo | Önce | Sonra |
|---|---|---|---|
| S0a | DB: kilitli satırda koşullu UPDATE bekler, 0 satır | PASS¹ | PASS |
| S0b | DB+PostgREST: `otomatikSonucuYaz` kilitli yükleme karşısında `korundu` | — (modül yok) | PASS |
| 1 / S1 | Kullanıcı yüklerken otomatik bulma | **FAIL** (yükleme "erisilemedi" ile ezildi) | PASS |
| 2 / S2 | İki eşzamanlı otomatik indirme | **FAIL** (2 dosya, 1 yetim) | PASS (1 kayıt, 1 dosya) |
| 3 / S3 | Başarılı kayıttan sonra geciken başarısız istek | **FAIL** ("indirildi" ezildi) | PASS |
| 4 / S4a | Otomatik: depo ✓, DB ✗ | **FAIL** (yetim) | PASS (hata + temizlik) |
| 4 / S4b | Yükleme: depo ✓, DB ✗ | **FAIL** (yetim) | PASS |
| 4 / S4c | DB ✗ ve telafi silmesi de ✗ | **FAIL** (telafi yok) | PASS (hata döner, yol `YETIM_DOSYA` izinde) |
| 5 / S5a | DB ✓, eski dosya temizliği ✗ | **FAIL** (sessiz yetim) | PASS (yeni kayıt geçerli, eski yol izde) |
| 5 / S5b | Değiştirirken DB ✗ → eski PDF yerinde | **FAIL** (yeni dosya yetim) | PASS |
| 6 / S6a | A'nın yüklemesine B'nin yolu | **FAIL** (B'nin PDF'i silindi) | PASS (reddedildi) |
| 6 / S6b | A'nın kaydı API'den B'nin yoluna çevrilir, A değiştirilir | **FAIL** (B'nin PDF'i silindi) | PASS |
| 6 / S6c | `..`, `\`, `//`, büyük harf, başka çalışma, otomatik kalıp, başka kullanıcı, ek | **FAIL** (7/10 kabul) | PASS (10/10 depoya dokunmadan red) |
| 7 / S7a | Yabancı kullanıcı okuyamaz/yazamaz, iz bırakmaz | **FAIL**² | PASS |
| 7 / S7b | Başkasının yüklemesini kendi künyesine bağlama | **FAIL** | PASS |
| 8 / S8a | Telafi sırasında dosyayı başka kayıt sahiplendi | PASS³ | PASS |
| 8 / S8b | "PDF değil" temizliği başka kaydın dosyasını silmez | **FAIL** | PASS |
| 9 / S9a | Dizin ağ hatası → tekrar | PASS³ | PASS |
| 9 / S9b | PostgREST yazması ağda düştü → tekrar | **FAIL** (yetim) | PASS |
| 9 / S9c | PostgREST tamamen kesik (telafi okuması da düşer) → tekrar | **FAIL** (sessiz yetim) | PASS (silinmez, yol izde, tekrar başarılı) |
| 10 / S10a–c | Tekrar çağrılarda idempotentlik | PASS³ | PASS |

¹ DB davranışı, kodla ilgisiz; S0a-kontrol koşulsuz yazmanın ezdiğini gösteriyor.
² Sahte depo RLS'siz; gerçek depoda yabancının yüklemesi politikayla reddediliyor (G6).
³ Eski kodda bu senaryonun hatası yoktu: S8a'da eski kodun telafisi hiç olmadığı için silecek bir şey de yoktu (koruma telafinin kendisini sınıyor); S9a ve S10 eski kodda da doğruydu. Gerileme koruması olarak duruyorlar.

Önce: 7/23 PASS · Sonra: 24/24 PASS (`sonuclar/eski.json`, `sonuclar/yeni.json`).

## Gerçek Storage kabulü (supabase/storage-api v1.11.13, yerel)

Storage API'nin kendi RLS uygulaması, proje migration'larındaki politikalarla (`calisma_klasoru`,
`can_write_project`, `subscription_open`). `kur-gercek-depo.sh` + `gercek-depo.mjs`.

| # | Senaryo | Önce | Sonra |
|---|---|---|---|
| G1 | Meşru yükleme + değiştirme; eski nesne silindi | PASS | PASS |
| G2 | Eşzamanlı iki otomatik indirme | **FAIL** (2 nesne, 1 yetim) | PASS |
| G3 | Kullanıcı yüklerken otomatik arama | **FAIL** (yükleme ezildi) | PASS |
| G4 | DB ✗ → yüklenen nesne temizlendi | **FAIL** (yetim nesne) | PASS |
| G5 | A/B yol saldırısı | **FAIL** (B'nin nesnesi silindi) | PASS |
| G6 | Yabancı: yükleyemez, indiremez, silemez; eylem reddeder | PASS | PASS |
| G7 | Eski istemcinin yolu (`y-<zaman>.pdf`) | kabul (beklenen) | reddedilir, nesne yetim kalır (bkz. riskler) |

## Tarayıcı kabulü (gerçek Next + gerçek Storage)

`tarayici-kabul.mjs`: Kaynakça penceresi, gerçek tarayıcı istemcisi.

| # | Senaryo | Önce | Sonra |
|---|---|---|---|
| T1 | PDF yükle → `yuklendi`, kullanıcıya bağlı yol | FAIL (eski yol biçimi — beklenen) | PASS |
| T2 | Değiştir → eski nesne silindi, yetim yok | PASS | PASS |
| T3 | PDF'i aç → imzalı bağlantı PDF döndürüyor | PASS | PASS |
| T4 | DB düşerken Değiştir → hata bildirimi, eski PDF yerinde, yeni nesne temizlendi | **FAIL** (yetim nesne) | PASS |

## DB / Storage tutarlılık matrisi

| Durum | Kayıt | Yeni dosya | Eski dosya | Kullanıcıya |
|---|---|---|---|---|
| Otomatik: indirme ✓, yazma ✓ | yeni/güncel | kayıtlı | (hazır olmayan satırın dosyası yok) | başarı |
| Otomatik: satır arada hazır oldu | DOKUNULMADI | sahipsizse silinir | — | güncel (hazır) satır |
| Otomatik: yazma ✗ | değişmedi | sahipsizse silinir; silinemezse `YETIM_DOSYA` | — | hata |
| Yükleme: yazma ✓, eski silme ✓ | yeni | kayıtlı | silindi | başarı |
| Yükleme: yazma ✓, eski silme ✗ | yeni | kayıtlı | kalır, `YETIM_DOSYA` | başarı (veri kaybı yok; temizlik içsel) |
| Yükleme: yazma ✗ / 3 kez yarış | eski hâli | sahipsizse silinir; silinemezse `YETIM_DOSYA` | yerinde | hata |
| Yükleme: yol başka künyede | değişmedi | dokunulmaz | yerinde | hata |
| Yol kalıp dışı | değişmedi | dokunulmaz | yerinde | hata ("sayfayı yenileyin") |
| Kullanım okunamadı (ağ) | — | silinmez, `YETIM_DOSYA` | — | hata |

Kural: eski PDF yalnızca yeni PDF'in kaydı yazıldıktan SONRA ve yalnızca artık hiçbir kayıt onu
göstermiyorsa silinir.

## Kalan riskler ve UNVERIFIED

- **UNVERIFIED — barındırılan Supabase Storage.** Gerçek Storage kabulü yerel storage-api v1.11.13 ile yapıldı; barındırılan sürüm ve ayarlar (Production/Test) sınanmadı.
- **UNVERIFIED — yetim taraması.** Yetim dosyalar `[kaynak-pdf] YETIM_DOSYA` iziyle, yoluyla günlüğe yazılıyor; kalıcı tarama ve temizlik P52b-2'de. Bu PR'da yalnızca raporlanabilirlik var.
- **Dağıtım geçişi:** dağıtımdan önce açılmış bir sekme eski biçimde yol üretir. Yükleme "Dosya yolu geçersiz. Sayfayı yenileyip yeniden yükleyin." ile reddedilir ve yüklenen nesne yetim kalır (G7). Veri kaybı yok.
- **Aynı yolu iki satır:** yalnızca doğrudan API kurcalamasıyla kurulabilir, başka künyenin dosyasını sildiremez; tam kapatma isteğe bağlı unique index (yukarıda, uygulanmadı).
- **Üç denemede yarış:** aynı künyeye art arda üç yükleme yarışırsa dördüncü "Kaydedilemedi" alır ve kendi dosyası temizlenir; kullanıcı yeniden yükler.
- `denetim/p52b/butunluk.mjs` (P52b denetimi) eski yol biçimini kullanıyor; yeni kodda ölçtüğü bulguların karşılığı `denetim/p52b1/senaryolar.mjs`.

## Nasıl koşulur

```
denetim/p52b1/kur-gercek-depo.sh            # PG17 + GoTrue + PostgREST + storage-api (docker, 127.0.0.1)
node denetim/p52b/yigin/gecit.mjs &
node --import ./denetim/p52b/taklit/yukleyici.mjs denetim/p52b1/senaryolar.mjs
node --import ./denetim/p52b/taklit/yukleyici.mjs denetim/p52b1/gercek-depo.mjs
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54401 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon JWT> \
  SUPABASE_SERVICE_ROLE_KEY=<service JWT> npx next dev -p 3125
node --import ./tests/register.mjs denetim/p52b1/tarayici-kabul.mjs http://localhost:3125
```
Eski kod için: `git worktree add ../eski 3d02235`, `denetim/p52b1/*.mjs` kopyalanıp aynı komutlar.
