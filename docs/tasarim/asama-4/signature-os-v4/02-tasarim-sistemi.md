# 02 — Tasarım sistemi kuralları (V4.1)

Token değerleri: `tokens-v4.css`. Örnek bileşenler:
`ornek/bilesenler.html` (açık/koyu PNG'leri `ornek/`). Bu belge kuralları
tanımlar; ekranlar V4.2'de.

## 1. Renk ve yüzey hiyerarşisi

| Katman | Açık | Koyu | Kullanım |
|---|---|---|---|
| `--yuzey-zemin` | #F6F7F9 | #0C1119 | uygulama kanvası |
| `--yuzey-kenar` | #F0F2F5 | #0F1621 | kenar çubuğu, ray |
| `--yuzey-1` | #FFFFFF | #141C28 | ana içerik yüzeyi, paneller |
| `--yuzey-2` | #F8F9FB | #18212F | ikincil satır, sekme zemini |
| `--yuzey-cokuk` | #EEF1F5 | #0A0F16 | girdi içi, belge masası |
| `--yuzey-ust` | #FFFFFF | #18212F | menü, modal, alt sayfa (+ `--golge-2/3`) |
| `--yuzey-vurgu` | #ECF1F8 | #182A45 | seçili öğe ve "Şimdi" (başka yerde kullanılmaz) |
| `--kagit` | #FFFFFF | #182231 | belge kâğıdı (koyuda loş kâğıt) |

Kurallar:
- Vurgu (lacivert) yalnız beş yerde:
  1. birincil düğme;
  2. bağlantı;
  3. etkin gezinme;
  4. odak halkası;
  5. seçili öğe / "Şimdi".
- Yeşil yalnız ilerleme ve başarı. Amber ve kiremit yalnız uyarı ve hata.
- Koyu tema yükseltiyi gölgeyle değil açıklıkla verir:
  zemin < kenar < yüzey-1 < yüzey-2 = üst katman.

## 2. Kontrast (hesaplanmış, WCAG 2.2)

| Çift | Açık | Koyu |
|---|---|---|
| metin-1 / bütün yüzeyler | 13,9–15,8 | 12,2–17,1 |
| metin-2 / bütün yüzeyler (vurgu zemini dahil) | 4,97–5,64 | 6,65–8,87 |
| metin-3 | **yalnız simge/ayraç** (2,7–3,1) | metin olarak kullanılabilir (≥4,58) |
| vurgu-metin / yüzeyler | 8,4–9,5 | 5,66–7,54 |
| birincil düğme (beyaz yazı) | 9,53 (hover 12,2) | 5,07 (hover 6,26) |
| başarı / uyarı / hata metni | ≥4,85 | ≥5,85 |
| odak halkası / zemin | 6,02 | 7,42 |
| ilerleme çubuğu / iz | 3,08 (arayüz öğesi ≥3) | — |
| belge metni / loş kâğıt | — | 13,12 |

## 3. Tipografi

| Rol | Token | Yazı tipi | Nerede |
|---|---|---|---|
| Gösterim | `--tip-gosterim` 34/40 · 500 | Newsreader | Ana Sayfa'da aktif çalışma adı |
| Sayfa | `--tip-sayfa` 30/36 · 500 | Newsreader | sayfa başlığı |
| Çalışma/kaynak | `--tip-calisma` 24/30 · 500 | Newsreader | çalışma ve kaynak başlıkları |
| Alıntı | `--tip-alinti` 16/26 italik | Newsreader | kaynaktan birebir alıntı |
| Bölüm | `--tip-bolum` 15/22 · 600 | Inter | bölüm başlığı |
| Gövde | `--tip-govde` 14/21 | Inter | arayüz metni |
| Meta | `--tip-meta` 13/19 | Inter | ikincil bilgi |
| Yardım | `--tip-yardim` 12/17 | Inter | açıklama |
| Etiket | `--tip-etiket` 11/14 · 600, büyük harf, .06em | Inter | yalnız bölüm etiketi (sayfada ≤3) |
| Sayı | `--tip-sayi` 26/30 · 600, eşit genişlik | Inter | ölçüler (başlıktan büyük olamaz) |

**Belge yazısı ayrıdır (K1):**
- Editördeki metin kılavuzun yazı tipini, puntosunu ve satır aralığını
  kullanır (`--font-belge` ve kılavuz kuralları). Bunlar korunur.
- v4 token'ları belge metnine uygulanmaz.
- Kılavuz bağlı değilse uygulamanın varsayılan belge yazısı kullanılır.

**Başlık sunumu:**
- Tamamı büyük harfle girilmiş başlıklar arayüzde Türkçe başlık düzeniyle
  gösterilir.
- Veritabanındaki özgün başlık değişmez; özgün hâl `title` ve
  erişilebilir adda kalır.

## 4. Boşluk ve yoğunluk

- **Ölçek:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 (`--b-*`). Başka değer
  kullanılmaz.
- **Bölüm aralığı:** 32 (masaüstü) / 24 (telefon). Satır iç boşluğu 12–16.
- **Rahat yoğunluk (varsayılan):** satır 52, kontrol 40.
- **Sık yoğunluk:** satır 40, kontrol 32. Yalnız editör araç çubuğu,
  kaynak listesi ve tablolarda.
- **Telefon:** satır 56, kontrol 48, dokunma ≥44.

## 5. Kenarlık, yarıçap, yükselti

- **Kenarlık:** 1 px `--cizgi`; girdide `--cizgi-guclu`.
- **Yarıçap:**

  | Değer | Kullanım |
  |---|---|
  | 6 | rozet, araç düğmesi |
  | 8 | düğme, girdi |
  | 10 | panel, liste kabı |
  | 12 | ana yüzey |
  | 16 | alt sayfanın üst köşeleri |

  Hap biçimi yalnız anahtar ve ilerleme çubuğunda.
- **Yükselti:**

  | Seviye | Nerede |
  |---|---|
  | 0 | düz: çizgiyle ayrılan yüzeyler |
  | 1 | `--golge-1`: kontrol |
  | 2 | `--golge-2`: ana yüzey, açılır menü |
  | 3 | `--golge-3`: modal, alt sayfa |

  Koyu temada 2–3 gölge yerine üst yüzey açıklığı ve iç çizgi.

## 6. Düğme ve kontrol hiyerarşisi

| Tür | Görünüm | Kural |
|---|---|---|
| Birincil | lacivert dolgu, beyaz yazı, 40 (telefon 48), en çok 240 px | ekranda 1 |
| İkincil | yüzey-1 zemin, 1 px çizgi | birincilin yanında ≤1, diğer yerlerde serbest |
| Üçüncül | zeminsiz metin + simge; üzerinde yüzey-2 | araç çubukları, satır eylemleri |
| Tonal | vurgu-yumuşak zemin, vurgu-metin | yalnız "Yeni çalışma" ve "Arvo AI" girişi |
| Tehlikeli | üçüncül, kiremit metin; onay penceresiyle | "Kaynağı sil", "Çalışmayı sil" |
| Simge düğmesi | 32 (sık) / 40 / 44 (telefon), erişilebilir ad ve ipucu zorunlu | |

## 7. Gezinme

| Genişlik | Gezinme | Çalışma bölümleri |
|---|---|---|
| ≥1200 | 236 px etiketli kenar çubuğu (kullanıcı 64 px raya daraltabilir) | kenar çubuğunda "Açık çalışma" grubu |
| 761–1199 | **64 px simge rayı** (K2): simge 20, ipucu, erişilebilir ad, ↑/↓ ile gezinme, etkin öğede 2 px vurgu çizgisi | üst çubuğun altında yatay çalışma şeridi |
| ≤760 | sabit alt gezinme (5 öğe, 64 + güvenli alan); içerik alttan aynı boşluğu bırakır | sayfanın üstünde yatay kaydırılan çalışma şeridi |

- **Uygulama bugün 761–1199'da 88 px etiketli ray kullanıyor.** Bu aşamada
  değişmez (K2). 64 px ray entegrasyonda ayrı karar.
- **Üst çubuk (56):** konum yolu, Ctrl+K arama, bildirim, tema, hesap.
  Editörde de aynı kalır.

## 8. Panel, açılır panel, modal, alt sayfa

- **Bağlam bölmesi (sağ):** Arvo AI, İnceleme, Kaynaklar, Teslim, PDF
  (önerilen) **tek bölmenin sekmeleri**. Aynı anda iki sağ panel olmaz.

| Genişlik | Bağlam bölmesi |
|---|---|
| ≥1200 | 360 px yerleşik bölme; belge metni ≥600 px kalmazsa kenar çubuğu otomatik raya iner |
| 761–1199 | sağdan açılan 360 px bölme; belgenin üstüne biner, örtüsüz (yazmaya devam edilebilir); Esc kapatır |
| ≤760 | alttan alt sayfa (%85 yükseklik, `role="dialog"`, `aria-modal`, tutamak, 44 px kapat); arkada örtü; odak içeride kalır, kapanınca açan düğmeye döner |

- **Modal:** yalnız odaklanmış görev (Kaynak bul, İçe aktar) ve yıkıcı
  onay. Genişlik 480 / 640 / 880. Esc ve dışarı tık kapatır (yıkıcı onay
  hariç).
- **Açılır menü:** yükselti 2, `--r-3`, öğe 36 (telefon 44). Ok tuşları,
  Home/End, harfle atlama.

## 9. Editör belge yüzeyi

- **Tek editör çubuğu (48 px):** solda kayıt durumu; ortada araç grupları;
  sağda belge eylemleri (Paylaş, Dışa aktar, Arvo AI).
- **Kılavuz bildirimi** ayrı şerit değil, çubukta bir durum çipi
  ("Kılavuz bağlı değil · Bağla").
- **Hedef:** üst çubuk 56 + editör çubuğu 48 + 24 boşluk → kâğıt üstten
  yaklaşık 128 px'te başlar (bugün yaklaşık 330 px).
- **Kâğıt:** sayfa boyutu kılavuza göre. Ekranda metin sütunu 600–760 px
  (`--olcu-belge-*`). Masa `--masa`, kâğıt `--kagit`, 1 px çizgi, gölge yok.
- **Taşma:** sığmayan araç grupları "⋯" menüsüne gider (uygulamanın kendi
  kuralı, `lib/arac-cubugu.ts`).
- **Odak modu:** kenar çubuğu, üst çubuk ve bölme gizlenir; editör çubuğu
  ince kalır.
- **Durum çubuğu (32):** kelime, karakter, yaklaşık sayfa, kılavuz durumu.

## 10. Arvo AI bileşenleri

AI tek yüzeydir: bağlam bölmesindeki "Arvo AI" sekmesi.
- Başlık çubuğundaki düğme ve seçim düğmesi aynı yüzeyi açar.
- Satır içi öneri belgede kalır (gri süsleme; Tab kabul eder).

| Bileşen | İçerik | Durum |
|---|---|---|
| Bağlam satırı | Bölüm, seçili metin, kılavuz durumu (örn. "1. Giriş · seçili 1 cümle · kılavuz yok") | **Sunum önerisi:** asistanın bugün kullandığı bağlam görünür kılınır; yeni yetenek değil |
| İstem | Kullanıcının isteği, sağa yaslı, yüzey-2 | Var |
| Yanıt kartı | Görev etiketi ("Önerilen paragraf"), metin, atıf işaretleri (kütüphane kaydına bağlı, doğrulama işaretiyle) | Var (atıf işaretinin doğrulama gösterimi: sunum önerisi) |
| Dayanak notu | Kenar notu çizgisiyle: "Literatür kütüphanenizden 2 kaynak · sayılar metninizden" | **Sunum önerisi** (denetim bugün var, görünmüyor) |
| Fark kartı | Yeniden yazmada ekleme/silme, "+N kelime · −N kelime" | Var |
| Eylemler | Kabul et / Paragrafın altına ekle / Düzenleyerek ekle / Reddet → "✓ Uygulandı · Geri al" | Var (uygulama her zaman kullanıcının eylemi) |
| Düşen yanıt | "Bu yanıt gösterilmedi: kütüphanenizde olmayan bir atıf içeriyordu" | Mesaj metni entegrasyonda doğrulanacak |
| Yazıyor | "Yazıyor…" göstergesi; iptal | Var |
| Kaynağa sor | PDF'e soru; yanıtta birebir alıntı Newsreader italik, sayfa numarası yalnız kullanıcının yazdığı | Var (ayrı pencere; v4'te bölme içinde: **önerilen**) |

