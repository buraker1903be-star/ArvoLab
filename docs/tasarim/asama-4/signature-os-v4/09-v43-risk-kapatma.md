# 09 — V4.3 risk kapatma (PLAN ONLY)

## Nasıl okunur

- Kanıtlar `08-v43-teknik-envanter.md`'deki dosya ve satırlardır. R24'ün dört
  bulgusu ayrıca elle yeniden okundu (YP:150-215, YP:284-302,
  `lib/ai-duzenleme.ts:78-90`).
- Çözümler **öneridir; uygulanmadı.**
- "Prototipte ölçüldü" yalnız statik HTML maket demektir; gerçek editörde
  doğrulanmış sayılmaz.

---

## R22 — Mobil Arvo AI paneli

### Bugün (kod)

| Konu | Davranış | Kanıt |
|---|---|---|
| Panel biçimi | 85dvh alt sayfa ve arkada örtü düğmesi | WS:1634-1641, `yan-panel.tsx:83-85` |
| Kiplik | Modal değil, odak tuzağı yok; bilerek | `yan-panel.tsx:18-21` |
| Esc | Kapatır | `yan-panel.tsx:92-97` |
| Odak | Açılınca seçili sekmeye gider; kapanınca açan düğmeye döner | `yan-panel.tsx:56-65` |
| Klavye | `visualViewport` hesabı yok | — |
| Seçili metin | Ekranın üst ~%15'inde, örtünün altında kalır; seçime kaydırma yapan kod yok | — |
| Yeni istem | Öneri beklerken gönderilebilir (bekleyen öneri yeni istemi engellemez) | YP:150-200 |

Mevcut davranış zaten kullanıcının yeni istem göndermesine izin veriyor. Bu
korunmalı.

### V4.2R maketi

