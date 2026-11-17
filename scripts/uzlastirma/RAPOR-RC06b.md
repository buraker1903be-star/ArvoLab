# RELEASE CLOSURE 06 — Son hazırlıklar (RC06b)

17.11.2026 · PR #101 HEAD (başlangıç) `facd83f`, hedef `design/os5` @ `11044d6` (değişmedi) · Karar: **HOLD**

Aşama 0–2'nin incelemesi ve provası yeniden başlatılmadı; bu belge yalnızca açık noktaları tamamlar.
`RAPOR.md` geçerli; burada yazılanlar onu günceller. **Production'a hiçbir yazma yapılmadı**
(yalnızca katalog, geçmiş tablosu içeriği ve toplu sayım SELECT'leri). Paylaşılan Test, main,
PR #96 ve ArvoOS değişmedi. Hiçbir PR birleştirilmedi.

## 1. Başlangıç kontrolü

| | Değer |
|---|---|
| PR #101 HEAD | `facd83fc7046ad7a8cef4489714aa9ae97a50a2c` — beklenenle aynı |
| Hedef | `design/os5` @ `11044d6` — değişmedi, mergeable `clean` |
| CI (facd83f) | `kontrol` ×2 success · Vercel Preview success · Supabase Preview `skipped` |
| Yorum | yalnızca Vercel botu |

Uygulama kodu düzeltmeleri ayrı, dar bir Draft PR'da: **#102** (`duzeltme/os5-rc06-son`, güncel `design/os5` üzerinden; birleştirilmedi).

## 2. Yedek ve entegrasyon — salt okunur doğrulama

| Alan | Bulgu | Durum |
|---|---|---|
| Son başarılı yedek | MCP'de yedek listesi yok (Management API `database/backups` anahtar ister; istenmedi) | **UNVERIFIED** |
| PITR etkin mi / aralık | Görünmüyor. Not: WAL arşivi çalışıyor (`pg_stat_archiver`: son arşiv 06:23 UTC, 8167 arşiv, 0 hata) — bu PITR KANITI DEĞİL; Supabase'te PITR ayrı eklenti, açıksa günlük yedek alınmıyor | **UNVERIFIED** |
| Geri yükleme yöntemi | Belgelere göre: Dashboard → Database → Backups (günlük, pro planda 7 gün) ya da PITR (eklentiyse, saniye ayrıntısı); proje geri yükleme süresince ERİŞİLEMEZ; depo (Storage) nesneleri yedekte YOK | yöntem belgelendi |
| Doğrulanmış geri yükleme provası | Yok; denenmedi (onay gerektirir) | **UNVERIFIED** |
| GitHub entegrasyonu bağlı mı | **Evet** — PR'larda "Supabase Preview" denetimi Production projesine bağlanıyor | doğrulandı |
| Supabase Branching | **Açık** — projenin varsayılan dalı `main` (05.11.2026'da oluştu, durum `FUNCTIONS_DEPLOYED`); PR başına önizleme dalı kapalı | doğrulandı |
| Production git dalı | Görünmüyor | **UNVERIFIED** |
| Birleştirmede otomatik migration ("Deploy to production") | Görünmüyor. Kanıt: `main`'de 104 migration var, 05.11'den sonra main'e birleştirme yapıldı (PR #74, 12.11), ama Production geçmişi hâlâ yalnızca eski 12 kayıt → **otomatik uygulama gözlenmedi**. Bu üç şeyden biri: ayar kapalı / Production dalı main değil / dağıtım ilk migration'da düştü — araçlarla ayırt edilemiyor | **UNVERIFIED** |

### Kullanıcının panelden okuması gerekenler (tek liste)

1. **Database → Backups → Scheduled backups:** en son başarılı yedeğin tarihi/saati.
2. **Database → Backups → Point in Time:** PITR açık mı; en eski ve en yeni geri dönüş noktası.
3. **Project Settings → Integrations → GitHub Integration:** bağlı depo, *Production branch* adı,
   *Deploy to production* açık mı, *Automatic branching* / *Supabase changes only* durumu, *Working directory*.
4. **Branches** sayfası (`main` dalı): son dağıtım denemelerinin zamanı ve sonucu (başarısız bir
   "Migrate" adımı varsa hangi migration'da).
5. GitHub depo ayarı: `main` için "Supabase Preview" zorunlu denetim mi.

Yeni yedek alınmadı, geri yükleme başlatılmadı, entegrasyon ayarı değiştirilmedi.

## 3. Güncellenmiş uygulama sırası

**Dalga 0 — her şeyden önce (Production'a SQL yok):**
1. Entegrasyon davranışı kesinleşir (yukarıdaki 3 ve 4). "Deploy to production" açıksa, geçmiş
   uzlaştırılana kadar kapatılması ya da Production dalının birleştirme yapılmayan bir dala alınması
   kararlaştırılır. **Bu kesinleşmeden hiçbir Production SQL'i, geçmiş değişikliği ya da main birleştirmesi yok.**
2. Yedek/PITR doğrulanır (1 ve 2); P5 ve tam geri dönüş (R3 `tam=1`) buna bağlı.
3. 12 boş yer tutucu dosya depoya alınır (`gecmis/yer-tutucular/` → `supabase/migrations/`; ayrı PR).
   Bunlar alınmadan CLI ve entegrasyon `DbPushMissingLocalError` ile durur (provada gösterildi).

**Dalga A — geçmiş, paketten bağımsız (100 sürüm):** `gecmis/dalga-A.txt` sürüm sürüm `migration repair
--status applied`. Ön koşul: Dalga 0 tamam. Şemayı DEĞİŞTİRMEZ (provada özet farkı 0).

**Dalga B — paketler ve kendi geçmişleri (9 sürüm):** P1 → P2 → P6 → P4 → P3 → (ayrı pencere) P5 → P8,
her paketten sonra özet karşılaştırması, sonra `gecmis/dalga-B-<P>.txt` repair. P5'in veri adımı
**uygulama penceresinde yeniden ölçülür** (17.11'deki 0 kalıcı varsayım değil); ölçüm 0 değilse kimlik
listesi kaydedilir ve P5 o pencerede yeniden değerlendirilir. P9 (tek yetki) karar sonrası.
P7 bu yayında ertelendi (sürüm geçmişe kabul edilen sapma olarak yazılır).

**Sonra:** entegrasyon ayarı istenen hâle → main birleştirmesi.

## 4. Migration geçmişi manifestosu

`gecmis/MANIFESTO.md` (+ `manifesto.tsv`, `dalga-*.txt`, üretici `manifesto.mjs`): 121 kayıt =
depo 109 + Production'daki eski 12. Her satırda sınıf, **son nesne eşleşmesi** ve **tarihsel etki**
ayrı sütunlarda, işlem, dalga, ön koşul, gerekçe.

### 4.1 Son nesne ≠ tarihsel etki

Şema-yalnız migration'da son hâl etkinin tamamıdır (DDL idempotent, ara hâller kalıcı değil). Veri
adımı olan **14** migration'da son hâl tek başına kanıt değil; her birinin bugün sağlanması gereken
son koşulu Production'da ölçüldü (17.11, toplu sayım):

| Sürüm | Veri işlemi (amaç) | Bugün gereken son koşul | Ölçüm | Neden yeniden çalıştırılmaz |
|---|---|---|---|---|
| 20260807113000 | kılavuz → üniversite/birim geri doldurma | üniversitesi boş kılavuz 0; doldurulabilecek birim 0 | 0 / 0 | Production'daki eşi ikinci adımı İngilizce birim türüyle çalıştırdı, hiç eşlemedi; bugün eşlenecek satır yok |
| 20260817120000 | İstanbul Üniv. kök birim tohumu | kök birimler var | 39 | Production'daki eşi birebir aynı içerik |
| 20260914090000 | staging'de birim türü Türkçeleştirme + kısıt | İngilizce satır 0, Türkçe kısıt | 0 + kısıt var | tablo boş |
| **20260915090000** | onaylı kılavuz anlık görüntüsü + tezlere atama | anlık görüntüsüz onaylı 0; güncel fonksiyonla eşleşmeyen tez 0 | 0 / 0 | tetikleyiciler ve resync atamayı her değişiklikte yeniden yapıyor |
| 20260923090000 | bridge_health tohumu | satır var | 1 | var |
| 20260924100000 | kova sınırları | özel, 20 MB, 5 MIME | birebir | aynı |
| **20260924100007** | dokunarak hazır-onay hesaplatma | ready_for_approval NULL 0 | 0 | tetikleyici her güncellemede hesaplıyor |
| **20260924100010** | OCR kılavuzlarını yeniden hesaplatma | NULL 0 | 0 | aynı tetikleyici |
| **20260924100034** | tezlere kurum gözeten eşleme | eşleşmeyen tez 0 (1 tezden) | 0 | P4 sonrası yeni kayıtlar yeni sürümü alır; mevcutları topluca değiştirmek ayrı karar |
| **20260926135648** | OCR'lı tek tık hazırları geri çekme | OCR'lı hazır 0 | 0 | koşulu sağlayan satır yok |
| 20261025131500 | anlık görüntülere sayı biçimi anahtarı | anahtarsız onaylı 0 | 0/9 | yok |
| 20261027061010 | tezlerde içindekiler açma | kapalı tez 0 | 0 | yeniden çalıştırmak öğrencinin sonradan kapattığını açar |
| 20261027070012 | ArvoOS adını boş profillere yazma | adı boş, listede adı olan profil 0 | 0 | tetikleyici sonrakileri karşılıyor |
| 20261106184046 | onaysız hesabın kurum bağını sökme (G1) | uygulama penceresinde ölçülür | 17.11: 0 | P5'in parçası |

**Kalın** olanlar raporun 6 BELİRSİZ'idir: sınıfları korundu (geçmiş tarihsel etki ayrıca
kanıtlanamıyor), ama hepsinde bugünkü son koşul sağlanıyor; geçmişe "uygulandı" yazılmaları güvenli.
Önceki turun DML taraması 4 migration'ı (20260807113000, 20260914090000, 20261027070012, takma adlı
`update … g set`) kaçırıyordu; düzeltildi.

### 4.2 Kabul edilen sapmalar

| Sürüm | Uygulama etkisi | Yeni ortam kurulumunda |
|---|---|---|
| 20260806234000 (academic_units tetikleyicileri, P7 ertelendi) | yok — üst birim doğrulaması yalnızca çevrimdışı dizin betiğinde eksik | depodan kurulan ortamda tetikleyiciler VAR (depo hedefi); Production'a P7 ileride |
| 20260806235500 (staging farklı soy) | yok — çalışma anı kullanmıyor | depo yapısı kurulur; Production soyu (academic_programs, data_sources) depoda yok, bilerek |
| 20260924100033 (universities yinelenen politika) | yok — aynı koşul | depodaki gibi |
| schema.sql organizations ifadesi | yok — anlamca aynı | depodaki gibi |

### 4.3 Production'daki 12 eski kayıt

| Production sürümü | Depo karşılığı | Eşleşme kanıtı |
|---|---|---|
| 20260815134724 thesis_guideline_intelligence | 20260807113000 | aynı DDL; geri doldurmanın 2. adımında birim türü İngilizce (Production) / Türkçe (depo) |
| 20260817140252 fix_academic_unit_access_and_seed_istanbul | 20260817120000 | boşluksuz md5 **birebir** |
| 20260818072457 grant_academic_units_service_role_access | 20260818110000 | yorumlar çıkınca md5 birebir |
| 20260818073414 guideline_automatic_discovery | 20260818113000 | md5 **birebir** |
| 20260815134754, 20260815145249, 20260818084045 | yok | Production'a özgü kılavuz kaynağı ekleme (insert, `on conflict` YOK — yeniden çalışırsa yineler) |
| 20260815143714 bootstrap_initial_academic_managers | yok | Production'a özgü rol güncellemesi |
| 20260818085709, 090326, 090724, 091259 | yok | Production'a özgü tarama kuyruğu işaretleri (son üçü aynı içerik) |

**Kayıtlar silinmez, `reverted` yapılmaz.** CLI'ın kendi önerisi tam da bu (bkz. §5); reddedildi.
Bunun yerine depoya 12 **boş yer tutucu** (`select 1;` + açıklama) eklenir: geçmiş korunur, hiçbir şey
yeniden çalışmaz, yeni ortamda etkisizdir.

## 5. Geçmiş uzlaştırmasının izole provası (CLI)

`prova-gecmis.sh` — Supabase CLI 2.122.1, `--db-url` yalnızca 127.0.0.1; `link` yok, Production'a bağlantı yok.

| Adım | `migration list` (ikisinde / yalnız yerel / yalnız uzak) | `db push --dry-run` bekleyen |
|---|---|---|
| Başlangıç (Production benzeri, geçmişte eski 12) | 0 / 109 / 12 | **`DbPushMissingLocalError`** — CLI'ın önerisi: 12'yi `reverted` yap (reddedildi) |
| + 12 yer tutucu | 12 / 109 / 0 | 109 |
| + Dalga A repair (100) | 112 / 9 / 0 | 9 · şema özeti farkı **0** |
| P1, P2, P6, P4, P3, P5 + her birinin repair'i | — | 8 → 7 → 6 → 5 → 3 → **0** |
| Son | **121 / 0 / 0** | **"Remote database is up to date"** |

## 6. Rol ve yetki

### 6.1 Rol: kayıt yolları

Hesap açan HER yol (kendi kaydı, davet, ArvoOS, yönetici API'si) profili `handle_new_user` ile açar ve
rolü YAZMAZ: rol sütun varsayılanından gelir (Production `'employee'`). Rolü açıkça yazan tek yol davet
(`app/actions/team.ts`) ve o da "Üye / Öğrenci" (client) seçildiğinde güncellemeyi ATLIYORDU — öğrenci
olarak davet edilen Personel oluyordu. Düzeltme (dar PR): davette rol her zaman açıkça yazılır.
Kendi kaydında uygulama katmanı rol yazamaz (kullanıcı kendi rolünü değiştiremez, tetikleyici engeller):
çözüm veritabanında **P8** (varsayılan `client`). Mevcut iki `employee` hesabına dokunulmaz.

Yerel sınama (gerçek form ve GoTrue kaydı; Production benzeri şema):

| Kod | Sütun varsayılanı | "Üye / Öğrenci" davetinin rolü | Kendi kaydının rolü |
|---|---|---|---|
| eski | `employee` (Production bugün) | **employee** ✗ | **employee** ✗ |
| yeni | `employee` | **client** ✓ | **employee** ✗ |
| eski | `client` (P8) | client | client |
| yeni | `client` (P8) | client ✓ | client ✓ |

Yalnızca kod düzeltmesi yetmez (kendi kaydı hâlâ Personel); yalnızca P8 de, varsayılan bir gün yine
kayarsa davet yolunu korumaz. İkisi birlikte gerekli.

### 6.2 Yetki

- Toplu genişletme yok. Uygulama yollarıyla kanıtlanan **tek eksik yetki**: `grant delete on public.profiles
  to service_role` (yetim profil dalı) → **P9** (+ R9). Başka hiçbir yol Production yetkisiyle düşmüyor
  (31 tablo×işlem + 4 RPC, önceki tur; sütun yetkileri üç tarafta aynı).
- Depoda tekrarlanabilir politika önerisi: `paketler/oneri/yetki-politikasi.sql` — Production'daki tablo,
  fonksiyon ve sütun yetkileri + P9, depoya "yetki sabitleme" migration'ı olarak alınmak üzere. Bu turda
  migration eklenmedi. (Söz dizimi yerel veritabanında geri alınan işlemle sınandı.)

### 6.3 Yetim profil silme (Production yetkileri taklit edilmiş yerel yığın)

| Kod | Yetki | Cron yanıtı | Profil |
|---|---|---|---|
| eski | Production (DELETE yok) | `silinen:1, ertelenen:0` | **KALDI** — rapor yanlış |
| yeni | Production (DELETE yok) | `silinen:0, ertelenen:1, yetimSilinemedi:1` · log: `42501 permission denied` | kaldı (doğru raporlandı) |
| eski | + P9 | `silinen:1` | silindi |
| yeni | + P9 | `silinen:1, yetimSilinemedi:0` | silindi |

## 7. Yazım Stüdyosu

### 7.1 U3 — kök neden ve düzeltme

Yaprak (≤1180 px) üst kenarını yalnızca açılışta ve `resize`'da ölçüyordu. Sayfa aşağı kaydırılmışken
açılınca üste yapışmış araç çubuğuna (ör. 56–114 px) göre yerleşiyor; sayfa yukarı dönünce araç çubuğu
eski yerine (279–337) iniyor ve yaprağın altında kalıyordu → 24 düğmenin 24'ü erişilemez. Aralıklıydı,
çünkü tıklamanın sayfayı kaydırıp kaydırmamasına bağlıydı (tanı döngüsünde zaman çizgisiyle görüldü).
Düzeltme (`yazim-paneli.tsx`): kaydırmada ve araç çubuğunun boyu değişince de yeniden ölçüm (kare başına
bir). Yeni panel mimarisi ya da tasarım değişikliği yok. Belirlenimci test **U4** eklendi.

Tekrarlı kabul (yerel; eski kod `design/os5` @ 11044d6, yeni kod PR #102):

| Senaryo | Eski kod | Yeni kod |
|---|---|---|
| U4-telefon (kaydırılmış açılış → yukarı) | **0/3** — 24/24 düğme erişilemez | 3/3 + 3/3 + 2 tam koşu |
| U4-1024 | **1/3** (1 gerçek düşme; 1'inde sayfa kaymadı, ön koşul sağlanmadığı için FAIL) | 3/3 + 3/3 + 2 tam koşu |
| U4-1440 / U4-1280 (yan panel, yaprak değil) | 3/3 | 3/3 + 3/3 + 2 tam koşu |
| U3 (eski aralıklı senaryo) | 3/3 bu turda (aralıklı; kanıt olarak yetersiz) | 3/3 + 3/3 + 2 tam koşu |
| Tam Yazım Stüdyosu | — | **61/61 ×2** (57 eski + 4 U4, K0 dahil) |

Ayıklanan ölçümler (raporun dürüstlüğü için): yeni kodla ilk ×5 turda 4 tekil düşme oldu. O sırada aynı
makinede `next build` ×3, iki üretim sunucusu ve R3 ölçümleri koşuyordu; ayrıntı kaydedilmemişti, neden
kanıtlanamadı. Boş makinede ×3 + ×3 + iki tam koşuda düşme yok. İlk U4 sürümü K0'ı düşürdü: U4'ün A ile
yeni girişleri tek oturum kuralıyla ana sayfanın oturumunu düşürüyordu. Denetimli deney: U4'süz betik yeni
kodda 57/57 (K0 dahil). U4 kendi kullanıcısına ve K0'dan sonraya alındı.

**Önceden var olan küçük bulgu (bu turda düzeltilmedi):** tek oturum kuralı bir sekmeyi "başka cihaz" diye
düşürünce, o sekmede bekleyen bir sunucu işlemi yönlendirmeye çarpıp konsola `unhandledRejection: An unexpected
response was received from the server` bırakıyor. Yönlendirme yine çalışıyor (`/?bilgi=baska-cihaz`); eski kodun
günlüğünde de var.

### 7.2 R3 — `next build` + `next start`

| Durum | Eşzamanlı | Doğrulanan | Çözümleme (sayaç) | Gecikme (ms) | Önbellekten |
|---|---|---|---|---|---|
| **Düzeltmeden önce**, tek örnek | 10 | 10 | 1, 1, **2** | 1450–2370 | 165–209 ms |
| **Düzeltmeden önce**, iki örnek | 10 | 10 | **3, 3, 3** (beklenen 2) | 1815–2800 | 155–222 ms |
| Düzeltmeden sonra, tek örnek (temiz başlatma) | 10 | 10 | **1, 1, 1, 1, 1** | medyan 1275–1720 | — |
| Düzeltmeden sonra, iki örnek | 10 | 10 | **2, 2, 2** (her örnek 1; günlükle doğrulandı) | 1664–1986 | 152–211 ms |

- **Kök neden (yeni bulgu):** süren iş haritaya sayaç çağrısından SONRA yazılıyordu; o ağ gidiş-dönüşü
  sırasında gelen istekler haritayı boş görüp ayrıca çözümlüyordu. RC05'teki "10 → 1" sonucu süreç
  içinde bile garanti değildi. Düzeltme: iş, kontrolle aynı eşzamanlı adımda haritaya yazılır, sayaç işin içinde.
- **Geliştirme sunucusu vs Production biçimi:** `next dev`'deki ilk koşu düşmeleri (0→2) aynı yarıştı;
  ilk derleme gecikmesi pencereyi büyütüyordu. Production biçiminde de vardı (yukarıdaki tablo).
- **Ayrı örnekler:** her serverless örneği kendi önbelleğini tutar; N örneğe dağılan eşzamanlı istekler
  en çok N çözümleme ve N sayaç birimi harcar. Süreçler arası tekilleştirme YOK ve iddia edilmiyor.
- **Limit davranışı:** sayaç birimi çözümleme başına (önbellekten yanıt birim harcamaz). Geçersiz bir
  ölçüm ayıklandı: bir koşu, `.next` altında yeniden derlenen çalışır bir sunucuya karşı yapılmıştı.
- Ölçüm notu: aynı kullanıcının ikinci tarayıcı bağlamında girişi ilk oturumu düşürüyor (tek oturum);
  çok örnekli ölçüm tek oturumla yapıldı.

### 7.3 PDF işlem sınırı

| | Değer |
|---|---|
| Gerçek varsayılan | **60** PDF / kullanıcı / saat (`PDF_ISLEM_VARSAYILAN`, `lib/pdf-islem-siniri.ts:27`) |
| Ortam değişkeni | `PDF_ISLEM_SAATLIK` (1–1000; geçersizse varsayılan) |
| Vercel Production'da | **tanımlı değil** → 60 (yalnızca değişken adları okundu, değer okunmadı) |
| Kabul testi | `PDF_ISLEM_SAATLIK=12` (R1 sınırı hızlı doldurmak için) |

Limit değiştirilmedi.

## 8. Gerçek AI ve yayın zinciri

Bu oturumda güvenle verilmiş bir **test** model anahtarı yok. Vercel Production'da AI anahtarı tanımlı ama
o üretim sırrı: okunmadı, kullanılmadı. Gerçek model çağrısı **0**, maliyet **0**. Model taklidi gerçek
kabul sayılmadı → **UNVERIFIED**.

Main öncesi zincir: Kayıt → e-posta doğrulama → ilk şifre → çalışma → DOI → PDF → AI → atıf/kaynakça →
Word/PDF → yeniden giriş → veri bütünlüğü. Yerelde parçalar ayrı betiklerde sınanıyor (kimlik-kabul,
studyo-kabul, kayit-butunlugu), ama **tek zincir olarak ve gerçek AI ile koşulmadı → UNVERIFIED.**

## 9. PASS / FAIL / UNVERIFIED

| Konu | Sonuç | Kanıt |
|---|---|---|
| PR #101 HEAD/hedef/CI (başlangıç) | PASS | §1 |
| Son başarılı yedek | **UNVERIFIED** | §2 — panel |
| PITR etkin + aralık | **UNVERIFIED** | §2 — WAL arşivi çalışıyor, PITR kanıtı değil |
| Geri yükleme provası | **UNVERIFIED** | yapılmadı (onay gerekir) |
| GitHub entegrasyonu bağlı / Branching açık | PASS (doğrulandı) | §2 |
| Production dalı + otomatik migration | **UNVERIFIED** | §2 — otomatik uygulama gözlenmedi |
| Geçmiş manifestosu (121 kayıt) | PASS | §4, `gecmis/` |
| 6 BELİRSİZ: son koşul | PASS (6/6 sağlanıyor) | §4.1 — tarihsel etki ayrıca kanıtlanamaz |
| 12 eski kayıt eşleşmesi | PASS (4 eşleşti, 8 Production'a özgü) | §4.3 |
| Geçmiş uzlaştırma provası (CLI) | PASS | §5 — son: bekleyen 0, 121/0/0 |
| Rol varsayılanı + davet yolu | PASS (yerel) · Production'da P8 bekliyor | §6.1 |
| En küçük yetki (P9) + yetim profil düzeltmesi | PASS (yerel) | §6.3 |
| U3 kök neden + düzeltme | PASS | §7.1 |
| R3 `next start` (süreç içi tekilleştirme) | PASS (düzeltmeden sonra) · düzeltmeden önce FAIL | §7.2 |
| R3 süreçler arası | beklenen davranış (örnek başına 1), tekilleştirme YOK | §7.2 |
| PDF sınırı netliği | PASS | §7.3 |
| Kayıt bütünlüğü / G1 / DOI | PASS 14/14 · 15/15 · 29/29 | yerel |
| Tam Yazım Stüdyosu (yeni kod) | PASS 61/61 ×2 | §7.1 |
| Gerçek AI modeli kabulü | **UNVERIFIED** | §8 — 0 çağrı |
| Uçtan uca yayın zinciri | **UNVERIFIED** | §8 |
| Production uygulaması | **HOLD** | onay yok; yazma yok |


## Production'ı engelleyen somut maddeler

1. Entegrasyon: Production git dalı ve "Deploy to production" ayarı (panel) — **Dalga 0'ın ilk adımı**.
2. Yedek/PITR: son yedek ve PITR aralığı (panel); geri yükleme provası yok.
3. Gerçek AI kabulü: test anahtarı yok.
4. Uçtan uca yayın zinciri: tek zincir hâlinde koşulmadı.
5. Kararlar: P8 (varsayılan `client`) onayı; iki `employee` hesabının durumu; P9 ve yetki politikası.
6. Dar düzeltme PR'ının (#102) incelenip `design/os5`'e alınması.
