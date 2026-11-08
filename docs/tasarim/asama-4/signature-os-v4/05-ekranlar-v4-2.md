# 05 — V4.2 Yüksek kaliteli ekran tasarımı

**Durum:** görsel onay bekliyor. Bu bir tasarım çalışmasıdır:
- uygulama kodu, `app/styles/tokens.css`, veritabanı, Production ve
  Supabase değişmedi;
- push yapılmadı;
- V4.3 başlamadı.

İçerik sentetiktir (`tests/fixtures/tez-enflasyon-issizlik.json` ve V4.1
örnek verisi).

Bütün ekranlar yalnız `tokens-v4.css` rollerini okur. Tek istisna konsept
görsellerindeki PDF sayfası benzetimidir: dış belgenin kendi renkleri vardır
(`.pdf-sayfa`). Ekran kaynakları:

```
node ekranlar/uret.mjs                                   # 9 HTML
node ekranlar/cek.mjs ekran-goruntuleri                  # 22 ekran + 6 konsept (2x)
node ekranlar/olc.mjs > ekranlar/olcum.json              # ölçüm
node ../../asama-3/v3/cek.mjs <v3-klasör>                 # v3 revize görüntüleri
node ekranlar/karsilastir.mjs <v3-klasör> karsilastirma  # yan yana
```

## 1. Teslim edilenler

### 1.1 Zorunlu 22 görsel (`ekran-goruntuleri/`)

Her satırda iki dosya vardır: `…-acik.png` ve `…-koyu.png`.

| # | Ekran | Dosya kökü |
|---|---|---|
| 1 | Ana Sayfa masaüstü (1440) | `01-ana-sayfa-1440` |
| 2 | Ana Sayfa telefon (390) | `02-ana-sayfa-390` |
| 3 | Çalışmalarım masaüstü | `03-calismalarim-1440` |
| 4 | Çalışmalarım telefon | `04-calismalarim-390` |
| 5 | Çalışma ayrıntısı telefon | `05-calisma-ayrinti-390` |
| 6 | Akademik Editör masaüstü | `06-editor-1440` |
| 7 | Akademik Editör telefon | `07-editor-390` |
| 8 | Editör + Arvo AI masaüstü | `08-editor-ai-1440` |
| 9 | Editör + Arvo AI telefon | `09-editor-ai-390` |
| 10 | Kaynak Kütüphanesi masaüstü | `10-kaynaklar-1440` |
| 11 | Kaynak Kütüphanesi telefon | `11-kaynaklar-390` |

Görüntüler şöyle çekildi:
- Masaüstü ve telefon ayrı dosyalardır; hepsi 2x çözünürlüktedir.
- Tam sayfa telefon çekimlerinde görünüm sayfa boyuna büyütüldü. Sabit
  alt gezinme bu yüzden gerçekte durduğu yerde, en altta görünür.
- Editör ekranları görünüm boyunda (900 / 844) çekildi, çünkü "ilk ekran"
  ölçütün kendisidir.

### 1.2 Konsept görselleri (Önerilen yeni işlev)

