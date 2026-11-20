# Makale Bul → PDF oku → Alıntı ekle: tasarım ve uygulama planı

20.11.2026 · Taban: `main` 93fee4c (PR #114 sonrası) · **Bu teslimde kod değişikliği yok.**
Merge, dağıtım, migration ya da ArvoOS değişikliği yapılmadı.

**Bağlayıcı karar:** Merkezde belge durur. Kaynak ya da PDF yalnızca gerektiğinde yanında
açılır, öteki kontroller kullanıcı isteyince görünür. Amaç daha çok özelliği aynı anda
göstermek değil, sıradaki adımı belli etmek.

**Hedef akış:** Makale ara → sonucu incele → uygulamada PDF'yi oku → çalışmana ekle → alıntı yap.
PDF'ye ulaşmak için kaynakça denetimi çalıştırmak gerekmemeli.

Görsel öneri: [`oneri.html`](oneri.html) (görüntüsü [`gorseller/oneri.png`](gorseller/oneri.png)).
Bugünkü hâlin görüntüleri `gorseller/bugun-*.png`. Yeniden üretim betiği:
[`betikler/yeniden-uret.mjs`](betikler/yeniden-uret.mjs). Sonuçları:
[`yeniden-uretim-sonucu.json`](yeniden-uretim-sonucu.json).

---

## 1. Belirtiler nasıl yeniden üretildi

Bütün denemeler sentetik veriyle ve yalnızca 127.0.0.1 üzerinde yapıldı: yerel yığın (Postgres,
GoTrue, PostgREST, storage-api), `next build` + `next start` ve model taklidi. Gerçek hesap
ve Production'a hiç dokunulmadı. Tohum, bireysel kullanıcı için şunları kuruyor:

- bir çalışma,
- Makale Bul'un kaydettiği biçimde bir kaynak: yazarlar `"Edward W. Fisher, Jane Other"`, dergi
  `Journal of Science &amp; Society`, cilt, sayı ve sayfa boş;
- bu kaynağa bağlı, metni bilinen bir sentetik PDF.

Dış dizinler bu kapsayıcıdan güvenilir biçimde kullanılamıyor: OpenAlex 429 döndürüyor,
Unpaywall'a ulaşılamıyor. Arama sonucunun içeriği bu yüzden saf işlevlere (`crossrefKayitlari`)
sentetik Crossref cevabı verilerek üretildi. Çıktısı: [`betikler/atif-saf-cikti.txt`](betikler/atif-saf-cikti.txt).

| # | Belirti (canlı test) | Yerelde | Gözlenen |
|---|---|---|---|
| 1 | Sonuçtan PDF uygulamada açılamıyor | **Kodda kesin** | Sonucun tek eylemi dış bağlantı: `literatur-bulucu.tsx:243` `target="_blank"` |
| 2 | Önce "PDF yok", PDF için kaynakça denetimi gerekiyor | **Kodda kesin** | PDF'yi bulup indiren `kaynakPdfleriniBul`'u yalnızca `citation-check-form.tsx:335` çağırıyor. Kaynak eklemek PDF kaydı oluşturmuyor |
| 3 | "PDF'yi aç" indirmeye gidiyor | Kısmen | PDF ucu `Content-Disposition: attachment` dönüyor (R4: `attachment; filename="kaynak.pdf"`). Okuyucu `fetch` kullandığı için okuyucu etkilenmiyor. İndirmeyi büyük olasılıkla kaynakça ekranındaki "PDF'i aç" yapıyor (imzalı adresi `window.open` ile açıyor). Tarayıcıda doğrulanmadı |
| 4 | "Kaynak kaydı" genel sayfaya gidiyor | **Kodda kesin** | `atif-karti.tsx:208` → `/dashboard/literature?calisma=…`, kaynak kimliği yok. Sayfa `kaynak` parametresi okumuyor |
| 5 | Kaynaklar'da yatay kaydırma | **Üretildi** | 1440 ve 1280 px'te kartın içinde 8 px'lik yatay kaydırma (`gb-sutun` 1048/1040; `.gb-liste{margin:0 -8px}`). 390 px'te sayfanın kendisi kayıyor (458/390): "Kaynak ekle" menüsü ve süzgeç düğmeleri satırı (`cluster` 504/390) taşıyor |
| 6 | PDF okuma alanı dar, iç içe kaydırma | **Üretildi** | 1440 px'te panel 520 px, okuma alanı **344 px** yüksekliğinde, sayfa 641 px (iç kaydırma). Seçim yapılınca **277 px**, alıntı formu açılınca **181 px**; panelin kendisi de kayıyor (919/760). 1280 px'te panel 382 px. Panelde 10–13 düğme |
| 7 | Sürükleyince yeniden sığdırma yok | Kodda | `pdf-goruntuleyici.tsx:108` yalnızca ilk açılışta genişliğe sığdırıyor; ResizeObserver yok |
| 8 | Seçilen ile eklenen aynı mı | **Üretildi, aynı** | Seçilen metin ile belgeye eklenen tırnak içi metin birebir aynı |
| 9 | Alıntının çevresindeki boşluk | **Üretildi, hata** | `…tanımlanmıştır“Seasonal …”`: alıntının önüne boşluk konmuyor (`kaynak-pdf-paneli.tsx:222`) |
| 10 | Kayıtlı imlece ekleme | Üretildi, doğru | İnsan hızında doğru yere giriyor. Betik End tuşundan hemen sonra PDF'ye geçtiğinde alıntı bir karakter önceye girdi. Bunun nedeni betiğin aşırı hızı (bkz. B-8) |
| 11 | `(Edward W. Fisher, 2023)` | **Üretildi** | Makale Bul `"Ad Soyad"` biçimini `", "` ile birleştirip saklıyor. `splitAuthors` bunu tek yazar sayıyor; CSL `{family:"Edward W. Fisher", given:"Jane Other"}` alıyor. `"; "` ile birleştirilince `(Fisher ve Other, 2023)` çıkıyor |
| 12 | Başarılı eklemeden sonra kırmızı "İşlem tamamlanamadı" | **Üretildi** | Bildirim: "İşlem tamamlanamadı · (Edward W. Fisher, 2023) eklendi; künyede eksik: cilt, sayı, sayfa aralığı". `manuscript-editor.tsx:2623` eksik alan varken `"error"` türünde bildirim gösteriyor |
| 13 | Uyarı varken "APA 7 uyum 100/100" | **Üretildi** | `author_format` uyarısı varken puan 100. Puan yalnızca `error` sayıyor (`apa7.ts:550`) ve arayüz bunu söylemiyor |
| 14 | Dergi adında `&amp;` | **Üretildi** | Kaynakça: `Journal of Science &amp; Society`. Kaynaklar listesinde de aynı. Arama sonuçları HTML varlıklarını çözmüyor (`literatur-arama.ts:135, 210`) |
| 15 | Kaynakça tekrarı | Üretildi, tekrar yok | Aynı kaynağa ikinci atıfta kaynakçada tek künye var. Başlık varlıklı ya da 60 karakterden uzun olduğunda tekrar riski sürüyor; teste bağlanacak |
| 16 | AI kartı geri almadan sonra "Eklendi"de kalıyor | **Üretildi** | "Seçilenin yerine koy" → Ctrl+Z metni geri getiriyor; kartta "Eklendi" yazıyor, "Seçilenin yerine koy" devre dışı (`yazim-paneli.tsx:188` bayrak geri dönmüyor) |
| 17 | Kısaltma anlamı kaybediyor | Kodda | `kisalt` yalnızca istemle korunuyor; `yazimDenetle` anlam korunmasına bakmıyor. Gerçek modelle ölçülmedi; taklit model bunu ölçemez |
| 18 | Kaynakça başlıklı belgede İçindekiler ana metnin arkasında | **Üretildi (birim)** | `[p, h1 Kaynakça, p]` → "Ana metin \| İÇİNDEKİLER \| Kaynakça". `anaMetinBaslangici` arka bölüm H1'ini (Kaynakça) ana metnin başı sayıyor |
| 19 | Tekil Word ve ZIP aynı kurallar | Kodda | İkisi de aynı üreticiyi (`/export`) kullanıyor. Fark şu: ZIP öncesinde `saveNow()` çağrılmıyor, son değişiklik ZIP'e girmeyebilir |

Seçimin kelime ortasında bitmesi hata sayılmadı (istendiği gibi). Eklenen metin, sunucunun
PDF metninde doğruladığı dilimin kendisi.

Tohumun yan etkisi: sarı "biçim bilgileri kaybolmuş" uyarısı, tohum belgeyi biçim bilgisi
olmadan yazdığı için görünüyor. Ürün bulgusu değil.

---

## 2. Hatalar (davranış yanlış; tasarımdan bağımsız düzeltilir)

| Kod | Hata | Kök neden | Düzeltme yönü | Test |
|---|---|---|---|---|
| B-1 | Arama sonucundan gelen yazarlar yanlış atıf üretiyor | `aramaKaydiniEkle` yazarları `"Ad Soyad"` biçiminde ve `", "` ile saklıyor (`literatur-arama.ts:245`); `kaynak-bul-penceresi.tsx:91` de ters çevrilmemiş ad yazıyor | Sağlayıcının yapılandırılmış adını (`given`/`family`) `formatAuthors` biçimine (`Soyad, A. B.`) çevirip `"; "` ile sakla. OpenAlex'te yalnızca `display_name` var: son sözcük soyad (Crossref ile aynı kural, `kisiAyristir`) | `literatur-arama.test.ts`: iki ve üç yazar, tek adlı yazar, `van der`. Atıf `(Fisher ve Other, 2023)` / EN `(Fisher & Other, 2023)` |
| B-1a | Önceden kaydedilmiş bu biçimdeki kaynaklar | Veri zaten yazılmış | **Otomatik dönüşüm yok.** Kaynaklar'da "Yazar biçimi belirsiz" uyarısı ve tek tıkla önerilen düzeltme; kullanıcı onaylar | Saf `yazarBicimiBelirsiz()` testi |
| B-2 | `&amp;` | Arama sonuçları varlık çözmüyor; DOI yolundaki `clean()` yalnızca üç varlığı, tek kez çözüyor | Tek ortak `htmlVarliklariniCoz` (çift kodlama dahil): içe aktarmada başlık, dergi ve yazar için. Gösterimde de (eski kayıtlar için) aynı yardımcı | `&amp;amp;`, `&#38;`, `&lt;i&gt;` |
| B-3 | Başarılı eklemeye kırmızı hata bildirimi | Eksik alan varken `"error"` türü | `"info"` (tür zaten var): "Atıf eklendi. Künyede eksik: … [Kaynağı tamamla]" | `bildirim-turleri.test.ts` + editör testi |
| B-4 | Uyarı varken 100/100 | Puan, uyarıları bilerek dışarıda bırakıyor | Puan hesabı değişmez. Yanına "Biçim uyarısı 1 · puana katılmaz" yazılır; uyarı varken 100 yeşil gösterilmez | `apa7.test.ts` sabitleme |
| B-5 | Alıntının önünde boşluk yok | `insertContent("“…” ")` önündeki karakteri kontrol etmiyor | Alıntı + atıf **tek işlem**de, `insertCitation`'daki akıllı boşluk kuralıyla: önce boşluk, sonra alıntı, sonra atıf. Tek Ctrl+Z ikisini birlikte geri alır | `tests/editor/`: sözcük sonu, boşluk sonu, `(` sonrası, paragraf başı, seçim varken |
| B-6 | CSL düşerse alıntı atıfsız kalıyor ve panel "başarılı" kapanıyor | Alıntı `await onCite` öncesi yazılıyor; `onCite` sonuç dönmüyor | Önce atıf metni üretilir, sonra ikisi birlikte yazılır. Hata olursa belgeye hiçbir şey girmez ve panel açık kalıp hatayı gösterir | Editör testi: CSL hata → belge değişmedi |
| B-7 | AI kartı geri almadan sonra "Eklendi"de kalıyor | `eklendi` bayrağı belgeyi izlemiyor | `editor.on("update")` ile asistan izinin (`kayitId`) belgede hâlâ durup durmadığı okunur; yoksa kart yeniden etkinleşir. "Faydalı · metne eklendi" puanı geri alınmaz, ikinci bir olay yazılır (kayıt değiştirilemez, `guard_ai_run_update`) | Saf `izBelgedeMi(doc, kayitId)` testi |
| B-8 | (Gözlem) Çok hızlı geçişte alıntı bir önceki konuma girebilir | ProseMirror seçimi, DOM seçimine bir olay turu gecikmeyle eşitleniyor | Panel açılırken ve seçim yapılırken imleç `{from,to}` olarak açıkça kaydedilip eklemede o kullanılır (bugün `focus()` ile son duruma güveniliyor) | Editör testi: kayıtlı konuma ekleme |
| B-9 | Kısaltma anlamı düşürüyor | Anlam korunması denetlenmiyor | `kisalt`/`akademik` için saf denetim: sayılar ve atıflar korunmalı (zaten var), ana terimlerin (kök toleranslı) en az belirli bir oranı korunmalı, çıktı girdiden kısa olmalı. Eşik altı → **uyarı** ile birlikte düşen terimler gösterilir (karar D-4) | `yazim-asistani.test.ts`: "otomatik kayıt ve yeniden açma" örneği |
| B-10 | Kaynakça başlıklı belgede İçindekiler ana metnin arkasında | `anaMetinBaslangici` arka bölüm H1'ini ana metin sayıyor; `onSayfaVar` başlıksız paragrafı ön sayfa sayıyor | Arka bölüm H1'i (Kaynakça, Ekler, Özgeçmiş) ana metni başlatmaz. Ön sayfa varlığı yalnızca ön sayfa başlıklarından hesaplanır. Word, yazdırma ve paylaşım aynı işlevi kullandığı için üçü birlikte düzelir | `heading-numbering.test.ts` + `cikti-yollari.test.ts`'e satır |
| B-11 | ZIP son değişikliği kaçırabilir | `teslim-paketi.tsx` öncesinde `saveNow()` yok | ZIP de tekil Word gibi önce kaydeder; ikisi aynı belge sürümünü kullandığı için sıralamaları da aynı olur | ZIP içindeki Word ile tekil Word'ün metin sırası karşılaştırması (mevcut kabul betiği genişletilir) |
| B-12 | Kaynaklar'da yatay kaydırma | `.gb-liste{margin:0 -8px}` + kartın `padding:0`; telefonda menü ve süzgeç satırı sarmıyor | Negatif kenar kaldırılır; süzgeç satırı kendi içinde kayar ya da sarar; menü ekrana sığar | Tarayıcı kabulü: 1440/1280/390'da `scrollWidth == clientWidth` |
| B-13 | "Kaynak kaydı" genel sayfaya gidiyor | Bağlantıda kaynak kimliği yok | `/dashboard/literature?calisma=…&kaynak=<id>`: sayfa kaydı seçili ve ayrıntısı açık getirir | Tarayıcı kabulü |
| B-14 | "PDF'yi aç" indiriyor | İmzalı adres yeni pencerede açılıyor; uç `attachment` dönüyor | Bütün "PDF'yi aç" düğmeleri uygulama içi okuyucuyu açar. İndirme ⋯ menüsünde açıkça "İndir" olarak kalır (`attachment` orada doğru) | Tarayıcı kabulü: yeni sekme / indirme olayı yok |
| B-15 | Seçim kaldırılınca seçim kartı kalıyor | `secimiBildir` boş seçimde erken dönüyor | Boş seçim kartı kapatır | Tarayıcı kabulü |
| B-16 | (Yan gözlem, R5) Asistanın yazdığı atıf kaynakçaya girmiyor | "Seçilenin yerine koy" `(Demir, 2019)`'u düz metin olarak ekliyor; atıf düğümü olmadığı için kaynakça güncellenmiyor | Asistan metnindeki atıflar zaten kütüphaneyle eşleştirilerek denetleniyor; ekleme sırasında eşleşen atıf, atıf düğümüne çevrilsin mi, kapsam dışında mı kalsın, ayrıca kararlaştırılır. Bu plana dahil değil | — |

---

## 3. Tasarım değişiklikleri (yerleşim ve akış)

### D-1 Makale Bul: tek alan + Ara + Filtreler
- İlk görünüm: arama kutusu, **Ara**, **Filtreler (n)**. Yıl, tür, "PDF'si olanlar" ve
  eklenecek çalışma filtre panelinde, panel istenince açılır.
- Seçili filtreler kutunun altında kaldırılabilir etiketler olarak durur, yanında "Temizle".
- Filtre değişince arama **bir kez** yinelenir (son değişiklikten ~400 ms sonra). Arama
  kutusuna yazarken dış servise istek gitmez; arama yine Enter ya da Ara ile başlar.
  Saatlik 60 hak (`rate_limit_hit`) aynen sürer.
- Her sonuçta PDF durumu: **PDF açık erişimde** · **PDF bulunamadı** · **Çalışmanızda, PDF var**.
- Eylemler: **PDF'yi oku** (birincil, PDF varsa) · **Çalışmaya ekle** · "Kaynağa git ↗"
  (ikincil, düz bağlantı) · PDF yoksa "PDF yükle".

### D-2 PDF'ye erişim tek çekirdek
- `kaynakPdfleriniBul`'un çekirdeği (aday adresler, güvenli indirme, depoya yazma, abonelik
  kapısı) künye metni yerine **kaynak kimliğiyle** çağrılabilir hâle gelir.