- Alt sayfa 62vh, örtü yok.
- Öneri beklerken karar düğmeleri dipte sabit ve **besteci gizli**.
- Bu, tercih ettiğiniz kurala ("yeni istem gönderebilmeyi ortadan kaldıran
  tasarım kabul edilmez") **aykırı**. Düzeltilmesi gerekiyor.

### Çözüm A — Yarım sayfa, karar şeridi ve tek satırlık besteci (önerilen)

**Kapalı klavye**
- Alt sayfa 62dvh, örtü yok.
- Belge üstte görünür. Açılışta seçim görünür alanın üst üçte birine
  kaydırılır (`coordsAtPos` ile; seçim değişmez, yalnız kaydırma).
- En altta iki katman:
  1. **Karar şeridi:** yalnız öneri varken görünür. Kabul et tam genişlikte;
     Düzenleyerek kabul et ile Reddet yan yana. Hepsi en az 44 px.
  2. **Daraltılmış besteci:** her zaman görünür, tek satır "Yeni istek
     yaz…". Öneri beklerken de yazılabilir ve gönderilebilir; bugünkü
     davranış budur.

**Klavye açıkken**
- Besteciye odaklanınca sayfa `visualViewport.height` kadar büyür. Belge
  geçici olarak gizlenir.
- Seçili cümle bestecinin üstünde **alıntı satırı** olarak görünür
  ("Seçili: Bu kadar farklı rejimin…"). Bu, `secimMetni`nin salt okunur
  kopyasıdır.
- Karar şeridi "1 öneri bekliyor · Göster" çipine iner. Klavye kapanınca
  geri açılır.

**Gönderim ve kapatma**
- Gönderim yeni bir tur ekler; bekleyen öneri kartı yerinde kalır. Her
  kartın kendi izlenen aralığı olduğu için yanlış yere uygulanmaz (R24).
- Kapatma: Esc, sağ üst ×, aşağı kaydırma ve Android geri tuşu.
- Geri tuşu için açılışta `history.pushState`, kapanışta `popstate`
  kullanılır.
  - popstate'i Next yönlendiricisi kendisi yönetiyor; geri ve ileri tuşları
    durdurulamıyor (`gezinme-korumasi.tsx:28` yorumu).
  - Eklenen geçmiş girdisinin Next yönlendirmesiyle ve kayıt devriyle
    (`kayitDevret`) çakışmadığı test edilmeli (R22-T5). Çakışırsa telefonda
    geri tuşu yalnız sayfadan çıkar; panel × ile kapanır.
- Kapanınca odak `editor.commands.focus()` ile **kayıtlı seçime** döner.
  Kaydırma konumu saklanıp geri yüklenir.

**Erişilebilirlik**
- Panel `role="region"`, `aria-label="Yazım paneli"`. Modal değil, bugünkü
  kararla tutarlı.
- Yeni öneri `aria-live="polite"` ile duyurulur: "Öneri hazır, 5 kelime
  eklendi, 3 kelime silindi".
- Odak sırası: sekmeler → akış → karar şeridi → besteci.

**Artı / eksi**
- Artı: belge bağlamı görünür kalır; bugünkü mimariye (`YanPanel`,
  `bicim="sayfa"`) en yakın çözüm; yeni istem her zaman mümkün.
- Eksi: `visualViewport` iOS ve Android'de farklı davranır. Gerçek cihaz
  testi şart; bu oturumda gerçek cihaz yok, sonuç UNVERIFIED olur.

### Çözüm B — Tam ekran asistan görünümü

- Mobilde panel tam ekran açılır.
- Üstte "‹ Belgeye dön" ve seçili metnin alıntı kartı.
- Altta besteci her zaman açık. Öneri kartlarının karar düğmeleri kartın
  içinde.
- Artı: klavye davranışı basit (tam ekran ve tek kaydırma alanı); en düşük
  uygulama riski.
- Eksi: kullanıcı öneriyi belgenin içinde, bağlamıyla göremez; alıntı
  kartına güvenmek zorunda. V4.2R'deki "belge ana alan" ilkesinden uzak.

### Çözüm C — Belge içi öneri kartı (değerlendirildi, önerilmiyor)

- Öneri seçili paragrafın hemen altında satır içi kart olarak çizilir.
  Süsleme (decoration) olur, belgeye yazılmaz.
- Eksi:
  - satır içi öneri eklentisi (`SatirIciOneri`) ve seçim düğmesiyle
    etkileşimi karmaşık;
  - yeni bir sunum mekanizması, yani yeni işlev sınırına çok yakın.

### Karar önerisi

**A.** Klavye açıkken B'nin alıntı fikri kullanılır. Telefonda kabul edilen
öneri için Geri al, panel kapanmışsa editörün dibinde 6 saniyelik "Geri al"
bildirimi olarak görünür (V4.2 G4).

## R23 — Editör belge geometrisi

### Gerçek editör bugün

- Yazı sütunu en çok 860 px ve dolguyla ortalanıyor (WS:72-97).
- Panel açılınca sütun daralıyor ve satırlar **yeniden kırılıyor**: ızgara
  `1fr + 340/360` (WS:1437).
- Ekran genişliği kılavuza bağlı değil. Kılavuz yalnız font, punto ve satır
  aralığı yazıyor (`ME:1001-1016`).

### Hedef (V4.2R prototipi, statik HTML)

- Kâğıt 760 px, metin 638 px.
- Panel kapalı / açık: 638 / 638 px. İlk paragraf 8 / 8 satır.
- **Bu yalnız prototipte ölçüldü.** Gerçek editörde: UNVERIFIED.

### Gerçek belgeyi etkileyen etkenler

| Etken | Etkisi | Plan |
|---|---|---|
| Kılavuz fontu ve puntosu (ör. 12 pt Times) | Aynı 638 px'e farklı sayıda karakter sığar. Satır kırılması belgeye göre değişir ama **panel aç/kapa sırasında değişmemeli**. | Ölçüt "aç/kapa farkı 0"; mutlak satır sayısı değil |
| Kılavuzun metin genişliği (A4, sol 3–4 cm, sağ 2–2,5 cm ≈ 140–160 mm ≈ 529–605 px, 96 dpi) | Ekran ölçüsü baskıdan geniş. Satırlar baskıdakiyle aynı kırılmaz (bugün de öyle). | Karar K-4: sabit 638 px mı, kılavuzun metin genişliği mi |
| Tablolar ve görseller | Sütundan geniş tablo taşar | Bugünkü kural korunur: tablo kâğıt içinde yatay kayar (`tablo-kabul.mjs`), görsel `max-width:100%` |
| Dipnotlar, atıflar | Satır içi; geometriden bağımsız | — |
| Tarayıcı yakınlaştırması | %200'de CSS piksel görünümü 720 px'e iner | Kural genişliğe göre çalışır; dar alanda panel katman olur |
| Panel aç/kapa | Sabit kâğıt yeniden kırılmayı önler; kâğıt yalnız yatay kayar | İmleç ve kaydırma: `scrollTop` korunmalı; ölçülmeli |

### Genişlik bütçesi (kenar 236 · ray 64 · kâğıt 760 · panel 360)

| Genişlik | Panel kapalı | Panel açık |
|---|---|---|
| 1440 | 236 + 760 = 996 ✓ | 236 + 760 + 360 = 1356 ✓ (yerleşik panel) |
| 1200 | ✓ | 1356 > 1200: kenar çubuğu **raya** iner, 64 + 760 + 360 = 1184 ✓. 88 px rayla 1208 > 1200 ✗ (K-1). |
| 1024 | 64 + 760 ✓ | Yerleşik sığmaz: panel **sağdan katman**; kâğıt daralmaz |
| 768 | Kâğıt akışkan (≈704) | Katman |
| 390 / 360 | Kâğıt tam genişlik, akışkan | Alt sayfa (R22) |

**"Yeniden kırılma 0" ölçütü** yalnız yerleşik panelin sığdığı masaüstü
yerleşimlerinde (≥1200, gerekirse kenar çubuğu raya inerek) geçerlidir. Katman
olan yerleşimlerde kâğıt zaten değişmez.

## R24 — Öneri beklerken yeni istem (koddan doğrulandı)

### Güvenli olanlar

- **Yanlış yere uygulanmaz.** Eski öneri **özgün izlenen aralığa**
  uygulanır, o anki seçime değil. Metin birebir eşleşmezse uygulanmaz:
  "izlenmiyor", "silindi", "degisti" (YP:226-302,
  `tiptap-asistan-araligi.ts:96-103`).
- **Bekleyen öneri yeni istemle kaybolmaz.** Her yanıt kendi `oneriId`siyle
  ayrı kart olur (YP:178, 191-194).
- **Geri al güvenli.**
  - Kendi geçmiş adımında çalışır (`closeHistory`).
  - Eklenen metin değiştiyse geri almaz (YP:351-372).
  - Ctrl+Z adımları ayrı kalır (`tests/editor/asistan-araligi.test.ts:108-123`).
- **Aynı kartı iki kez kabul etmek çift ekleme yapmaz.** İlk kabul aralığı
  bırakır (YP:342); ikincisi uyarı alır.

### Bulunan açıklar

| No | Önem | Açık | Kanıt | Öneri (uygulanmadı) |
|---|---|---|---|---|
| G1 | **Yüksek** | Seçim menüsünden gelen görev (Akademikleştir, Kısalt, Genişlet) istek sürerken **sessizce kaybolur**. `bekleyenGoreviAl()` görevi kuyruktan siler, `gonder` sonra `bekliyor` yüzünden erken döner, menü çoktan kapanmıştır, kullanıcıya hiçbir şey söylenmez. | `lib/ai-duzenleme.ts:83-87`, YP:151, YP:208-211 | Görev yalnız `!bekliyor` iken alınır; değilse kuyrukta kalır ve "Önceki yanıt bekleniyor, sıraya alındı" duyurulur. Ya da menü düğmeleri istek sürerken devre dışı ve gerekçeli olur. |
| G2 | Orta | "Paragrafın altına ekle" yolu doğrulama yapmaz. İzlenen aralık silinmişse çökmüş konuma ekler. | YP:286-301 | `izlenenAralik` sonucu `silindi` ise uyar ve uygulama; bağlam bloğu hâlâ var mı denetle. |
| G3 | Düşük | İzlenen aralık hata, ağ istisnası ya da metinsiz yanıtta **bırakılmaz**. `uygulandi` ve `geri_alindi` kartlarının aralıkları da kalır. Her işlemde eşleme maliyeti birikir. | YP:179, 186-197, 345 | `finally` içinde metinsiz yanıtta `araligiBirak`; son durumlarda bırak. |
| G4 | Düşük · UNVERIFIED | `uygula`'da `durum === "oneri"` denetimi yok. `isleniyor` kilidi yalnız sürüm yolunda (YP:228, 246). Çift tıklamanın yeniden çizimden önce gelip gelmediği doğrulanamadı. | YP:226-249 | Başta `durum` denetimi ve `useRef` tabanlı işlem kilidi. |
| G5 | Bilgi | Seçim menüsündeki "Kendi isteğini yaz", menünün açıldığı andaki değil **gönderim anındaki** seçimi kullanır. | `secim-ai.tsx:180-185`, YP:153 | Seçimi menü açılışında yakala. Kabulde metin denetimi olduğu için yanlış yere uygulanmaz; yalnız kullanıcı beklentisi. |
| G6 | Bilgi | Sohbet ve bekleyen öneriler yalnız bellekte. Sayfa yenilenince kaybolur; belge etkilenmez. | YP:124 | Değişiklik önerilmez; tasarımda "yenilemede öneriler gider" bilgisi. |

### Test borcu (eklenmeli)

Bugün test edilmeyen durumlar:
- birden çok bekleyen öneri;
- çift kabul;
- istek sürerken seçim menüsü görevi;
- silinmiş bağlamda "altına ekle".

V4.3-E'nin ön koşulu: G1–G4 düzeltmeleri **ayrı bir hata düzeltme commit'i**
olarak tasarım değişikliğinden önce yapılır ve testleriyle birlikte gelir.
Bunun için ayrı onay gerekir.

## R25 — Mobil Çalışmalarım

V4.2R'de her kartın altında 48 px'lik "Özet, teslim ve bölümler ›" satırı
var. Kart başına yaklaşık 60 px ek yükseklik.

| Ölçüt | A · Kartın tamamı bağlantı (+ başlıkta ›) | B · Ayrı geçiş satırı (V4.2R) | C · Kart bağlantı + meta satırında küçük "Özet ›" |
|---|---|---|---|
| Erişilebilirlik | Tek odak durağı; erişilebilir ad = başlık + meta; iç içe etkileşim yok | İki ayrı hedef aynı yere gider: tekrar | Tek hedef; görünür ipucu |
| Yanlış dokunma | Düşük (tek hedef) | Düşük; satır alanı dar | Düşük |
| Bilgi hiyerarşisi | Başlık > durum > sıradaki | Geçiş satırı içerikle yarışıyor | Başlık > durum > sıradaki > ipucu |
| Dikey alan | En az | Kart başına +60 px | Kart başına +0–8 px |
| Görünüm | Sakin, kart kendinden açık | Ağır, form gibi | Sakin, hedef söylenmiş |

**Öneri: A + C birleşimi.**
- Kartın tamamı tek `<a>`.
- Başlık satırının sonunda › simgesi.
- Etkin çalışmada "Sıradaki: …" satırı.
- Ayrı satır yok. Kartın içinde düğme yok (iç içe etkileşim yasak); "Yazmaya
  devam et" ayrıntı ekranındadır.
- Kartlar arası boşluk 8 px.

Bugünkü kod liste ile ayrıntıyı aynı sayfada `order:-1` ile gösteriyor
(`genel-bakis.css:351-363`). Telefonda ayrıntı aynı adreste (`?sec=`) ayrı
görünüm olarak çizilmeli. Bu yalnız bir sunum değişikliği; rota değişmez.

## R26 — V4.2R'de revize edilmeyen mobil ekranlar

**Ana Sayfa telefon** (`ekran-goruntuleri/02-*`), masaüstüyle farklar:
- Teslim satırları sağda **rozetli** (Eksik, Bakılacak) ve › işaretli.
  Masaüstünde artık işaret + durum sözcüğü + eylem fiili var.
- "Akademik kanıt" satır listesi ve **"Sunum önerisi" etiketi duruyor**.
  Masaüstünde A1 ile dört eksenli yüzeye geçti ve etiket kalktı.
- "Teslim hazırlığı" ölçüsünde parçalı ilerleme yok.
- Alt akordeon ("Diğer") ile masaüstündeki tek satırlık şerit arasında dil
  farkı var.

**Kaynak Kütüphanesi telefon** (`ekran-goruntuleri/11-*`):
- Eksenler satır içinde sarılan iz olarak gösteriliyor. Sütun hizası
  telefonda zaten sığmaz; sorun değil.
- Künye ekseni değeri veri açığından etkileniyor (K-3).
- Ayrıntı paneli telefonda alt sayfa. Kaydırma davranışı tasarlanmadı.
- "Kaynakça · 94/100" kartı ile masaüstündeki şerit farklı.

**Karar:** bu iki ekran için **ek görsel onay gerekir.** Kısa bir V4.2R-2
turu yeterli.
- V4.3-A ve V4.3-B'yi engellemez.
- V4.3-C'nin (Ana Sayfa) ve V4.3-F'nin (Kütüphane) telefon kısmını engeller.

---

## Diğer açık kararlar (envanterden çıkanlar)

| No | Konu | Seçenekler | Öneri |
|---|---|---|---|
| K-1 | Ray 88 → 64 px (K2: "88 px bu aşamada değişmez") | (a) 64'e geç (V4.3-B); (b) 88 kalsın | (a). 1200 px'te panel açıkken sığmanın tek yolu. `kabuk-kabul` eşikleri güncellenir. |
| K-2 | Koyu tema logosu resmî değil (betikle türetilmiş) | (a) kurumdan resmî koyu dosya; (b) türetilmiş dosya resmî kabul | (a). Gelene kadar (b) sürer. |
| K-3 | Kütüphane satırında Künye ekseni: doğrulama sonucu saklanmıyor; PDF durumu çalışmanın kaynakça satırına bağlı | (a) Künye = yalnız hesaplanan "eksik alan" (bugün var), karşılaştırma panelde isteğe bağlı; PDF = seçili çalışmada DOI eşleşmesi, çalışma seçili değilse "—"; (b) karşılaştırma sonucunu saklamak (yeni veri, migration: **yeni işlev**, bu kapsamda yok) | (a). Tasarımdaki "bakılmadı / eşleşti" değerleri (a)'ya göre yeniden etiketlenir. |
| K-4 | Ekran ölçüsü | (a) sabit 638 px; (b) kılavuz bağlıysa kılavuzun metin genişliği (mm → px) | (a). (b) baskıyla satır eşliği verir ama kılavuza göre ekran değişir; ayrı tasarım turu ister. |
| K-5 | Koyu temada kâğıt | (a) bugünkü açık kâğıt (`kagit-kabul.mjs` onaylı); (b) V4.1 "loş kâğıt" | Karar sizin. (b) seçilirse `kagit-kabul` ölçütleri ve baskıda beyaz kâğıt kuralı yeniden sınanır. |
| K-6 | Newsreader | `next/font` ile 400/500 ve 400 italik, yalnız editoryal başlıklarda; ilk yükleme ≈30–45 KB | Onay gerekir (V4.1 R3). |
| K-7 | Dokunma eşiği 40 → 44 px | `dokunma-kabul` ve `duyarlilik` eşikleri güncellenir; araç çubuğu telefonda yeniden ölçülür | 44 (kabul kriteri). |
| K-8 | EN "Bakılacak" = "İnceleme" = *Review* | "Needs attention" | Sözlük §6 |
| K-9 | Supabase Test girişi | O1/O2 (bekliyor) | O1 |