**Yasaklar:**
- Asistanın kendiliğinden kaynak önerdiği bir bileşen çizilmez.
- Metin belgeye kendiliğinden girmez.

## 11. Kaynak ve PDF bileşenleri

- **Kaynak satırı (sık):**
  - kaynak adı (Inter 14/600; ayrıntıda Newsreader);
  - yazarlar · yıl · dergi;
  - doğrulama izi (Künye, PDF, Atıf, Kanıt);
  - okuma durumu;
  - bir sonraki adım düğmesi.
- **Ayrıntı:**
  - başlık Newsreader 24;
  - künye tablosu;
  - doğrulama izi (ayrıntılı);
  - PDF durumu (indirildi / yüklendi / bulunamadı / erişilemedi / kayıt
    yok: `kaynak-pdf-satiri.tsx`);
  - eylemler: "PDF'i aç" (var, yeni sekme), "Kaynağa sor" (var),
    "Dizinlerde karşılaştır" (var).
- **PDF bölmesi — ÖNERİLEN YENİ İŞLEV (K3):**
  - belge %55 / PDF %45, sürüklenebilir ayırıcı (klavyeyle ←/→);
  - araç satırı: sayfa x/y, yakınlaştır, "Kaynağa sor", "Atıf ekle",
    "Yeni sekmede aç";
  - Kaynağa sor alıntısı PDF'te işaretlenir.
  - Bütün çıktılarda "Önerilen yeni işlev" etiketi taşır.
  - Mevcut "PDF'i aç" ve "Kaynağa sor" davranışı değişmez.

