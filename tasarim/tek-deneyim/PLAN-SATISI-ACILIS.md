# Standart / Plus / Pro satışa açılışı — kalan işler (25.11.2026)

Hedef: üç abonelik kartının müşteriye görünmesi ve satın alınabilmesi.

**ArvoLab tarafı hazır ve KAPILI.** Bugünkü katalogla üç kartlı bölüm
çizilmiyor, mevcut ödeme yolu çalışıyor; ölçüm
`scripts/yerel-yigin/sonuclar/ilk-kullanim-155/RAPOR.md` (G1–G4, dört
görünümde PASS). Kapı açıldığında ArvoLab'da **kod değişikliği gerekmiyor**:
katalog eksiksiz gelmeye başladığı gün bölüm kendiliğinden açılır.

Bu belge ArvoOS tarafında gerekenleri sayar. **Bu depoda hiçbir ArvoOS
değişikliği yapılmadı**; ArvoOS deposu bu oturumun GitHub kapsamında değil,
dolayısıyla aşağıdaki alan ve davranış tespitleri ArvoLab'daki okuyucu
sözleşmesinden, ayna şemasından ve canlı gözlemden çıkarıldı —
**ArvoOS'un kendi kaynağından teyit edilmedi (UNVERIFIED)**.

## 1. Katalog: üç kademe, eksiksiz

ArvoLab'ın kapısı (`lib/plan-satis.ts` → `planKartlari`) bir plan satırı için
şunların **hepsini** istiyor; biri eksikse bölüm açılmıyor:

| Alan | ArvoLab'ın okuduğu anahtarlar | Bugün ArvoOS | Kural |
|---|---|---|---|
| Plan kodu | `code`, `planCode` | ✅ tek aylık + tek yıllık | kademe başına ayrı kod |
| Dönem | `interval`, `period`, `billingInterval` | ✅ | `month` / `year` |
| Tutar | `price`, `amount`, `monthlyFee` | ✅ (`individual_monthly_fee`) | kuruş; 0 ve altı fiyat sayılmaz |
| **Görünen ad** | `ad`, `name`, `label`, `title` | ❌ | **birebir** "Standart" / "Plus" / "Pro" |
| **Dahil aylık kredi** | `kredi`, `credits`, `monthlyCredits`, `aylikKredi` | ❌ | pozitif tamsayı |
| **Avantajlar** | `avantajlar`, `advantages`, `features`, `benefits` | ❌ (alan yok) | en az 1, en çok 6 metin |

Ek kurallar:
- **Tam üç kademe** olmalı; iki kademeli bir "üç plan" ekranı, eksik olanın
  var olmadığını söylerdi.
- **Kodlar tekil**: iki kademe aynı kodu taşırsa bölüm hiç açılmıyor — yoksa
  "Pro'yu seç" düğmesi Plus satın alırdı.
- Ad **tanınan kademe** olmalı. ArvoOS adı plan koduyla doldurursa
  (`"arvolab-aylik"`) kart çizilmez: tanımadığımız bir plana kendi satış
  cümlemizi iliştirmek, olmayan bir vaat vermek olurdu.
- Yıllık sürüm aynı adı taşıyıp `interval: "year"` olursa kartın İÇİNDE
  ikinci düğme olarak çıkıyor, kendi koduyla.

**ArvoOS'ta yapılacak:** bireysel ücretin tek sütunda tutulduğu bugünkü yapı
kademe kavramını taşımıyor. Üç kademe için plan kaydı (kod, ad, tutar, dönem,
dahil kredi, avantaj listesi) ve köprünün bunları `plans` içinde bildirmesi
gerekiyor.

## 2. Ödeme sonrası aboneliğin etkinleşmesi

ArvoLab **ödemeyi doğrulamıyor**: onay PayTR'den ArvoOS'a gelir, ArvoLab bir
sonraki `ensure` çağrısında yeni durumu okur.

**ArvoOS'ta yapılacak:**
- Ödeme onayından sonra **seçilen plan kodunu** aboneliğe yazmak ve köprüde
  `planCode` (ya da `plan` / `currentPlan` / `planKodu`) olarak bildirmek.
- Durumu **etkin** bildirmek: ArvoLab ücretli etiketi yalnızca
  `active` / `trialing_paid` / `etkin` durumlarında gösteriyor
  (`lib/uyelik-tipi.ts`). Kod yazılmazsa ya da durum deneme kalırsa ekran
  **deneme olarak kalır** — sessizce yanlış göstermez, ama müşteri ödediği
  üyeliği görmez.
- Dönem bitişini (`currentPeriodEnd`) bildirmek: "Sonraki yenileme" satırı ve
  erken yenileme penceresi (`ERKEN_YENILEME_GUN = 14`) ona bağlı.

## 3. Satışa açmadan önce test ortamı doğrulaması

Üç kademenin **her biri için ayrı ayrı**, gerçek para hareketi olmadan
(sağlayıcının test ortamı), şu zincir ölçülecek:

| Adım | Ölçüt |
|---|---|
| 1. Plan seçimi | Karttaki düğme **seçilen kademenin kodunu** gönderiyor (Pro düğmesi Plus kodu göndermiyor) |
| 2. Doğru tutar | Ödeme ekranındaki tutar katalogdaki kademe tutarıyla birebir aynı |
| 3. Doğru abonelik etkinleşiyor | Ödeme sonrası abonelik **seçilen** kademe oluyor; Abonelik ekranı, Ana Sayfa, sol navigasyon ve Ayarlar → Üyelik tipi **aynı** adı gösteriyor |
| 4. İptal | Deneme/mevcut durum sürüyor, hiçbir şey etkinleşmiyor |
| 5. Hata | Kullanıcıya mesaj gösteriliyor, durum değişmiyor |
| 6. Yıllık | Yıllık düğme kendi kodunu ve kendi tutarını gönderiyor |

Bu zincirin ArvoLab tarafı taklit köprüyle zaten ölçülü (B1–B4, V1–V2, H1–H2);
eksik olan **gerçek ArvoOS + sağlayıcı test ortamı** ile koşulması.

## 4. Sıra ve onay

1. ArvoLab tarafı yayına girer (katalog eksik olduğu için satış kapalı,
   mevcut ödeme yolu çalışır).
2. ArvoOS'ta katalog ve ödeme sonrası etkinleştirme yapılır.
3. Test ortamında üç kademenin zinciri (yukarıdaki tablo) doğrulanır.
4. Ancak bundan sonra satış açılır.

**Paddle entegrasyonu beklemede.**

`main`'e merge **otomatik canlı dağıtım** başlatıyor (kanıt: son 12 Production
dağıtımının hepsi `main`'e giren PR commit'lerinden, `source: "git"`, alias
`lab.arvo-os.com`, ~40 saniyede yayında). Bu yüzden her yayın adımı **ayrı
açık onay** ister.
