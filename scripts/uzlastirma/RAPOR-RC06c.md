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
| **TAM** — içeriği Production'da | 96 | 90 EŞDEĞER + 6 BELİRSİZ | Dalga A | özet eşit; BELİRSİZ'lerde bugünkü son koşul ölçüldü (RC06b §4.1) |
| **TAM, paketten SONRA** | 8 | 20261112195236 (P1), 20261115203504 (P2), 20260913120000 (P6), 20260926131150 (P4), 20260924100026 + 100027 (P3), 20261106184046 + 20261107120542 (P5) | Dalga B, her biri kendi paketi uygulanıp özet eşleşince | provada bekleyen sayısı yalnızca paket uygulandıktan sonra düştü: 9→8→7→6→5→3→0 |
| **TAM (kendi içeriği)** | 1 | 20260924100003 | Dalga A | kendi nesneleri eşit; tablo farkı 20260924100027'den (P3) |
| **NET-EŞDEĞER** | 1 | 20261107113542 | Dalga B (P5 ile) | `sifre_durumum()`'u kurar, 20261107120542 kaldırır; ikisi birlikte net etki yok |
| **KISMİ — kabul edilen sapma** | 3 | 20260806234000, 20260806235500, 20260924100033 | Dalga A | aşağıda; eksik parça adıyla yazılı |

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
| Yerelde modellenmeyen Production farkları | — | academic_programs, academic_program_import_staging, data_sources tabloları; staging yapısı | yok — çevrimdışı betik |

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
Eski/yeni kod × yetkisiz/yetkili matrisi: `sonuclar/yetim-profil-test.txt`.

**Toplu taşıma geri çekildi:** RC06b'de eklenen `paketler/oneri/yetki-politikasi.sql` (Production yetki
kümesini depoya taşıma önerisi) bu turda **kaldırıldı**. Yalnızca P9 kaldı.

## 5. PR #102

| | |
|---|---|
| HEAD | `2d780b2e65026dc809e33e7bf35ed19222eb63b4` |
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

## 6. Yayın planı (güncel)

| Adım | Ne | Kayıt |
|---|---|---|
| 0a | Panel: entegrasyon (Production dalı, "Deploy to production"), son yedek, PITR | **UNVERIFIED** — kullanıcı |
| 0b | **PR #102 incelemesi** (kod sahibi) | — |
| 0c | **#102 → `design/os5`**, sonra **#101 → `design/os5`** (yalnızca belgeler) | birleşik adayın commit SHA'sı |
| 0d | Yer tutucular + `check-migrations` istisnası ayrı PR → `design/os5` | — |
| 1 | **Birleşik aday** (`design/os5`'in o anki SHA'sı) üzerinde, izole yerel yığın + Production benzeri şema ve **P1–P6, P8 uygulanmış** hâlde: gerçek AI kabulü (≤30 çağrı, güvenli test anahtarı) ve uçtan uca zincir (kayıt → e-posta doğrulama → ilk şifre → çalışma → DOI → PDF → AI → atıf/kaynakça → Word/PDF → yeniden giriş → veri bütünlüğü) | **adayın commit SHA'sı + şema durumu**: `sema-ozeti` çıktısının md5'i, uygulanan paketler, geçmiş tablosu sayımı |
| 2 | Production: Dalga 0 (entegrasyon kesinleşir) → Dalga A geçmişi → Dalga B paketleri (P5'in veri adımı pencerede yeniden ölçülür) → P8 → (onaylanırsa) P9 | her paket sonrası Production özeti = provanın aynı adımı |
| 3 | `design/os5` → main (entegrasyon ayarı istenen hâldeyken) | — |

Adım 1, 0c'deki birleşik aday dışında bir commit üzerinde yapılırsa geçersizdir; yeniden koşulur.

## 7. PASS / FAIL / UNVERIFIED (değişenler)

| Konu | Sonuç |
|---|---|
| P8 hedefi | **KARARLAŞTIRILDI** (`client`); Production uygulaması onay bekliyor |
| CLI "bekleyen 0" açıklaması | PASS — sürüm bazında; 3 KISMİ, eksik parçalar adıyla |
| CLI temizken kalan şema farkları | PASS — 142 satırın tamamı kabul edilen listede |
| Yer tutucular: temiz kurulum | PASS (0 fark, test:db 350/350); depoya alma `check-migrations` istisnası İSTER |
| Eski kayıt izi | PASS (12/12 parmak izi; 3 birebir, 1 şema aynı + veri farklı, 8 Production'a özgü) |
| P9 tam tanım | PASS (hazırlık); uygulama onayı **yok** |
| PR #102 testleri | PASS; 4 açıklanamayan erken düşme + 1 açıklanamayan U3-telefon kayıtlı |
| Yedek / PITR / entegrasyon ayarı | **UNVERIFIED** |
| Gerçek AI ve uçtan uca zincir | **UNVERIFIED** — birleşik aday üzerinde yapılacak |