- Bu çekirdeği beş yer çağırır: Makale Bul sonucu, Kaynaklar satırı, editördeki kaynak
  listesi, PDF panelinin boş hâli ve kaynakça denetimi. Kaynakça denetimindeki düğme yerinde
  kalır, aynı çekirdeği kullanır.
- Kaynak eklenince PDF araması kendiliğinden başlamaz; maliyetli olduğu için kullanıcının
  "PDF'yi oku" / "PDF bul" eylemiyle başlar.
- `kaynak_pdfleri.kaynak_id` sütunu var. **Migration beklenmiyor.** Uygulamada gerekirse ayrı
  onaya sunulur.

### D-3 PDF okuyucu: belge ortada, okuma alanı küçülmez
- Okuma alanı panelin bütün yüksekliğini kullanır. Alttaki yığılmış bölüm (seçim kartı,
  uzun form, AI sohbeti) kalkar.
- **Seçim araç çubuğu** seçimin yanında açılır: Alıntı ekle · Yalnızca atıf · AI'a sor · Kopyala.
- **Onay kutusu** seçimin altında küçük bir katman olarak açılır. İçinde: eklenecek metin, "PDF
  s. N'de birebir" etiketi, atfın önizlemesi, isteğe bağlı basılı sayfa, Ekle / Vazgeç.
  Kaynak eşleşmesi kesin değilse aday seçimi aynı katmanda görünür ve kesinleşmeden Ekle açılmaz.
