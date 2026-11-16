# P52b-2B/2C — Tasarım sertleştirmesi (AUDIT-ONLY, UYGULANMADI)

Başlangıç: `design/os5` @ `05182c7` (PR #95 birleşti).

Bu tur:
- Migration oluşturulmadı.
- Worker çalıştırılmadı.
- Veri silinmedi.
- Production/Test'e bağlanılmadı.

Yarış kanıtları yerel PostgreSQL 17.12'de, READ COMMITTED altında, ayrı bir karalama veritabanında (`p52b2_yaris`) koşturuldu:
- Her senaryonun kendi şeması var.
- Depo bir tabloyla temsil ediliyor; senaryolarda DELETE ifadesi yok.
- Düzenek: [`yaris/yaris.mjs`](yaris/yaris.mjs) ve [`yaris/oturum.mjs`](yaris/oturum.mjs). Sonuç: [`sonuclar/yaris.json`](sonuclar/yaris.json).

Bu belge [`TASARIM-2C-silme-kuyrugu.md`](TASARIM-2C-silme-kuyrugu.md) ile [`TASARIM-2B-cop-kutusu.md`](TASARIM-2B-cop-kutusu.md)'yi **düzeltir**. İlk 2C tasarımında iki gerçek açık vardı (A ve B); ikisi de aşağıda gerçek PostgreSQL'de gösterildi.

**Kesin ürün kararları (bu belgenin girdisi):**
- Editör görsel kütüphanesi metinde kullanılmasa da korunur. Otomatik görsel temizliği yok; `editor-images` hiçbir koşulda kuyruğa girmez.
- Karantina kovası yok.
- Silme kanıtı 90 gün saklanacak; hukuki onay olmadan etkinleştirilmez.
- Çalışmalar için çöp kutusu 30 gün.
- Hesap silme çöp kutusu yüzünden uzamaz.

---

## 1. PostgreSQL yarış testleri

**Sonuç iki ayrı grupta okunur** (çıktı ve `yaris.json` her senaryo için `tur`, `beklenen`, `gozlenen`, `beklentiye_uydu` alanlarını taşır):
- **Pozitif, yani önerilen ya da güvenli olması beklenen: 9/9 GÜVENLİ.** Bunlar A1-i3, A1-i4, A2-i1…i4, A3, B2 ve B3.
- **Negatif, yani anomali beklenen: 8/8 ANOMALİ yeniden üretildi.** Bunlar A1-i1, A1-i2, A2-yanlis-tek-ifade, A2-yanlis-stable, A4, B1, B1b ve C1. Bu tasarımlar **güvensizdir**; "beklentiye uydu" demek "geçti" ya da "güvenli" demek değildir.
- Beklentiye uymayan senaryo yok. 17 senaryo art arda koşturuldu (16.11 ve 16.11 P52b-2D turu).
- "Bekledi" kararı süreye bağlı değil: gözcü oturum, `pg_stat_activity.wait_event_type = 'Lock'` ile oturumu kilit beklerken görüyor.
- Sıralar elle oynatılıyor; zamanlamaya bırakılan bir yarış yok.

### A. Kuyruk satırı henüz yokken: kuyruğa alma ↔ bağlama

| # | Tasarım / sıra | Gözlenen | Sonuç |
|---|---|---|---|
| A1-i1 | **İlk tasarım** (`INSERT … WHERE NOT EXISTS` + tetikleyicide `SELECT … FOR UPDATE`). E kuyruğa alır (açık) → B bağlar → E commit → B commit | Kimse beklemedi. ref=1, kuyruk=PENDING_DELETE | **ANOMALİ**: bağlı dosya silinmeye gidiyor |
| A1-i2 | İlk tasarım. B bağlar (açık) → E kuyruğa alır → B commit → E commit | Kimse beklemedi. ref=1, kuyruk=PENDING_DELETE | **ANOMALİ** |
| A1-i3 / i4 | İlk tasarım, seri | IPTAL / kuyruk yok | Güvenli (yalnızca seriyken) |
| A2-i1 | **Öneri**: yol başına danışma kilidi, kontrol ayrı ifadede. E açık → B bağlar | B **bekledi**; E commit'ten sonra kuyruğu gördü ve iptal etti | Güvenli |
| A2-i2 | Öneri. B açık → E kuyruğa alır | E **bekledi**; B commit'ten sonra referansı gördü, `kuyruga_al = false` | Güvenli |
| A2-i3 | Öneri. Yeniden bağlama (`UPDATE ref SET yol`) | B bekledi, sonra iptal etti | Güvenli |
| A2-i4 | Öneri. İki eşzamanlı kuyruğa alma | İkincisi bekledi; tek satır, ikinci çağrı `false` | Güvenli |
| A2-yanlis-tek-ifade | Kilit doğru, ama `NOT EXISTS` kilitle **aynı** INSERT ifadesinde | E kilitte **bekledi**, yine de kuyruğa aldı | **ANOMALİ**: ifadenin anlık görüntüsü kilit beklemesinden önce alınmış |
| A2-yanlis-stable | Tetikleyici işlevi `STABLE` | B kilitte bekledi, yine de bağladı | **ANOMALİ**: STABLE işlev dış ifadenin görüntüsünü kullanır |
| A3-serializable | İlk tasarım, iki taraf SERIALIZABLE | `could not serialize access…` (40001) | Güvenli, ama yeniden deneme gerektirir; uygulama READ COMMITTED |
| A4-kayit-satiri | Satır **önceden var** (nesne kaydı). İki taraf da onu kilitliyor; kontrol tek UPDATE'in `NOT EXISTS`'inde | E bekledi, yine de PENDING_DELETE yazdı | **ANOMALİ**: EvalPlanQual hedef satırı tazeler, alt sorguyu tazelemez |

**Kanıtlananlar:**
1. Var olmayan satıra `FOR UPDATE` hiçbir şeyi kilitlemez. `INSERT … WHERE NOT EXISTS`, READ COMMITTED'da yazma çarpıklığını engellemez (A1).
2. Kilit **gerekli ama yetmez**. Karar, kilit alındıktan **sonra başlayan ayrı bir SQL ifadesinde** verilmeli, ve bunu yapan işlev `VOLATILE` olmalı. Aynı ifadede ya da STABLE işlevde karar, kilitten önceki dünyaya göre verilir (A2-yanlis-*, A4).
3. Önerilen düzen (A2) dört sırada da güvenli; ikinci taraf kilitte bekliyor.

### B. Kira süresi ve gecikmiş Storage isteği

| # | Senaryo | Gözlenen | Sonuç |
|---|---|---|---|
| B1-ilk-tasarim | A kirayı alır, silme isteği yolda kalır. Kira dolar, satır PENDING_DELETE'e döner. Kullanıcı aynı yolu bağlar (iptal). A'nın gecikmiş isteği **sonra** uygulanır | Bağlama geçti, ref=1, dosya silindi=true | **VERİ KAYBI** |
| B1b-isim-ile-bitleme | Geçişler kuşak yerine `kira_sahibi` adına koşullu. Aynı adla yeniden başlayan worker'ın geç "yeniden dene"si B'nin kirasını geri alıyor | A'nın geç yazımı 1 satırı geri aldı; ardından C de kira aldı | **ÇİFT KİRA** |
| B2-oneri | Aynı akış, öneriyle: bir kez kiralanan yol bir daha bağlanamaz, geçişler **kuşağa** koşullu, kanıt aynı ifadede | Bağlama **reddedildi**, kullanıcı yeni yolla bağladı. A'nın geç işaretlemesi ve yeniden denemesi 0 satır. Kanıt 1, son durum DELETED/2 | Güvenli; A'nın geç isteği ölü bir yola düştü |
| B3-nesne-kimligi | Yol aynı, nesne değişmiş (belirlenimci yola yeni dosya yazılmış) | `ayni_nesne_mi = false`; worker durur | Silme yapılmıyor |

B1 notu: ilk tasarımda kuşak sütunu yoktu. B1, öneri tetikleyicisinin kuşak koşulu sıfırlanarak ilk tasarımın davranışına indirildi. Satır kodda işaretli.

### C. Eksik envanter

| # | Senaryo | Gözlenen |
|---|---|---|
| C1 | `storage.search` ile aynı sıralama: `ORDER BY name LIMIT/OFFSET`. Sayfalar arasında bir ekleme, sonra bir silme | Eklemede `c` iki kez göründü. Silmede `d` hiç görünmedi |

**Doğrulananlar:**
- Yerel `storage.search` gövdesinde `limit $5 offset $6` var.
- 2A tarayıcısı yolları tekilleştirmiyor (`nesneler.push`, `lib/depo-envanteri-tarama.ts`). Bu yüzden:
  - eşzamanlı ekleme bir dosyayı **iki kez sayabilir** (toplam şişer);
  - eşzamanlı silme bir dosyayı **atlayabilir**. Bu, yetim için güvenli taraftır (aday olmaz), ama başvurulan bir dosya atlanırsa **sahte ADAY_KAYIP** çıkabilir. 2A'nın ikinci geçişi klasörü yeniden listeliyor ve bunu büyük ölçüde eliyor, ama o liste de ofsetli.

2A hiçbir şey silmediği için bu bir veri kaybı değil, sayım hatası. Ayrı bir 2A düzeltmesi olarak önerilir (§5).

---

## 2. Güvenli silme kuyruğu: revize mimari (2C v2)

**Temel kabul (değişmedi):** PostgreSQL satır kilidi Storage silmesini atomik yapmaz. Storage HTTP isteği veritabanı işleminin parçası olamaz, koşullu da değildir (ETag/sürüm şartı yok), ve gönderilmiş bir istek, istemci vazgeçse de **sonradan** uygulanabilir. Bu yüzden doğruluk zamanlamaya değil şu kurala dayanır:

> **Bir yol worker'a bir kez verildiyse o yol ölüdür:** hiçbir kayda bir daha bağlanamaz, RLS üzerinden yeniden yaratılamaz. Geç gelen her silme isteği, kimsenin kullanamayacağı bir yola düşer.

### 2.1 Durum makinesi (yol başına)

```
(satır yok = ACTIVE)
ACTIVE ──depoyu_birak()──▶ PENDING_DELETE (kusak=0)
PENDING_DELETE (kusak=0) ──bağlama──▶ IPTAL              [yalnızca hiç kiralanmamışken]
PENDING_DELETE ──kuyruktan_al()──▶ DELETING (kusak+1)    [bitleme jetonu = kusak]
DELETING ──silindi / zaten yok──▶ DELETED                [WHERE kusak=$k; kanıt aynı ifadede]
DELETING ──bilinmiyor──▶ PENDING_DELETE (kusak≥1)        [WHERE kusak=$k; geri çekilme]
DELETING ──kira doldu──▶ PENDING_DELETE (kusak≥1)        [kurtar()]
DELETING ──nesne kimliği değişmiş──▶ ELLE_BAKILMALI      [silme yok]
kusak≥1 olan her satır: bağlama REDDİ, depo INSERT REDDİ (ölü yol)
```

İlk tasarımdan farkı:
- **kusak (bitleme jetonu)** eklendi.
- **İptal yalnızca `kusak = 0` iken** yapılabiliyor (B1 kapandı).
- **ELLE_BAKILMALI** eklendi.

### 2.2 Kurallar

**R1. Yol kilidi (A için).**
- Yolun durumunu değiştiren her işlem önce `pg_advisory_xact_lock(hashtextextended('arvolab.depo:' || yol, 0))` alır. Bunlar: `depoyu_birak`, bütün referans tablolarındaki bağlama tetikleyicileri ve kalıcı silme işlevleri.
- Kilit **ayrı bir ifadede** alınır; kontrol **sonraki** ifadede yapılır.
- İşlevler `VOLATILE` olur (plpgsql'de her ifade yeni anlık görüntü alır).
- Karma çakışması yalnızca gereksiz sıralama demektir, hata değil.

Seçilmeyen yollar:
- **SERIALIZABLE** (A3): uygulama ve PostgREST READ COMMITTED; her çağıranın 40001'i yeniden denemesi gerekir.
- **Nesne kaydı satırı** (A4): eski nesnelerin satırı yok; kayıt satırı olsa bile kontrol yine ayrı ifadede olmalı.

**R2. Kuyruğa alma yalnızca `depoyu_birak(yol, neden)` ile.**
- security definer, yalnızca service_role.
- Kilitten sonra şunları yeniden doğrular:
  1. beş referans tablosunda yol yok;
  2. yolun sahibi (çalışma ya da kullanıcı) yok, ya da **kalıcı silme işleminin kendisi** çağırıyor;
  3. yol çöp kutusundaki bir çalışmaya ait değil;
  4. kategori uygun (R6).
- `storage.objects.id` okunup `nesne_kimligi` olarak yazılır. Okunamazsa kuyruğa alınmaz.

**R3. Bağlama tetikleyicisi.** `kaynak_pdfleri`, `document_uploads`, `calisma_kilavuzu`, `uak_tablolari` ve `academic_score_entries` tablolarında, BEFORE INSERT OR UPDATE OF <yol sütunu>, VOLATILE. Sırasıyla:
1. Yol kilidini alır.
2. `kuyruk FOR UPDATE` ile kuyruk satırını kilitler.
3. Kuyruk satırına göre karar verir:
   - satır yok ya da IPTAL → bağlama geçer;
   - PENDING_DELETE ve `kusak = 0` → IPTAL;
   - diğer her durum → `BAGLAMA_REDDI`. Uygulama yeni rastgele bir yolla yeniden yükler.

**R4. Kira.**
- Kira `UPDATE … WHERE yol IN (SELECT … FOR UPDATE SKIP LOCKED LIMIT n)` ile alınır; `kusak = kusak + 1`, `kira_bitis = now() + 5 dk`.
- Bağlama ile kira aynı kuyruk satırını kilitlediği için sıralanır:
  - bağlama önce kazanırsa satır IPTAL olmuştur, worker almaz;
  - worker önce kazanırsa bağlama DELETING görür ve reddedilir.
- Kiradan sonra worker, R2'deki doğrulamayı **yeniden** yapar. Bir referans çıkarsa satır ELLE_BAKILMALI'ya geçer: kusak ≥ 1 olduğu için bağlamaya bir daha açılmaz, ama silinmez de.

**R5. Bitleme.**
- Her geçiş `WHERE yol = $y AND kusak = $k AND durum = 'DELETING'` ile yapılır: DELETED, yeniden dene ve ELLE_BAKILMALI.
- Kanıt, DELETED geçişiyle **aynı ifadede** yazılır (CTE) ve en çok bir kez yazılır (B2).
- Kirası düşen ya da aynı adla yeniden başlayan worker hiçbir şeyi değiştiremez (B1b).
- `kira_sahibi` yalnızca bilgi içindir, koşul değildir.

**R6. Uygunluk: yalnızca yeniden yaratılamayan yollar.**
- **Depo INSERT politikası ölü yolu reddeder:** `not exists (select 1 from depo_silme_kuyrugu q where q.yol = name and q.kusak > 0)`. Böylece RLS'li istemci (tarayıcı, sunucu eylemi) ölü bir yola yeniden dosya yazamaz.
- **Bugünkü yol adları.** Ölçüldü: yalnızca kaynak-pdf (P52b-1) rastgele UUID kullanıyor. Diğer yollar şöyle:
  - `editor-images`, `imports`, `kilavuz`, `etik` ve belge: `Date.now()-<ad>`;
  - `docentlik`: `<giriş>-<zaman>.pdf`;
  - `uak`: `<zaman>.pdf`;
  - `exports`: tamamen belirlenimci (`<kullanıcı>/exports/<çalışma>.docx`) ve **service_role ile, upsert ile** yazılıyor.

  Ölü yol politikası RLS'li yazmayı kapatır; zaman damgalı adlar R6 ile güvenlidir.
- **`exports` kuyruğa hiç girmez.** RLS'i atladığı için tetikleyicinin ve politikanın dışında kalıyor. Bu dosya yalnızca hesap silmede, kullanıcı satırı gittikten sonra silinir; o noktada dışa aktarma rotası oturum açamaz.
- **`editor-images` kuyruğa hiç girmez** (ürün kararı). İstisna: hesap silme ve çalışmanın kalıcı silinmesi. Orada klasörün sahibi gitmiştir.
- **Önerilen kod değişikliği** (migration'sız, 2C'den önce): yeni yüklemeler P52b-1 gibi rastgele UUID ile adlandırılır. Bu, aynı milisaniyedeki çakışmayı da kapatır.

**R7. Nesne kimliği (B3).**
- Worker silmeden hemen önce klasörü listeleyip yoldaki nesnenin `id`'sini `nesne_kimligi` ile karşılaştırır. Farklıysa silmez, satırı ELLE_BAKILMALI yapar.
- Bu kontrol pencereyi daraltır, kapatmaz: Storage silmesi koşullu değil. Pencereyi **kapatan** kural R6'dır.

**R8. Zaman aşımı.**
- Worker'ın HTTP zaman aşımı kira süresinin çok altında olur (örneğin 30 sn'ye karşı 5 dk), ve worker zaman aşımından sonra kirayı **kendisi** bırakmaz.
- Doğruluk bu sayılara dayanmaz; sayılar yalnızca gereksiz yeniden denemeyi azaltır.

**R9. Yeniden deneme.**
- "Bilinmiyor" sonucunda `deneme + 1` ve `sonraki_deneme = now() + min(24 sa, 1 dk · 2^deneme) ± sapma`.
- 10 denemeden sonra satır ELLE_BAKILMALI olur. "Bilinmiyor" hiçbir zaman DELETED sayılmaz.

**R10. Envanter karar vermez (C için).**
- 2A raporu yalnızca aday üretir. Kuyruğa alma her yol için ayrı ayrı `depoyu_birak` ile yapılır ve o işlem R2'yi **kendi anında, kilit altında** yeniden doğrular. Raporun eski ya da eksik olması kuyruğa yanlış yol sokamaz.
- **Kısmi rapor otomatik kuyruğa alma başlatamaz.** `yarim = true` ya da `okunamayan_klasor > 0` ise hiçbir aday otomatik işlenmez; yalnızca rapor yazılır.
- Silmeden önceki bağımsız doğrulama üç katmandır: (1) kuyruğa alırken R2, (2) kira sonrası R4, (3) silmeden hemen önce R7. Üçü de envanter raporundan bağımsız, güncel okumadır.
- Üretim ölçeğinde tutarlı bir anlık görüntü için envanter `storage.objects` üzerinden okunmalı: tek bir REPEATABLE READ işleminde `WHERE name > $son ORDER BY name LIMIT n` (anahtar kümesi). Ofsetli Storage listelemesi kullanılmamalı. Bu, `storage` şemasına salt okunur SQL erişimi gerektirir. Erişim yolu UNVERIFIED; ayrı onay ister.

**R11. Hesap silme.**
- Talep anında erişim kapanır (bugün `silme_talebi_at`).
- Kalıcı silme tek işlemde yapılır:
  1. kullanıcının ve sahibi olduğu bütün çalışmaların (çöp kutusundakiler dahil) satırları silinir;
  2. aynı işlemde bütün klasör yolları `depoyu_birak` ile kuyruğa girer;
  3. kullanıcı silinir.
- Depo silmesi kuyruğun işidir. Bugünkü "sil, hata olursa günlüğe yaz" davranışının yerini alır. Başarısız silme kuyrukta kalır ve yeniden denenir.

**R12. Kanıt ve veri minimizasyonu.**
- `depo_silme_kaniti (yol_ozeti, sahip_ozeti, neden, istendi, silindi_at, kusak, deneme)`. Özetler SHA-256'dır, ham yol ve kimlik tutulmaz.
- 90 günlük saklama işi bayrakla kapalı gelir; hukuki onaydan sonra açılır.
- Günlükler yalnızca sayı ve hata türü içerir.

---

## 3. Çöp kutusu erişim matrisi

Kaynaklar:
- yerel yığının (canlıya denk şema) `pg_policies` ve `pg_constraint` kataloğu;
- koddaki service_role kullanımlarının taranması.

Satırlar bugünkü yolları gösteriyor; "Gerekli" sütunu önerilen değişiklik.

**Kaskat (doğrulandı):** `academic_projects`'e bağlı 16 CASCADE ve 4 SET NULL yabancı anahtar var (2B belgesindeki liste aynı). Yumuşak silme hiçbir yabancı anahtarı değiştirmez; kaskat yalnızca 30. gündeki kalıcı silmede çalışır. Kabul testi bu 20'li kümeyi sabitler.

### 3.1 Veritabanı politikaları

| Yol | Bugün | Çöpteyken bugünkü tasarımla | Gerekli |
|---|---|---|---|
| `academic_projects` SELECT/UPDATE/DELETE | sahip, atanan uzman, `gozetim_kapsami` | 2B v1 sahibe silinmiş satırı göstermeyi öneriyordu. **Açık:** 8 tablo bu satıra `EXISTS` ile yaslanıyor ve sahip onları okumaya devam ederdi | Politika silinmiş satırı **herkese** kapatır. Çöp kutusu listesi `cop_kutusu_listesi()` (definer) ile yalnızca üst veri döndürür: kimlik, başlık, silinme ve kalıcı silinme tarihi |
| `EXISTS(academic_projects)` ile okuyan 8 tablo: calisma_kilavuzu (4 işlem), calisma_takvimi, calisma_yapilacaklari, etik_kurul, kanit_kayitlari, kaynak_pdfleri, makale_profili, literatur_tarama_gunlugu | çalışmanın görünürlüğü | Yukarıdaki değişiklikle kendiliğinden kapanır | Sınama |
| `can_view/can_write_project` kullananlar: project_manuscripts, project_manuscript_versions, manuscript_comments, manuscript_share_links, yazim_kontrolleri, citation_checks SELECT, document_uploads SELECT ve öteki tabloların yazmaları | işlev | İşleve `silindi_at is null` eklenince kapanır | Gövde **canlı anlık görüntüden** alınır |
| **consultancy_requests** (4 işlem) | talep eden, atanan uzman, gözetim. **Çalışmaya hiç bakmıyor** | **AÇIK KALIR**: danışmanlık talebi okunur ve güncellenir | Politikalara `calisma_acik(project_id)` |
| **document_uploads DELETE**, **citation_checks DELETE** | yükleyen / oluşturan | **AÇIK KALIR**, ve geri yüklemeyi eksik bırakır: çöpteyken satır silinebilir | `calisma_acik(project_id)` ve yazma koruma tetikleyicisi |
| document_uploads / citation_checks INSERT | `guard_project_link_insert` (can_view_project) | İşlev değişince kapanır | — |
| notifications | `user_id` (gelen kutusu) | Kullanıcının kendi bildirimleri görünür kalır | Çöpteki çalışma için **yeni** bildirim üretilmez (aşağıda tetikleyiciler). Eski bildirimler kalır (karar) |
| analiz_sonuclari, literature_sources, ai_assistant_runs (SET NULL) | `owner_id` (kullanıcının kendi kütüphanesi) | Görünür kalır | Bilerek açık: kullanıcı varlıkları. Çöpteki çalışmaya **yeni** bağlama reddedilir |
| Bütün yazmalar (16 tablo ve `academic_projects`) | RLS | Okuma kapansa da sahibin yazma yolları ayrı | **Yazma koruma tetikleyicisi**: çöpteki çalışmaya INSERT, UPDATE ve **DELETE** yasak. İstisna, `current_user` tablo sahibiyse (definer işlevler ve FK kaskatı). Bu kalıp ArvoOS'taki imza korumasında kullanılıyor |

### 3.2 Depo

| Yol | Bugün | Çöpteyken | Gerekli |
|---|---|---|---|
| `<çalışma>/…` okuma, yazma, silme | can_view / can_write | İşlevle kapanır | — |
| **`<kullanıcı>/…`**: belge, kilavuz, imports, exports, etik | sahibi ve kurumun kontrolör/akademik yöneticisi; **çalışmanın durumuna bakmıyor** | **AÇIK KALIR**: çöpteki çalışmanın belgesi indirilip silinebilir | SELECT ve DELETE politikasına `not depo_yolu_cop_kutusunda(name)`. Bu, `document_uploads.storage_path`, `calisma_kilavuzu.depo_yolu` ve `exports/<çalışma>.docx` adından çalışma kimliğini çıkarır. `storage_path` ve `depo_yolu` için dizin gerekir |
| Önceden verilmiş imzalı URL'ler | TTL: görseller ~1 sa, kaynak PDF 600 sn, dışa aktarma 300 sn | **TTL bitene kadar açık** | Kabul edilen kalıntı: en çok ~1 saat. Belgede yazılı |

### 3.3 service_role yolları

| Yol | Bugün | Çöpteyken | Gerekli |
|---|---|---|---|
| **Paylaşım sayfası** (`app/share/[token]`) | belirteç, iptal, süre; çalışma için yalnızca sahibin `silme_talebi_at`'ı | **AÇIK KALIR**: metin ve görseller (admin imzalı) sunulur, görüntülenme sayılır, bildirim yazılır | Çöp kontrolü; `silme_talebi_at` kontrolünün yanına |
| Yazma, yazdırma, dışa aktarma ve kanıt (admin, RLS okumasından **sonra**) | önce RLS | İşlevle kapanır | Sınama |
| `asistanKaydet` (ai_assistant_runs, admin) | çalışma denetimi yok | Çöpteki çalışma kimliğiyle kayıt yazılabilir | `lib/ai/erisim.ts` kapısında çalışma açık mı denetimi |
| hesap-silme cron'u | sahibinin bütün çalışmaları | Çöptekiler de satır olarak durduğu için dahil (istenen) | R11'e göre kuyruğa geçiş |
| `hesabim/verilerim` (KVKK veri dökümü) | `owner_id` | — | **Dahil edilmeli**: veri hâlâ tutuluyor. "Çöp kutusunda" işaretiyle |

### 3.4 Tetikleyici ve definer işlevler

Bunlar çöpteki satıra yazar ya da yazmaya çalışır.

| İşlev | Sorun | Gerekli |
|---|---|---|
| `resync_project_guidelines` | Eşleşen **bütün** çalışmaları günceller. Yazma koruması gelince çöpteki tek bir çalışma **bütün senkronu düşürür** | `where silindi_at is null` |
| `notify_guideline_approved`, `notify_guideline_ready` | Çöpteki çalışmanın sahibine bildirim gönderir | Süzgeç |
| `notify_project_changes` (projects UPDATE) | Çöpe atma ve geri yükleme UPDATE'i "değişti" bildirimi üretebilir | Çöp sütunlarını yok sayar; çöpe atma ve geri yükleme kendi bilinçli bildirimini yazar |
| `guard_academic_project_update`, `sync_academic_project_guideline` | Yeni sütunu engelleyebilir ya da tetiklenebilir. UNVERIFIED | Gövde canlı anlık görüntüden okunup ele alınır |
| `notify()` 60 günlük temizlik | Çöpteki çalışmanın **okunmuş** bildirimlerini silebilir | Kabul: geri yüklemenin tek bilinen istisnası; bildirim içerik değil |
| `prune_manuscript_versions` | Yalnızca yeni sürüm eklenince çalışır; çöpteyken yazma yok | Güvenli |
| `olcum_ozeti` (iç ekip istatistiği) | Çöptekileri sayar | Ayrı sütun |

### 3.5 Geri yükleme eksiksizliği

Satırlar silinmediği ve çöpteyken her yazma (silme dahil) reddedildiği için şunlar aynen döner:
- metin;
- bütün sürümler;
- yorumlar;
- kaynak PDF kayıtları ve dosyaları;
- belge kayıtları ve dosyaları;
- kılavuz, etik kurul, takvim, yapılacaklar, kanıt, makale profili, yazım kontrolleri;
- paylaşım bağlantıları;
- editör görselleri (klasöre dokunulmuyor).

Bunun için iki koşul var:
- `depoyu_birak` çöpteki çalışmaya ait hiçbir yolu kuyruğa almaz (R2, kural 3);
- 2A'nın `referanssiz` adayları çöpteki çalışmalar için üretilmez.

**Bilinen istisnalar:**
- `notify()` tarafından temizlenen okunmuş bildirimler.
- Çöpteyken süresi dolan paylaşım bağlantıları: süre işlemeye devam eder.
- Önceden verilmiş ve süresi dolmuş imzalı URL'ler.

### 3.6 Hesap silme ile etkileşim

- Kalıcı silme zamanı `min(silindi_at + 30 gün, hesabın kalıcı silinme zamanı)`. Çöp kutusu hesap silmeyi **hiçbir koşulda** geciktirmez.
- Hesap silme talebinden sonra çalışma geri yüklenemez. Bu, sahip için de, aynı kurumun gözetim rolü için de geçerli: kullanıcının silinmesini istediği veri diriltilmez.
- Hesap silme çöp kutusundakiler dahil bütün çalışmaları alır (R11).

---

## 4. Migration bağımlılık sırası (öneri; hiçbiri oluşturulmadı)

**Ön adımlar (migration'sız, ayrı PR'lar):**
- **K0-a:** yeni yüklemelerde rastgele UUID adı (R6).
- **K0-b:** 2A'da yol tekilleştirme ve sayfa arası tutarsızlığın rapora yazılması.
- **K0-c:** paylaşım sayfası ve `erisim.ts` için çöp kontrolünün hazırlanması.

**2B (çöp kutusu)** — her biri bir öncekine bağlı. M1–M5 çöpe atma başlamadan etkisizdir.

| # | Migration | Bağımlılık |
|---|---|---|
| M1 | `academic_projects`: `silindi_at`, `silen`, `kalici_silinecek_at` ve kısmi dizin | — |
| M2 | `calisma_acik(uuid)`: definer, yalnızca boolean döner, politikalarda kullanılır (açık kalır). `can_view_project` / `can_write_project` yeni gövdeleri | M1 |
| M3 | Politikalar: `academic_projects` (silinmiş satır herkese kapalı); consultancy_requests, document_uploads DELETE, citation_checks DELETE; depo `<kullanıcı>/` SELECT ve DELETE (`depo_yolu_cop_kutusunda`) ve dizinleri | M2 |
| M4 | Yazma koruma tetikleyicisi: `academic_projects` ve 16 tablo; security invoker, `current_user` istisnası | M1 |
| M5 | Tetikleyici ve definer düzeltmeleri: resync, guideline bildirimleri, `notify_project_changes`, guard ve sync | M4 (önce M5 uygulanmazsa resync düşer; **M4 ile aynı sürümde**) |
| M6 | `calismayi_cop_kutusuna_at`, `calismayi_geri_yukle`, `cop_kutusu_listesi`: definer; `revoke … from public, anon, authenticated` ve `grant authenticated` | M1–M5 |
| — | Uygulama: `deleteProject` → M6, çöp kutusu ekranı, paylaşım ve AI kontrolü | M6 |

**2C (silme kuyruğu):**

| # | Migration | Bağımlılık |
|---|---|---|
| M7 | `depo_silme_kuyrugu` (yol, durum, kusak, nesne_kimligi, neden, sahip_ozeti, deneme, sonraki_deneme, kira_*) ve `depo_silme_kaniti`. RLS açık, politika yok | — |
| M8 | `yol_kilidi(text)` ve `depoyu_birak(text, text)`: definer, yalnızca service_role | M7, M1 (çöp kontrolü için) |
| M9 | Beş referans tablosunda bağlama tetikleyicileri (R3) | M8 |
| M10 | Depo INSERT politikasına ölü yol koşulu (R6) | M7 |
| M11 | Worker işlevleri: `kuyruktan_al`, `silindi_isaretle`, `yeniden_dene`, `kurtar`, `elle_bak` (kuşağa koşullu, yalnızca service_role) | M7 |
| M12 | `calismayi_kalici_sil(uuid)`: satırı sil, sonra aynı işlemde kuyruğa al. Hesap silme kuyruğa alma işlevi | M6, M8–M11 |
| M13 | Kanıt saklama işi (90 gün): **bayrakla kapalı**, hukuki onaydan sonra | M7 |
| — | Worker cron rotası: önce **yalnızca rapor** kipi, sonra ayrı onayla gerçek silme | M11, M12 |

M9 ile M10, P52b-1 akışlarıyla (otomatik ve elle PDF, değiştirme ve telafi) birlikte sınanmadan birleştirilmez.

---

## 5. Riskler ve kabul ölçütleri

### Riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Kilit kuralının bir yerde unutulması: yeni bir referans tablosu ya da yeni bir bağlama yolu | A1'deki gibi bağlı dosyanın silinmesi | Referans tabloları tek listede; `tests/db/` her referans tablosunda tetikleyicinin varlığını sabitler. Worker kira sonrası yeniden doğrular (R4) |
| Kontrolün kilitle aynı ifadeye yazılması, ya da işlevin STABLE işaretlenmesi | Kilit var ama koruma yok (A2-yanlis) | Kod incelemesi kuralı; bu iki yanlış biçim kabul düzeneğinde kalıcı senaryo |
| service_role ile yazan bir yol (bugün yalnızca exports) | Ölü yol politikası onu durduramaz | exports kuyruğun dışında. Yeni service_role yazıcısı eklenirken R6'ya göre değerlendirilir |
| Storage silmesinin koşulsuz olması | Geç gelen istek | R6: yol ölü. R7 pencereyi daraltır |
| `<kullanıcı>/` politikasına eklenen alt sorgunun maliyeti | Listeleme yavaşlar | Dizin; ileride çalışma dosyalarının `<çalışma>/` altına taşınması |
| İmzalı URL kalıntısı | Çöpe attıktan sonra ≤1 sa erişim | Kabul edildi, yazılı |
| Ofsetli listeleme | Envanter sayısı yanlış | R10: rapor karar vermez. Üretimde anahtar kümeli `storage.objects` okuması |
| M4'ün M5'siz uygulanması | Kılavuz senkronu bütünüyle düşer | Aynı sürüm |
| Gözetim rolünün geri yüklemesi | Hesap silme talebi olan kullanıcının verisinin diriltilmesi | §3.6 kuralı |

### Kabul ölçütleri (uygulama turunda; yerel yığın, PGlite ve gerçek Storage API)

**2C:**
- **A1–A4 düzeneği kalıcı:** öneri dört sırada güvenli. Yanlış biçimler, yani tek ifade ve STABLE, testte ANOMALİ olarak işaretli kalır ki biri "sadeleştirirse" görünsün.
- **Gerçek tablolarla:** her referans tablosu için kuyruğa alma ↔ bağlama, iki oturumla iki sırada. Bağlı ve kuyrukta satır sayısı her durumda 0.
- **B1–B3 gerçek Storage API ile:**
  - worker A'nın silme isteği bir geçitte bekletilir, kira dolar;
  - bağlama reddedilir;
  - A'nın isteği bırakılır;
  - başvurulan hiçbir dosya silinmez;
  - kanıt tam bir kez yazılır.
- **Ölü yol:** RLS'li istemcinin ölü bir yola yüklemesi reddedilir. Rastgele yeni yolla yükleme geçer.
- **Storage kapalı, 5xx ya da yetki hatası:** satır DELETED olmaz, deneme artar, 10'dan sonra ELLE_BAKILMALI olur.
- **Kısmi envanter** (`yarim` ya da `okunamayan > 0`): otomatik kuyruğa alma 0.
- **Meşru akışlar** aynen çalışır: P52b-1 otomatik ve elle PDF, değiştirme, telafi; belge, kılavuz, ÜAK ve doçentlik yükleme ve değiştirme; editör görsel kütüphanesi.
- **Editör görselleri ve exports** hiçbir senaryoda kuyruğa girmez.

**2B:**
- **Kaskat kümesi sabit:** 16 CASCADE ve 4 SET NULL. Kalıcı silmede 16 tablonun satırları gider, 4'ü NULL olur.
- **Çöpe atınca kapananlar:**
  - §3.1 ve §3.2'deki her satır sahip, atanan uzman, aynı kurum gözetimi ve başka kurum için ayrı ayrı sınanır;
  - REST üzerinden SELECT, INSERT, UPDATE ve DELETE;
  - Storage okuma, yükleme ve silme (`<çalışma>/` ve ilgili `<kullanıcı>/` nesneleri);
  - paylaşım sayfası;
  - AI kaydı.
- **Çöpteyken her yazma reddedilir**, DELETE dahil: otomatik kayıt, geç yükleme, otomatik PDF, danışmanlık güncellemesi, belge silme.
- **Geri yükleme sonrası** her tablo için satır sayısı ve içerik özeti, depo nesne listesi ve paylaşım bağlantıları çöpe atmadan önceki anlık görüntüyle **aynı**. Tek istisna yazılı bildirim temizliği.
- **Kılavuz senkronu** çöpte bir çalışma varken başarılı; çöpteki çalışma güncellenmez.
- **Hesap silme:** çöpteki çalışma hesapla birlikte, hesabın zamanında gider (30. günü beklemez). Talepten sonra geri yükleme reddedilir.
- **Kurum sınırı:** B kurumunun gözetim rolü A kurumunun çöp kutusunu göremez ve geri yükleyemez.

### Bu turda yapılmayanlar
- Migration, worker, gerçek Storage silmesi: yok. Yarış kanıtları yalnızca karalama veritabanında.
- Kabul ölçütlerinin çoğu migration gerektiriyor; yukarıda ölçüt olarak duruyor.
- **UNVERIFIED:**
  - barındırılan Supabase'te `storage.objects`'e salt okunur SQL erişim yolu;
  - `guard_academic_project_update` ve `sync_academic_project_guideline` gövdelerinin yeni sütunlara tepkisi;
  - barındırılan Storage'ın imzalı URL TTL'leri.
