# Tek ana deneyim (20.11.2026)

Kurum sahibinin ürün kararı: **tek üyelik kimliği, tek ana kullanıcı görünümü, tek çalışma oluşturma akışı.**
Kural ve gerekçe kodda: `lib/yonetim.ts`.

## İnceleme: rol ve kuruma göre farklılaşan yollar (önce)

| Yol | Önceki davranış | Şimdi |
|---|---|---|
| Ana Sayfa (`/dashboard`) | Personel rolünde çok çalışmalı genel bakış (RLS'in gösterdiği bütün çalışmalar, sayaçlar, kuyruklar); öğrencide "Kaldığınız yer" | Herkes aynı kişisel düzen, yalnızca **kendi** çalışmaları |
| Çalışmalarım (`/dashboard/editor`) | Gözetim rolünde kurumun bütün çalışmaları, onay, sayaçlar; öğrencide kendi listesi | Herkes aynı iki kartlı liste, yalnızca kendi çalışmaları; iç ekibin kurum seçimi kişisel listeye uygulanmıyor |
| Hesap menüsü | İç ekipte "Görünüm: Personel / Öğrenci · kurum / Öğrenci · bireysel" (çerez); kurum seçici; "Personel Araçları" | Görünüm seçimi kaldırıldı (`lib/onizleme*` silindi); kurum seçici Yönetim ekranlarına taşındı; "Yönetim" bölümü |
| Kurum seçimi bildirimi | Her sayfanın üstünde "Yalnızca X gösteriliyor" | Yalnızca Yönetim, ekip, destek kuyrukları, asistan kayıtları ve kurum faturasında (`kurumSecimiGorunur`); kişisel Ana Sayfa ve Çalışmalarım'da yok |
| Yeni çalışma | Öğrencide sade pencere; personelde üniversite/enstitü/bölüm seçtiren tam form (`createProject`) | Herkes için tek pencere: ad, üç tür (tez, makale, proje), belge dili; Oluştur ve yaz / Word'den içe aktar. Doçentlik dosyası ortak pencerede değil, doçentlik modülünde (yalnızca personel; sunucu da reddeder) |
| Danışmanıma gönder | Yalnızca kurumsuz (bireysel) abonede | Herkesin kendi çalışmasında |
| Ctrl+K "çalışma aç" | RLS'in gösterdiği bütün çalışmalar | Yalnızca kendi çalışmaları |
| Boş durum / ilk kullanım | Personele "Üniversitenizi seçerek başlayın", "Enstitünüzden…" | Küresel metin |

## Yönetim alanı

- `/dashboard/yonetim`: eski personel ana sayfası (sayaçlar, dikkat isteyenler, uzman/destek kuyrukları, çalışma hareketi).
- `/dashboard/yonetim/calismalar`: eski personel çalışma listesi (onay, bilgileri düzenleme, silme, filtreler, öğrenci adı).
- Kapı: `STAFF_ROLES` (`app/dashboard/yonetim/kapi.ts`); Üye/Öğrenci için 404.
- Hesap menüsünün Yönetim bölümünden ve Ctrl+K'dan açıkça girilir.
- Satırları yine RLS seçiyor; onay işlemleri kendi sunucu denetimini yapıyor.
- Bir çalışmayı değiştiren her sunucu işlemi dört listeyi birden yeniler (`lib/liste-yenileme.ts`): Ana Sayfa, Çalışmalarım, Yönetim genel bakışı, Yönetim çalışmaları. Eskiden yalnızca ilk ikisi yenileniyordu; Yönetim'in sayaçları bir sonraki tam yüklemeye kadar eski kalıyordu.
- Sorumlu atama ekranda yok: `assignProject` 03.11.2026'da kaldırıldı (bkz. `app/actions/projects.ts`); sütun ve RLS kuralı duruyor. Bu yüzden atama sonrası yenileme sınanamadı; arayüzde atamadan söz eden metin düzeltildi.
- Başkasının çalışmasına giden bağlantılar (destek kuyruğu, eski `/dashboard/editor/<id>`, çalışma içindeki "Özet ve teslim") yetkiliyi Yönetim listesine indirir; yetkisiz kişi kendi listesinde kalır.

## Bu turda değişmeyenler

- Paket, fiyat, ödeme, Auth ayarı, RLS, migration.
- Mevcut kurum ve kılavuz kayıtları; "Bilgileri düzenle"deki kurum alanları.
- Destek sayfasındaki personel kuyrukları (rol bazlı, önizleme bağımlılığı kaldırıldı); Ayarlar'daki iç ekip bölümü.
- `b.erdogan@arvoculture.com` için hiçbir istisna yok; rolü değiştirilmedi.

## Kabul (yerel üretim derlemesi, sentetik veri)

İki tur var; ikisi de son olarak BUILD_ID `cjhw4Vfv3_xRRB1W2R7z8` (inceleme düzeltmeleriyle) üzerinde koşuldu, yerel yığın 127.0.0.1, gerçek hesap ve Production verisi yok.

- **Birinci tur: 36/36 PASS** (`kabul-sonucu.json`, `gorseller/`). Görünüm ve erişim.
- **İkinci tur: 16/16 PASS** (`kabul2-sonucu.json`, `gorseller2/`). Gerçek kayıt oluşturma ve kayıt sonrası yenileme; aşağıda.

### Birinci tur

**Hesaplar ve çalışmalar.** İki kurum vardı (A ve B). Beş hesap açıldı, her birinin bir çalışması var:

| Hesap | Rol | Kurum |
|---|---|---|
| kurucu | founder | — |
| personel | controller | A |
| kurumlu öğrenci | client | A |
| bireysel öğrenci | client | — (aktif bireysel abonelik) |
| B kurumunun öğrencisi | client | B |

**Dört erişim türünde aynı olanlar** (kurucu, personel, kurumlu, bireysel):

- Ana sayfa düzeni aynı (`os5-ana`).
- Ana gezinme aynı.
- Ana Sayfa ve Çalışmalarım yalnızca kişinin kendi çalışmasını gösteriyor.
- Hesap menüsünde görünüm seçimi yok.

**Yeni çalışma.** İki giriş noktası sınandı. İkisinde de aynı alanlar var (`title`, `type`, `belgeDili`), üç tür kartı ve iki çıkış (`word`, `yaz`). Kurum alanı yok.

**Yönetim erişimi.**

- Kurucu ve personel Yönetim'i görüyor; kurumlu ve bireysel öğrenci görmüyor (bulunamadı).
- Personel (A) kurum listesinde yalnızca A'nın çalışmalarını görüyor: kendi çalışması ve kurumlu öğrencinin çalışması. Bireysel aboneninkini, B kurumununkini ve kurucunun çalışmasını görmüyor.
- Kurucu beşini de görüyor (iç ekip).
- Onay araçları yalnızca Yönetim listesinde.

**Başkasının çalışmasına yönlendirme.**

- Personel, öğrencinin çalışmasını Yönetim listesinde seçili hâlde açıyor.
- Kendi çalışmasını kişisel listede açıyor.
- Öğrenci başkasının çalışma kimliğini adrese yazınca Yönetim'e yönlenmiyor ve o çalışmayı görmüyor.

**Görseller (`gorseller/`).**

- Dört rolün Ana Sayfa'sı ve Çalışmalarım'ı.
- Yeni çalışma penceresi.
- Kurucu ve personel için Yönetim.
- Kurucuda Ana Sayfa, Yeni çalışma ve Yönetim için tam matris: TR/EN × açık/koyu × masaüstü/telefon.
- Öteki rollerde EN koyu, masaüstü ve telefon.
- Özetler: `ozet-dort-rol-ana.png`, `ozet-yonetim.png`, `ozet-yeni-calisma.png`, `ozet-telefon.png`.

### İkinci tur (PR #113 incelemesi)

Bu tur gerçekten kayıt yazar ve sayfayı yenilemeden ölçer: işlemden sonra yalnızca istemci gezinmesi var, tam sayfa yüklemesi sayılıyor ve her senaryoda sıfır olmalı.

| Senaryo | Sonuç |
|---|---|
| Dört hesap türünde (kurucu, personel, kurumlu, bireysel) Yeni çalışma → Oluştur ve yaz | Sahibi kendisi, tür tez, kurumu hesabınki (kurucu ve bireysel NULL), editör açıldı, yazılan cümle kaydedildi ve yeniden yüklemede duruyor, kişisel listede |
| Word'den içe aktar (bireysel, `docx-ornek.mjs` ile üretilen sentetik dosya) | Metin ve iki başlık (Giriş, Yöntem) editöre geldi, kaydedildi, yeniden yüklemede duruyor |
| Kurucu, Kurum A seçili | Hesap menüsünde kurum yok; Yönetim şeridi "Yalnızca Kurum A"; Yönetim'de B yok; Ana Sayfa ve Çalışmalarım'da şerit yok, kendi çalışmaları orada; seçim açıkken oluşturduğu çalışma da kişisel listede |
| Doçentlik dosyası | Personel modülden oluşturdu (tür `associate-professorship`, kişisel listede); ortak pencere üç seçenekli kaldı; kurumlu öğrencide düğme yok |
| Onayla | Yönetim listesinin ve genel bakışın "Onay bekliyor" sayacı yenilemeden düştü |
| Onayı geri al | Kart "Revizyonda" ve "Onayla" düğmesi yenilemeden döndü; veritabanında onay silindi. Çalışma `revision`'a döndüğü için onay kuyruğuna GİRMİYOR, sayaç bilerek aynı kalıyor |
| Bilgileri düzenle (başlık) | Yeni başlık listede ve genel bakışta, yenilemeden |
| Çalışmayı sil (kurucu) | Listeden ve "Aktif çalışma" sayacından yenilemeden düştü, genel bakışta yok, veritabanında yok |

**Yerel geçit düzeltmesi.** Word içe aktarma ilk denemede yerelde düştü: tarayıcıdaki Supabase istemcisi geçide (127.0.0.1:54401) gidiyor, geçit de Supabase'in Kong'u gibi CORS başlığı eklemiyordu. Ürün hatası değil; `scripts/yerel-yigin/gecit.mjs` artık Kong'un CORS cevabını taklit ediyor. Production'da Supabase bunu zaten yapıyor.

### Yeniden koşmak

Depo kökünde, yerel yığın, geçit ve `next start -p 3150` açıkken:

```
node tasarim/tek-deneyim/betikler/tohum.mjs
node tasarim/tek-deneyim/betikler/kabul.mjs http://localhost:3150
node tasarim/tek-deneyim/betikler/tohum.mjs
node tasarim/tek-deneyim/betikler/docx-ornek.mjs /tmp/ornek.docx
node tasarim/tek-deneyim/betikler/kabul2.mjs http://localhost:3150 /tmp/ornek.docx
```

İkinci tur kayıt eklediği için birinci turdan önce tohum yeniden atılır.

`tohum.json` (rastgele şifre) betiğin yanına yazılır; depoya girmez.

**Sınırlama.** Yönetim'e yetkisiz girişte ekran "bulunamadı" gösteriyor, ama HTTP durumu 200. Bu, panelin `loading.tsx` sınırının bilinen etkisi; öteki panel sayfalarındaki `notFound()` ile aynı davranış.
