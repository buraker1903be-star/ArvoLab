# Yayın planı: PR #110 (bağlamlı çalışma alanı)

**Aday:** `9827590db41544e33cf1e557e12af5925144fe4b` (`tasarim/baglamli-calisma-alani`). Uygulama kodu `7b05256` ile
aynı; bu planı ekleyen commit yalnızca bu dosyayı ekler. Geliştirme kapsamı kapandı: bu dala yeni özellik ya da
görsel düzenleme girmez. Bundan sonraki her değişiklik ayrı bir PR'dır.

**Bu plan yazılırken hiçbir şey uygulanmadı:** migration yok, merge yok, dağıtım yok. Aşağıdaki "salt okunur" sorgular
18.11.2026'da Production'da (`zpfpocyajnxcketdjbxm`) çalıştırıldı ve sonuçları yazıldı. Her adım tek yayın onayıyla
yapılır; bir durma koşulu çıkarsa onay kendiliğinden düşer.

## 0. Bugünkü durum (salt okunur, 18.11.2026)

| Denetim | Sonuç |
|---|---|
| Production Vercel | `dpl_GLoSgdGXu7rYtRBuG2FcPeotqFd9`, `main` @ `a076d9d` (#109), geri dönüş adayı |
| PR #110 | Taslak, taban `main` @ `a076d9d`, `mergeable_state: clean`, CI `kontrol` yeşil |
| Migration geçmişi | Canlıda 121 sürüm; depoda 123. Fark **yalnızca** `20261118122556` ve `20261118125346`; yalnız canlıda olan sürüm yok |
| Son uygulanan | `20261115203504 metin_surum_damgasi` (yeni ikisi ondan sonra sıralanıyor) |
| `academic_projects.belge_dili`, kısıt | Yok |
| `kaynak_pdfleri.kaynak_id`, dizin, işlev, tetikleyici | Yok |
| Bağımlılıklar | `academic_projects`, `kaynak_pdfleri`, `literature_sources` var; `literature_sources.id` uuid; `kaynak_pdfleri.project_id` var; iki tabloda RLS açık |
| Yetki | `authenticated`: iki tabloda tablo düzeyinde SELECT/INSERT/UPDATE/DELETE (sütun düzeyinde kısıt yok, yeni sütun kendiliğinden okunur ve yazılır); `anon`: yetki yok |
| `academic_projects` tetikleyicileri | `guard_academic_project_insert`/`update`, `guard_subscription`, `notify_project_changes`, `sync_academic_project_guideline`. Güncelleme koruması sütunları adıyla sayıyor (onay, atama, sahip, kurum, teslim durumu); `belge_dili` listede değil, sahibi yazabilir. Bu bilerek: migration'ın yorumu da öyle diyor |
| Satır sayısı | `academic_projects` 3, `kaynak_pdfleri` 30 (ikisi de küçük; `add column` ve kısıt anlık) |

## 1. Migration'lar: dosya adları ve sıra

| Sıra | Dosya | Ne yapar | Kilit / süre |
|---|---|---|---|
| 1 | `supabase/migrations/20261118122556_calisma_belge_dili.sql` | `academic_projects.belge_dili text` (NULL serbest, varsayılansız) + `check (null, 'tr', 'en')` | Kısa ACCESS EXCLUSIVE; 3 satır |
| 2 | `supabase/migrations/20261118125346_kaynak_pdf_kaynak_bagi.sql` | `kaynak_pdfleri.kaynak_id uuid references literature_sources on delete set null`, kısmi dizin, `kaynak_pdf_bagi_denetle()` (security invoker, `revoke … from public, anon, authenticated`) ve tetikleyici | Kısa ACCESS EXCLUSIVE; 30 satır |

İkisi de yalnızca EKLER: mevcut satır değişmez, toplu doldurma yok, varsayılan yok. İkisi de `if not exists` / `drop … if
exists` ile yeniden çalıştırılabilir.

**Uygulama yolu.** Canlı geçmişte sürüm adları dosya adlarıyla birebir (`version` + `name`), bu korunmalı. Her dosya
için tek işlem:

```sql
begin;
-- <dosyanın içeriği, olduğu gibi>
insert into supabase_migrations.schema_migrations (version, name)
values ('20261118122556', 'calisma_belge_dili');   -- ikincisi: '20261118125346', 'kaynak_pdf_kaynak_bagi'
commit;
```

Supabase CLI bağlıysa eşdeğeri `supabase db push`; önce `--dry-run` çıktısında **yalnızca bu iki dosya** görünmeli,
fazlası çıkarsa durulur. MCP `apply_migration` sürümü kendi zaman damgasıyla yazdığı için bu ikisinde kullanılmaz
(`check:migrations` ve geçmiş eşlemesi bozulur).

## 2. Ön koşul (migration'dan hemen önce, salt okunur)

Bölüm 0'daki sorgular yeniden çalıştırılır. Beklenen: yeni sütun/kısıt/işlev/tetikleyici/dizin sayısı **0**, bekleyen
migration **tam iki**, Production dağıtımı hâlâ `a076d9d`. `main` bu arada ilerlediyse PR yeniden `main` ile
birleştirilir, CI yeşil olmadan devam edilmez.

```sql
select
  (select count(*) from supabase_migrations.schema_migrations where version in ('20261118122556','20261118125346')) as kayitli,
  (select count(*) from information_schema.columns where table_schema='public'
     and ((table_name='academic_projects' and column_name='belge_dili') or (table_name='kaynak_pdfleri' and column_name='kaynak_id'))) as sutun,
  (select count(*) from pg_proc where proname='kaynak_pdf_bagi_denetle') as islev,
  (select count(*) from pg_trigger where tgname='kaynak_pdf_bagi_denetle_trigger') as tetik,
  (select max(version) from supabase_migrations.schema_migrations) as son;
-- beklenen: 0, 0, 0, 0, '20261115203504'
```

Yedek: Supabase'in günlük yedeği / PITR durumu Dashboard → Database → Backups'ta görülür ve son yedeğin saati not
edilir. Sütun geri almaları veri kaybettirdiği için (bölüm 6) bu not yayın kaydına girer.

## 3. Migration sonrası: şema önbelleği ve API doğrulaması

1. Veritabanında (her iki migration'dan sonra):

   ```sql
   select
     (select count(*) from supabase_migrations.schema_migrations where version in ('20261118122556','20261118125346')) as kayitli,          -- 2
     (select is_nullable||'/'||coalesce(column_default,'∅') from information_schema.columns
        where table_name='academic_projects' and column_name='belge_dili') as belge_dili,                                                  -- YES/∅
     (select pg_get_constraintdef(oid) from pg_constraint where conname='academic_projects_belge_dili_check') as kisit,
     (select confdeltype from pg_constraint where conrelid='public.kaynak_pdfleri'::regclass and contype='f'
        and conkey = array[(select attnum from pg_attribute where attrelid='public.kaynak_pdfleri'::regclass and attname='kaynak_id')]) as silme, -- n (set null)
     (select prosecdef from pg_proc where proname='kaynak_pdf_bagi_denetle') as definer_mi,                                                 -- false
     (select count(*) from information_schema.routine_privileges where routine_name='kaynak_pdf_bagi_denetle'
        and grantee in ('PUBLIC','anon','authenticated')) as acik_yetki,                                                                  -- 0
     (select count(*) from public.academic_projects where belge_dili is not null) as dolu_dil,                                             -- 0
     (select count(*) from public.kaynak_pdfleri where kaynak_id is not null) as dolu_bag;                                                 -- 0
   ```

2. Şema önbelleği: `notify pgrst, 'reload schema';`

3. API'den görülüyor mu (sentetik hesabın oturum belirteciyle, `apikey` = yayımlanabilir anahtar):

   ```
   GET /rest/v1/academic_projects?select=id,belge_dili&limit=1   → 200 (boş dizi de olur)
   GET /rest/v1/kaynak_pdfleri?select=id,kaynak_id&limit=1        → 200
   ```

   `PGRST204` ya da `42703` (sütun yok) dönerse önbellek yenilenmemiştir: `notify` bir kez daha, 30 sn sonra yeniden
   denenir; ikinci denemede de dönerse **kod dağıtılmaz** (bölüm 5).

4. Anon erişimi açılmadı: aynı iki istek oturumsuz → 401/permission denied (bugünkü durumla aynı).

## 4. Sıra: eski kod migration'dan sonra çalışır, yeni kod öncesinde çalışmaz

- **Migration → (eski kod `a076d9d` canlıda) → yeni kod.** Eski kod iki sütunu hiç adlandırmıyor; NULL'lu yeni sütunlar
  ve yalnızca `kaynak_id` dolu satırlarda iş gören tetikleyici onu etkilemez (tetikleyici `kaynak_id is null` ise hemen
  döner). Migration ile dağıtım arasında beklemek güvenli.
- **Ters sıra kırar.** Yeni kod editör sayfasının proje okumasında (`app/actions/projects.ts`), yeni çalışma
  oluşturmada, `lib/belge-dili.ts`'te ve PDF listesinde (`app/actions/kaynak-pdf.ts`, `SECIM`) sütunları adıyla
  seçiyor: sütun yokken **editör açılmaz**, yeni çalışma ve PDF listesi düşer. Bu yüzden Preview bu yollarda düşüyor
  ve Preview'da kabul yapılmadı.
- **Merge = Production dağıtımı.** Vercel'de `main`'e her push Production'a çıkıyor. Adımlar:
  1. Bölüm 2 → bölüm 1 (iki migration) → bölüm 3 (önbellek + API) tamam.
  2. PR #110 taslaktan çıkarılır, `main`'e birleştirilir (geçmişte olduğu gibi tek commit; ileti adayın SHA'sını
     taşır).
  3. Vercel Production derlemesi READY; dağıtımın commit'i `main`'deki birleştirme commit'i.
  4. Bölüm 7'deki canlı kontrol.

## 5. Durma koşulları

Herhangi biri olursa durulur; o noktaya kadar yapılan geri alınmaz, durum yazılıp yeni onay beklenir:

- Ön koşulda bekleyen migration iki değil, ya da sütunlardan biri zaten var.
- Migration işlemi hata verir (işlem geri sarılır, şema değişmez) ya da geçmiş kaydı yazılamaz.
- Bölüm 3'te bir değer beklenenden farklı; işleve `PUBLIC/anon/authenticated` yetkisi açık; NULL olmayan satır var.
- Önbellek yenilendikten sonra da API `PGRST204/42703` döner → **kod dağıtılmaz**; eski kod çalışmaya devam eder.
- Birleştirmeden önce CI kırmızı ya da `main` ilerlemiş ve yeniden birleştirmede çakışma var.
- Vercel derlemesi ERROR.
- Canlı kontrolde (bölüm 7) bir FAIL, sayfa hatası (`pageerror`), 5xx ya da Vercel çalışma hatalarında yeni bir hata.

## 6. Geri dönüş: kod ile veri ayrı

**Kod geri dönüşü (veri kaybı yok, ilk tercih).** Vercel → Deployments → `dpl_GLoSgdGXu7rYtRBuG2FcPeotqFd9`
(`a076d9d`) → Instant Rollback; ardından `main`'de birleştirme commit'inin `git revert`'ü (yoksa bir sonraki push yeni
kodu geri getirir). Migration'lar YERİNDE KALIR: eski kod yeni sütunlarla çalışıyor (bölüm 4), kullanıcıların
seçtiği belge dilleri ve kurduğu bağlar korunur, yeni kod yeniden çıkınca kaldığı yerden devam eder. Belge dili ya da
PDF bağı yanlış davranıyorsa geri dönüş budur.

