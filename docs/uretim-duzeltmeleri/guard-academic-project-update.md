# Üretim düzeltmesi: `guard_academic_project_update`

**Durum (05.11.2026):** düzeltme kurum sahibince onaylandı; **Production'a
uygulanması onaylanmadı.** Hiçbir ortama SQL uygulanmadı. Bu belge
uygulamanın nasıl yapılacağını ve doğrulanacağını anlatır.

- SQL: [`guard-academic-project-update.sql`](./guard-academic-project-update.sql)
- Regresyon testi: `tests/db/calisma-guncelleme-korumasi.test.mjs`
  (`npm run test:db`, yerel PGlite)

## Sorun

`supabase/migrations/20260913120000_phase1_role_guards.sql` depoda
`academic_projects` için bir BEFORE UPDATE tetikleyicisi kurar. Canlı
veritabanında (`zpfpocyajnxcketdjbxm`) bu tetikleyici ve fonksiyonu yok.
Migration geçmişi 12 satır, depoda 104 dosya var; bu dosya canlıya hiç
uygulanmamış.

Canlıdaki UPDATE politikası ("Update own, assigned, or oversight-role
projects") satırı kimin değiştireceğini sınırlıyor: sahip, atanan ya da
kurumunun gözetim rolü. Hangi sütunun değişeceğini sınırlamıyor. Bu yüzden
canlıda sıradan bir kullanıcı **kendi** çalışmasında şunları yapabiliyor:

| Değişiklik | Canlı (tetikleyici yok) | Depo / düzeltme sonrası |
|---|---|---|
| Kendine onay yazmak (`controller_approved_by/at`) | geçer | reddedilir |
| Durumu `ready` / `delivered` yapmak | geçer | reddedilir |
| Kurumu taşımak ya da boşaltmak | geçer | reddedilir |
| Atanan kişi ya da atanan adı yazmak | geçer | reddedilir |
| Sahipliği devredip kendini atanan bırakmak | geçer | reddedilir |
| Başkasının çalışmasını değiştirmek | 0 satır (RLS) | 0 satır (RLS) |

Kurumlar arası veri okuma, kredi ya da abonelik kazancı yok: kredi ve
abonelik kurumu çalışmadan değil profilden alınıyor, profilde rol ve kurum
değişikliğini de canlıdaki `prevent_self_role_escalation` engelliyor.
Canlıda istismar izi yok: 2 çalışmanın hiçbiri onaylı, atanmış ya da
ready/delivered değil ve hiçbirinin kurumu sahibinin kurumundan farklı
değil.

## Taslak ile migration karşılaştırması

| | Migration 20260913120000 | Taslak |
|---|---|---|
| Fonksiyon gövdesi | — | **birebir aynı** (test sınıyor) |
| `security definer`, `search_path = public` | var | var |
| Yetki | yalnızca `revoke … from public` | `revoke … from public, anon, authenticated` |
| Tetikleyici | `drop if exists` + `create`, BEFORE UPDATE, FOR EACH ROW | aynı |
| İşlem | migration aracı sarar | kendi `begin; … commit;` bloğu |
| Geçmiş satırı | `db push` ile yazılır | **yazılmaz** (SQL Editor) |

Yetki farkının nedeni: Supabase yeni fonksiyonu `anon` ve
`authenticated`'a da açabiliyor. Canlıdaki eşi `guard_academic_project_insert`
bu iki rol için kapalı (05.11.2026'da okundu). Tetikleyici fonksiyonu
doğrudan çağrılamadığı için fark davranışı değiştirmez; AGENTS.md'deki
"her yeni fonksiyonun ardından revoke" kuralının gereğidir.

Komutlar `create or replace` ve `drop … if exists` olduğundan taslak iki kez
çalıştırılabilir (test sınıyor). Migration geçmişi ileride düzeltilirken
20260913120000'in yeniden çalışması da güvenlidir.

Tetikleyiciler ad sırasıyla çalışır: `guard_academic_project_update_trigger`
kılavuz eşitlemesinden (`sync_academic_project_guideline_trigger`) önce
çalışır. 20260915090000'deki yorum bu sırayı bekliyor. Eşitleme yalnızca
`guideline_id` ve `citation_style` alanlarına yazdığı için korumaya
takılmaz.

## Neyi bozmaz

- **Sahibin düzenlemeleri.** `updateProject`, takvim, kılavuz ve atıf
  stili, müsvedde ilerlemesi korunan sütunlara yazmıyor. Teslim dışı durum
  geçişleri ve `ready`'den geri dönüş serbest.
- **Gözetim akışları.** `approveProject` ve `revokeApproval` gözetim
  rolüyle çalışıyor ve tetikleyiciden muaf. Kurum sınırı RLS'te kalıyor:
  başka kurumun kontrolörü 0 satır görür, yönetici çalışmayı kurumunun
  dışına taşıyamaz.
- **Servis rolü yolları.** `auth.uid()` boşken kural atlanır. Gerekli,
  çünkü hesap silmede `controller_approved_by` ve `assignee_id` yabancı
  anahtarı ON DELETE SET NULL ile boşalıyor. Bu bir UPDATE'tir ve silme
  cron'u servis rolüyle çalışıyor.

**Muafiyetin güvenlik etkisi:** authenticated isteğin JWT'sinde `sub` hep
dolu. `sub`'sız istek anon sayılır; anon'un tabloda UPDATE yetkisi yok ve
politikalar `to authenticated`. Muafiyete yalnızca servis anahtarı ya da
veritabanı sahibi girebilir; ikisi zaten RLS'i atlıyor. Bu yollar yetkiyi
kendisi doğrulamak zorundadır.

Tek kullanıcı modeli değişmiyor: düzeltme yalnızca depodaki kuralı geri
koyar. Yeni bir rol, onay ya da atama akışı eklemez.

## Test projesi kurulduğunda doğrulama

Test projesi henüz yok; kurulumu ayrı onay bekliyor
([`../test-ortami.md`](../test-ortami.md)).

1. **Önce yerelde:** `npm run test:db` yeşil olmalı. Bu dosyada 38 senaryo
   var: tetikleyicili, tetikleyicisiz ve taslak uygulanmış hâller.
2. Test projesinin şeması depodan kuruluysa tetikleyici zaten vardır. Önce
   canlının durumunu taklit edin:
   `drop trigger guard_academic_project_update_trigger on public.academic_projects; drop function public.guard_academic_project_update();`
   Bunu YALNIZCA test projesinde yapın.
3. Taslağı test projesinin SQL Editor'ünde çalıştırın. SQL dosyasının
   sonundaki DOĞRULAMA sorgularından 1–3'ü çalıştırın; 3. sorgunun md5
   sonucunu not alın, Production'da aynı değer beklenir.
4. **Davranış denemesi:** test projesinde iki sentetik hesap açın
   (sahip ve kontrolör). Gerçek e-posta göndermeyin; kullanıcıları
   panelden "Auto Confirm" ile oluşturun.
   - Sahip, uygulamada başlık ve durum (`writing`) düzenlemesi yapar ve
     başarılı olmalı.
   - Sahip, tarayıcı konsolundan Supabase istemcisiyle
     `update({ controller_approved_at: new Date().toISOString() })` dener;
     hata kodu `42501` ve "Onay, atama ve teslim alanlarını…" mesajı
     dönmeli.
   - Kontrolör, uygulamada "Onayla" ve "Onayı geri al" yapar ve başarılı
     olmalı.
5. Geri almayı da deneyin (dosyanın sonundaki GERİ ALMA bloğu) ve
   tekrar uygulayın. İki yön de sorunsuz olmalı.

## Production kontrol listesi (onaydan sonra)

**Önce**
- [ ] Test projesinde yukarıdaki 1–5 tamamlandı ve sonuçlar kaydedildi.
- [ ] Kurum sahibi Production uygulamasını yazılı olarak onayladı.
- [ ] Yedek: Supabase panelinde son günlük yedeğin tarihini not edin
      (Database → Backups). Düzeltme veri değiştirmez; yedek yalnızca
      genel güvence içindir.
- [ ] Mevcut durumun anlık görüntüsünü alın (salt okuma):
      - `select count(*), max(version) from supabase_migrations.schema_migrations;`
        Beklenen: 12, 20260818091259.
      - `select tgname from pg_trigger where tgrelid='public.academic_projects'::regclass and not tgisinternal order by 1;`
        Beklenen: 4 tetikleyici, `guard_academic_project_update_trigger` yok.
      - `select to_regprocedure('public.guard_academic_project_update()');`
        Beklenen: NULL.
- [ ] Düşük trafikli bir saat seçin. Tetikleyici oluşturma tabloyu çok
      kısa süre kilitler; tablo 2 satır.

**Uygulama**
- [ ] SQL Editor'de taslağın `begin` ile `commit` arasını tek seferde
      çalıştırın. `supabase db push`, `supabase migration up` ya da MCP
      `apply_migration` KULLANMAYIN.

**Sonra (salt okuma)**
- [ ] DOĞRULAMA 1: tetikleyici listesi 5 öğe ve hepsi `O`.
- [ ] DOĞRULAMA 2: `anon` ve `authenticated` yetkisi false.
- [ ] DOĞRULAMA 3: md5 değeri test projesindekiyle aynı.
- [ ] DOĞRULAMA 4: migration geçmişi hâlâ 12 satır ve 20260818091259.
- [ ] Uygulamada sahip olarak bir başlık düzenleyin (kendi deneme
      çalışmanızda, geri alınabilir bir değişiklik) ve kaydın başarılı
      olduğunu görün. Canlıda saldırı denemesi YAPILMAZ; davranış
      yerelde ve test projesinde kanıtlandı.
- [ ] Vercel çalışma zamanı hatalarında `42501` ya da "Onay, atama ve
      teslim" mesajını 24 saat izleyin. Meşru bir akışta görünürse geri
      alın.

**Geri dönüş**
- [ ] Ölçüt: meşru bir kullanıcı düzenlemesi `42501` ile düşüyorsa.
- [ ] SQL dosyasının sonundaki GERİ ALMA bloğunu çalıştırın, ardından
      DOĞRULAMA 1'i tekrarlayın (tetikleyici yok olmalı).
- [ ] Veri değişmediği için veri kurtarma adımı yoktur.

## Bu düzeltmenin kapsamı dışında

- `academic_units` tetikleyicileri (`validate_academic_unit_parent`,
  `set_academic_unit_updated_at`) ertelendi. Canlı veri bugün kurallara
  uygun.
- Yalnızca canlıda bulunan `academic_programs`,
  `academic_program_import_staging` ve `data_sources` tablolarına
  dokunulmaz.
- RLS politikaları değişmez. Canlı ile depo arasındaki iki politika farkı
  (`universities` çift okuma politikası, `organizations` eşdeğer ifade)
  güvenlik açısından nötrdür.

## S1.1 — Atama zinciri ve editör resimleri (06.11.2026)

**Bulgu (Production, salt okumayla doğrulandı 06.11.2026):** tetikleyici ve
fonksiyon yok; migration geçmişi 12 satır. Bu yüzden sahip ve atanan kişi
`assignee_id`'yi kendisi yazabiliyor. Resim imzalama (yönetici istemcisi,
RLS'siz) atanan kişinin `<kimlik>/editor-images/` klasörünü de kabul
ediyordu. İkisi birlikte: A, B'yi kendi çalışmasına atayıp metnine B'nin
resim yolunu yazarsa, editör/yazdırma/Word/paylaşım yolları o dosyayı
imzalıyordu; paylaşım bağlantısıyla oturumsuz birine de. Ön koşul: B'nin
kullanıcı kimliğini ve dosya adını (`<zaman damgası>-<özgün ad>`) bilmek.
İstismar izi yok: Production'da atanmış çalışma 0.

**Düzeltme 1 — veritabanı (bu belge, onay bekliyor):** tetikleyici geri
gelince sahip ve atanan kişi `assignee_id`'yi yazamaz. Test projesinde
06.11.2026'da işlem içinde denendi ve geri alındı: A'nın denemesi 42501
ile reddedildi, B'nin A'nın çalışmasına denemesi RLS'te 0 satır.

**Düzeltme 2 — uygulama (bağımsız savunma katmanı, kodda):**
`calismaResimKlasorleri` (`lib/editor-resim-yolu.ts`) yalnızca çalışma
klasörünü ve sahibin klasörünü kabul eder; dört imzalama noktası
(`app/share/[token]`, `app/api/manuscripts/[projectId]/export`,
`app/dashboard/editor/[id]/write`, `app/print/manuscript/[id]`) bu
listeyi kullanır. Tetikleyici olmasa da zincir kapanır. Testi:
`tests/unit/editor-resim-yolu.test.ts`.

**Eski resimlerin geçişi:** atanan kişinin eski yükleme yolundaki
(`<atanan kimliği>/editor-images/…`) resimler artık imzalanmaz. Production'da
böyle resim yok (06.11.2026: tek editör resmi çalışma klasöründe; metinlerdeki
bütün resim bağlantıları kendi çalışma klasörüne gidiyor). Uygulamadan
hemen önce aynı salt okuma sorgusu yeniden çalıştırılmalı; sonuç sıfır
değilse önce o dosyalar çalışma klasörüne kopyalanır ve metindeki yol
güncellenir (ayrı onayla), sonra kod yayına alınır.

Doğrulama sorgusu (salt okuma, dosya adı yazdırmaz):

```sql
select count(*) as atanan_klasorunden_resim
from public.project_manuscripts m
join public.academic_projects p on p.id = m.project_id
where p.assignee_id is not null
  and m.content::text ~ ('/project-files/' || p.assignee_id::text || '/editor-images/');
```

Beklenen: 0.

**Not (düşük, güvenlik açığı değil):** depo okuma politikasındaki
`gozetim_kapsami(kullanici_kurumu(calisma_klasoru(name)), …)` ifadesi
`kullanici_kurumu`'na çalışma kimliği veriyor; o fonksiyon kullanıcı
kimliği bekliyor ve her zaman NULL döner. Bu dal hiç eşleşmez (kapalı
tarafa düşer); gözetim rolleri dosyaya zaten `can_view_project` dalından
ulaşıyor. Ayrı bir migration'la düzeltilebilir; acil değil.
