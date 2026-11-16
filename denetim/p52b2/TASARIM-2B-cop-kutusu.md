# P52b-2B — 30 günlük çöp kutusu: tasarım (UYGULANMADI)

Bu belge bir öneri. Kod yok, migration dosyası yok.

## Bugünkü durum (ölçüldü)

**Silme akışı.** `app/actions/projects.ts` → `deleteProject`, `academic_projects` satırını **hemen** siliyor. Yetkiyi RLS veriyor: "Owner or oversight-role can delete projects".

**Çalışmaya bağlı tablolar.** Canlı şemaya denk yerel yığında `pg_constraint` ile çıkarıldı.
- **CASCADE (16):**
  - citation_checks, document_uploads, consultancy_requests;
  - project_manuscripts, project_manuscript_versions, manuscript_comments;
  - notifications, manuscript_share_links;
  - calisma_kilavuzu, kanit_kayitlari, makale_profili;
  - calisma_yapilacaklari, kaynak_pdfleri, yazim_kontrolleri;
  - calisma_takvimi, etik_kurul.
- **SET NULL (4):** literature_sources, ai_assistant_runs, analiz_sonuclari, literatur_tarama_gunlugu.

**Depo.** Hiçbir dosya silinmiyor; ayrıntı için P52b-2A envanterine bakın.

**Erişim kuralları.**
- Erişimin merkezi `can_view_project` / `can_write_project` işlevleri ve `academic_projects` üzerindeki SELECT politikası.
- `kaynak_pdfleri`, `etik_kurul` gibi tabloların okuma politikası doğrudan `exists (select 1 from academic_projects …)`: çalışma tablosunun RLS'ine yaslanıyor.
- Depo politikası `can_write_project(calisma_klasoru(name))` / `can_view_project(…)` kullanıyor.

## Öneri: yumuşak silme

**1. Sütunlar.** `academic_projects` tablosuna üç sütun:
- `silindi_at timestamptz`
- `silen uuid`
- `kalici_silinecek_at timestamptz` (varsayılan `silindi_at + 30 gün`).

**2. Erişimi tek yerden kapatmak.**
- `can_view_project` / `can_write_project` işlevlerine `and p.silindi_at is null` eklenir.
- SELECT politikası iki parçaya bölünür:
  - silinmemiş çalışmalar: bugünkü kurallar;
  - silinmiş çalışmalar: **yalnızca sahibi ve iç ekip** görür, o da yalnızca çöp kutusu ekranından.
- Böylece metin, sürüm, yorum, kaynak PDF, kılavuz ve etik kurul tablolarının yanında depo politikası da kendiliğinden kapanır. Tek tek tablolara dokunmak gerekmez.
- Paylaşım bağlantısı (`app/share/[token]`) service_role ile okuyor. Silinmiş çalışmayı açıkça reddetmesi gerekir; ayrı bir kod değişikliği.

**3. Yazma koruması.**
- `silindi_at` dolu bir çalışmaya her yazma reddedilir. Bunu bir tetikleyici ya da `can_write_project` sağlar.
- Gecikmiş istekler dahil: açık sekmedeki otomatik kayıt, geç gelen yükleme, otomatik PDF araması.
- Depo yükleme politikası `can_write_project` kullandığı için geç gelen yükleme de reddedilir.

**4. Silme.**
- `deleteProject` artık satırı silmez: `silindi_at = now()` yazar.
- Bunu bir `security definer` işlevi yapar (`calismayi_cop_kutusuna_at`). Yetki bugünkü silme politikasıyla aynı.
- Ekranda "Çöp kutusu — N gün sonra kalıcı olarak silinecek" yazar.

**5. Geri yükleme.**
- `calismayi_geri_yukle(id)`: yalnızca sahip ya da iç ekip, yalnızca `kalici_silinecek_at > now()` iken çalışır.
- `silindi_at = null` yapar; hiçbir veri taşınmaz, çünkü satırlar hiç silinmemişti.