| Dosya kökü | Ne gösteriyor |
|---|---|
| `K1-konsept-editor-pdf-1440` | Belge ve PDF yan yana (55/45). Kenar çubuğu raya iner. PDF başlığında Atıf ekle, yeni sekmede aç ve kapat. |
| `K2-konsept-editor-pdf-ai-1440` | Belge, PDF ve Arvo AI **aynı anda** (56/44). Sağ sütunda üstte PDF, altta "Kaynağa sor" (bu PDF'e bağlı). Birbirini dışlayan sekme değil. |
| `K3-konsept-editor-pdf-ai-1024` | 1024 px: Belge ve PDF ana alanda sekme, Arvo AI sağda sabit. PDF ile AI yine aynı anda görünür. |

Her konseptte üstte "Önerilen yeni işlev" bandı vardır, "Kaynağa sor"
bölümünde de "Bölmede" etiketi bulunur.

**Dar ekran alternatifi** (görsel üretilmedi, kural olarak tanımlandı):

| Genişlik | Düzen |
|---|---|
| 768–1023 | Ray (64 px). Belge / PDF ana alanda sekme. Arvo AI 360 px'lik bölme yerine **sağdan açılan katman** (`role="dialog"`, Esc kapatır). PDF sekmesi açıkken AI katmanı da açılabilir; PDF solda görünür kalır (768'de 704 − 360 = 344 px: okunur ama dar, alıntı seçmek için yakınlaştırma gerekir). |
| ≤767 (telefon) | PDF tam ekran **ayrı görünüm**, üstte "Belgeye dön" ve alıntı seçince "Atıf ekle". Kaynağa sor alt sayfası (86 vh) PDF görünümünün üzerinde açılır; PDF alt sayfanın arkasında 14 vh görünür kalır. Bugünkü "PDF'i aç" (yeni sekme) telefonda varsayılan kalır; bölme yalnız istenince açılır. |

### 1.3 v3 ↔ v4 yan yana (`karsilastirma/`)

Her biri açık ve koyu temada üretildi:
- `ana-sayfa-1440`, `calismalarim-1440`, `editor-ai-1440`, `kaynaklar-1440`;
- `telefon-ana-ayrinti`: Ana Sayfa ve Çalışma ayrıntısı, dört sütun;
- `telefon-editor-kaynak`: Editör + AI ve Kaynaklar, dört sütun.

## 2. Ekran kararları

### 2.1 Ana Sayfa

Ekran üç soruya cevap verir ve birincil eylem bir tanedir:
- **Hangi çalışma?** "Aktif çalışma" başlığı Newsreader 34/40'tır. Tür,
  üniversite ve durum hemen altındadır.
- **Şimdi ne yapmalıyım?** "Şimdi" bir kenar notudur (2 px dayanak
  çizgisi), ayrı bir kart değildir. Eylemi çerçeveli ikincil düğmedir
  ("Kılavuzumu yükle").
- **Teslime ne kadar hazır?** Sağdaki sütunda üç ölçü durur: kalan gün,
  teslim hazırlığı 1/5, yazılan. Hazırlık sayıyla birlikte metinle de
  söylenir: "3 madde bakılmayı bekliyor".
- **Birincil eylem:** yalnız "Yazmaya devam et". Ölçümde birincil düğme
  sayısı 1/1.

Aşağıda iki sütun vardır:
- **Sol:** Teslim için bakılacaklar ve Diğer çalışmalarınız.
- **Sağ:** Akademik kanıt. Kaynakça, Kanıt matrisi, Literatür ve Belge
  kontrolü dört eksende ayrı tutulur ve her biri doğrulama iziyle
  gösterilir (● ◐ ○ ◆ ve metin). Bu bölüm bugünkü kartların yeni
  sunumudur, "Sunum önerisi" olarak etiketlidir.
- **Altta ikincil şerit:** Danışmanıma gönder, Abonelik ve kredi, Yazım
  ritmi, geri bildirim.

Telefonda:
- Aynı üç soru tek kartta sorulur; ölçüler satır olarak verilir.
- Teslim ve akademik kanıt satır listesidir; geri kalanlar akordeondur.
- Alt gezinme sabittir. Son içerik çubuğun 28 px üstünde biter.

### 2.2 Çalışmalarım

**Tek gezinme.** Bu sayfada kenar çubuğu çalışmanın bölümlerini
**göstermez**, yalnız seçiciyi gösterir. Bölümler ayrıntı panelinin
sekmelerindedir: Özet / Yazım / Kaynaklar 3 / Kanıt 2 / Analiz. Geri
kalanlar "Diğer araçlar" menüsündedir (telefonda: Takvim, Kaynakça, Etik
kurul).

Liste (300 px) ve ayrıntı tek ekrandadır:
- Seçili satırda 2 px dayanak çizgisi ve vurgu yüzeyi vardır.
- Satırda tür, kelime sayısı, son düzenleme, durum, kalan gün ve ilerleme
  bulunur.

