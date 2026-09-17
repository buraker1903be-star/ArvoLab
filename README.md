# ArvoLab

## Tasarım Sistemi (ArvoOS tabanlı, iOS benzeri)

ArvoOS panelinin görsel dili ArvoLab'ın lacivert/yeşil marka renkleriyle tek
kaynaklı bir sisteme taşındı.

- **Stiller** `app/styles/` altında: `tokens.css` (renk, yarıçap, gölge,
  tipografi, hareket; açık ve koyu tema), `base.css`, `components.css`,
  `shell.css` (kenar çubuğu, üst çubuk, mobil gezinme), `auth.css`,
  `workspace.css` (editör, analiz tabloları).
- **Tema:** `<html data-theme="light|dark">`. Boyamadan önce `app/layout.tsx`
  yazar (kayıtlı tercih, yoksa işletim sistemi); düğme
  `app/_components/theme-toggle.tsx`.
- **Kabuk:** masaüstünde gruplu kenar çubuğu (aktif sayfa vurgulu) ve buzlu
  cam üst çubuk; 900px altında iOS gezinme çubuğu, alt sekme çubuğu ve sağdan
  açılan menü. Menü tanımı tek yerde: `app/dashboard/_components/navigation.ts`.
- **Bileşen sınıfları:** `status-pill` + `data-tone` (tonlar
  `lib/status-tone.ts`), `alert`, `callout`, `empty-state`, `section-title`,
  `cluster` / `stack`, `result-*`, `chip`, `segmented`, `compact-select`,
  `button-danger` / `button-success` ve mevcut `projects-*` / `project-*`.
- **Pencere / alttan açılan sayfa:** `app/dashboard/_components/panel-drawer.tsx`
  masaüstünde ortada pencere, 760px altında iOS gibi alttan kayan sayfa (tutma
  çizgisi, yapışık kaydet çubuğu). "Yeni … ekle" formları ve düzenlemeler bu
  pencerelerde açılır; sayfalar listeyle başlar.
- **Bildirim:** `ActionForm` başarıda iOS benzeri bir bildirim gösterir
  (`toaster.tsx`; masaüstünde üstte, mobilde sekme çubuğunun üstünde) ve açık
  pencereyi kapatır. Hata mesajı formun içinde kalır.
- **Kenar çubuğu:** "Menüyü daralt" ile simge moduna küçülür; tercih çerezde
  (`arvolab_nav`) tutulur, sayfa açılışında titreme olmaz.
- **Yazı:** Apple cihazlarda SF Pro, diğerlerinde Inter; Montserrat yalnızca
  logo ve marka yazısında.
- **Kurallar:** TSX'te satır içi stil ve hex renk yok (yalnızca veriye bağlı
  değerler); ham renk yalnızca `tokens.css`'te; en küçük yazı 11px.
  `npm run check:css` denetler, `npm run build` bunu otomatik çalıştırır.

## Faz 3 — Yönetim Ekranları

- **Çalışma düzenleme** (`/dashboard/editor/[id]/edit`): başlık, kaynakça
  sistemi (onaylı kılavuz yoksa), yöntem, durum, ilerleme (%), teslim tarihi,
  öncelik ve notlar. Sahibi, atanan personel ve Kontrolör+ düzenleyebilir.
  "Teslime hazır / Teslim edildi" durumları yalnızca Kontrolör+ tarafından
  verilir (veritabanı tetikleyicisiyle de korunur). Ana sayfa istatistikleri
  artık bu durumlardan beslenir.
- **Personel ataması:** Serbest metin yerine ekipten kişi seçilir;
  `assignee_id` dolduğu için atanan kişi çalışmayı kendi listesinde görür
  ve panelde yazabilir.
- **Ekip yönetimi:** E-postayla kullanıcı daveti (rol ve kurumla birlikte),
  kullanıcı listesinde e-posta ve "davet bekliyor" durumu, erişimi durdurma /
  yeniden açma. Bunlar sunucuda `SUPABASE_SECRET_KEY` gerektirir.
- **Düzenleme/silme:** Literatür kaynağı düzenleme, kılavuz kimlik bilgilerini
  düzenleme (üniversite/enstitü değişirse yeniden onaya düşer), doçentlik
  kriteri düzenleme, yüklenen belgeyi (dosya + analizler) silme.

**Supabase'de yapılması gereken (davet için):** Authentication → Email
Templates → **Invite user** şablonundaki bağlantıyı şu şekilde değiştirin:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/reset-password">Daveti kabul et</a>
```

Varsayılan şablon bağlantıyı tarayıcı tarafında (URL `#` kısmında) işler;
sunucu tarafı oturum kullanan bu panelde davetli kişinin şifre belirleyebilmesi
için `token_hash` biçimi gerekir. Site URL'in panel adresi olduğundan emin olun.

