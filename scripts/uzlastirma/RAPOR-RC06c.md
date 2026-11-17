# RELEASE CLOSURE 06 — Teslimin dar tamamlanması (RC06c)

17.11.2026 · Karar: **HOLD** · Aşama 0–2 yeniden başlatılmadı. Production'a ve paylaşılan Test'e yazma yok;
PR birleştirme, migration repair, db push, ayar değişikliği yok. Production'da yalnızca katalog ve geçmiş
tablosu üst verisi okundu (içerik kopyalanmadı). Bu belge `RAPOR-RC06b.md`'yi günceller; çelişkide bu geçerli.

## 1. P8 — karar verildi

Hedef rol **`client`** (kullanıcı kararı). P8 artık karar bekleyen madde değil; yalnızca Production uygulama
onayı bekliyor (`paketler/P8_profil_rol_varsayilani.sql` başlığı güncellendi). Mevcut iki `employee` hesabına
**dokunulmaz** — P8 yalnızca sütun varsayılanını değiştirir, satır güncellemez (provada doğrulandı).

## 2. P7 ertelenmişken CLI nasıl "bekleyen 0" diyor — sürüm bazında

CLI dosya SÜRÜMLERİNİ sayar, nesneleri değil. "Bekleyen 0", 109 depo sürümünün hepsinin geçmişte kayıtlı
olduğunu söyler; şemanın depoyla aynı olduğunu söylemez. Kayıt kuralı ve her istisna:

| Kayıt durumu | Sayı | Sürümler | Ne zaman kaydedilir | Kanıt |
|---|---|---|---|---|
| **TAM** — içeriği Production'da | 96 | 90 EŞDEĞER + 6 BELİRSİZ | Dalga A (97 = bu 96 + aşağıdaki 20260924100003) | özet eşit; BELİRSİZ'lerde bugünkü son koşul ölçüldü (RC06b §4.1) |
| **TAM, paketten SONRA** | 8 | 20261112195236 (P1), 20261115203504 (P2), 20260913120000 (P6), 20260926131150 (P4), 20260924100026 + 100027 (P3), 20261106184046 + 20261107120542 (P5) | Dalga B, her biri kendi paketi uygulanıp özet eşleşince | provada bekleyen sayısı yalnızca paket uygulandıktan sonra düştü: 9→8→7→6→5→3→0 |
| **TAM (kendi içeriği)** | 1 | 20260924100003 | Dalga A | kendi nesneleri eşit; tablo farkı 20260924100027'den (P3) |
| **NET-EŞDEĞER** | 1 | 20261107113542 | Dalga B (P5 ile) | `sifre_durumum()`'u kurar, 20261107120542 kaldırır; ikisi birlikte net etki yok |
| **KISMİ — kabul edilen sapma** | 3 | 20260806234000, 20260806235500, 20260924100033 | **Dalga A-K, ayrı onay (Onay K, aşağıda)** | aşağıda; eksik parça adıyla yazılı |

### KISMİ kayıtlar: neden "uygulandı" yazılıyor ve neden bu CLI'ı temiz göstermek için değil

