# 07 — V4.2R Hedefli görsel revizyon

**Durum:** görsel onay bekliyor. Yalnız tasarım çalışmasıdır:
- uygulama kodu, `app/styles/tokens.css`, Production ve Supabase değişmedi;
- push yapılmadı;
- V4.3 başlamadı.

Eski V4.2 görselleri (`ekran-goruntuleri/`) yerinde duruyor; karşılaştırma
onlarla yapıldı.

```
node ekranlar/uret.mjs                               # HTML (V4.2R)
node ekranlar/cek.mjs <klasör>                       # görüntüler
node ekranlar/olc.mjs > ekranlar/olcum.json          # genel ölçüm (46)
node ekranlar/revizyon-olc.mjs <eski-ekranlar> > ekranlar/revizyon-olcum.json
node ekranlar/karsilastir-r.mjs                      # eski ↔ revize, ölçü satırlarıyla
```

Eski HTML'i almak için `git archive b5db4ec docs/tasarim/asama-4/signature-os-v4`
çıktısının `ekranlar/` klasörü kullanılır.

## Teslim edilenler

- **`ekran-goruntuleri-v42r/`** (20 görsel, her biri açık ve koyu):
  - istenen 7 ekran: Editör + AI masaüstü / telefon, Çalışmalarım
    masaüstü / telefon, Çalışma ayrıntısı telefon, Ana Sayfa masaüstü,
    Kaynak Kütüphanesi masaüstü;
  - hizayı göstermek için Editör (panel kapalı) masaüstü;
  - A3 gereği ilk kullanım (boş) durumu, masaüstü ve telefon.
- **`karsilastirma-v42r/`** (16 görsel):
  - her ekran için eski ↔ revize yan yana, başlıkta ölçülen farklar;
  - ayrıca `1b-editor-hiza`: panel kapalı ↔ açık.
- **`06-terim-sozlugu.md`:** A5, TR/EN sözlük. Mevcut bir çakışma da
  bulundu.

## 1. Ölçülen fark (`ekranlar/revizyon-olcum.json`)

Ölçüler yapıya bakar (kutu, hiza, kırılma, kesik öğe); renk ve boşluğa
değil. Hepsi 1440 ve 390 px'te, aynı betikle eski ve yeni HTML üzerinde
alındı.

| Ekran | Ölçü | Eski v4 | Revize v4 |
|---|---|---|---|
| Editör + AI masa | AI akışındaki kutu (çerçeve ya da ayrık zemin) | 4 | **2** (yalnız istem balonları) |
| | Metin sütunu: panel kapalı / açık | 654 / 618 px | **638 / 638 px** |
| | İlk paragraf satır sayısı: kapalı / açık | 7 / 8 (yeniden kırılıyor) | **8 / 8** (kırılmıyor) |
| Editör + AI telefon | Alt sayfa yüksekliği | 726 px (86 vh) | **523 px (62 vh)** |
| | Alt sayfanın üstünde görünen belge | 14 px | **217 px** |
| | Örtü / seçili cümle görünür | var / hayır | **yok / evet** |
| | AI akışındaki kutu | 3 | **1** |
| Çalışmalarım masa | Liste / ayrıntı genişliği | 300 / 812 | 320 / 818 (tek yüzey) |
| | Yüzey dışında boşta kalan liste alanı | 351 px | **0** |
| | "Yeni çalışma" | sayfa başlığında düğme | **listenin son satırı** |
| Çalışmalarım telefon | Satırda ≥44 px açık geçiş bölgesi | 0 / 2 | **2 / 2** |
| Ayrıntı telefon | Kesik sekme (390 / 360 px) | 2 / 2 | **0 / 0** |
| | Şerit kayıyor | evet | **hayır** |
| Ana Sayfa masa | Alt bölümde rozet · anahtar-değer satırı · ayar bloğu | 4 · 4 · 3 | **0 · 0 · 0** |
| | Eylem fiiliyle biten teslim maddesi | 0 | **3** |
| | Alt bölüm yüksekliği | 602 px | 545 px |
| Kaynak Kütüphanesi masa | PDF ekseninin satırlar arası x sapması | 32 px | **0** |
| | Ortalama satır | 110 px | 95 px |
| | Ayrıntı paneli · görünüme sığar · iç kaydırma | 800 px · hayır · yok | **640 px · evet · var** |
| | Kaynağa sor / PDF'i aç | 1 / 1 | 2 / 1 |