**6. Kalıcı silme.** Zamanlanmış bir iş, `kalici_silinecek_at <= now()` olan satırları sırayla işler:
1. Çalışmanın depo klasörlerindeki bütün yollar silme kuyruğuna girer (2C, `PENDING_DELETE`).
2. Satır silinir; bugünkü kaskat çalışır.
3. Depo silmesi kuyruk worker'ının işidir. Satır silindikten sonra kuyruktaki yolları kimse yeniden bağlayamaz: sahip satır yok, depo politikası reddeder.

**7. Hesap silme ile etkileşim.**
- Hesap silme talebinde erişim **hemen** kapanır (bugün de öyle).
- Kullanıcının çöp kutusundaki çalışmalar hesapla birlikte gider; **çöp kutusu süresi hesap silmeyi uzatmaz**. Ürün kararı böyle.
- Hesap kalıcı silinirken kullanıcının bütün çalışmaları (silinmiş ve silinmemiş) ve kullanıcı klasörü tek seferde kuyruğa alınır.
- Önceden kalıcı silinmiş çalışmaların klasörleri artık 6. adımda kuyruğa girdiği için bugünkü "bulunamayan klasör" açığı kapanır.

**8. Kurum ve paylaşılan çalışmalar.**
- Gözetim rolleri (Kontrolör, Akademik Yönetici) bugün silebiliyor. Önerilen kural:
  - gözetim rolü çalışmayı **çöp kutusuna** atabilir;
  - **geri yükleme** sahip ya da aynı kurumun gözetim rolü yapabilir (`gozetim_kapsami`);
  - **kalıcı silmeyi** yalnızca zamanlanmış iş ya da iç ekip yapar.
- Atanan uzman (`assignee_id`) silemez; bugün de silemiyor.
- Kurum aboneliği bittiğinde 90 gün salt okunur ve dışa aktarma politikası ayrı bir bayrakla gelir. Hukuki inceleme yapılmadan etkinleştirilmez. Çöp kutusuyla ilişkisi: salt okunur dönemde çöp kutusuna atma ve geri yükleme kapalı olur.

**9. Referans bütünlüğü.**
- SET NULL alanlar (asistan kayıtları, analiz sonuçları, literatür) yalnızca kalıcı silmede boşalır; çöp kutusunda bağlı kalırlar, geri yüklemede zaten yerindedirler.
- `ai_assistant_runs` eğitim verisi olarak kalır (bugünkü davranış).

## Gerekli migration'lar (2B)
1. `academic_projects`: `silindi_at`, `silen`, `kalici_silinecek_at` sütunları ve kısmi dizin `(kalici_silinecek_at) where silindi_at is not null`.
2. `can_view_project` / `can_write_project` yeni gövdeleri ve `academic_projects` SELECT, UPDATE, DELETE politikalarının bölünmesi.
3. Yazma koruma tetikleyicisi (silinmiş çalışmaya yazma yok).
4. `calismayi_cop_kutusuna_at`, `calismayi_geri_yukle` (security definer; `revoke all … from public, anon, authenticated` ve yalnızca `authenticated`'a `grant`).
5. Kalıcı silme işlevi (yalnızca service_role).

## Kabul ölçütleri
Yerel yığın ve PGlite'ta, migration'la birlikte:
- **Sil → erişim kapanıyor:** metin, kaynak PDF, depo nesnesi ve paylaşım bağlantısı açılmıyor. Silinmiş çalışmayı sahibi görüyor, başkası görmüyor.
- **Geri yükle:** her şey eski hâlinde.
- **Silinmiş çalışmaya geç gelen yazma reddediliyor:** otomatik kayıt, depo yüklemesi ve otomatik PDF araması.
- **30. gün:** kalıcı silme; satırlar kaskatla gidiyor, yollar kuyrukta.
- **Hesap silme:** çöp kutusundaki çalışmalar da gidiyor; süre uzamıyor.
- **Kurum sınırı:** B kurumunun Kontrolörü A kurumunun çöp kutusunu görmüyor ve geri yükleyemiyor.
- **Meşru akışlar:** normal çalışma oluşturma, düzenleme ve gözetim okuması aynen çalışıyor.
