# Premium çalışma alanı (17.11.2026)

Onaylı açık/koyu tasarım görsellerinin uygulanması. Girişte kullanılan
Paddle temelli dil (40 px kontrol, 4 px kontrol köşesi, ince çizgi, düz
yüzey, kontrollü lacivert vurgu) uygulamanın geri kalanına taşındı.
Paralel bir tasarım altyapısı kurulmadı: `os5-tokens.css`, `tokens.css`,
`app/_components/ui` ve resmî logo bileşeni (`arvolab-logosu.tsx`)
geliştirildi.

## Yerleşim kararları ve öğrencinin işi

Her karar, öğrencinin o ekranda tamamlayacağı işe göre verildi.

| Ekran | Öğrencinin işi | Karar | Neden |
|---|---|---|---|
| Kenar çubuğu | "Bugün neyle çalışacağım?" | 3 ana öğe: Ana Sayfa, Çalışmalarım, Kaynaklar. Analiz ve Belge Kontrol "Araçlar", Kılavuz ve Destek "Yardım" altında; Ayarlar en altta | Günlük iş bu üçünden biri. Altı eşit öğe, ilk açılışta hangisinin günlük iş olduğunu ayırt etmeyi zorlaştırıyordu |
| Editör | Yazmaya odaklanmak | Editör açılınca kenar çubuğu değişmez; çalışma bölümleri sayfadaki sekmelerde | Eskiden editöre girmek kenar çubuğunu uzatıyordu; konum duygusu kayboluyordu |
| Ana Sayfa | Kaldığı yere dönmek | Tek kart + tek "Yazmaya devam et"; altında son kaynaklar | Ana eylem eskiden 9 kartın arasındaydı |
| Ana Sayfa (çok çalışma) | Doğru çalışmayı seçmek | Son düzenlenen + en fazla 3 çalışma daha; tamamı Çalışmalarım'da | Liste ana eylemi gölgelemesin |
| Ana Sayfa (yeni kullanıcı) | İlk çalışmayı açmak | Üç adım + tek "İlk çalışmayı oluştur" | Boş ekran yerine tek yol |
| Çalışma özeti | Teslime ne kaldığını görmek | Ölçüler, teslim kontrolü, takvim, kılavuz, araçlar burada | Ana Sayfa'dan taşınan bilgilerin bağlamı bu çalışma |
| Yazım Stüdyosu | Metin yazmak | İnceleme paneli varsayılan kapalı; adı görünür ("Kontroller"); kılavuz uyarısı tek satır | Belge birincil; kontroller istenince |
| Yazım Stüdyosu (telefon) | Telefonda birkaç cümle eklemek | 390×664'te başlık + eylemler tek satır; sekmeler bu ekranda gizli | Metin ilk ekranda görünmüyordu |
| Kaynaklar | Kaynak eklemek, okumak, işaretlemek | Tek liste; tek "Kaynak ekle" (DOI / dosya / arama); Kaynakça ayrı sekme | Üç ayrı giriş ve her zaman açık DOI kutusu "ekle"nin nerede olduğunu belirsizleştiriyordu |

## Rakiplerden alınan yaklaşımlar

Yalnızca kamuya açık belgeler ve incelemeler kullanıldı; rakip arayüzü
kopyalanmadı.