Genel ölçüm (`olcum.json`, 23 ekran-genişlik × 2 tema = 46):

| Ölçüt | Sonuç |
|---|---|
| Yatay taşma | 0 |
| Açık ↔ koyu yerleşim farkı | 0 |
| En düşük metin kontrastı | 4,87 |
| Telefonda 44 px altı hedef | 0 |
| Birincil düğme | her ekranda en çok 1 |

## 2. Ekran kararları

### 2.1 Editör + Arvo AI (öncelik 1)

**Masaüstü**

- **Belge ana alan.**
  - Kâğıt artık iki durumda da 760 px (metin 638 px). Panel açılınca kâğıt
    yalnız ortalandığı alanın daralmasıyla yer değiştirir; satırlar
    yeniden kırılmaz.
  - Eskiden panel açılınca metin 654'ten 618 px'e iniyor, her paragraf
    yeniden kırılıyordu; yazarken göz yerini kaybediyordu.
- **Tur yapısı.** Her istek bir tur ve dört parça sırayla, çerçevesiz
  durur:
  - **İstem:** sağa yaslı, zeminli balon. Altında bağlamı yazar:
    "1. Giriş · seçili 1 cümle".
  - **Önerilen metin:** başlık, kelime farkı, renk açıklaması
    (silinen / eklenen). Fark doğrudan metnin içinde.
  - **Dayanak:** kenar notu, yani mavi 2 px çizgi. "Sunum önerisi"
    etiketlidir.
  - **Karar:** üstünde 1 px çizgi; Kabul et (birincil) · Düzenleyerek
    kabul et · Reddet.
- **Uyarı** ayrı kart değil, kırmızı çizgili kenar notudur: "Yanıt
  gösterilmedi", nedeni ve "DOI ile ekle".
- **Geri al** bir olay satırıdır: "Ana hat önerisi belgeye eklendi ·
  14:12 · Geri al".
- Kaldırılan çerçeveler:
  - üç bağlam çipi;
  - uygulandı kutusu;
  - yanıt kartının dış çerçevesi ve başlık şeridi;
  - uyarı kartı.

**Telefon**

- Alt sayfa 62 vh'tir ve örtüsüzdür. Belgede seçili cümle alt sayfanın
  üstünde görünür kalır (belge seçime kaydırılmış gösterildi).
- Öneri beklerken karar düğmeleri sayfanın dibine sabitlenir ve besteciyi
  geçici olarak yerinden eder. Karar verilince besteci geri gelir. Böylece
  önerinin kararsız kaldığı bir durum olmaz.
- Önceki gösterilmeyen yanıt tek satırlık bir olay olarak kalır
  ("Ayrıntı").

**Değişmeyen davranışlar.** Aşağıdakiler aynen korunur; tasarım yalnız
sunumu değiştirir:
- kaydetme güvenliği (bekleyen kayıt, `beforeunload`, gezinme koruması);
- seçim konumu güvenliği (4.3-1);
- kabul / düzenleyerek kabul / reddet / geri al akışı (`yazim-paneli.tsx`);
- asistan izi;
- atıf ve sayı denetimi ve "gösterilmedi" kuralı (`app/actions/ai-yazim.ts`).

Telefonda örtünün kalkması alt sayfayı **modal olmayan** bir panele
çevirir. Odak sırası ve Esc davranışı V4.3'te sınanmalı (risk R22).

### 2.2 Çalışmalarım

**Masaüstü**

- Liste ve ayrıntı iki ayrı yüzeydi; artık tek bölünmüş yüzey (320 px |
  kalan).
- Liste sütunu kendi zemininde ayrıntıyla aynı boyda durur. İki çalışmada
  kalan alan sütunun içinde kalır ve sayfa zemininde boşta kalan bir
  boşluk değildir.