## 12. Doğrulama izi

Dört işaret; her zaman metinle birlikte:

| İşaret | Anlam | Renk | Örnek eşleme (mevcut durumlar) |
|---|---|---|---|
| ● dolu daire + ✓ | doğrulandı / hazır | başarı | künye eşleşti; PDF indirildi/yüklendi; atıf kütüphanede eşleşti; kanıt "doğrudan" |
| ◐ yarım daire | kısmen / kullanıcı adımı gerekli | uyarı | künye kısmen eşleşti; PDF bulunamadı/erişilemedi ("siz yükleyin"); kanıt "dolaylı" |
| ○ boş daire | bakılmadı / bekliyor | nötr | künye bakılmadı; kanıt değerlendirilmedi |
| ◆ eşkenar dörtgen | sorun | hata | künye uyuşmuyor; dizinde kayıt yok; atıf kütüphanede yok |

- Eksenler ayrı gösterilir: **Künye · PDF · Atıf · Kanıt.** Toplam puan
  ya da tek "doğrulandı" yok.
- Okuma durumu (Okunacak → Okundu → Kullandım) doğrulama değildir.
  Ayrı bir adım göstergesidir.

## 13. Responsive mimari

| | 1440 | 1024 | 768 | 390 | 360 |
|---|---|---|---|---|---|
| Gezinme | kenar 236 | ray 64 | ray 64 | alt çubuk 64 | alt çubuk 64 |
| İçerik dolgusu | 32 | 24 | 24 | 20 | 16 |
| İçerik ızgarası | 12 sütun, en çok 1320 | 8 sütun | 6 sütun | tek sütun | tek sütun |
| Ana Sayfa | odak yüzeyi + 55/45 iki sütun | odak + iki sütun (eşit) | odak + tek sütun | tek akış, ilk ekranda çalışma, birincil eylem, "Şimdi" | aynı (başlık 4 satır) |
| Çalışmalarım | liste 300 + ayrıntı | liste 280 + ayrıntı | liste → ayrıntı (iki ekran) | liste → ayrıntı | aynı |
| Editör | belge + yerleşik bölme 360 | belge; bölme üstüne açılır | aynı | tam genişlik belge; alt sayfa | aynı |
| PDF bölmesi (önerilen) | %55/%45 bölme (kenar raya iner) | belge/PDF arasında sekme | sekme | ayrı ekran; geri ile belgeye | aynı |
| Kaynak Kütüphanesi | liste + 360 ayrıntı/PDF bölmesi | liste + üstüne açılan ayrıntı | liste → ayrıntı | liste → ayrıntı → PDF | aynı |