| Sürüm | Production'da VAR | Production'da YOK |
|---|---|---|
| **20260806234000** academic_unit_directory | `academic_units` tablosu, RLS, SELECT politikası, yazma politikaları (sonraki migration'ların adlarıyla; politika grubu özeti eşit) | `validate_academic_unit_parent()` + tetikleyicisi, `set_academic_unit_updated_at()` + tetikleyicisi (**P7, ertelendi**); `academic_units_university_parent_idx`, `academic_units_active_lookup_idx` (yerine `academic_units_root_unique`); "Authenticated users can view universities" (aynı koşulu "All authenticated users can view universities" sağlıyor) |
| 20260806235500 academic_unit_import_pipeline | staging tablosu (farklı yapıda), içe aktarma fonksiyonu (sonraki sürümle aynı) | staging tablosunun depo yapısı (farklı soy; çalışma anı kullanmıyor) |
| 20260924100033 ortak_veri_ve_yorum_yazma_kapsami | thesis_guidelines kurum sütunu/dizini, öteki politikalar (özet eşit) | depodaki yinelenen universities SELECT politikası |

- Bu sürümlerin **ana gövdeleri** Production'da: tablo, RLS, politikalar. Kaydedilmezlerse CLI ve
  entegrasyon onları yeniden çalıştırmaya kalkar. Bu, oturmuş tabloyu ve politikaları gözden geçirilmeden
  yeniden kurar ve P7'yi onaysız uygular. Bu yüzden kaydedilmemeleri daha güvenli DEĞİL.
- Eksik parçalar kayıt geri çekilerek değil, **yeni bir migration'la (yeni sürüm)** teslim edilir. P7
  sonra bu yolla gelir. Manifestoda her biri `KISMİ — var: … · yok: …` olarak durur
  (`gecmis/MANIFESTO.md`, `manifesto.tsv` "kayıt_durumu" sütunu).
- **Ölçüm:** geçmiş provasının son durumunda (CLI 121/0/0, bekleyen 0) depo hedefiyle şema farkı
  **142 satır** (`sonuclar/gecmis-son-fark.txt`). Bunların tamamı aşağıdaki listede. Dalga B'deki 9 sürümün
  hiçbir nesnesi farkta yok.

### Onay K — üç KISMİ sürümün geçmişe "uygulandı" yazılması (AYRI ONAY MADDESİ)

Bu üç kaydın yazılması Dalga A'dan **ayrıldı**: `gecmis/dalga-A.txt` artık 97 sürüm, üçü
`gecmis/dalga-A-kismi.txt`'te (manifestoda dalga `A-K (ayrı onay)`); `prova-gecmis.sh` onları kendi
adımında (4b) yazar. Dalga A'nın onayı bu üçünü KAPSAMAZ.

| Onaylanacak | Sürüm | Yazılınca CLI'ın artık kurmayacağı (Production'da YOK) | İleride yeni migration'ın kapsamı |
|---|---|---|---|
| K1 | 20260806234000 | `validate_academic_unit_parent()` + `validate_academic_unit_parent_trigger`; `set_academic_unit_updated_at()` + `set_academic_unit_updated_at_trigger`; `academic_units_university_parent_idx`; `academic_units_active_lookup_idx`; universities "Authenticated users can view universities" | **P7** (iki fonksiyon + iki tetikleyici; ön koşul sorgusu 17.11'de 0); iki dizin — Production'daki `academic_units_root_unique` ile birlikte değerlendirilerek; yinelenen politika gerekmez (aynı koşul var) |
| K2 | 20260806235500 | depo yapısındaki `academic_unit_import_staging` (id, parent_name, external_code, imported_at, import_error, created_at, tür kısıtı, bekleyen dizini) ve service_role'e yazma yetkisi | çevrimdışı birim içe aktarma hattı yeniden kullanılacaksa staging tablosunu ve `import_academic_units()`'i Production yapısıyla birlikte hizalayan bir migration (bkz. §2b bulgusu) |
| K3 | 20260924100033 | universities yinelenen SELECT politikası | yok (aynı koşulu "All authenticated users can view universities" sağlıyor) |

- Onay K verilmezse ne olur: bu üç sürüm geçmişte "bekleyen" kalır; CLI/entegrasyon onları **yeniden
  çalıştırmaya** kalkar (oturmuş tablo ve politikalar gözden geçirilmeden yeniden kurulur, P7 onaysız gelir).
  Bu yüzden Onay K verilmeden Dalga B'den sonra bile CLI temiz değildir ve **main birleştirmesi yapılmaz**.
- Eksik nesneler kayıt geri çekilerek değil, yeni sürümlü bir migration'la teslim edilir; o migration
  ayrı bir PR ve ayrı bir Production onayıdır.
- Prova (RC06d, `sonuclar/prova-gecmis-rc06d.txt`): Dalga A (97) sonrası bekleyen 12, Dalga A-K (3) sonrası
  bekleyen 9; iki repair de şemayı 0 satır değiştirdi; paketlerden sonra 121/0/0, bekleyen 0, depo hedefine
  göre fark yine 142 satır (liste birebir aynı).

### Kabul edilen şema farkları (CLI temizken kalanlar)

| Fark | Satır | Kaynağı | Uygulama etkisi |
|---|---|---|---|
| P7 fonksiyon ×2, tetikleyici ×2 | 4 | 20260806234000 (KISMİ) | yok — yalnızca çevrimdışı dizin betiği |
| P7 fonksiyonlarının çalıştırma yetkisi | 2 | aynı | yok |
| academic_units dizinleri (depo 2 ↔ Production 1) | 3 | 20260806234000 (KISMİ), Production soyu | sorgu planı; işlevsel değil |
| universities yinelenen SELECT politikası | 1 | 20260924100033 (KISMİ) | yok — aynı koşul |
| organizations SELECT ifadesi | 2 | `schema.sql` (migration değil) | yok — anlamca aynı |
| Tablo yetkileri (Production daha dar) | 82 | Production elle daraltılmış | yetim profil dalı dışında yok (RC06 §3.3); o dal için P9 |
| Fonksiyon yetkileri (Production daha dar) | 48 | aynı | yok — uygulamanın RPC'leri yetkili |
| Production'a özgü 3 tablo + farklı staging yapısı | — | ayrıntı §2b | yok — yayınlanan kod hiçbirine dokunmuyor |

### 2b. Production'a özgü tablolar ve farklı staging tablosu

Kaynak: Production kataloğu, salt okunur (sütun adı/tipi, RLS, politika adı, yetki, FK, bağımlı
fonksiyon/görünüm/tetikleyici). **Satır içeriği ve satır sayısı okunmadı.** Kod ilişkisi:
`app/`, `lib/`, `scripts/`, `supabase/` taraması (PR #102 HEAD `2d780b2`).

| Tablo | İşlevi (sütunlardan) | Production'daki erişim | Bağlı nesne | Yayınlanan kodla ilişkisi |
|---|---|---|---|---|
| `academic_programs` | ÖSYM program kataloğu: `osym_program_code`, `name`, `degree_level`, `language`, `education_type`, `scholarship_type`, `is_active`, `source_url/year/checked_at`; FK `university_id → universities` (CASCADE), `academic_unit_id → academic_units` (SET NULL) | RLS açık, **politika yok**; anon/authenticated yetkisiz; service_role yalnızca REFERENCES/TRIGGER/TRUNCATE (SELECT/INSERT yok) | yok (fonksiyon, görünüm, tetikleyici, gelen FK yok) | **yok** — hiçbir dosyada adı geçmiyor; API rolleriyle okunamaz/yazılamaz |
| `academic_program_import_staging` | program içe aktarma ara tablosu: `university_name`, `academic_unit_name`, `osym_program_code`, `program_name`, derece/dil/öğrenim/burs türü, kaynak alanları | aynı (politika yok, API rolleri yetkisiz) | yok | **yok** |
| `data_sources` | veri kaynağı künyesi: `source_name`, `source_type`, `source_url`, `scope`, `reference_date`, `fetched_at`, `checksum`, `notes` | aynı | yok | **yok** |
| `academic_unit_import_staging` (ikisinde de var, yapı farklı) | birim içe aktarma ara tablosu. **Production:** `university_name`, `parent_unit_name`, `unit_name`, `unit_type`, `education_level`, `yok_unit_id`, `source_url`, `source_checked_at` (kimlik sütunu yok). **Depo (20260806235500):** `id`, `university_name`, `parent_name`, `unit_name`, `unit_type`, `source_url`, `external_code`, `imported_at`, `import_error`, `created_at` + tür kısıtı + bekleyen dizini | Production: RLS açık, politika yok, service_role yalnızca REFERENCES/TRIGGER/TRUNCATE. Depo: service_role'e SELECT/INSERT/UPDATE/DELETE | `import_academic_units()` (Production'da EXECUTE yalnızca service_role) | **uygulama kodunda yok.** Yalnızca çevrimdışı betikler (`scripts/academic-directory/crawl.mjs:215`, `generate-sync-sql.mjs:42,48`) SQL Editor'de çalıştırılacak SQL üretiyor |

**Bulgu (düzeltilmedi, kapsam dışı):** Production'daki `import_academic_units()` gövdesi (md5
`c4ed4a25…`) `imported_at` ve `parent_name` sütunlarına başvuruyor; Production'daki staging tablosunda
ikisi de yok. plpgsql sütunları çalışma anında denetlediği için fonksiyon ilk çağrıda düşer: çevrimdışı
birim içe aktarma hattı Production'da bugün **çalışmaz**. Yayınlanan uygulamayı etkilemez (hiçbir uç onu
çağırmıyor, API rolleri yetkisiz). Bu turda düzeltme önerilmiyor; Onay K2'deki gelecek migration'ın konusu.