- Sahte içerik eklenmedi.
- "Yeni çalışma" listenin son satırı oldu: sayfa başlığındaki ikinci düğme
  kalktı. Kenar çubuğundaki genel "Yeni çalışma" yerinde.

**Telefon**

- Her satırın altında "Özet, teslim ve bölümler ›" geçiş bölgesi var
  (48 px). Satırın neresine dokunulursa dokunulsun ayrıntı açılır; bölge
  bunu görünür kılar.
- Etkin çalışmada "Sıradaki" adım gösterilir. Bu gerçek veridir: Ana
  Sayfa'daki "Şimdi" notunun aynısı.

**Ayrıntı (telefon)**

- Şerit kaymaz: beş bölüm ve "⋯" (Diğer: Etik kurul, Belge Kontrol,
  Takvim, Kaynakça) her genişlikte sığar.
- Sıra masaüstü sekmeleriyle aynı: Özet / Yazım / Kaynaklar / Kanıt /
  Analiz.
- Geri bağlantısı "Çalışmalarım" (eskiden "Çalışmalar").
- "Diğer araçlar" satırı ve "tek gezinme" açıklama cümlesi kaldırıldı;
  aynı hedefler şeritteki "⋯" menüsünde. Hiçbir işlev kalkmadı.

**İlk kullanım (A3)**

- Yalnız gerçek boş durum tasarlandı.
- Tek eylem: "İlk çalışmanızı oluşturun".
- İki cümle: çalışmanın ne olduğu ve kılavuzun kendiliğinden uygulanması.
- Bir not: Word içe aktarma.
- Genel rehber, adım listesi ya da örnek içerik yok.

### 2.3 Ana Sayfa

- Üç soru yapısı ve tek birincil düğme ("Yazmaya devam et") aynen kaldı.
  Teslim hazırlığına beş parçalı bir ilerleme eklendi (1/5).
- **Teslime giden yol** ("Teslim için bakılacaklar" yerine):
  - satır + sağda rozet tablosu yerine işaret + ad + durum sözcüğü + tek
    satır açıklama;
  - her madde eylem fiiliyle biter: Kapağı ekle · Uyarılara bak ·
    İçindekileri ekle.
- **Akademik kanıt (A1, onaylandı):**
  - Anahtar-değer tablosu yerine dört eksenli tek yüzey (2 × 2).
  - Her eksende: eksen adı, tek büyük sayı, bir açıklama, iz satırları ve
    gidilecek yer.
  - "Tek puan yok" başlıkta yazılı. Eksenler birleştirilmez.
  - A1 onaylandığı için "Sunum önerisi" etiketi bu bölümden kaldırıldı.
- **İkincil bilgiler** üç sütunlu ayar bloğu yerine tek satırlık sessiz
  şerit: Danışmanıma gönder (Okuma bağlantısı · Dosya) · 318 kredi
  (Ayrıntı · Kredi al) · Yazım ritmi. Bağlantıların hepsi korunuyor.
- **Diğer çalışma** tek satır, Newsreader.

### 2.4 Kaynak Kütüphanesi

**Liste**

- Eksenler artık hizalı sütunlar: Kaynak | Künye | PDF | Kanıt | Okuma.
- Ad başlık satırında bir kez yazılır; hücrede işaret + değer (+ ayrıntı)
  durur.
- Dört eksen ayrı kalır; durum her hücrede sözcükle yazılı.
- Kaynakça denetimi tek satırlık şerit oldu.

**Ayrıntı paneli**

