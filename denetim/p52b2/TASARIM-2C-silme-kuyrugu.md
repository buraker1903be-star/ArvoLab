# P52b-2C — Kalıcı silme kuyruğu: tasarım (UYGULANMADI)

Bu belge bir öneri. Kod yok, migration dosyası yok. Kalıcı veri silme mekanizması ayrıca onay gerektiriyor.

## Temel kabul

**PostgreSQL satır kilidi Storage silmesini atomik yapmaz.** Veritabanı işlemi ile Storage HTTP isteği aynı işlemin parçası olamaz. Bu yüzden tasarım "kilitle ve sil" üzerine değil, şu üç şey üzerine kurulu:
- açık durum geçişleri;
- her geçişte yeniden doğrulama;
- geri alınamaz adımı (Storage silmesi) en sona ve tekrar edilebilir hâle koymak.

## Durum makinesi (dosya yolu başına)

```
ACTIVE ──(sahipsiz kaldı / çalışma kalıcı silindi / hesap silindi)──▶ PENDING_DELETE
PENDING_DELETE ──(bağlandı)──▶ ACTIVE                      [kuyruktan çıkar]
PENDING_DELETE ──(en_erken geldi, worker kira aldı)──▶ DELETING
DELETING ──(Storage: silindi ya da zaten yok)──▶ DELETED   [kanıt kaydı]
DELETING ──(Storage: bilinmiyor / hata)──▶ PENDING_DELETE  [deneme+1, geri çekilme]
DELETING ──(kira süresi doldu, worker öldü)──▶ PENDING_DELETE  [başka worker alır]
DELETED   (son durum; yol bir daha kullanılmaz)
```

`ACTIVE` ayrı bir satır değildir: kuyrukta satırı olmayan yol ACTIVE sayılır. Kuyruk yalnızca silinmeye aday yolları tutar.

## Tablo (öneri)

```
depo_silme_kuyrugu (
  yol              text primary key,                 -- kova içi tam yol (yol kalıbı check'i)
  kova             text not null default 'project-files',
  durum            text not null check (durum in ('PENDING_DELETE','DELETING','DELETED')),
  neden            text not null,                    -- 'sahipsiz' | 'calisma_kalici_silindi' | 'hesap_silindi' | 'yerine_gecildi' | 'telafi'
  sahip_tur        text not null check (sahip_tur in ('calisma','kullanici')),
  sahip_ozeti      text not null,                    -- sahip kimliğinin SHA-256 özeti (veri minimizasyonu)
  istendi          timestamptz not null default now(),
  en_erken         timestamptz not null,             -- saklama: çöp kutusu sonrası hemen; sahipsiz için +7 gün
  deneme           int not null default 0,
  sonraki_deneme   timestamptz not null default now(),
  kira_sahibi      text, kira_bitis timestamptz,
  son_hata_turu    text,                             -- 'ag' | '5xx' | 'yetki' | 'bilinmeyen' (metin yok)
  silindi_at       timestamptz
)
```

**Erişim.**
- RLS açık; `authenticated` ve `anon` için **hiçbir politika yok**.
- Kuyruğa ekleme ve kuyruktan çıkarma yalnızca security definer işlevler ve service_role ile yapılır.
- Her işlevin ardından `revoke all … from public, anon, authenticated` ve yalnızca gereken role `grant`. Bu durum `tests/db/guvenlik.test.mjs` içinde sabitlenir.

**Denetim kaydı (`depo_silme_kaniti`).**
- Satırlar: `(yol_ozeti, sahip_ozeti, neden, istendi, silindi_at, deneme, worker)`.
- Yol ve kimlik ham tutulmaz, yalnızca özetleri. Silmenin yapıldığı kanıtlanır, dosyanın ne olduğu açığa çıkmaz.
- Saklama süresi hukuki incelemeyle belirlenir.

## Kurallar

1. **Atomik oluşturma.** Kuyruğa ekleme, sahipsizlik koşuluyla aynı SQL ifadesinde yapılır:
   ```
   INSERT … SELECT … WHERE NOT EXISTS (referans tablolarında yolu gösteren satır)
   ON CONFLICT (yol) DO NOTHING
   ```
   Çalışma kalıcı silinirken kuyruğa ekleme, satır silmesiyle **aynı veritabanı işleminde** yapılır: ya ikisi de olur ya hiçbiri.