## 3. 12 boş yer tutucu: amaç, sınır, doğrulama, iz

Ayrıntı: `gecmis/ESKI-KAYITLAR.md`.

- **Amaç:** Production'daki 12 eski kayıt depoda yok. CLI ve entegrasyon bunlarda durur. CLI'ın önerisi
  bu kayıtları `reverted` yapmak (silmek); bunun yerine aynı sürümle **boş** dosya konur.
- **Sınır:** yalnızca yorum + `select 1;`. Production işlemini yeniden üretmez, yeni ortamda hiçbir şey
  kurmaz. `migration repair` bu 12 sürüme dokunmaz.
- **Yeni bulgu:** `check:migrations`, eski sürümlü yeni dosyaları **reddediyor** ("sürümü gönderilmiş en
  son migration'dan küçük"). Yer tutucuları depoya almak için dar bir istisna şart:
  `gecmis/check-migrations-yer-tutucu.patch`. Patch sabit 12 sürüme ve yalnızca `select 1;` gövdesine izin
  verir. Uygulanmadı; yer tutucuları alacak PR'ın parçası.
- **Doğrulama (yerel, geri alındı):**

  | Sınama | Sonuç |
  |---|---|
  | İstisnasız `check:migrations` | FAIL (beklenen) |
  | Patch ile | PASS (121 dosya) |
  | Yer tutucuya gerçek SQL yazılınca | reddedildi |
  | Temiz kurulum (121 dosya) ↔ depo hedefi (109 dosya) | **0 satır** şema farkı |
  | `test:db` | 350/350 |
  | `test:unit` | 2239/2239 |

- **İz:** her kaydın yalnızca güvenli üst verisi tutuldu (1 ifade, uzunluk, boşluksuz md5, işlem türü,
  hedef tablo). İçerik kopyalanmadı; bir kayıt profil rolü güncelliyor ve kişisel veri içerebilir. Her yer
  tutucu aynı parmak izini taşıyor.

  | Eşleşme | Sayı | Kayıtlar |
  |---|---|---|
  | Depoyla birebir | 2 | 20260817140252, 20260818073414 |
  | Yorum hariç birebir | 1 | 20260818072457 |
  | Aynı şema, veri adımı farklı | 1 | 20260815134724 |
  | Production'a özgü veri işlemi | 8 | — |

## 4. P9 — tam tanım (uygulama onayı YOK)

| | |
|---|---|
| Hedef tablo | `public.profiles` |
| Hedef rol | `service_role` (yalnızca) |
| Production'da mevcut yetki | `service_role = REFERENCES, SELECT, TRIGGER, TRUNCATE` · `authenticated = SELECT, UPDATE` · `anon` yok |
| Önerilen | `service_role`'e **DELETE** eklenir; başka rol ya da tablo değişmez |
| Neden | hesap silme cron'unun yetim profil dalı (yalnızca o dal; olağan yol GoTrue `deleteUser` + FK kaskadı, yetki gerektirmez) |
| RLS etkisi | **yok.** `profiles`'ta RLS açık (force değil); `service_role` `BYPASSRLS` taşıyor, RLS onu zaten sınırlamıyor. `authenticated`/`anon` için politika ya da yetki değişmiyor (DELETE politikası yok, DELETE yetkisi yok — değişmez). |
| DELETE'te tetikleyici | yok (`guard_profile_lifecycle`, `prevent_self_role_escalation` yalnızca BEFORE UPDATE) |
| Silmenin götürdükleri (FK) | CASCADE: `manuscript_comments.author_id`, `notifications.user_id`, `manuscript_share_links.created_by` · SET NULL: `thesis_guidelines.reviewed_by`, `manuscript_comments.resolved_by`, `academic_projects.assignee_id`, `academic_projects.controller_approved_by`, `consultancy_requests.assigned_expert_id` — yetim profil zaten hesabı silinmiş kişinindir; bu kaskadlar olağan hesap silmede de aynı |
| Not | `service_role` bugün `TRUNCATE` (tabloyu bütünüyle boşaltma) taşıyor ama `DELETE` taşımıyor; P9 bunu değiştirmez |

```sql
-- P9 (paketler/P9_yetim_profil_silme_yetkisi.sql)
begin;
grant delete on public.profiles to service_role;
commit;

-- Ön koşul / doğrulama
select has_table_privilege('service_role','public.profiles','DELETE');   -- önce false, sonra true
select has_table_privilege('authenticated','public.profiles','DELETE');  -- her zaman false

-- Geri alma (paketler/geri/R9_yetim_profil_silme_yetkisi.sql)
begin;
revoke delete on public.profiles from service_role;
commit;
```

Yerelde sınandı: ikişer kez uygulandı ve geri alındı, durum false/false → true/false → false/false.

**R9'un sınırı:** R9 yalnızca YETKİYİ geri alır. P9 açıkken cron'un sildiği yetim profil satırlarını ve
silmenin götürdüklerini (CASCADE: o kişinin `manuscript_comments` yorumları, `notifications`,
`manuscript_share_links`; SET NULL yapılan beş sütun) **geri getirmez**. O veri yalnızca yedek/PITR ile
döner — yedek ve PITR bu raporda hâlâ **UNVERIFIED**. Bu yüzden P9, yedek doğrulanmadan uygulanmamalı.

**Yetim profil seçimi P9 ile değişmez** — P9 yalnızca yetkiyi açar, hangi satırın silineceğine kod karar
verir. PR #102 bu rotada seçim koşullarına dokunmadı (`git diff 11044d6 2d780b2` yalnızca hata okumasını
ve `yetimSilinemedi` sayacını ekliyor). Referanslar PR #102 HEAD `2d780b2`:

| Koşul | Kod |
|---|---|
| Aday yalnızca silme talebi olan profil | `app/api/cron/hesap-silme/route.ts:55` — `silme_talebi_at is not null` |
| 30 günlük bekleme sorguda | `route.ts:51,56` — `sinir = şimdi − BEKLEME_GUNU`, `silme_talebi_at ≤ sinir`; `lib/hesap-silme.ts:13` `BEKLEME_GUNU = 30` |
| Bekleme uygulamada ikinci kez (saat kaymasına karşı) | `route.ts:79` — `suresiDoldu(...)` değilse atlanır; `lib/hesap-silme.ts:31-32` |
| Tur başına en fazla 10, en eski önce | `route.ts:16,57-58` |
| Kullanıcı okunamazsa yetim SAYILMAZ (yalnızca 404) | `route.ts:90-95` — başka hata ertelenir |
| Yetim dalı yalnızca auth kaydı YOKSA | `route.ts:104` |
| Silme yalnızca o adayın satırı | `route.ts:105` — `.delete().eq("id", aday.id)` |
| Talep geri alınırsa aday olmaz | `app/actions/hesap.ts:94` — `silme_talebi_at = null` |
| Talep yalnızca kişinin kendisinden, e-posta onayıyla; iç ekip hariç | `app/actions/hesap.ts:44` (ADMIN_ROLES reddi), `:53` (`onayGecerli`), `:60` (damga) |
Eski/yeni kod × yetkisiz/yetkili matrisi: `sonuclar/yetim-profil-test.txt`.