## Faz 2 — Veritabanı Dosyaları Canlı Yapıyla Hizalandı

Repodaki SQL dosyaları canlı Supabase veritabanından farklıydı; sıfırdan
kurulum `schema.sql`'in ilk politikasında çöküyordu. Artık `schema.sql` →
`supabase/migrations/*` (tarih sırasıyla) → `supabase/seeds/*` sırası temiz
bir veritabanında hatasız çalışıyor ve `academic_units` canlıyla birebir aynı
yapıda oluşuyor (PGlite üzerinde test edildi, rol/RLS davranış testleri dahil).

- `schema.sql`: `has_role()` ve `get_my_organization_id()` politikalardan önce
  tanımlanıyor; `profiles` okuma politikası canlıdaki gibi
  `get_my_organization_id()` kullanıyor (önceki hali sonsuz döngüye giriyordu).
- `prevent_self_role_escalation`: SQL Editor'den (JWT olmadan) rol atamaya
  artık izin veriyor — aşağıdaki "ilk yöneticiyi yükseltin" adımı önceden
  bu tetikleyiciye takılıyordu.
- `academic_units` migration'ı canlı yapıya çevrildi: `parent_unit_id`,
  Türkçe birim türleri (`fakulte`, `enstitu`, `bolum`…), `normalized_name`,
  `education_level`, `yok_unit_id`, `source_checked_at`.
- Eski içe aktarma hattı (`scripts/academic-directory` → staging →
  `import_academic_units()`) ve Ankara seed'leri Türkçe türlere uyarlandı.
  GitHub Actions iş akışının çağırdığı `academic-directory:*` npm betikleri
  bir önceki yüklemede silinmişti; geri eklendi.

**Canlıda yapılması gereken:** SQL Editor'de
`supabase/migrations/20260914090000_phase2_live_alignment.sql` dosyasını
çalıştırın (rol yükseltme tetikleyicisi + içe aktarma hattı; tekrar
çalıştırılabilir, mevcut veriyi değiştirmez).

## Faz 1 — Güvenlik ve Kırık Akış Düzeltmeleri