2. **Silinirken yeniden bağlanma engeli.** Referans tablolarına (`kaynak_pdfleri.depo_yolu`, `document_uploads.storage_path` …) bir BEFORE INSERT/UPDATE tetikleyicisi eklenir. Tetikleyici `depo_silme_kuyrugu` satırını `FOR UPDATE` ile kilitler:
   - satır **PENDING_DELETE** ise silinir. Bağlama silmeyi iptal eder; yol ACTIVE'e döner.
   - satır **DELETING** ise bağlama **reddedilir**. Worker Storage isteğinin ortasında olabilir; sonucu bilinmeyen bir dosyaya kayıt bağlanmaz. Uygulama yeni bir yol ile yeniden yükler (P52b-1: yollar rastgele).
   - satır **DELETED** ise bağlama reddedilir. Yol ölmüştür.

3. **Worker'ın kira alması.** Satırlar şu sorguyla alınır:
   ```
   UPDATE … SET durum='DELETING', kira_sahibi=$w, kira_bitis=now()+'5 min'
   WHERE yol IN (SELECT yol … WHERE durum='PENDING_DELETE' AND en_erken<=now() AND sonraki_deneme<=now()
                 ORDER BY sonraki_deneme FOR UPDATE SKIP LOCKED LIMIT n)
   ```
   - Bu geçiş kısa bir işlemdir ve **2. kuraldaki kilitle sıralanır**: bağlama ile kira alma aynı satırı kilitler, biri ötekini bekler. Bağlama önce kazanırsa satır kuyruktan çıkmıştır, worker almaz. Worker önce kazanırsa durum DELETING'dir, bağlama reddedilir.
   - Kirayı aldıktan sonra worker referans tablolarına **yeniden** bakar. Yolu gösteren bir satır varsa (tetikleyicisi olmayan eski bir tablo, elle müdahale) satırı PENDING_DELETE'e döndürür ve bir uyarı sayar.

4. **Storage silmesi (geri alınamaz adım).**
   - Kira alındıktan sonra işlem dışında yapılır.
   - Sonuç P52b-1'deki gibi üçe ayrılır: **silindi**, **zaten yok**, **bilinmiyor**.
   - "Bilinmiyor" ağ hatası, 5xx ya da yetki hatasıdır. HEAD kullanılmaz; varlık listelemeyle doğrulanır.

5. **İdempotentlik.**
   - "Zaten yok" başarı sayılır.
   - DELETED satır bir daha işlenmez.
   - Aynı yolu iki worker alamaz (kira + `SKIP LOCKED`). Kira süresi dolup ikinci worker alsa bile Storage silmesi tekrarlanabilir bir işlemdir.
   - DELETED'a geçiş `WHERE durum='DELETING' AND kira_sahibi=$w` koşullu yapılır. Kirası düşen worker başkasının kaydını bitiremez.

6. **Yeniden deneme.**
   - "Bilinmiyor" sonucu satırı PENDING_DELETE'e döndürür: `deneme+1`, `sonraki_deneme = now() + min(24 sa, 1 dk · 2^deneme)` ve rastgele sapma.
   - 10 denemeden sonra satır durur ve yönetim panelinde "elle bakılmalı" olarak görünür. Silinmiş sayılmaz.

7. **Worker çökmesi.**
   - `kira_bitis < now()` olan DELETING satırları her turun başında PENDING_DELETE'e döner (`deneme+1`).
   - Storage silmesi olmuşsa bir sonraki deneme "zaten yok" alır ve DELETED'a geçer.

8. **Yolların yeniden kullanılmaması.**
   - P52b-1'den beri yeni yollar rastgele UUID ile biter.
   - DELETED satırı kuyrukta kalır (ya da yol özeti bir "ölü yollar" tablosuna taşınır). Tetikleyici bu yolu bir daha bağlatmaz.

