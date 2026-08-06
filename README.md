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
- [x] APA 7 kaynakça doğrulama
- [x] Marka kimliği (logo, renkler)
- [ ] ArvoLab Orijinallik Ön-Kontrolü (kendi markalı benzerlik taraması)
- [ ] MAXQDA / SPSS çıktı yorumlama asistanı

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