- **Giriş koruması:** `proxy.ts` (Next.js 16'nın middleware katmanı) oturumu
  olmayan ziyaretçiyi `/dashboard` altındaki tüm sayfalardan giriş sayfasına
  yönlendirir (girişten sonra kaldığı sayfaya döner) ve Supabase oturum
  çerezini her istekte yeniler.
- **Rol kontrolleri:** Onay geri alma, uzman talebi üstlenme/tamamlama/iptal,
  destek talebi durumu, doçentlik kriteri, kılavuz ekleme/silme ve ekip
  rol/kurum işlemleri artık server action'da rolü ve sahipliği doğruluyor
  (`lib/auth-guards.ts`). Yetkisiz işlemler sessizce "başarılı" görünmüyor.
- **Hata mesajları:** Sayfalardaki buton formları `app/dashboard/action-form.tsx`
  üzerinden çalışıyor; hata olursa butonun altında gösteriliyor. Silme
  işlemleri onay penceresi soruyor.
- **Doçentlik modülü:** Kayıt/kriter formları var olmayan `/dashboard/scoring`
  adresine gidip 404 veriyordu; düzeltildi. Kayıtlı kullanıcıları olan bir
  kriter silinmek yerine pasife alınıyor.
- **Yeni sayfalar:** `/dashboard/settings` (profil + şifre değiştirme),
  `/forgot-password`, `/reset-password`, `/auth/confirm`, Türkçe 404,
  dashboard yükleniyor/hata ekranları.
- `npm run lint` artık çalışıyor (`eslint.config.mjs`), `.env.example` tüm
  değişkenleri içeriyor. İşlevsiz bildirim zili kaldırıldı.

**Supabase'de yapılması gerekenler:**

1. SQL Editor'de `supabase/migrations/20260913120000_phase1_role_guards.sql`
   dosyasını çalıştırın. Bu dosya, kullanıcıların kendi çalışmasına Kontrolör
   onayı yazmasını ve kendi talebini "tamamlandı/çözüldü" yapmasını veritabanı
   seviyesinde engeller.
2. **Authentication → URL Configuration:** Site URL'i panel adresiniz yapın ve
   Redirect URLs listesine `https://<alan-adınız>/auth/confirm**` ekleyin
   (şifre sıfırlama bağlantısı için).
3. Vercel'e `NEXT_PUBLIC_SITE_URL` ekleyin (ör. `https://panel.arvolab.com`).

## Yeni Özellik — Çalışma Silme Butonu

Belge Editörü listesindeki her çalışma kartına **"Çalışmayı Sil"**
butonu eklendi. Yetki, veritabanı seviyesindeki (RLS) kuralla
birebir aynı: çalışmanın **sahibi** ya da **Akademik Yönetici/Sistem
Yöneticisi/Kurucu** rolleri silebilir (Kontrolör silme yetkisine
sahip değildir — bu bilinçli bir tercihtir, Kontrolör onay verir
ama kayıt silemez). Silmeden önce, çalışmanın adını içeren bir onay
penceresi çıkar ve bağlı tüm verilerin (belge yüklemeleri, kaynakça
kontrolleri, panelde yazılmış metin) de silineceği açıkça belirtilir
— bu veriler veritabanında `ON DELETE CASCADE` ile zaten otomatik
temizlenecek şekilde kurulu. Gerçek tarayıcıda test edildi: onay
penceresi doğru metinle çıkıyor, "İptal" seçilince hiçbir şey
silinmiyor.

**Supabase değişikliği gerekmiyor** — silme yetkisi ve kaskad kurallar
zaten önceki kurulumda mevcuttu, yalnızca arayüze eksik olan buton
eklendi.

## Yeni Özellik — Kapak Sayfası Şablonu

Panelde Yazma editöründe artık bir **"Kapak sayfası"** butonu var
(araç çubuğunun sağında). Açtığınızda: üniversite, enstitü/fakülte,
anabilim dalı/bölüm, program, çalışma türü (Yüksek Lisans/Doktora/
Lisans/Makale/Proje/Doçentlik), başlık, yazar adı, danışman ve
şehir/yıl bilgilerini girebileceğiniz bir form açılır — çoğu alan
çalışmanızın mevcut bilgilerinden (üniversite, enstitü, bölüm, başlık,
kendi adınız) otomatik doldurulur, isterseniz değiştirebilirsiniz.

Kapak sayfası açıksa, Word'e aktarımda belgenin **ilk sayfası** olarak
otomatik oluşturulur (standart Türkçe tez kapağı düzeninde: üstte
kurum bilgileri, ortada büyük harfli başlık, altta yazar/danışman/
şehir-yıl) ve ardından gerçek içeriğiniz yeni bir sayfada başlar.
Gerçek verilerle test edildi: LibreOffice'te render edilen çıktıda
kapak sayfası doğru düzende, sayfa geçişi ve sayfa numaralandırması
(1→2) sorunsuz çalışıyor.

**Bilinen basitleştirme:** Kapak sayfası da diğer sayfalar gibi
numaralandırılıyor (bazı kılavuzlar kapağın numarasız olmasını ister).
İsterseniz bunu ayrı bir adımda "ilk sayfada farklı üstbilgi/altbilgi"
özelliğiyle geliştirebiliriz.

**Supabase değişikliği gerekli:**

```sql
alter table public.project_manuscripts
  add column if not exists cover_page jsonb;
```

## Yeni Özellik — Sayfa Numarası

Panelde Yazma editöründeki "Sayfa Ayarları" paneline bir **"Sayfa
numarası ekle"** anahtarı eklendi (varsayılan: açık). Açıkken, Word'e
aktarılan belgenin her sayfasının altına ortalanmış, otomatik
numaralanan bir sayfa numarası ekleniyor (gerçek Word alan kodu
kullanılarak — sabit metin değil, Word'ün kendi sayfa sayacı).
Gerçek bir .docx oluşturup LibreOffice ile render ederek doğrulandı.

**Supabase değişikliği gerekli:**

```sql
alter table public.project_manuscripts
  add column if not exists show_page_numbers boolean not null default true;
```

## Yeni Özellik — Tez Formatlama: Satır Aralığı, Girinti, Kenar Boşlukları

Panelde Yazma editörüne üç yeni kontrol eklendi (Türkiye'deki
üniversitelerin tez/makale kılavuzlarında sık istenen özellikler):

- **Satır aralığı** (araç çubuğunda dropdown): Tek (1.0), 1.15, 1.5, Çift (2.0)
- **İlk satır girintisi** (araç çubuğunda buton, aç/kapa): 1.25 cm standart girinti
- **Sayfa kenar boşlukları** (araç çubuğundaki dişli ikonuyla açılan panel):
  üst/alt/sol/sağ, santimetre cinsinden, tamamen serbestçe düzenlenebilir

Üçü de hem editörde uygulanır hem de **Word'e aktarımda gerçekten
etkilidir** — varsayılan değer dayatılmaz (kurumdan kuruma değiştiği
için), kullanıcı serbestçe ayarlar. Gerçek bir .docx dosyası oluşturup
LibreOffice ile render ederek doğrulandı: asimetrik kenar boşlukları
(sol/üst geniş, sağ/alt dar), ilk satır girintisi ve 1.5 satır aralığı
hepsi doğru şekilde çıktıya yansıdı.

**Supabase değişikliği gerekli:** `project_manuscripts` tablosuna
kenar boşluğu sütunları eklendi — aşağıdaki SQL'i çalıştırın:

```sql
alter table public.project_manuscripts
  add column if not exists margin_top_cm numeric not null default 2.5,
  add column if not exists margin_bottom_cm numeric not null default 2.5,
  add column if not exists margin_left_cm numeric not null default 2.5,
  add column if not exists margin_right_cm numeric not null default 2.5;
```

Akademik Araştırma ve Analiz Sistemi — çalışanlarınız ve müşterileriniz için
akademik operasyon paneli.

## Mevcut Modüller

- **Kimlik doğrulama** — Supabase Auth (e-posta/şifre), oturum çerezleri SSR ile yönetiliyor.
- **Roller ve kurum yapısı** — proje dosyası Bölüm 3'e göre 6 rol: `employee`
  (Çalışan), `expert` (Uzman), `controller` (Kontrolör), `academic_manager`
  (Akademik Yönetici), `system_admin` (Sistem Yöneticisi), `founder`
  (Kurucu/Yönetim). Rol bilgisi `profiles` tablosunda tutulur — JWT/user
  metadata'da DEĞİL (proje dosyası Bölüm 3.1 ile uyumlu). Yeni kullanıcı
  kaydında otomatik `employee` rolüyle profil satırı açılır; rol
  yükseltmeleri yalnızca SQL/servis anahtarıyla yapılmalıdır.
- **Akademik Çalışmalar** — tez/makale/proje/doçentlik dosyası kayıtları
  (`academic_projects`), kurum/atanan çalışan/Kontrolör onayı alanlarıyla.
  Kontrolör, Akademik Yönetici, Sistem Yöneticisi ve Kurucu rolleri kurumdaki
  tüm çalışmaları görüp yönetebilir; Çalışan/Uzman yalnızca kendi/atandığı
  çalışmayı görür.
- **Belge Kontrolü → APA 7 Kaynakça Doğrulama** (`/dashboard/documents`) — kural
  bazlı kaynakça format kontrolü + metin içi atıf/kaynakça tutarlılık denetimi.
  **İçerik üretmez**, yalnızca denetler. Sonuçlar `citation_checks` tablosuna kaydedilir.
- **Marka kimliği** — logodan çıkarılan renkler uygulandı: lacivert
  `#002045` (`--primary`) ve yeşil `#6F9548` (`--accent`). Gerçek logo
  `public/arvolab-logo.png` altında ve giriş sayfasında kullanılıyor.

## Kapsam Notu

Bu panel bir **editöryal/danışmanlık destek aracıdır**:
- Kaynakça ve format denetimi yapar, metin üretmez.
- Orijinallik modülü (planlanan) Turnitin'in resmi raporunu taklit etmeyecek;
  kendi markasıyla ("ArvoLab Ön-Kontrol") bağımsız bir benzerlik taraması sunacak.
- Doçentlik puan hesaplayıcı (planlanan) yalnızca kullanıcının kendi beyan ettiği
  yayınlara ÜAK kriterlerini uygular; içerik/yayın üretmez.

## Yerel Geliştirme

```bash
npm install
cp .env.example .env.local   # Supabase bilgilerinizi girin
npm run dev
```

## Supabase Kurulumu

1. https://supabase.com üzerinde yeni proje oluşturun.
2. **SQL Editor**'de `supabase/schema.sql` dosyasının tamamını çalıştırın.
   Bu, `academic_projects` ve `citation_checks` tablolarını + RLS
   politikalarını oluşturur.
3. **Project Settings → API**'den şu değerleri `.env.local` ve Vercel'e ekleyin:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Authentication panelinden ilk kullanıcı(lar)ınızı oluşturun (e-posta/şifre).
   Kayıt olan her kullanıcı otomatik olarak `employee` rolüyle bir `profiles`
   satırı alır. İlk yöneticinizi (Kurucu/Sistem Yöneticisi) SQL Editor'de
   yükseltin:

   ```sql
   update public.profiles set role = 'founder' where id = '<auth-user-uuid>';
   ```

   Bir kurum oluşturup kullanıcıyı bağlamak için:

   ```sql
   insert into public.organizations (name) values ('AkademikMerkez') returning id;
   update public.profiles set organization_id = '<yukarıdaki-id>' where id = '<auth-user-uuid>';
   ```

## Migration Kuralı

Yeni migration açarken **`supabase migration new` kullanmayın**:

```bash
npm run db:new -- "paylasim baglantisi suresi"
```

Nedeni: bu projede migration dosyaları bir dönem gerçek tarihle değil "bir
sonraki gün" mantığıyla adlandırıldı ve sapma 24 Eylül 2026'ya kadar çıktı
(dosyalar 17 Eylül'de yazıldığı hâlde `20260924…` adını taşıyor). Uygulanmış
migration'lar Supabase tarafında sürüm dizesiyle izlendiği için geriye dönük
yeniden adlandırma defteri bozardı; dosyalar olduğu gibi bırakıldı.

Sonuç olarak bugünün gerçek zaman damgasıyla açılan bir dosya, zaten
uygulanmış olanların **önüne** sıralanır. `db:new` sürümü
`max(şimdi, son + 1 saniye)` olarak hesaplayıp bunu engeller.

`npm run build` (ve `npm run check:migrations`) şunları denetler: ad biçimi,
sürüm benzersizliği, tarihin gerçekten geçerli olması ve yeni bir dosyanın
git'te izlenen (yani gönderilmiş) en son sürümden büyük olması. Gerçek zaman
`20260924100000`'i geçtikten sonra normal zaman damgaları yeniden güvenli
hâle gelir ve denetim sessizce geçer.

Yeni tablo eklerken RLS'i açıp politikalarını aynı migration içinde yazın.

## Vercel Deploy

Mevcut Vercel hesabınızda **yeni bir proje** olarak bu GitHub reposunu bağlayın,
yukarıdaki iki ortam değişkenini ekleyin, deploy edin.

## Yol Haritası

- [x] Kimlik doğrulama
- [x] Roller ve kurum yapısı
- [x] "Yeni çalışma" formu Supabase'e gerçek kayıt yazıyor
- [x] Çalışmalar listesi ve dashboard istatistikleri gerçek verilerle çalışıyor
- [x] Kontrolör onay akışı (Kontrolör/Akademik Yönetici/Sistem Yöneticisi/Kurucu bir çalışmayı onaylayabilir/geri alabilir)
- [x] Doküman yükleme (DOCX/PDF) + otomatik kaynakça/atıf analizi
- [x] Üniversite tez yazım kılavuzu veritabanı + uyum kontrolü (zorunlu bölüm ve kaynakça sistemi denetimi)
- [x] Doçentlik puan hesaplayıcı (yönetilebilir kriterler + kullanıcı beyanına göre toplam puan)
- [x] "Uzmandan destek iste" talep akışı (açık talepler, üstlenme, tamamlama)
- [x] ArvoLab Orijinallik Ön-Kontrolü (erişilebilir belge havuzuyla shingle-tabanlı benzerlik taraması — Turnitin değildir)
- [x] APA 7 kaynakça doğrulama
- [x] Marka kimliği (logo, renkler)
- [x] MAXQDA / SPSS çıktı yorumlama asistanı (SPSS → APA7 biçimlendirme + kod kitabı kalite kontrolü)
- [x] Panelde Yazma: tam özellikli editör (başlık, tablo, resim, dipnot) + manuel kılavuz/APA7 kontrolü + gerçek .docx dışa aktarım
- [x] **Kritik hata düzeltmesi:** "Panelde Yaz" sayfası `DOMMatrix is not defined` hatasıyla çöküyordu. Sebep: `pdf-parse` kütüphanesi statik import edildiği için, onu hiç kullanmayan sayfalar bile (Turbopack'in paylaşılan derleme parçaları yüzünden) onu yükleyip tarayıcıya özgü API'leri (DOMMatrix) polyfill etmeye çalışıyordu. Çözüm: `pdf-parse` ve `mammoth` artık yalnızca gerçekten çağrıldıkları anda dinamik `import()` ile yükleniyor.
- [x] **Gerçek veri analizi motoru:** Analiz Merkezi'ne Excel/CSV yükleyip gerçek istatistiksel testler (betimsel istatistik, bağımsız örneklem t-testi, tek yönlü ANOVA, Pearson korelasyonu, ki-kare bağımsızlık testi, Cronbach Alpha güvenilirlik analizi) çalıştırma özelliği eklendi. Tüm hesaplama motoru sıfırdan yazıldı (Lanczos log-gamma, tamamlanmamış beta/gamma fonksiyonları) ve bilinen kritik tablo değerleri + elle hesaplanmış örneklerle doğrulandı (bkz. aşağıdaki "Doğrulama Notu"). Hesaplama tamamen tarayıcıda yapılır, veri sunucuya yüklenmez.

## Doğrulama Notu — Veri Analizi Motoru

`lib/stats-math.ts` ve `lib/stats-tests-core.ts` içindeki tüm istatistiksel
fonksiyonlar, teslim öncesinde şu şekilde test edilmiştir:
- t, F ve χ² dağılımlarının p-değerleri, ders kitabı kritik tablo
  değerleriyle (df=10,20,30 için t; çeşitli df kombinasyonları için F ve χ²)
  4 ondalık basamağa kadar birebir eşleşecek şekilde doğrulandı.
- Bağımsız örneklem t-testi, tek yönlü ANOVA, Pearson korelasyonu, ki-kare
  bağımsızlık testi ve Cronbach Alpha, elle hesaplanabilir küçük örnek
  veri setleriyle doğrulandı (sonuçlar beklenen değerlerle birebir eşleşti).
- Uçtan uca: gerçek bir Excel dosyası oluşturulup uygulamaya yüklendi,
  t-testi çalıştırıldı, arayüzdeki sonuç (t(8) = -2.00, p = .081) elle
  hesaplanan değerle doğrulandı.

**Bilinen sınırlama:** `xlsx` (SheetJS) npm paketinin bilinen, npm
üzerinden düzeltmesi olmayan güvenlik açıkları vardır (prototip kirliliği,
ReDoS). Bu riski azaltmak için dosya ayrıştırma tamamen kullanıcının
tarayıcısında yapılır (sunucuda değil) — bu, olası bir istismarın etkisini
yalnızca dosyayı yükleyen kullanıcının kendi oturumuyla sınırlar.

## Hata Düzeltmesi — Dosya Yükleme Boyutu Sınırı

Next.js Server Action'ları varsayılan olarak **1 MB** gövde boyutu
sınırına sahiptir; bunun üzerindeki bir DOCX/PDF yüklemesi, uygulama
içi bir hata mesajı bile göstermeden ham bir tarayıcı hatasıyla
başarısız olur ("This page couldn't load"). `next.config.ts`'te
`experimental.serverActions.bodySizeLimit` değeri **25 MB**'a
yükseltildi (uygulama içi 20 MB dosya boyutu kontrolüne uyumlu,
üzerine biraz pay bırakılarak).

## Yeni Özellik — SPSS Tarzı Kapsamlı Analiz Raporu

Analiz Merkezi'nde artık tek testleri tek tek seçmek yerine **"Kapsamlı
Raporu Oluştur"** butonuyla, yüklenen veri setindeki TÜM değişkenler için
otomatik olarak şunlar üretiliyor:
1. Tüm sayısal değişkenler için betimsel istatistikler (N, ortalama, SS, min, maks, medyan)
2. Tüm kategorik değişkenler için frekans tabloları (frekans + yüzde)
3. Tüm sayısal değişken çiftleri için korelasyon matrisi (r, p, N — p<.05 olanlar yeşil/kalın işaretli)

Belirli bir hipotezi (örn. iki grup arasında fark var mı) test etmek
isteyenler için tekil test seçimi (t-testi, ANOVA, ki-kare, güvenilirlik)
ayrıca mevcut. Gerçek bir örnek veri setiyle uçtan uca test edildi;
sonuçlar elle hesaplanan değerlerle birebir eşleşti.
- [x] Marka tutarlılığı düzeltmesi: 17 eksik CSS sınıfı (project-card, project-form-grid, projects-primary-button vb.) tanımlandı — Çalışmalar listesi, formlar ve tüm alt sayfalar artık ArvoLab tasarım diliyle tutarlı
- [x] Navigasyon yeniden yapılandırıldı (10 madde): Ana Sayfa, Belge Editörü, Literatür Taraması, Kaynakça Doğrulama, Analiz Merkezi, Belge Kontrol, Kılavuzlar, Doçentlik Puan Sorgulama, Uzman Desteği, Uygulama Destek Talep
- [x] Müşteri odaklı akış düzeltmesi: "Yeni Çalışma" formundan "Atanan çalışan" alanı kaldırıldı (müşteri kendi çalışmasını oluştururken bir çalışan seçmemeli). Atama artık çalışma oluşturulduktan sonra, yalnızca Kontrolör ve üzeri roller tarafından Belge Editörü listesinden yapılıyor.
- [x] Rol modeli düzeltmesi: Yeni kayıt olan her kullanıcı artık varsayılan olarak **Üye/Öğrenci (client)** rolüyle başlıyor (önceden yanlışlıkla "Çalışan" idi). AkademikMerkez personeli olmak, yalnızca Sistem Yöneticisi/Kurucu'nun yeni **Ekip Yönetimi** panelinden (`/dashboard/team`) bilinçli rol ataması yapmasıyla mümkün. Ayrıca kullanıcıların kendi rollerini kendilerine yükseltmesini engelleyen bir veritabanı güvenlik önlemi (trigger) eklendi.
- [x] Türkiye üniversiteleri referans listesi (204 devlet + vakıf üniversite, YÖK listesi baz alınarak) — Yeni Çalışma ve Kılavuz formlarında arama/otomatik tamamlama olarak kullanılıyor.
- [x] Kılavuz Tarama Aracı (yarı otomatik): Akademik Yönetici bir üniversitenin resmî tez yazım kılavuzu URL'sini (PDF/HTML) girip "Tara" diyebiliyor; sistem metni çıkarıp olası bölüm başlıklarını ve kaynakça sistemini öneriyor. **Hiçbir şeyi otomatik uygulamaz** — insan onayı her zaman gereklidir.

## Önemli Sınırlama — Kılavuz Tarama

"Otomatik kılavuz tarama" tam anlamıyla insansız/kendi kendine güncellenen bir
sistem DEĞİLDİR ve olmamalıdır: 200'den fazla üniversitenin resmî sayfalarını
hatasız yorumlayıp doğrudan kural olarak uygulayan bir yapay zeka, yanlış
kural çıkarımıyla öğrencilere zarar verebilir. Bunun yerine kurulan sistem:
Akademik Yönetici bir URL girer → sistem metni çeker ve olası bölüm
başlıklarını/kaynakça sistemini **önerir** → yönetici bu önerileri inceleyip
kendi onayıyla "Yeni Kılavuz Ekle" formuna işler. Bu, proje dosyasının kendi
"Kılavuz Güncelleme Akışı" ilkesiyle (Bölüm 6.3: değişiklikler akademik
yöneticiye sunulur, onaylanan sürüm etkinleşir) birebir uyumludur.

## Navigasyon → Route Haritası

| Nav öğesi | Route | İçerik |
|---|---|---|
| Ana Sayfa | `/dashboard` | Özet istatistikler + modül kısayolları |
| Belge Editörü | `/dashboard/editor` | Çalışma listesi + yeni çalışma + panelde yazma (eski "Çalışmalar") |
| Literatür Taraması | `/dashboard/literature` | Kaynak havuzu takibi (yeni) |
| Kaynakça Doğrulama | `/dashboard/citations` | Manuel APA7 kaynakça kontrolü (Belge Kontrol'den ayrıldı) |
| Analiz Merkezi | `/dashboard/analysis` | SPSS→APA7, MAXQDA kod kontrolü |
| Belge Kontrol | `/dashboard/documents` | DOCX/PDF yükleme + analiz + kılavuz uyumu + orijinallik |
| Kılavuzlar | `/dashboard/guidelines` | Üniversite tez yazım kılavuzları |
| Doçentlik Puan Sorgulama | `/dashboard/associate-professorship` | Puan hesaplayıcı |
| Uzman Desteği | `/dashboard/expert-requests` | Akademik danışmanlık talebi |
| Uygulama Destek Talep | `/dashboard/support` | Teknik/uygulama destek talebi (yeni) |

## Faz 1 Tamamlandı 🎉

Proje dosyasındaki (Bölüm 10.1) "V1 kapsamı" ilk sürüm teslim
kriterlerinin tamamı karşılandı: kimlik doğrulama, rol/kurum yapısı,
proje CRUD, doküman yükleme + analiz, APA7 kontrolü, kılavuz uyumu,
Kontrolör onayı, orijinallik ön-kontrolü (kendi markalı), doçentlik
puan hesaplayıcı ve uzman danışmanlık talep akışı.

Sıradaki adımlar için proje dosyasının Faz 3-5 bölümlerine (gelişmiş
SPSS/nitel analiz otomasyonu, kılavuz otomatik izleme, ArvoOS
entegrasyonu, çoklu kurum SaaS modeli) bakılabilir.

## Yeni Özellik — Yazı Tipi ve Boyutu Seçimi (Belge Editörü)

Panelde Yazma editörünün araç çubuğuna iki yeni seçici eklendi:
- **Yazı tipi:** Times New Roman (Türkiye'deki üniversitelerin çoğunun
  tez/makale kılavuzlarında talep ettiği font), Arial, Calibri, Cambria,
  Garamond, Georgia, Verdana, Book Antiqua — seçim tamamen serbest,
  hiçbir kısıtlama yok.
- **Yazı boyutu:** 9-24 punto arası yaygın değerler (10, 10.5, 11, 12,
  13, 14 dahil).

Seçilen yazı tipi/boyutu hem editörde **canlı olarak görünür** hem de
**Word'e aktarımda gerçekten uygulanır** (docx.js `TextRun`'a `font` ve
`size` — yarım punto cinsinden — olarak geçirilir). Bu, gerçek bir
belgeyle uçtan uca test edildi: Times New Roman + 12pt seçilen bir
paragraf, LibreOffice ile render edilen çıktı Word dosyasında gerçekten
serif ve doğru boyutta görünüyor; biçim uygulanmayan metin varsayılan
fontta kalıyor.

## Hata Düzeltmesi — 413 FUNCTION_PAYLOAD_TOO_LARGE (Kök Sebep)

Önceki iki düzeltme (dosya boyutu sınırı, zaman aşımı) yardımcı oldu ama
gerçek kök sebep farklıydı: **Vercel'in sunucu fonksiyonlarında,
next.config.ts ile HİÇBİR ŞEKİLDE aşılamayan, platform seviyesinde sabit
bir istek boyutu sınırı (~4.5 MB) vardır.** Gerçek bir tez/makale dosyası
bunu kolayca aşar ve "413 FUNCTION_PAYLOAD_TOO_LARGE" hatasına yol açar
— bu, uygulama içi bir hata değil, Vercel'in altyapısının isteği daha
bizim kodumuza ulaşmadan reddetmesidir.

**Kalıcı çözüm — mimari değişiklik:** Dosyalar artık ASLA Vercel'in
sunucu fonksiyonlarından geçmiyor. Hem Belge Kontrol (DOCX/PDF yükleme)
hem de Panelde Yazma (resim ekleme), dosyayı **doğrudan tarayıcıdan
Supabase Storage'a** yüklüyor (`@supabase/ssr` browser client ile).
Sunucu fonksiyonuna yalnızca küçük metin verisi (dosya yolu, ad, boyut)
gönderiliyor; asıl analiz/metin çıkarımı, dosya Supabase'ten SUNUCU
TARAFINDA indirilerek yapılıyor — bu, gelen istek boyutu sınırına tabi
değildir çünkü giden bir istektir.

Bu değişiklik test edildi: gerçek bir DOCX dosyasıyla tarayıcı akışı
uçtan uca çalıştırıldı, JavaScript hatası oluşmadı, hata durumları
(oturum yok, boyut aşımı vb.) düzgün mesajlarla karşılandı.

## Hata Düzeltmesi — Sunucu Fonksiyonu Zaman Aşımı

Vercel'in sunucu fonksiyonları varsayılan olarak **10 saniye** zaman
aşımına sahiptir. Büyük dosya yükleme/analiz (Belge Kontrol), resim
yükleme (Panelde Yazma) ve dış URL'den kılavuz tarama gibi işlemler bunu
aşabilir — bu da uygulama içi hata göstermeden ham bir tarayıcı hatasına
("This page couldn't load") yol açar. İlgili sayfalara
(`app/dashboard/documents/page.tsx`, `app/dashboard/editor/[id]/write/page.tsx`,
`app/dashboard/guidelines/page.tsx`) ve dışa aktarım API route'una
`export const maxDuration = 60;` eklendi.

**Önemli not:** Bu ayar `"use server"` server action dosyalarına
DEĞİL, onları çağıran sayfa dosyalarına eklenmelidir — React'ın
kuralı gereği bir server action modülü yalnızca async fonksiyon
export edebilir, başka bir sabit export edilirse (maxDuration gibi)
tüm modülün export'ları algılanamaz hale gelir ve build hata verir.
Bunu ilk denemede yanlış yere ekleyip yakalayıp düzelttim.

## Yeni Özellik — AI Geri Bildirimi (ChatGPT/OpenAI)

Belge Kontrol sayfasında, analiz edilmiş her belge için **"AI Geri
Bildirimi Al"** butonu eklendi. Bu özellik **İÇERİK ÜRETMEZ**:

- Yapay zeka yalnızca belgenin YAPISI ve RETORİĞİ hakkında geri bildirim
  verir (ör. "giriş bölümünde amaç cümlesi net değil", "bu paragrafta
  birden fazla fikir karışık veriliyor")
- Sistem prompt'u (`lib/ai-feedback.ts`), modelin yeniden yazım/alternatif
  cümle önermesini, araştırma bulgularını yorumlamasını ve kopyalanabilir
  metin üretmesini AÇIKÇA YASAKLAR
- Arayüzde geri bildirim, turuncu/kesikli çizgili bir uyarı kutusunda,
  "öğreticidir, doğrudan kopyalamayın" ibaresiyle gösterilir — normal
  belge içeriğiyle karışmayacak şekilde görsel olarak ayrıştırılmıştır

**Kurulum gerekli:** Bu özelliğin çalışması için Vercel proje ayarlarına
şu ortam değişkenini eklemeniz gerekiyor:
- `OPENAI_API_KEY` — OpenAI hesabınızdan alacağınız API anahtarı
  (platform.openai.com/api-keys)
- `OPENAI_MODEL` (opsiyonel) — varsayılan `gpt-4o-mini`, isterseniz
  değiştirebilirsiniz

**Not:** API anahtarınız olmadan bu sandbox'ta canlı bir OpenAI isteği
test edemedim (dış API'ye erişimim yok); ancak istek/yanıt işleme
mantığını sahte (mock) bir yanıtla test ettim ve kod tabanı tam
derlemeden hatasız geçti. Anahtarı ekledikten sonra ilk denemede bir
sorun çıkarsa (özellikle OpenAI'dan dönen hata mesajı varsa) paylaşın.

## Proje Yapısı

```
app/
  actions/auth.ts                    # giriş/çıkış server action'ları
  actions/citation-check.ts          # APA7 kontrolünü çalıştırır + kaydeder
  dashboard/documents/               # Belge Kontrolü (APA7) sayfası
  api/apa7/validate/route.ts         # APA7 doğrulama API'si (bağımsız kullanım için)
lib/
  apa7.ts                            # kural bazlı doğrulama motoru
  supabase/client.ts, server.ts      # Supabase istemcileri
supabase/
  schema.sql                         # veritabanı şeması + RLS politikaları
```