| Ürün | Yaklaşım | ArvoLAB'a uyarlanışı |
|---|---|---|
| Jenni AI | Yazım alanı ortada; asistan ve atıflar yan panelde ([inceleme](https://fritz.ai/jenni-ai-review/), [yardım](https://intercom.help/jenniai/en/articles/11193737-the-editor-formatting-blocks-and-shortcuts)) | Arvo AI ve Kaynaklar yan panelde, kullanıcı açınca. Asistan yine yalnızca sohbette yazar; belgeye eklemek kullanıcının düğmesi (AGENTS.md) |
| Zotero | Tek kütüphane listesi; araç çubuğunda DOI/ISBN ile ekleme, dosya ekleme ayrı ([destek](https://www.zotero.org/support/adding_items_to_zotero)) | Tek "Kaynak ekle" menüsü: DOI ile ekle, dosyadan içe aktar, dizinlerde ara. Künye dizinden dolar; doğrulama kuralları değişmedi |
| Overleaf | Dosya ağacı ve önizleme panelleri daraltılabilir; yazı alanı büyür ([belgeler](https://docs.overleaf.com/navigating-in-the-editor/working-with-the-pdf-viewer/editor-and-pdf-layout-and-sizing)) | Kenar çubuğu daraltılabilir (tercih hatırlanır); inceleme paneli ve PDF paneli kullanıcı açınca |
| Paperpal | Teslim öncesi kontroller tek raporda: geçen ve kalan maddeler ([EndNote](https://endnote.com/blog/endnote-teams-with-paperpal-to-bring-pre-submission-checks-to-its-users/)) | Teslim kontrolü ve "Başka neler var" çalışma özetinde tek yerde; ana sayfayı kalabalıklaştırmıyor. Kabul olasılığı ya da "dergiye uygun" hükmü yok (AGENTS.md) |
| Paddle (giriş ekranı referansı) | 40 px kontrol, 4 px köşe, gölgesiz kart | Token düzeyinde: kart 8 px, kontrol 4 px, duran yüzeyde gölge yok, birincil düğme düz lacivert |

## Taşınan özelliklerin yeni yerleri

| Özellik | Eski yer | Yeni yer |
|---|---|---|
| Analiz Merkezi | Kenar çubuğu ana listesi | Kenar çubuğu → Araçlar; telefonda Daha fazla; çalışma sekmelerinde "Analiz" |
| Belge Kontrol | Kenar çubuğu ana listesi | Kenar çubuğu → Araçlar; Daha fazla; çalışma sekmeleri |
| Destek | Kenar çubuğu ana listesi | Kenar çubuğu → Yardım; Daha fazla |
| Kullanım Kılavuzu | Hesap menüsü | Kenar çubuğu → Yardım; Daha fazla |
| Ayarlar | Yalnızca hesap menüsü | Kenar çubuğu altı + hesap menüsü |
| Dil seçimi | Hesap menüsü, Ayarlar | + üst çubukta kısa dil menüsü |
| Çalışmanın bölümleri (Özet, Yazım, Kanıt, Etik, Makale) | Editördeyken kenar çubuğu alt menüsü | Her çalışma sayfasının sekme sırası (Çalışmalarım'da da) |
| O çalışmaya süzülü Kaynaklar / Analiz / Belge | Kenar çubuğu "Bu çalışmada" | Sekme sırasının sonunda |
| Teslim ölçüleri, teslim tarihi, takvim, "Şimdi" satırı | Ana Sayfa | Çalışma özeti (Çalışmalarım → çalışma) |
| Teslim için kalanlar | Ana Sayfa | Çalışma özeti "Başka neler var" + editör Teslim kontrolü |
| Araç ızgarası (Yazım asistanı, DOI ekle, Kaynağa sor…) | Ana Sayfa | Editör araç çubuğu (Asistan, Kaynak bul, Atıf), Kaynaklar → Kaynak ekle, sekmeler |
| Kaynaklar ve kanıt satırları | Ana Sayfa | Çalışma özeti düğmeleri (Literatür, Kaynakça, Kanıt matrisi, Etik, Analiz) |
| Danışmanıma gönder (bireysel abone) | Ana Sayfa | Çalışma özeti, durum kartının altı |
| Abonelik ve kredi kartı | Ana Sayfa | Hesap menüsü → Abonelik ve Kredi; Ayarlar → Asistan krediniz |
| Haftalık yazım ritmi | Ana Sayfa kartı | Ana Sayfa selamlamasının alt satırı (bu hafta yazılan kelime) |
| Bul ve değiştir, Odak modu | Editör araç çubuğu | Editör → Belge menüsü (Ctrl+F ve Esc aynı) |
| İnceleme paneli | Varsayılan açık | Araç çubuğunda "Kontroller" (varsayılan kapalı; tercih hatırlanır) |
| Kılavuz yok uyarısı | Belgenin üstünde büyük kutu | Tek satırlık bilgi; iki bağlantı aynı |
| DOI kutusu | Kaynaklar'da her zaman açık | Kaynak ekle → DOI ile ekle (adreste DOI varsa kendiliğinden açık) |
| Kaynakça denetimi | Kaynaklar'da sağ kart | Kaynaklar → Kaynakça sekmesi |

## Bilinen borçlar

- Ana Sayfa'nın Phase 4 stillerinden (`os5-ana-sayfa.css`: `os5-ana-olcu`,
  `os5-ana-arac` vb.) artık kullanılmayanlar dosyada duruyor; ayrı bir
  temizlikte kaldırılacak.
- Çalışma özeti kartında birden çok birincil düğme var ("Yazmaya devam et",
  "Kılavuzu yükle", "Şimdi" satırının eylemi). Bu PR'da değiştirilmedi.
- `scripts/onizleme/*-kabul.mjs` tarayıcı betikleri eski kenar çubuğu alt
  menüsünü arıyor olabilir; bu PR'da koşturulmadı.