- Üst şerit bir satır: kaynak adı · sayfa · **Genişliğe sığdır** · ⋯ · kapat. Kaynak bağı,
  PDF içinde arama, yakınlaştırma adımları ve İndir ⋯ menüsüne taşınır.
- Bölücü sürüklenince sayfa yeniden sığdırılır (ResizeObserver). Genişlik, PDF başına sayfa,
  yakınlaştırma ve **sayfa içi kaydırma konumu** saklanır. Editör imleci kaydedilir (B-8).
- AI sohbeti PDF panelinden **Arvo AI paneline** taşınır: "AI'a sor" seçili pasajla o paneli
  açar (karar D-3).

### D-4 Üç ayrı durum
Atıf kartında ve PDF üst şeridinde aynı üç satır kullanılır:
- **Kaynak kaydı:** Eşleşti · Eksik alan · Doğrulanamadı.
- **PDF:** Bulundu · Aranıyor · Açık erişimde yok / Yükle.
- **Alıntı:** PDF s. N'de birebir · PDF'de bulunamadı · Alıntı yok.

Tek bir "doğrulandı" ya da yüzde kullanılmaz (`lib/kanit/durum.ts` ilkesi). Bugün yalın
"Doğrulandı" yazan künye satırı "Kaynak kaydı doğrulandı" olur (`KUNYE_ETIKETI_METIN`).