- Görünüm boyuyla sınırlı (900 px'lik ekranda 640 px).
- Başlık ve eylemler (Kaynağa sor · PDF'i aç · Atıf ekle) üstte sabit.
- Doğrulama / Okuma / Künye / Notlarım arada ve kendi içinde kayar
  (klavyeyle odaklanabilir, `tabindex="0"`).
- "Kaynağı sil" altta sabit.

**Korunanlar**

- Kaynağa sor (satırda ve panelde);
- PDF'i aç (yeni sekme);
- Dizinlerde karşılaştır;
- Okudum / Kullandım işareti (panelde);
- içe aktarma ve Kaynak bul.

## 3. Kararların uygulanması

| Karar | Uygulama |
|---|---|
| A1 onaylandı | Ana Sayfa'da dört eksenli "Akademik kanıt"; etiket kaldırıldı |
| A2 onaylandı, kritik uyarılar gizlenmez | Aşağıdaki çip durumları |
| A3 | Yalnız gerçek ilk kullanım (boş) durumu; genel rehber yok |
| A4 | PDF bölmesi masaüstü konsepti olarak kaldı (`ekran-goruntuleri/K1–K3`); uygulama izni yok, bu revizyonda değişmedi |
| A5 koşullu | `06-terim-sozlugu.md`. Bulunan çakışma: "Bakılacak" ve "İnceleme" İngilizcede ikisi de *Review* |

**A2: kılavuz çipinin durumları**

| Durum | Çip | Kritik uyarı nasıl görünür |
|---|---|---|
| Kılavuz bağlı değil (örnek çalışma) | "Kılavuz bağlı değil · Bağla" | Durum çubuğunda "varsayılan belge yazısı"; Ana Sayfa ve Özet'te "Şimdi" notu |
| Bağlı, sorun yok | "DEÜ SBE kılavuzu" ve ● | — |
| Bağlı, uyarı var (kritik değil) | "DEÜ SBE kılavuzu · 3 uyarı" ve ◐ | Çip tıklanınca İnceleme sekmesi |
| **Bağlı, kritik uyarı var** | Çip hata renginde: "Kılavuz · 2 kritik" ve ◆ | **Ayrıca** araç çubuğunun altında, belgenin üstünde, kapatılamayan tek satırlık kenar notu: "2 kritik kılavuz sorunu: kapak sayfası yok, kenar boşluğu 2,5 cm olmalı · Gör". Çipe indirgenmez. |
| Kılavuz onay bekliyor (kurum) | "Kılavuz onay bekliyor" ve ○ | — |

## 4. Kalan görsel sorunlar

| No | Sorun |
|---|---|
| G1 | Editör + AI masaüstünde akış alta yaslı (sohbet gibi). En eski tur üstte kesik görünür; bu bilinçli bir kaydırma ipucu ama ilk bakışta kırpılmış gibi okunabilir. |
| G2 | Telefonda belge seçime kaydırılmış gösterildi ("…" ile başlıyor). Gerçek uygulamada bu, seçimin görünür alanda tutulması demek (R23). |
| G3 | Çalışmalarım masaüstünde liste sütunu iki çalışmada yine yarı boş. Boşluk artık sütunun kendi zemininde; sahte içerik eklenmedi. |
| G4 | Ana Sayfa telefon ve Kaynak Kütüphanesi telefon bu revizyonun kapsamında değildi; eski düzende kaldı (teslim satırları rozetli). V4.3 öncesi aynı dile çekilmeli. |

## 5. V4.3 ön riskleri (eklenenler)

| No | Risk | Önlem |
|---|---|---|
| R22 | Telefonda örtüsüz, modal olmayan alt sayfa: odak sırası, Esc, ekran okuyucu duyurusu | `role="dialog"` yerine bölge + odak yönetimi; kabul testleri |
| R23 | Seçimin alt sayfanın üstünde görünür tutulması (kaydırma) seçim konumu güvenliğiyle etkileşir | 4.3-1 testleri yeşil kalmalı; kaydırma seçimi değiştirmez |
| R24 | Kararsız öneri varken besteciyi gizlemek: kullanıcı yeni istem yazamaz | Reddet her zaman görünür; "Yeni istek" kararsız öneriyi reddetmeden açılmaz (bugünkü davranışla aynı mı, sınanmalı) |
| R25 | Kâğıdın sabit 760 px olması 1200–1300 px'te panel açıkken sığmayabilir | 1200'ün altında AI katman olur (V4.2 R21); 1200–1300 ölçülmeli |
| R26 | Kütüphane sütun düzeni 1200 px altında sığmaz | 1200 altında V4.2'nin satır düzenine dönülür |
| R27 | "Bakılacak / İnceleme" EN çakışması | Sözlük §6; metin değişikliği V4.3'te, iki dil birlikte |

---

**V4.2R burada durur.** Onayınızı bekliyorum.