Ayrıntı panelinin içeriği:
- Newsreader başlık, tek birincil düğme ("Yazmaya devam et"), "…" menüsü;
- Şimdi notu ve teslim listesi;
- sağda üç ölçü ve "Kaynak durumu" doğrulama izi.

Telefonda Çalışmalarım bir liste ekranıdır. Satır, ayrıntıyı açar. "Yeni
çalışma" çerçevelidir: bu ekranın işi seçmektir, birincil düğme yoktur.

### 2.3 Çalışma ayrıntısı (telefon)

- Üstte geri ("Çalışmalar"), "…" ve avatar bulunur.
- Hemen altında **çalışma şeridi** durur: Özet / Yazım / Kanıt / Kaynaklar /
  Analiz / Etik. Şerit yatay kayar ve yapışkandır.
- v3'teki "Araçlar" listesi kaldırıldı, çünkü şeritle aynı hedeflere
  gidiyordu (ilke 3). Yalnız "Diğer araçlar" satırı kaldı.
- Ölçüler satırdır; birincil düğme bir tanedir.

### 2.4 Akademik Editör

**Belge odakta.** Araç çubuğu tek satır ve 48 px'tir. Üzerinde şunlar
bulunur:
- kayıt durumu ve geri al;
- paragraf stili, kalın / italik / altı çizili, iki liste;
- Atıf ve "…" taşma menüsü (mevcut `lib/arac-cubugu.ts` kuralı);
- sağda kılavuz çipi ve "Arvo AI".

**Belge yazısı kılavuzdan bağımsız biçimlendirilmez.**
- Örnek çalışmada kılavuz bağlı değil. Bu yüzden belge bugünkü varsayılan
  belge yazısıyla çizildi (`--font-belge`: sistem sans).
- Newsreader ya da v4 tipografi rolleri belge metnine uygulanmadı.
- Durum açıkça yazılır: çubukta "Kılavuz bağlı değil · Bağla",
  durum çubuğunda "varsayılan belge yazısı".
- Kâğıt yalnız yüzeyi (renk, kenar) v4'ten alır. Koyu temada "loş kâğıt"
  yalnız ekrandadır; yazdırma ve Word değişmez (R9).

**Metindeki atıf:** kütüphanede eşleşen atıf noktalı alt çizgi alır
(Phillips 1958); eşleşmeyen kırmızı noktalı çizgi alır (Friedman 1968).
Bu bir sunum önerisidir; veri bugünkü atıf eşleştirmesinden gelir.