### Ekran ekran: kalan, birleşen, taşınan, kaldırılan
Hiçbir işlev silinmiyor; "kaldırılan" yalnızca bir yinelemenin ya da ekrandaki bir yerin kalkması.

| Ekran | Kalan | Birleşen | Taşınan | Kaldırılan |
|---|---|---|---|---|
| Makale Bul (Kaynaklar penceresi + editör sol aracı) | Arama, sonuç listesi, Çalışmaya ekle, saatlik hak | — | Yıl, açık erişim, eklenecek çalışma → Filtreler paneli | Sonucun tek eylemi olan dış bağlantı "Tam metin" birincil olmaktan çıkar ("Kaynağa git ↗" ikincil) |
| Kaynaklar sayfası | Liste, süzgeçler, Kaynakça sekmesi, dışa aktarma | Satırdaki PDF durumu D-4 ile aynı dil | — | Negatif kenarın doğurduğu yatay kaydırma |
| Kaynakça denetimi | "PDF'leri bul", elle PDF yükleme | PDF bulma tek çekirdekte (D-2) | — | "PDF'i aç"taki indirme davranışı (okuyucuya gider; İndir ayrı) |
| Editör · sol kaynak listesi | Atıf ekle, PDF'yi aç | — | "Kütüphanede aç" → kaydın kendisine (B-13) | — |
| Editör · PDF paneli | Kaynak seçici, sayfa, yakınlaştırma, arama, kaynak bağı, doğrulanmış alıntı | Seçim kartı + alıntı formu → seçim araç çubuğu + onay katmanı | AI sohbeti → Arvo AI paneli; arama, bağ, İndir → ⋯ | Alttaki %45'lik yığılmış bölüm |
| Atıf kartı | Atıf, Künye/PDF/Alıntı satırları, PDF'yi aç | Satır etiketleri D-4 ile | "Kaynak kaydı" → kaydın kendisi | — |
| Yazım asistanı | Bütün görevler, İmlece ekle / Seçilenin yerine koy | — | — | Geri almadan sonra yanlış "Eklendi" |
| Dışa aktar (Word/ZIP) | İkisi de | Aynı kayıt + aynı üretici | — | — |