**Sütun geri alma (VERİ KAYBETTİRİR, ayrı karar).** Yalnızca şemanın kendisi zarar veriyorsa (ör. tetikleyici meşru
bir PDF yazımını reddediyor ve kodla çözülemiyor, ya da yetki açığı). Önkoşul: kod önce `a076d9d`'ye dönmüş olmalı —
yeni kod sütunlar düşünce editörü açamaz. Sıra kurulumun tersi:

1. `supabase/geri-alma/20261118125346_kaynak_pdf_kaynak_bagi.sql` → **kaybolan:** kullanıcıların kurduğu bütün PDF–kaynak
   bağları. PDF'ler ve kaynak kayıtları silinmez; eşleşme yeniden künye/DOI ile yapılır.
2. `supabase/geri-alma/20261118122556_calisma_belge_dili.sql` → **kaybolan:** seçilmiş bütün belge dilleri. Çalışmalar eski
   türetmeye (makale profili → arayüz dili) döner; belgelerin metni değişmez, etiket dili değişebilir.
3. Her ikisi `notify pgrst, 'reload schema';` içerir.
4. `delete from supabase_migrations.schema_migrations where version in ('20261118125346','20261118122556');`

Kaybın boyutu geri almadan önce sayılır ve yayın kaydına yazılır:
`select count(*) from academic_projects where belge_dili is not null;` ve
`select count(*) from kaynak_pdfleri where kaynak_id is not null;`. İki geri alma dosyası yerel veritabanında bir işlem
içinde çalıştırılıp geri sarıldı; Production'da hiç çalıştırılmadı.

