# Tek ana deneyim (20.11.2026)

Kurum sahibinin ürün kararı: **tek üyelik kimliği, tek ana kullanıcı görünümü, tek çalışma oluşturma akışı.**
Kural ve gerekçe kodda: `lib/yonetim.ts`.

## İnceleme: rol ve kuruma göre farklılaşan yollar (önce)

| Yol | Önceki davranış | Şimdi |
|---|---|---|
| Ana Sayfa (`/dashboard`) | Personel rolünde çok çalışmalı genel bakış (RLS'in gösterdiği bütün çalışmalar, sayaçlar, kuyruklar); öğrencide "Kaldığınız yer" | Herkes aynı kişisel düzen, yalnızca **kendi** çalışmaları |
| Çalışmalarım (`/dashboard/editor`) | Gözetim rolünde kurumun bütün çalışmaları, onay/sorumlu, sayaçlar; öğrencide kendi listesi | Herkes aynı iki kartlı liste, yalnızca kendi çalışmaları; iç ekibin kurum seçimi kişisel listeye uygulanmıyor |
| Hesap menüsü | İç ekipte "Görünüm: Personel / Öğrenci · kurum / Öğrenci · bireysel" (çerez); "Personel Araçları" | Görünüm seçimi kaldırıldı (`lib/onizleme*` silindi); "Yönetim" bölümü |
| Yeni çalışma | Öğrencide sade pencere; personelde üniversite/enstitü/bölüm seçtiren tam form (`createProject`) | Herkes için tek pencere: ad, tür, belge dili; Oluştur ve yaz / Word'den içe aktar |
| Danışmanıma gönder | Yalnızca kurumsuz (bireysel) abonede | Herkesin kendi çalışmasında |
| Ctrl+K "çalışma aç" | RLS'in gösterdiği bütün çalışmalar | Yalnızca kendi çalışmaları |
| Boş durum / ilk kullanım | Personele "Üniversitenizi seçerek başlayın", "Enstitünüzden…" | Küresel metin |

## Yönetim alanı

- `/dashboard/yonetim`: eski personel ana sayfası (sayaçlar, dikkat isteyenler, uzman/destek kuyrukları, çalışma hareketi).
- `/dashboard/yonetim/calismalar`: eski personel çalışma listesi (onay, sorumlu, filtreler, öğrenci adı).
- Kapı: `STAFF_ROLES` (`app/dashboard/yonetim/kapi.ts`); Üye/Öğrenci için 404.
- Hesap menüsünün Yönetim bölümünden ve Ctrl+K'dan açıkça girilir.
- Satırları yine RLS seçiyor; onay ve atama işlemleri kendi sunucu denetimini yapıyor.
- Başkasının çalışmasına giden bağlantılar (destek kuyruğu, eski `/dashboard/editor/<id>`, çalışma içindeki "Özet ve teslim") yetkiliyi Yönetim listesine indirir; yetkisiz kişi kendi listesinde kalır.

## Bu turda değişmeyenler

- Paket, fiyat, ödeme, Auth ayarı, RLS, migration.
- Mevcut kurum ve kılavuz kayıtları; "Bilgileri düzenle"deki kurum alanları.
- Destek sayfasındaki personel kuyrukları (rol bazlı, önizleme bağımlılığı kaldırıldı); Ayarlar'daki iç ekip bölümü.
- `b.erdogan@arvoculture.com` için hiçbir istisna yok; rolü değiştirilmedi.

## Kabul (yerel üretim derlemesi, sentetik veri)

**36/36 PASS** (`kabul-sonucu.json`). BUILD_ID `uASSzVwbOFY2jrB0reGPp`, yerel yığın 127.0.0.1.

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

**Yeniden koşmak.** Depo kökünde, yerel yığın ve `next start -p 3150` açıkken:

```
node tasarim/tek-deneyim/betikler/tohum.mjs
node tasarim/tek-deneyim/betikler/kabul.mjs http://localhost:3150
```

`tohum.json` (rastgele şifre) betiğin yanına yazılır; depoya girmez.

**Sınırlama.** Yönetim'e yetkisiz girişte ekran "bulunamadı" gösteriyor, ama HTTP durumu 200. Bu, panelin `loading.tsx` sınırının bilinen etkisi; öteki panel sayfalarındaki `notFound()` ile aynı davranış.