9. **Yanlışlıkla silmeye karşı.**
   - **Saklama süresi:** çalışma 30 gün çöp kutusunda kalır (2B). Sahipsiz dosya en az 7 gün PENDING_DELETE'te bekler.
   - **İki kez doğrulama:** kuyruğa alırken ve kira aldıktan sonra.
   - **Storage tarafında geri dönüş:** Supabase Storage'da sürümleme yok. Gerekirse PENDING_DELETE sırasında dosyaları ayrı bir "karantina" kovasına taşıyan bir ara adım eklenebilir. Bu maliyet ve gizlilik karşılığında bir geri alma penceresi açar; ürün kararı.

10. **Hesap silme.**
    - Erişim hemen kapanır.
    - Kalıcı silmede kullanıcının klasörü ve bütün çalışma klasörleri tek işlemde kuyruğa girer, `auth.users` satırı silinir. Storage silmesi kuyruğun işidir; başarısız olursa kuyrukta kalır ve yeniden denenir. Bugünkü "günlüğe yaz ve unut" davranışının yerini alır.
    - Klasör listesi Storage'dan alındığı için listelemenin düşmesi kuyruğa ekleme adımını erteler, hesabı silmez. Ürün kararı: erişim zaten kapalı.

11. **Veri minimizasyonu ve günlükler.**
    - Günlüklere yol, dosya adı ya da kimlik yazılmaz. Yalnızca sayılar (alınan, silinen, yeniden denenen, duran) ve hata türü yazılır.
    - Kuyrukta yol ham tutulmak zorunda (silmek için). Erişimi yalnızca service_role'de.

## Gerekli migration'lar (2C)
1. `depo_silme_kuyrugu` ve `depo_silme_kaniti` tabloları; RLS açık, politika yok.
2. `depoyu_birak(yol, neden)` işlevi: atomik koşullu ekleme, security definer, yetkileri kısıtlı.
3. Referans tablolarına bağlama tetikleyicileri (2. kural): `kaynak_pdfleri`, `document_uploads`, `calisma_kilavuzu`, `uak_tablolari`, `academic_score_entries`. Metindeki görseller için ayrı karar gerekiyor; bkz. açık sorular.
4. Worker işlevleri: `kuyruktan_al(n, worker)`, `silindi_isaretle(yol, worker)`, `yeniden_dene(yol, worker, hata_turu)`. Yalnızca service_role.
5. Kalıcı çalışma silme ve hesap silme işlevlerinin kuyrukla birleştirilmesi (2B/5 ile birlikte).

## Kabul ölçütleri
Yerel yığın, gerçek Storage API, sentetik veri:
- **Aynı anda bağlama ve kira alma** (iki gerçek oturum):
  - bağlama önce → yol ACTIVE, worker almıyor;
  - worker önce → bağlama reddediliyor, dosya siliniyor ya da kayıt hiç yazılmıyor.
- **Storage kapalı:** satırlar PENDING_DELETE'e dönüyor, deneme artıyor, hiçbir şey DELETED sayılmıyor.
- **Worker kirayı aldıktan sonra öldürülüyor:** kira doluyor, ikinci worker işi bitiriyor, dosya bir kez siliniyor, kanıt bir kez yazılıyor.
- **Çift worker:** aynı yolu iki kez almıyor (`SKIP LOCKED`).
- **Geç gelen yükleme** (çalışma kalıcı silindikten sonra) reddediliyor; DELETED yol yeniden bağlanamıyor.
- **Hesap silme:** kalan klasörler kuyruğa giriyor. Storage hatası kuyrukta yeniden deneniyor, kaybolmuyor.
- **Başka kullanıcının ve kurumun dosyaları:** kuyruğa hiç girmiyor.
- **Günlük ve kanıt:** yol ya da kimlik içermiyor.
- **Meşru akışlar:** yükleme, değiştirme, otomatik PDF ve görsel kütüphanesi çalışmaya devam ediyor.

## Açık sorular (ürün kararı)
- **Editör görselleri:** metinden çıkarılan görsel kütüphanede kalıyor. Kütüphane temizliği olacak mı (örneğin hiçbir metin ve sürümde geçmeyen, 90 günlük görsel)?
- **Karantina kovası:** geri alma penceresi istenecek mi?
- **Silme kanıtlarının saklama süresi** ne olacak?
