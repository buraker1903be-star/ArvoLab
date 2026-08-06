# ArvoLab

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