## 7. Yayın sonrası dar canlı kontrol (sentetik hesap)

Ayrı, gerçek kişiye ait olmayan bir test hesabıyla (bireysel abone, kurumsuz; adında "yayin-kontrol" geçer), Chromium,
1472 px ve 390×844 telefon emülasyonu. Gerçek kullanıcı verisine dokunulmaz, gerçek AI çağrısı yapılmaz.

| # | Kontrol | Geçme ölçütü |
|---|---|---|
| C1 | Eski çalışma (`belge_dili` NULL, migration öncesinden; hesapta yoksa yayından ÖNCE bu hesapla bir çalışma açılır) editörde açılır, bir cümle yazılır, kaydedilir, yenilenir | Metin kalır; `belge_dili` NULL kalır (kayıt dili yazmaz) |
| C2 | Yeni çalışma penceresi: ad, tür, belge dili **EN** → oluştur → yaz → kaydet → yenile | Satırda `belge_dili='en'`; editör açılır, metin kalır |
| C3 | Arayüz dilini değiştir (TR↔EN) | C2'nin belge dili değişmez; C1 eski kuralla çözülür |
| C4 | Kaynak ekle (DOI'siz, elle künye) + küçük sentetik PDF yükle → PDF panelinde "Bu kaynağa bağla" | Satırda `kaynak_id` dolu; atıf kartında "PDF'i aç" o PDF'i açar |
| C5 | Bağ yetkisi (API, sentetik hesabın belirteci): başka bir çalışmanın kaynak kimliğiyle `PATCH kaynak_pdfleri` | `42501` ile reddedilir, satır değişmez |
| C6 | Panel geçişleri 1472: Kaynaklar listesi + PDF (liste şeride iner, PDF sütun), Arvo AI paneli açılır/kapanır (AI'ya istek gönderilmez), Esc çekmeceyi/odak modunu kapatır; telefonda alt çubuk → Belge/Kaynaklar/Çalışma | Yatay taşma yok, sayfa hatası yok, kapatma düğmeleri ekranda |
| C7 | Word dışa aktarma: C2 (EN) ve C1 (TR) | `.docx` iner, açılır; metin, atıf, kaynakça var; içindekiler/şekil etiketi C2'de İngilizce, C1'de Türkçe |
| C8 | Vercel çalışma hataları ve Supabase API günlüğü, yayından sonraki 30 dk | Yeni 5xx, `PGRST204` ya da `42703` yok |

**Temizlik:** sentetik hesabın C1–C7'de oluşturduğu çalışma, kaynak ve PDF hesabın kendi silme yollarından silinir;
silinmeyen kalırsa kimlikleri yayın kaydına yazılır. Hesap bir sonraki yayında yeniden kullanılmak üzere kalır.

## 8. Doğrulanmamış maddeler ve kapsam farkları (yayında açık kalanlar)

UNVERIFIED (ölçülmedi, iddia edilmiyor):

- **Gerçek OpenAlex/Crossref.** Makale bul yalnızca elle yazılmış SENTETİK kayıtlı yanıtlarla sınandı (S17). Gerçek
  dizinin yanıtı, hızı, hata ve oran sınırı davranışı sınanmadı. Canlı kontrol bunu da sınamıyor (bilerek dar).
- **Gerçek modelle AI.** Kayıtlı sekmesi ve yazım asistanı yalnızca yerel model taklidiyle; canlı kontrolde AI isteği yok.
- **Tarayıcı ve cihaz.** Yalnızca Chromium; Safari/Firefox, gerçek dokunmatik cihaz ve ekran okuyucu ölçülmedi.
- **Vercel Preview'da kabul.** Migration'lar orada yok; kabul yalnızca yerel yığında ve temiz üretim derlemesinde
  (`calisma-alani-kabul-7b05256.json`, 21 PASS).
- **LaTeX ve paylaşım bağlantısı tarayıcıda** (birim ve editör testleriyle sınanıyor).
- **Production'da migration provası.** Dosyalar yerel yığında ve PGlite'ta uygulandı ve geri sarıldı; Production
  şemasının bağımlılıkları yukarıda salt okunur doğrulandı, ama dosyalar Production'da hiç çalıştırılmadı.

Kapsam farkları (bilerek yapılmadı):

- **Kayıtlı sekmesi** yalnızca yazım asistanının cevaplarını gösterir. Kaynakla sohbet ("Kaynağa sor") geçmişi ve
  diğer yeteneklerin kayıtları yok; bütün AI geçmişi tamamlanmış DEĞİL.
- Doğrulanmış pasaj yalnızca oturum boyunca tutulur; yenilemeden sonra kartta yalnızca "PDF'i aç".
- Atıf kartı dipnotlu stillerde açılmaz.
- Eski PDF'ler toplu ya da tahminle kaynağa bağlanmaz; eşleşme künye/DOI ile "olası eşleşme" olarak kalır.
- Mevcut çalışmaların belge dili toplu doldurulmaz (NULL = eski kural).
- Prototipten kalan görsel farklar `README.md` → "Prototipten kalan farklar".