**Toplu taşıma geri çekildi:** RC06b'de eklenen `paketler/oneri/yetki-politikasi.sql` (Production yetki
kümesini depoya taşıma önerisi) bu turda **kaldırıldı**. Yalnızca P9 kaldı.

## 5. PR #102

| | |
|---|---|
| HEAD | `33f77d14666856177e25501fc709f3d69df8fe28` (RC06d: `2d780b2` + yalnızca `scripts/yerel-yigin/studyo-kabul.mjs` kanıt toplaması; uygulama kodu `2d780b2` ile aynı) |
| Taban | `design/os5` @ `11044d61846a160c73131f294cf175f4e319e82c` (birleşme tabanı aynı) |
| Commit'ler | `4dd20d0` düzeltmeler · `2d780b2` U4 kendi kullanıcısıyla ve K0'dan sonra |
| CI | `kontrol` ×2 success · Vercel success · Supabase Preview skipped |
| Durum | Draft, birleştirilmedi |

| Dosya | +/− | Değişiklik |
|---|---|---|
| `app/dashboard/editor/[id]/write/yazim-paneli.tsx` | +29/−1 | yaprak kaydırmada ve araç çubuğu boyu değişince yeniden ölçülür |
| `lib/kaynak-pdf-okuma.ts` | +17/−5 | süren iş haritaya sayaçtan önce, aynı eşzamanlı adımda yazılır |
| `app/api/cron/hesap-silme/route.ts` | +18/−3 | yetim profil silme hatası okunur, `ertelenen`/`yetimSilinemedi`, hata kodu günlükte |
| `app/actions/team.ts` | +9/−3 | davette rol her zaman açıkça yazılır |
| `scripts/yerel-yigin/studyo-kabul.mjs` | +65/0 | U4 (belirlenimci), kendi kullanıcısı, K0'dan sonra |
| `scripts/yerel-yigin/README.md` | +4/−1 | U4 ve R3'ün süreç içi sınırı |

### Test kanıtı (yerel yığın, Production benzeri şema ve yetkiler)

| Sınama | Sonuç |
|---|---|
| Tam Yazım Stüdyosu (son test betiği, boş makine) | **61/61 ×2** |
| U3+U4 ×3 (son betik, boş makine) | 18/18 |
| U3+U4 ×3 (önceki betik, boş makine) | 18/18 |
| Eski kod U4: telefon / 1024 | 0/3 · 1/3 (24/24 düğme erişilemez) |
| Denetimli deney: eski test betiği → yeni kod | 57/57 (K0 dahil) |
| R3 `next start`, düzeltmeden sonra | tek örnek 1 ×5; iki örnek 2 ×3 (günlükle doğrulandı) |
| R3 düzeltmeden önce | tek örnek 1, 1, 2; iki örnek 3, 3, 3 |
| Yetim profil (Production yetkisi) | eski `silinen:1` + profil kaldı → yeni `ertelenen:1, yetimSilinemedi:1` + 42501 günlükte |
| Davet "client" (varsayılan `employee`) | eski employee → yeni client |
| kimlik-kabul / kayıt bütünlüğü | 15/15 · 14/14 |
| tsc, eslint, check:css, check:rakamlar, check:migrations, test:unit, test:editor | temiz (2239 · 112) |

### Açıklanamayan dört düşme (korunuyor)

Yeni kodla ilk **×5 U3+U4 turunda 4 tekil FAIL** oldu: U3-1024, U3-telefon, U4-1440 ve U4-telefon, her biri
bir kez. Ayrıntı (gözlenen değerler) **kaydedilmemişti**; neden **bilinmiyor** ve herhangi bir sebebe
bağlanmıyor. Aynı zaman diliminde makinede başka işler de koşuyordu, ama bu bir kanıt değildir. Bu
düşmelerden sonraki ayrıntılı kayıtlı koşularda (×3, ×3, ×3 ve dört tam koşu) U3/U4 düşmesi olmadı. Biri
hariç: ikinci son koşu turunda **U3-telefon** bir kez yalnızca "Geri al" düğmesi erişilemez diye düştü
(panel üstü 345, taşma 0). Bunun da nedeni kanıtlanmadı.

İlk U4 sürümünün K0 düşmesi ve bir U4-1280 "kaydırma 0 px" düşmesi ise nedeni bulunmuş test kusurlarıydı
(tek oturum etkileşimi; kaydırma ön koşulunun tek karede denenmesi). İkisi de düzeltildi ve denetimli deneyle ayrıldı.

### RC06d: U3/U4 kanıtlı tekrarlar — AÇIK KABUL BULGUSU