Kırılımlar uygulamanınkiyle aynı: 760/761 ve 1199/1200
(`lib/os/kirilimlar.ts`). 1024 ve 768 ara durumlardır; yeni kırılım
eklenmez.

## 14. Bileşen durumları

| Durum | Kural |
|---|---|
| Üzerinde (hover) | üçüncülde yüzey-2 zemin; ikincilde çizgi-güçlü; birincilde vurgu-üzerine. 120 ms |
| Odak | 3 px `--odak` halkası, 2 px boşluk; her yüzeyde görünür (`app/styles/odak.css` ilkesi sürer) |
| Etkin (basılı) | 1 px aşağı değil: zemin bir ton koyu; hareket yok |
| Seçili | yüzey-vurgu zemin + 2 px vurgu çizgisi (liste, gezinme); sekmede 2 px alt çizgi |
| Devre dışı | metin-3 metin, çizgi zemin; imleç varsayılan; neden ipucunda ("Önce editörde metin seçin") |
| Yükleniyor | iskelet satırlar (yüzey-2, 1,2 sn yumuşak nabız, azaltılmış harekette sabit); `aria-busy`; 300 ms'den kısa işlerde gösterilmez |
| Boş | tek cümle ne olduğunu, tek düğme ne yapılacağını söyler; görsel/illüstrasyon yok |
| Hata | satır içi, kiremit metin + ◆; "Tekrar dene" ve kaydın yerinde durduğu bilgisi (veri kaybı yok dili) |
| Başarılı | kısa bildirim (4 sn), ekran okuyucuya `role="status"` |

## 15. Hareket

- **Süreler:** 120 ms (hover, durum), 200 ms (menü, sekme), 320 ms
  (bölme, alt sayfa; `--egri-sayfa`).
- Azaltılmış hareket tercihinde süreler 0.
- Sayfa geçişlerinde animasyon yok.
- Kayıt durumu değişimi yalnız metin.