---

## 4. Küçük PR'lar (bağımlılık sırasıyla)

Hepsi yalnızca ArvoLab'da. Migration ve ArvoOS değişikliği beklenmiyor. Her PR kendi testleri,
sekiz CI denetimi ve gerekiyorsa yerel tarayıcı kabulüyle gelir.

| Sıra | PR | Tür | İçerik | Bağımlı |
|---|---|---|---|---|
| 1 | **M1 Atıf doğruluğu** | Hata | B-1, B-1a (uyarı, dönüşüm yok), B-2, B-3, B-4 | — |
| 2 | **M2 Alıntı ekleme** | Hata | B-5, B-6, B-8; kaynakça tekrarı testi (#15) | — |
| 3 | **M3 Word sırası + ZIP** | Hata | B-10, B-11, ZIP ile tekil Word eşitliği | — |
| 4 | **M4 AI kartı + kısaltma** | Hata | B-7, B-9 | — |
| 5 | **M5 Kaynaklar düzeni ve bağlantılar** | Hata | B-12, B-13, B-14, B-15 | — |
| 6 | **M6 PDF tek çekirdek** | Tasarım + işlev | D-2: kaynak kimliğiyle PDF bul, Kaynaklar ve editör listesinde "PDF bul", D-4 dilinde PDF durumu | M1 (temiz künye ve başlık eşleşmesi) |
| 7 | **M7 Makale Bul sadeleştirme** | Tasarım | D-1: tek alan + Filtreler + etiketler + PDF durumu + "PDF'yi oku" (ekle → PDF bul → editörde okuyucuda aç) | M6 |
| 8 | **M8 PDF okuyucu yerleşimi** | Tasarım | D-3: seçim araç çubuğu, onay katmanı, tam yükseklik, yeniden sığdırma, konum saklama, AI → Arvo AI paneli | M2 |
| 9 | **M9 Üç durum** | Tasarım | D-4: atıf kartı ve PDF şeridi | M6, M8 |

M1–M5 birbirinden bağımsız; paralel açılabilir ve tek tek yayınlanabilir. Hedef akış M7 ile
uçtan uca çalışır hâle gelir, M8 ile rahatlar.

**Kabul (uçtan uca, M7 + M8 sonrası):** Makale Bul'da ara → "PDF'yi oku" → editör açık kalır,
PDF sağda açılır → pasaj seç → Alıntı ekle → Ekle. Beklenenler:

- alıntı kayıtlı imlece girer ve önünde/arkasında doğru boşluk vardır;
- atıf `(Fisher ve Other, 2023)` biçimindedir;
- kaynakçada tek künye vardır, içinde `&amp;` yoktur;
- kırmızı bildirim yoktur;
- tek Ctrl+Z alıntıyla atfı birlikte geri alır;
- PDF'nin sayfası, yakınlaştırması ve kaydırma konumu panel kapatılıp açılınca korunur;
- Word ve ZIP içindeki Word'de İçindekiler ana metinden önce gelir.

Dış dizinler kabulde kayıtlı cevaplarla taklit edilir (`scripts/yerel-yigin/kayitli-dizin-yanitlari.mjs`).
Gerçek ağla deneme ayrıca not edilir.

---

## 5. Sizin kararınız gereken noktalar

1. **D-1 · "PDF'yi oku" kaynağı çalışmaya ekler mi?** PDF, çalışmaya ve kaynak kaydına bağlı
   olarak saklanıyor. Önerim: evet, "Okunacak" durumunda eklesin ve bildirimde "Geri al"
   bulunsun. Alternatif: eklemeden geçici okuma. Bunun için depolamada sahipsiz dosya ve
   temizlik işi gerekir.
2. **D-3 · AI sohbeti PDF panelinden Arvo AI paneline taşınsın mı?** Önerim: evet. PDF paneli
   yalnızca okumaya kalır; "AI'a sor" seçili pasajla Arvo AI'ı açar ve yanıtlar yine yalnızca
   o PDF'e dayanır.
3. **B-1a · Eski kayıtlar:** öneri gösterilsin, otomatik dönüşüm yapılmasın (önerim). Ya da
   ayrı onaylı bir veri düzeltmesi yapılsın.
4. **B-9 · Kısaltma denetimi:** anlam kaybı şüphesinde cevap **düşsün** mü, yoksa düşen
   terimlerle birlikte **uyarı** mı gösterilsin? Önerim: uyarı. Yanlış alarm kullanıcıyı aracı
   bırakmaya iter (AGENTS.md'deki sayı denetimi ilkesi).

Bu noktalar netleşince M1'den başlayarak PR'ları sırayla hazırlarım.