Sonradan görülen **U3-telefon** düşmesi (ikinci son koşu turu, yalnızca "Geri al" erişilemez, panel
üstü 345) **açık kabul bulgusu** olarak tutuluyor; nedeni kanıtlanmadı. Aşağıdaki 10 turda U3-telefon hiç
düşmedi; bu, o düşmenin olmadığını değil, yeniden üretilemediğini gösterir.

**Düzenek** (PR #102 `33f77d1` — `2d780b2` + yalnızca test kanıt toplaması; geçme ölçütü değişmedi):
`studyo-kabul.mjs` U3/U4'te her adımda viewport, görsel viewport, kaydırma, belge yüksekliği,
yaprak ve araç çubuğu kutusu, odak, her düğmenin üstündeki öğe ve ekran görüntüsü yazar; senaryo
patlarsa hata yığını da. Anlık görüntü edilgendir (kaydırmaz, odak değiştirmez). Yerel yığın,
Production benzeri şema + P1–P6, P8 (`sema-ozeti` md5 `358efe9c…`), `next dev`, 4 çekirdek, makinede
başka iş yok. **10 tam stüdyo turu** (her tur 61 denetim). Kanıt: `sonuclar/rc06d-u3u4/tur1…10/`
(senaryo başına JSON, tur çıktısı), temsilci görüntüler `goruntu/`.

| Senaryo | PASS | FAIL | Düşmelerin ortak imzası |
|---|---|---|---|
| **U3-1024** | 3 | **7** | 7/7: asistan tıklaması sayfayı **314 px** aşağı kaydırmış (yaprak içindeki metin kutusu odak alıyor); 3/3 PASS: kaydırma 0. Tek erişilemeyen hep "Geri al", üstündeki öğe yaprağın kendi içeriği `div.yazim-bos-bas` @97,314, ölçüm sonunda yaprak üstü 371 |
| U3-telefon | 10 | 0 | — (tıklama sayfayı hiç kaydırmadı) |
| **U4-1440** | 8 | **2** | 2/2: **ön koşul sağlanmadı** — sayfa 420'deyken tıklandı, açılışta kaydırma 0 oldu; dört adımın hepsinde 0/24 erişilemez, taşma 0 |
| **U4-1280** | 8 | **2** | aynı (açılışta kaydırma 0); dört adım temiz |
| U4-1024 | 10 | 0 | — |
| U4-telefon | 10 | 0 | — |

Tur toplamı: 61/61 yalnızca iki turda (3 ve 5). Bütün düşmeler U3-1024, U4-1440 ve U4-1280; öteki 58 denetim 10 turun 10unda PASS.
**Bu turlar U3-1024 ve U4-1440/1280 için PASS VERMEZ.**

**U3-1024 — denetimli deney (kanıt, `sonuclar/rc06d-u3u4/kare-deneyi*`):** sayfa 314'e kaydırılıp
yaprak o konuma göre oturduktan sonra U3'ün dizisi (yukarı kaydır → düğmeyi görünüme al → ölç)
kare kare tekrarlandı, 1024 ve telefonda 20'şer kez:

| Ölçüm anı | Örtük (1024) | Örtük (telefon) | Yaprak üstü |
|---|---|---|---|
| kaydırmayla eşzamanlı | 20/20 | 20/20 | eski (230 / 199) |
| 1 rAF sonra (U3'ün ölçtüğü an) | 20/20 | 20/20 | eski |
| aynı karenin çiziminden sonraki ilk görev | **0/20** | **0/20** | yeni (321 / 345) |
| 2 rAF sonra | 0/20 | 0/20 | yeni |

Kanıtlanan: U3'ün 1024'teki düşmesi, yaprağın kaydırmada yeniden hizalandığı (PR #102,
`yazim-paneli.tsx`: `scroll` → `requestAnimationFrame` → `hizala`) karenin İÇİNDE, yaprağın kendi
rAF'ı koşmadan önce alınan bir ölçüm. O karenin çiziminden sonra örtme 40/40 ölçümde yok; ekran
görüntüleri (`tur1-U3-1024-04.png`) de çizilen hâlde yaprağın araç çubuğunun altında olduğunu gösteriyor.
Kanıtlanmayan: kullanıcının kendi kaydırmasında (kompozitör iş parçacığı) tek bir karenin eski konumla
çizilip çizilmediği — başsız tarayıcıda ölçülemedi. **Bulgu açık; düzeltme yapılmadı.** Seçenekler
(karar sizin): (a) ölçümü çizilmiş kareye taşımak (testte iki kare beklemek — ölçütü değiştirir),
(b) `hizala`'yı `scroll` dinleyicisinde eşzamanlı çağırmak (ürün değişikliği; aynı karede düzeltir).

**U4-1440/1280:** düşme, senaryonun kendi ön koşulunun ("yaprak sayfa aşağıdayken açıldı") sağlanmaması:
masaüstünde yaprağın odak aldığı metin kutusu sayfayı değişken bir konuma kaydırıyor (10 turda 0, 65,
115, 420, 499). 0 olduğunda senaryo eski hatayı üretemez; ölçüm yapılmamış sayılır, PASS yazılmaz.

**İlk ×5 turundaki dört açıklanamayan düşme** (U3-1024, U3-telefon, U4-1440, U4-telefon) korunuyor.
U3-1024 ve U4-1440'ın bugünkü imzalarla örtüşmesi MÜMKÜN, ama o turların gözlenen değerleri saklanmadığı
için bağlanmıyor. U3-telefon ve U4-telefon için bugün bir imza yok.

### RC06e: U3 için dar ürün düzeltmesi (karar (b)) ve sonuçları

PR #102 HEAD **`8b3dddf`**. Ürün değişikliği tek: `0036569`, `yazim-paneli.tsx`. Kaydırma olayında
ölçüm artık rAF'a ertelenmiyor, olayın içinde yapılıyor; değer değişmediyse stil yazılmıyor.
Resize ve ResizeObserver kare başına bir ölçümle rAF'ta kaldı. Yeni panel mimarisi yok.
`0036569`'dan sonraki commit'ler yalnızca test betiğini ve sonuç dosyasını değiştirdi
(`git diff 0036569 8b3dddf -- app lib` boş).

Test değişiklikleri (ölçüme iki kare ya da sabit süre **eklenmedi**; U3'ün ölçütü aynı):
- **U3K:** U3-1024'ün düştüğü durumu her seferinde kurar (yaprak açıkken sayfa 314 px aşağı). Yaprak
  oturana kadar koşula bağlı bekler (üst kenarı üç kare aynı), sonra U3'ün AYNI ölçümünü yapar.
- **U3** artık tıklamanın kendi kaydırmasını da yazıyor (0 ise o tur yukarı dönüş yolunu sınamıyor).
- **U4 ön koşulu** yaprağın DOM'a girdiği andaki kaydırma; tıklamanın kendi kaydırması ayrıca kaydedilir.
  Ön koşul tutmazsa üç denemeden sonra `KURULAMADI` olur; PASS sayılmaz, çıkış kodu 1.
- **U5:** fare tekerleği ve klavyeyle kaydırma; çizilmiş her karede örtüşme aranır, fare düğmeye
  gerçekten isabet ediyor mu bakılır (`:hover`). Dokunma `UNVERIFIED`.
- İşlem kimlikleri sunucunun derlemesinden okunuyor. Eskiden `.next/dev` okunuyordu ve `next start`
  altında S5/S6/R1–R3 boş dönüyordu.

Ortam: `next build` + `next start`, yerel yığın, Production benzeri şema + P1–P6, P8 (md5 `358efe9c…`).
Kanıt: `sonuclar/rc06e-u3u4/` (her tur, her senaryo için JSON ve çıktı).

| Sınama | Eski kod `33f77d1` (ayrı derleme, kontrol) | Yeni kod |
|---|---|---|
| U3K-1024 | **FAIL 3/3** — "Geri al" ← `div.yazim-bos-bas` @97,314 | **PASS 10/10** |
| U3K-telefon | **FAIL 3/3** — "Geri al" ← yaprak içeriği @17,288, panel üstü 345 | **PASS 10/10** |
| U3-1024 / U3-telefon | PASS 3/3 (tıklama kaydırmadı → yol sınanmadı) | PASS 10/10 (tıklama sonrası kaydırma 10/10 turda 0 → yol U3K'da sınandı) |
| U4 ×4 genişlik | — | PASS 10/10 her biri; ön koşul 40/40 ilk denemede (açılış anında 420/499/501 px; tıklamanın kendi kaydırması 0 ya da +79/+81) |
| U5 tekerlek/klavye × 1024/telefon | — | PASS 10/10 her biri; 7–15 çizilmiş kare, örtük 0; fare isabeti var |
| Kare deneyi: kaydırmadan sonraki ilk rAF'ta örtük | 40/40 (`next dev`, RC06d) | **0/40** |
| Tam stüdyo kabulü | — | ilk koşu 14 FAIL: betik işlem kimliklerini geliştirme bildiriminden okuyordu; betik düzeltildi → **67 PASS · 0 FAIL · 1 UNVERIFIED** (U5-dokunma) |
| tsc, eslint, check:css, check:rakamlar, check:migrations, test:unit, test:editor | — | temiz (2239 · 112) |

- **Eski U3-telefon düşmesi:** imzası (yalnızca "Geri al", panel üstü 345) eski kodun U3K-telefon
  düşmesiyle aynı. Bu, aynı mekanizmayla UYUMLU. O koşunun değerleri saklanmadığı için kanıtlı değil;
  açık bulgu olarak kalıyor.
- **İlk ×5'in dört düşmesi** hiçbir sebebe bağlanmadı.
- **UNVERIFIED:** dokunmatik kaydırma ve kompozitörün kendi kareleri (başsız tarayıcı).

## 6. Yayın planı (güncel, RC06d)

**Entegrasyon davranışının doğrulanması BÜTÜN birleştirme adımlarının önündedir.** Sebep: GitHub
entegrasyonu Production'a bağlı ve Branching açık; Production dalının ve "Deploy to production"
ayarının ne olduğu doğrulanmadı. `design/os5` ya da `main`'e giren bir migration dosyası, ayar
öyleyse Production'a KENDİLİĞİNDEN uygulanabilir. Bugüne kadar böyle bir uygulama gözlenmedi
(`main` 104 migration, Production geçmişi yalnızca eski 12 kayıt); bu, ayarın kapalı olduğunun
kanıtı değil.

| Adım | Ne | Ön koşul | Kayıt |
|---|---|---|---|
| **0a** | **Entegrasyon davranışı** (panel): Production dalı hangisi, "Deploy to production" açık mı, Branching'in birleştirmede migration uygulayıp uygulamadığı; son yedek ve PITR | — | **UNVERIFIED** — kullanıcı; ekran görüntüsü/ayar değerleri rapora |
| 0b | PR #102 incelemesi (kod sahibi) | — (birleştirme değil) | — |
| 0c | #102 → `design/os5`, sonra #101 → `design/os5` (yalnızca belgeler) | **0a** | birleşik adayın commit SHA'sı |
| 0d | Yer tutucular + `check-migrations` istisnası ayrı PR → `design/os5` | **0a** (bu PR `supabase/migrations/`'a dosya ekliyor) | — |
| 1 | **Birleşik aday** (`design/os5`'in o anki SHA'sı) üzerinde, izole yerel yığın + Production benzeri şema ve **P1–P6, P8 uygulanmış** hâlde: gerçek AI kabulü (≤30 çağrı, güvenli test anahtarı) ve uçtan uca zincir (kayıt → e-posta doğrulama → ilk şifre → çalışma → DOI → PDF → AI → atıf/kaynakça → Word/PDF → yeniden giriş → veri bütünlüğü) | 0c, 0d; güvenli test anahtarı (**UNVERIFIED**) | **adayın commit SHA'sı + şema durumu**: `sema-ozeti` md5, uygulanan paketler, geçmiş tablosu sayımı |
| 2 | Production: Dalga 0 → Dalga A (97) → **Onay K varsa** Dalga A-K (3) → Dalga B paketleri (P5'in veri adımı pencerede yeniden ölçülür) → P8 → (onaylanırsa, yedek doğrulandıktan sonra) P9 | 0a + 1 + her biri için ayrı Production onayı | her adım sonrası Production özeti = provanın aynı adımı |
| 3 | `design/os5` → main | **0a**, 2 tamam, CLI bekleyen 0 (Onay K dahil) | — |

Adım 1, 0c/0d'den sonraki birleşik aday dışında bir commit üzerinde yapılırsa geçersizdir; yeniden koşulur.

## 7. PASS / FAIL / UNVERIFIED (değişenler, RC06d dahil)

| Konu | Sonuç |
|---|---|
| P8 hedefi | **KARARLAŞTIRILDI** (`client`); Production uygulaması onay bekliyor |
| CLI "bekleyen 0" açıklaması | PASS — sürüm bazında; 3 KISMİ, eksik parçalar adıyla |
| KISMİ kayıtlar | **ayrı onay maddesi (Onay K)**; Dalga A 97 + A-K 3, provada doğrulandı |
| CLI temizken kalan şema farkları | PASS — 142 satırın tamamı kabul edilen listede; Production'a özgü tablolar §2b |
| Çevrimdışı birim içe aktarma hattı (Production) | **FAIL (bulgu, düzeltilmedi)** — `import_academic_units()` olmayan sütunlara başvuruyor; uygulamayı etkilemez |
| Yer tutucular: temiz kurulum | PASS (0 fark, test:db 350/350); depoya alma `check-migrations` istisnası İSTER |
| Eski kayıt izi | PASS (12/12 parmak izi) |
| P9 tam tanım | PASS (hazırlık); uygulama onayı **yok**; R9 veri geri getirmez |
| PR #102 Yazım Stüdyosu kabulü | **PASS (yerel, `next start`, `8b3dddf`)** — U3K 10/10 (eski kodda 3/3 FAIL), U3/U4/U5 10/10, tam koşu 67/0/1; dokunma ve kompozitör UNVERIFIED; eski U3-telefon ve ilk ×5'in dört düşmesi açık bulgu (kanıtsız) |
| PR #101 CI @ `a6efca4` | PASS — `kontrol` ×2 success, Vercel success, Supabase Preview skipped |
| Yedek / PITR / entegrasyon ayarı | **UNVERIFIED** — bütün birleştirmelerin ön koşulu |
| Gerçek AI ve uçtan uca zincir | **UNVERIFIED** — güvenli test anahtarı yok; birleşik aday üzerinde yapılacak |
