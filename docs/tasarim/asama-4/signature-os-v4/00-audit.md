# Signature OS v4 — V4.0 Audit (08.11.2026)

Kapsam: `docs/tasarim/asama-3/v3/` paketi ve revizyon notları, önceki/revize
v3 karşılaştırmaları, uygulamanın Ana Sayfa, Çalışmalarım, Editör, Arvo AI ve
Kaynak Kütüphanesi ekranları (Aşama 2.1 ekran görüntüleri ve kod, salt
okunur), `app/styles/` (12 dosya, ~9.300 satır; `tokens.css`'te 242 ayrı token — 290, koyu tema tekrarlarıyla tanım satırı sayısıydı).
Uygulama kodu, veritabanı, Supabase ve v3 paketi değişmedi.

## 1. Korunacak güçlü yönler

- **Kabuk:** kalıcı kenar çubuğu, üst çubuk, telefonda sabit alt gezinme,
  Ctrl+K komut paleti, çalışma değiştirici; açık/koyu tema yerleşimi birebir aynı.
- **Tek birincil eylem** ("Yazmaya devam et") ve uygulamanın kendi
  "Şimdi" önerisi: sıradaki işi kural tabanlı ve dürüst söylüyor.
- **Veri dürüstlüğü:** maketlerde var olmayan özellik çizilmedi; AA
  kontrastı, 44 px hedef ve taşma ölçümü (`olc.mjs`) ile görsel karşılaştırma
  (`scripts/onizleme/gorsel-fark.mjs`) altyapısı hazır.
- **Akademik işlev derinliği (ürünün asıl farkı):** kılavuza bağlı editör,
  kayıt güvenliği (Aşama 2.1), asistan önerisinin fark görünümüyle
  kabul/ret/geri al akışı, satır içi öneri, birebir alıntıyla "Kaynağa sor",
  künyenin dizinlerde karşılaştırılması, PDF durumları (indirildi, yüklendi,
  bulunamadı, erişilemedi, kayıt yok), kanıt matrisi, teslim kontrolü.

## 2. Görsel kalite eksikleri (v3)

1. **Kimlik jenerik.** v3 temiz ama herhangi bir SaaS ürünü olabilir:
   lacivert vurgu, ince çizgi, tek gölgeli kart. Akademik/editoryal bir imza
   öğesi yok; belge metaforu yalnız editörde.
2. **Tipografik hiyerarşi düz.** Fiilen üç boy (24 / 14 / 12) ve hep
   600–650 ağırlık. Başlık ile rakam yarışıyor; büyük harfli üst etiketler
   (AKTİF ÇALIŞMA, ŞİMDİ, KAYNAK, DURUM…) her ekranda tekrar edip kimliğe
   değil gürültüye dönüşüyor.
3. **Tekdüze satır kalıbı.** Ana Sayfa, Çalışmalarım, kütüphane ve ayrıntıda
   aynı "ad + açıklama + sağda değer" satırı; ikincil alanlar ayar sayfası
   gibi görünüyor.
4. **Vurgu rengi aşırı kullanılıyor.** accent-soft aynı anda Şimdi, seçili
   öğe, etkin gezinme, sekme ve süzgeç zemini; rozetler (Eksik, Bakılacak,
   Yeni, %94, Okunacak…) ekranda yarışıyor.
5. **Koyu tema işlevsel ama derinliksiz.** Kanvas ile yüzey birbirine çok
   yakın; katmanlar ayrışmıyor.
6. **Editör v3'te bugünkü ekranın yeniden boyanmış hâli.** Uzun araç
   çubuğu, masada kâğıt; AI paneli kullanıcının da belirttiği gibi bir komut
   listesi. Konuşma durumu, kaynağa dayalı yanıt ve önerinin fark görünümü
   hiç çizilmedi.
7. **Kütüphanede doğrulama görünmez.** Ürünün en güçlü farkı olan künye
   doğrulama, dizin karşılaştırma ve PDF durumu metin satırlarına sıkışmış.
8. **Kırılımlar eksik.** Yalnız 1440 ve 390 tasarlandı; 1024 ve 768 hiç
   çizilmedi. Uygulama bu genişliklerde 88 px'lik ray kullanıyor; talimattaki
   daraltılmış kenar 64 px. Çelişki çözülmedi.
9. **Durumlar tasarlanmadı:** hover, odak, etkin, devre dışı, yükleniyor,
   boş, hata.

## 3. En önemli UX problemleri (uygulama + v3)

1. **Editörde yazı alanı geç başlıyor.** Bugün belge metni üstten yaklaşık
   330 px aşağıda başlıyor: üst çubuk, iş çubuğu, araç çubuğu, kılavuz şeridi
   ve sağ panel sekmeleri üst üste biniyor.
2. **AI dört ayrı yerde.** Başlık çubuğundaki "Arvo AI", panel sekmesi,
   seçim düğmesi ve satır içi öneri. Tek bir zihinsel model yok; yanıtın
   hangi kaynağa dayandığı görsel olarak gösterilmiyor.
3. **Kaynak ↔ belge arasında bağlam kopuyor.** PDF yeni sekmede açılıyor
   (`app/dashboard/citations/kaynak-pdf-satiri.tsx`, "PDF'i aç"); "Kaynağa
   sor" ayrı bir pencere. Yazarken kaynağı yan yana okumak mümkün değil.
   Akademik iş akışının çekirdeği bu.
4. **Atıfın durumu metinde görünmüyor.** Bir atfın kütüphanede eşleştiği,
   doğrulandığı ya da kanıt matrisinde olduğu belgeden anlaşılmıyor.
5. **Doğrulama dili parçalı.** Üç ayrı eksen var: okuma durumu (3), PDF
   durumu (5), künye ve kanıt durumu (3 sütun). Ortak bir görsel dil yok.
6. **Adlandırma tutarsız.** Kaynaklar / Literatür / Kaynak Kütüphanesi /
   Kaynakça; Teslim listesi / durumu / kontrolü / hazırlığı; Belge Kontrol /
   Belge kontrolü.
7. **Telefon Ana Sayfa hâlâ uzun** (2096 px, 6 açılır bölüm). Telefonda
   editör araçları ile AI alt sayfası masaüstü panelinin sıkıştırılmış hâli.
8. **Çift gezinme riski** (kenar çubuğundaki çalışma bağlamı ile sayfa
   sekmeleri) v3'te sayfa sayfa yamandı; ilke olarak çözülmedi.

## 4. Tasarım sistemi eksikleri

- **Yükselti ve katman kuralı yok:** tek gölge var. Panel, açılır panel
  (drawer), modal ve alt sayfa için katman, örtü ve kırılıma göre davranış
  tanımsız.
- **Yoğunluk modu yok:** uzun oturum için rahat/sık ayrımı yok.
- **Editoryal tipografi tanımsız:** belge yazısı kılavuza bırakılmış;
  okuma ölçüsü (satır uzunluğu, satır aralığı) token değil.
- **Hareket kuralı yok:** uygulamada süre token'ları var, v3 kullanmadı.
- **Bileşen durum matrisi yok.**
- **AI bileşen kütüphanesi yok:** mesaj, kaynak dayanağı, alıntı doğrulama,
  fark kartı, uygula/geri al, "dayanak bulunamadı" durumu.
- **Kaynak/PDF bileşenleri yok:** PDF durum göstergesi, yan yana okuma,
  sayfa/alıntı işaretçisi.
- **Token göçü haritası yok:** v3 token'ları uygulamanın 290 token'ından
  farklı; eşleme tablosu olmadan entegrasyon bütün ekranları etkiler.

## 5. v4'ün çözmesi gerekenler

1. Akademik/editoryal imzası olan özgün bir kimlik (tipografi ve belge
   metaforu üzerinden; gradyan veya süs olmadan).
2. Editör öncelikli çalışma alanı: yazı alanı ilk ekranda daha yukarıda,
   sade araç çubuğu, tek bir AI yüzeyi, kaynağa dayalı ve fark görünümlü yanıt.
3. Kaynak ↔ belge yan yana çalışma (yeni önerilen işlev olarak açıkça işaretli).
4. Ortak bir doğrulama görsel dili (künye, PDF, atıf, kanıt).
5. Üç soruya cevap veren Ana Sayfa; daha kısa bir telefon akışı.
6. Beş kırılım (1440 / 1024 / 768 / 390 / 360) ve ray kararı.
7. Tam durum matrisi ve token göçü haritası.

## 6. Mevcut / yeni işlev ayrımı (v4 ekranları için)

| Öğe | Durum |
|---|---|
| Arvo AI paneli, satır içi öneri, seçimle düzenleme (Akademikleştir, Kısalt, Genişlet, Kendi isteğini yaz), fark görünümüyle Kabul et / Reddet / Geri al | **Var** |
| Kaynağa sor (PDF'e soru, birebir alıntı) | **Var**, ayrı pencere |
| PDF'i aç | **Var**, yeni sekmede; uygulama içi görüntüleyici **yok** |
| Seçili cümleye kaynak bul (kütüphane + dizinler, kullanıcı seçer) | **Var** |
| Künyeyi dizinlerde karşılaştırma, PDF durumları, kanıt matrisi | **Var** |
| Belge ile PDF'in yan yana açılması, PDF'te alıntıya işaret | **Yok** → v4'te "önerilen yeni işlev" olarak işaretlenecek |
| Asistanın kendiliğinden kaynak önermesi | **Yasak** (AGENTS.md: "Asistan kaynak önermez"); çizilmeyecek |

Not: v3 README'deki "PDF düğmesi yok" ifadesi eksikti. "PDF'i aç" var, ama
Kaynakça penceresinde ve yeni sekmede açılıyor. Kütüphanedeki ayrıntı
panelinde yok.

## 7. V4.1'e geçmeden önce kararlar

- **K1 — Belge/editoryal yazı tipi.** Önceki karar "yalnız Inter, Newsreader
  yok" idi. v4 brief'i "kontrollü akademik/editoryal tipografi" istiyor.
  Seçenekler:
  - (a) her yerde Inter; editoryal karakter yalnız boyut, ağırlık ve ölçüyle;
  - (b) arayüz Inter, belge alanı ve büyük başlıklar için tek bir serif.
- **K2 — Daraltılmış kenar.** Uygulamada 88 px etiketli ray, talimatta 64 px
  yalnız simge. Hangisi?
- **K3 — PDF yan yana ekranı.** Ekran 3 "önerilen yeni işlev" olarak açıkça
  işaretlenerek çizilsin mi?