**Yazının başladığı yer:**
- masaüstünde 193 px (900 px'lik görünümde üst üçte bir sınırı 300);
- telefonda 173 px (844'te sınır 281).

### 2.5 Editör + Arvo AI

**Panel belgeyi aşırı daraltmaz.**
- 1200 px ve üstünde panel 360 px'lik yerleşik bir bölmedir. Kâğıt
  ortalanmış kalır; 1440'ta metin sütunu **618 px**'tir (ölçüt ≥600).
- 761–1199 px'te panel yerleşik kalırsa sütun 600'ün altına iner. Hesap
  1024 için: 1024 − 64 ray − 360 panel − 48 masa dolgusu − 80 kâğıt
  dolgusu ≈ 470. Bu yüzden orada panel sağdan bir **katman** olarak açılır;
  kâğıt daralmaz, panel kenara çekilir (kimlik §1.2). Bu genişlik görsel
  olarak üretilmedi.

Panel sekmeleri bugünkü dört sekmedir: Arvo AI / İnceleme / Kaynaklar /
Teslim 1/5.

**Gösterilen durumlar** (hepsi bir akışta):

| Durum | Görselde | Bugün uygulamada |
|---|---|---|
| Kullanıcı istem yazıyor | Alttaki besteci odakta, imleç görünür; altında kural cümlesi ("Yalnız kütüphanenizdeki kaynaklara atıf yapar; metinde olmayan sayı yazmaz") | Var: kural metni `yazim-paneli.tsx:491` |
| Dayanağıyla yanıt | "Dayanak · yalnız seçili metin; yeni atıf ve sayı yok". Kaynakla çalışmada alıntı kartı: birebir alıntı, "PDF'te işaretli", "sayfa numarası sizin girişiniz" | Denetim var (`lib/ai/yazim-asistani.ts`); **dayanak notu bir sunum önerisidir** |
| Fark görünümü | Kelime düzeyinde silinen (üstü çizili, hata rengi) ve eklenen (başarı rengi); "+5 kelime · −3 kelime" | Var (`MetinFarki`) |
| Kabul et / Düzenleyerek kabul et / Reddet | Tek satır; Kabul et birincil | Var (`yazim-paneli.tsx:741–761`) |
| Geri al | Üstteki "Paragraf belgeye eklendi · 14:12 · Geri al" satırı | Var ("Uygulandı" + "Geri al", `:768–772`) |
| Dayanak bulunamadı, dürüst uyarı | "Bir yanıt gösterilmedi. Önerilen paragraf kütüphanenizde olmayan bir atıf içeriyordu (Friedman, 1968). Kaynağı kütüphanenize ekleyip yeniden isteyin." Yanında "DOI ile ekle". | Var (`app/actions/ai-yazim.ts:163`, bugün hata mesajı olarak); **kart sunumu bir sunum önerisidir** |

**Asistan kaynak önermez.** Uyarı kartı bir kaynak adı önermez:
- Yalnız kullanıcının metninde **zaten geçen** atfı (Friedman, 1968)
  söyler.
- Kullanıcıyı kendi ekleme yoluna (DOI ile ekle) yönlendirir.
- Görselde hiçbir yerde asistanın yazdığı künye, DOI ya da kaynak adı
  yoktur.

**Telefon:**
- Panel bir alt sayfadır (86 vh, `role="dialog"`, `aria-modal`). Karar
  düğmeleri 44 px'tir.
- Kabul et tam genişliktedir; Düzenleyerek kabul et ve Reddet ikinci
  satırdadır.
- Geri al satırı telefon görselinde yok; bkz. §5 G4.

### 2.6 Kaynak Kütüphanesi

**Dört eksen ayrı, dil tek.** Her kaynak satırında üç doğrulama izi
yanyana durur, hepsi aynı ● ◐ ○ ◆ işaret dilini ve yanında metni kullanır:
- **Künye:** bakılmadı / eksik: dergi, cilt, sayfa.
- **PDF:** indirildi / bakılmadı.
- **Kanıt:** 1 iddia · değerlendirilmedi / doğrudan / iddiaya bağlı değil.

Dördüncü eksen **okuma** durumudur: üç adımlı bir çizgi (Okunacak — Okundu
— Kullandım). Eksenler birleştirilmez; tek bir "doğrulandı" ya da yüzde
yoktur.

**Liste ve ayrıntı.** Kaynak adı Newsreader 17'dir ve durumdan önce gelir
(ilke 2). Ayrıntı panelinde:
- eylemler: **Kaynağa sor** (korundu), PDF'i aç (yeni sekme, bugünkü
  davranış), Atıf ekle;
- Doğrulama (Künye / PDF / Kanıt, "eksenler ayrı");
- Okuma adımı ve tek sonraki adım düğmesi;
- Künye tablosu ve Düzenle;
- Notlarım ve Kaynağı sil.

**Kaynakça denetimi** üstte bir özet şerididir:
- 94/100 uyum · 4 künye · dün ve üç ayrı bulgu;
- Sonuçları aç / Yeniden denetle.

**Telefonda:**
- Birincil eylem "Kaynak bul"dur. Kaynakça özeti tek satırdır.
- Okuma süzgeçleri yatay kayar.
- "Kaynağa sor" PDF'i olan satırda kendi satırında, 44 px düğmedir.
  Önceki taslakta okuma adımlarının yanına sığmıyor, 360 px'te kesiliyordu.

## 3. Mevcut ↔ önerilen işlev ayrımı

| İşlev | Durum | Görselde |
|---|---|---|
| Yazmaya devam et, Çalışma özeti, Kılavuzumu yükle | Mevcut | Ana Sayfa, Çalışmalarım |
| Teslim için bakılacaklar (Kapak, Yapı ve atıflar, İçindekiler) | Mevcut | Ana Sayfa, ayrıntı |
| Kaynakça denetimi 94/100 ve üç bulgu türü | Mevcut | Ana Sayfa, Kütüphane |
| Kanıt matrisi (doğrudan / değerlendirilmedi) | Mevcut | Ana Sayfa, Kütüphane |
| Okuma durumu (Okunacak / Okundu / Kullandım) | Mevcut | Kütüphane |
| PDF durumu (indirildi, bakılmadı …) ve **PDF'i aç (yeni sekme)** | Mevcut, değişmez | Kütüphane ayrıntısı |
| **Kaynağa sor (ayrı pencere)** | Mevcut, değişmez | Kütüphane ayrıntısı ve satırı |
| Dizinlerde karşılaştır | Mevcut | Kütüphane ayrıntısı ("Karşılaştır") |
| DOI ile ekle, Kaynak bul, İçe aktar | Mevcut | Kütüphane, uyarı kartı |
| Arvo AI paneli (4 sekme), seçim menüsü, fark, Kabul / Düzenleyerek kabul / Reddet / Geri al | Mevcut | Editör + AI |
| Atıf denetimi ve "gösterilmedi" mesajı | Mevcut (mesaj) | Uyarı kartı |
| Danışmanıma gönder, Abonelik ve kredi, Yazım ritmi, geri bildirim | Mevcut | Ana Sayfa alt şerit |
| Akademik kanıt bölümü (dört eksen yan yana) | **Sunum önerisi** | Ana Sayfa |
| AI bağlam çipleri (bölüm, seçim), dayanak notu, uyarı kartı | **Sunum önerisi** | Editör + AI |
| Metindeki atıfın eşleşme işareti (noktalı çizgi) | **Sunum önerisi** | Editör |
| Satırda üç eksenli doğrulama izi | **Sunum önerisi** | Kütüphane |
| Kılavuz çipi (şerit yerine) | **Sunum önerisi** (R10) | Editör |
| **Editör + PDF bölmesi** | **Önerilen yeni işlev** (K3) | K1, K3 |
| **Bölmede Kaynağa sor, alıntıyla atıf ekle, PDF'te göster** | **Önerilen yeni işlev** | K2, K3 |

Görsellerde **olmayan** ama uygulamada **olan** işlevler kaldırılmadı;
ekranda başka yerdedir:
- Paylaş ve Dışa aktar: editörde "…" menüsü.
- Satır içi öneri anahtarı: AI panelinde, görselde akış dolu olduğu için
  görünmüyor.
- Ana hat ve Kendi isteğini yaz: besteci ve seçim menüsü.
- Sürümler.

"İmlece ekle" ve "atıf kopyala" uygulamada olmadığı için görsellerde de
yoktur.

## 4. Responsive kurallar

| Genişlik | Gezinme | Çalışma bağlamı | Editör + AI | Not |
|---|---|---|---|---|
| **1440** | Etiketli kenar çubuğu (236) | Kenar çubuğunda "Açık çalışma" + bölümler | Panel 360, metin sütunu ≥600 (ölçülen 618) | Ana Sayfa iki sütun |
| **1024** | 64 px ray (ipucu, `aria-label`, klavye) | Üst çubukta yol (Çalışmalarım › çalışma › bölüm) | Belgede AI sağdan katman (kâğıt daralmaz); PDF sekmesindeyken yerleşik bölme (K3) | PDF + AI: K3 |
| **768** | 64 px ray | Yol + sayfa üstünde çalışma şeridi | AI sağdan katman (360) | Ana Sayfa tek sütun; ölçüler kartın altında yatay |
| **390** | Sabit alt gezinme (5 hedef, 64 px) | Yapışkan çalışma şeridi | AI alt sayfa (86 vh) | Dokunma ≥44 |
| **360** | Aynı | Aynı | Aynı | **Yatay taşma 0** (ölçüldü: 6 ekran × 2 tema) |

Uygulamanın bugünkü 88 px rayı bu aşamada değişmez (K2). 64 px ray V4.3'te
ayrı karardır (R5).

## 5. Ölçüm (`ekranlar/olcum.json`)

20 ekran-genişlik × 2 tema = 40 ölçüm.

| Ölçüt | Sonuç |
|---|---|
| Yatay taşma (belge ve kayan şerit dışı öğeler) | **0** / 40 |
| Açık ↔ koyu yerleşim farkı | **0** / 40 |
| En düşük metin kontrastı | açık 4,87 · koyu 5,07 (≥4,5) |
| Telefonda 44 px altı dokunma hedefi | **0** (ilk turda 3 tane vardı; düzeltildi) |
| Birincil düğme sayısı | Ana Sayfa 1, Çalışmalarım 1, ayrıntı 1, Editör + AI 1 (Kabul et), Kütüphane 1. Editörde ve telefon Çalışmalarım'da 0 (bilerek: belge ve liste odakta). |
| Editör metin sütunu | 654 (panel kapalı) · **618 (AI açık)** · 624 (PDF) · 637 (PDF + AI) |
| Yazı alanının başladığı nokta | masaüstü 193 / 900 · telefon 173 / 844 |
| Telefonda son içerik ile alt çubuk arası | 28 px (Ana Sayfa, ayrıntı, Kütüphane) |
| En küçük yazı | 11 px (Sunum önerisi etiketi 10,5'ten 11'e çıkarıldı) |

İlk turda bulunup düzeltilenler:
- İki sayaç (kenar çubuğu "Kanıt matrisi 2", sekme "Kaynaklar 3")
  `--metin-3` ile 2,78 ve 3,11 kontrasttaydı. V4.1'de `--metin-3` yalnız
  simge içindir; sayaçlar `--metin-2`'ye alındı.
- PDF + AI konseptinde metin sütunu 550 px'ti. Bölme 52/48'den 56/44'e
  alındı, kâğıt dolgusu 56'dan 40'a indi; sütun 637 oldu.
- Konsept bandı araç çubuğunun üstüne biniyordu; artık kendi satırındadır.
- PDF benzetiminde İngilizce makalenin içinde Türkçe bir "alıntı"
  işaretliydi. Birebir alıntı kuralını görselin kendisi çiğniyordu. Artık
  işaretli metin PDF'te birebir geçen İngilizce cümledir ve AI kartındaki
  alıntıyla aynıdır.

## 6. Kalite değerlendirmesi

Ölçüt notları: **G** = GEÇER, **Z** = ZAYIF. KALIR (yeniden yapılmalı) olan
ekran yok.

| Ekran | Tipografi | Denge | Akademik kimlik | Tema | Birincil eylem | Kullanılabilirlik / erişilebilirlik | v3'ten somut fark | Sonuç |
|---|---|---|---|---|---|---|---|---|
| 1 Ana Sayfa masa | G: Newsreader 34 başlık; geri kalan Inter | G (alt bölüm iki sütun, sağ sütun biraz kısa) | G: dört eksenli kanıt bölümü | G | G (1) | G | Hazırlık ölçüsü üst karta çıktı; "Şimdi" kart değil kenar notu; kanıt eksenleri ayrıldı; v3'te başlık Inter kalındı | **GEÇER** |
| 2 Ana Sayfa telefon | G | G | G | G | G | G | Akordeonlar "Diğer" altında tek grupta; kanıt satırlarında iz | **GEÇER** |
| 3 Çalışmalarım masa | G | Z: iki çalışmalı listede sol sütunun altı boş | G | G | G | G | Kenar çubuğunda bölüm listesi yok (tek gezinme); sekmeler sayaçlı | **GEÇER** (boşluk veri azlığından; 10+ çalışmada dolar) |
| 4 Çalışmalarım telefon | G | Z: iki satır, ekranın yarısı boş | G | G | G (birincil yok, bilerek) | G | Satır kartı Newsreader; ilerleme çubuğu | **ZAYIF**: boş durum rehberi eklenebilir (açık karar A3) |
| 5 Ayrıntı telefon | G | G | G | G | G | Z: şerit sağda "Etik" kesik; kaydırılabilirlik sezilir ama kesik kelime kusur gibi okunur | v3'ün "Araçlar" listesi kaldırıldı (şeritle çift gezinmeydi) | **ZAYIF**: şerit sonuna solma maskesi (G1) |
| 6 Editör masa | G: belge yazısı kılavuzdan, arayüz Inter | G | G | G | G (birincil yok; belge odakta) | G | Çubuk tek satır, 48 px; kılavuz şeridi çipe indi; atıf eşleşme işareti | **GEÇER** |
| 7 Editör telefon | G | G | Z: metinde atıf işareti yok | G | G | G | Üst çubuk ve şerit birleşti, yazı 173'te başlıyor | **GEÇER** (G2) |
| 8 Editör + AI masa | G | G | G: dayanak, fark, uyarı tek akışta | G | G (Kabul et) | G | v3 panelinde görev listesi vardı, fark/karar akışı yoktu; artık durumlar görünür | **GEÇER** |
| 9 Editör + AI telefon | G | G | G | G | G | G (44 px) | Alt sayfa; karar düğmeleri tam genişlik | **GEÇER** (Geri al satırı yok, G4) |
| 10 Kütüphane masa | G: kaynak adı Newsreader 17 | Z: ayrıntı paneli listeden yaklaşık 350 px uzun | G: üç iz + okuma adımı | G | G | G | v3'te tek "durum" rozeti vardı; artık eksenler ayrı | **GEÇER** (G3) |
| 11 Kütüphane telefon | G | G | G | G | G | G | "Kaynağa sor" satırda korunuyor; çift çizgi giderildi | **GEÇER** |
| K1–K3 konsept | G | G | G | G | — | G (bölme ayırıcı `role=separator`, klavye ←/→) | v3'te yoktu | Konsept; işlev onayı ayrı |

Teknik ölçülerin hepsi geçiyor; yukarıdaki ZAYIF notlar görsel incelemeden
gelir.

## 7. Görsel sorunlar ve açık kararlar

| No | Sorun | Öneri |
|---|---|---|
| G1 | Telefon çalışma şeridinde son sekme kesik görünüyor ("Etik"). | Sağ kenarda 24 px solma maskesi ya da "Etik"i "Diğer araçlar"a almak. |
| G2 | Telefon editöründe metindeki atıf işareti yok (masaüstünde var). | Aynı noktalı çizgi; dokununca alt sayfada atıf ayrıntısı. |
| G3 | Kütüphane masaüstünde ayrıntı paneli listeden uzun (üç kaynaklı örnekte). | Panel yapışkan (`position: sticky`) ve kendi içinde kayar. |
| G4 | Telefon AI alt sayfasında "Uygulandı · Geri al" satırı gösterilmedi. | Kabul sonrası alt sayfa kapanır, editörün altında 6 sn'lik "Geri al" bildirimi kalır. |

Açık kararlar (kurum sahibi):

- **A1.** Ana Sayfa'daki "Akademik kanıt" bölümü bugünkü dört kartın yerine
  geçsin mi? (Sunum önerisi.)
- **A2.** Editör çubuğunda kılavuz şeridi yerine çip olsun mu? (R10:
  `?kilavuz=1` derin bağlantısı korunur.)
- **A3.** Çalışmalarım telefonunda az çalışma varken boş alana "Yeni
  çalışma rehberi" eklensin mi?
- **A4.** PDF bölmesi önce yalnız masaüstünde mi açılsın? (1024 ve üstü:
  K1–K3; telefonda bugünkü yeni sekme.)
- **A5.** Sözlük (R12): ekranlarda şu adlar kullanıldı:
  - "Kaynak Kütüphanesi" (sayfa), "Kaynaklar" (sekme / alt gezinme),
    "Literatür" (Ana Sayfa ekseni), "Kaynakça" (denetim);
  - "Teslim için bakılacaklar" (liste), "Teslim hazırlığı" (ölçü).

  Bu ayrım onaylanırsa Kullanım Kılavuzu ve İngilizce metinler buna göre
  güncellenir.

## 8. V4.3 ön risk listesi

V4.1'deki R1–R12 geçerlidir (`04-uygulama-riskleri.md`). V4.2 ekranlarının
eklediği riskler:

| No | Risk | Etki | Önlem |
|---|---|---|---|
| R13 | **Uyarı kartı** bugün hata mesajı (toast) olarak geliyor. Karta taşımak, eylemin dönüş biçimini değiştirir (metin → yapı: neden, atıf, öneri yolu). | `app/actions/ai-yazim.ts`, panel | Sunucu mesajı korunur, yanına yapılandırılmış alan eklenir; denetim mantığına dokunulmaz. "Gösterilmedi" kuralı test edilir. |
| R14 | **Dayanak notu** asistanın kullandığı bağlamı (seçim, kütüphane eşleşmesi) gösterir; bu bilgi bugün istemciye dönmüyor olabilir. | `lib/ai/yazim-asistani.ts` dönüşü | Yalnız okuma: eşleşen atıflar ve sayı denetimi sonucu döner. `ai_assistant_runs` kaydı değişmez. |
| R15 | **Metindeki atıf eşleşme işareti** her tuşta kütüphane karşılaştırması gerektirebilir. | Editör performansı (P2.9) | Mevcut atıf eşleştirmesinin sonucundan süsleme (decoration); belgeye düğüm yazılmaz, hiçbir çıktıya girmez. |
| R16 | **Kütüphane satırında üç eksen**: künye, PDF ve kanıt farklı tablolardan geliyor; liste sayfasında N+1 riski. | Sorgu sayısı | Tek görünüm ya da özet işlevi; P2.1 ölçüm düzeneğiyle sınanır. |
| R17 | **Çalışmalarım'da kenar çubuğu yalnız seçici**: aynı kenar çubuğu diğer sayfalarda bölümleri gösteriyor; koşullu gezinme kabuk testlerini etkiler. | `kabuk-kabul.mjs` (18 senaryo) | Senaryolar güncellenir; çift gezinme yokluğu bir senaryo olur. |
| R18 | **Telefon çalışma şeridi** üst çubukla birleşince bugünkü kaydetme güvenliği bileşenleri (bekleyen kayıt göstergesi) yer değiştirir. | Aşama 2.1 kayıt güvenliği | `gezinme-korumasi-kabul.mjs` (21 senaryo) yeşil kalmalı; gösterge küçülür ama kaybolmaz. |
| R19 | **Newsreader çalışma başlığında**: Türkçe büyük İ ve ı ile uzun başlıklar 3 satıra çıkıyor. | Ana Sayfa yüksekliği | Başlık en çok 3 satır, `text-wrap: balance`; özgün başlık `title`'da (R4). |
| R21 | **761–1199'da AI katmanı**: bugün panel her genişlikte yerleşik. Katmana geçiş odak yönetimini ve seçim konumu güvenliğini (4.3-1) etkiler. | Editör | Seçim konumu testleri yeşil kalır; katman kapanınca odak belgeye ve aynı seçime döner. |
| R20 | **Koyu tema PDF benzetimi**: gerçek PDF görüntüleyicide koyu temada sayfa açık kalır; çevresi koyu. | Konsept doğruluğu | Görüntüleyici sayfa rengini değiştirmez (belge içeriği); yalnız çerçeve tema alır. |

---

**V4.2 burada durur.** V4.3 entegrasyonuna geçmek için açık onay gerekir:
"Signature OS v4 görsel tasarımını onaylıyorum, entegrasyon planını
hazırla."
