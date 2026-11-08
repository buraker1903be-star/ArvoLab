# 01 — Signature Academic OS: tasarım kimliği ve ilkeler (V4.1)

**Yaklaşım:** Academic Editorial × Precision SaaS.
**Bir cümleyle:** İçerik editoryal, araçlar hassas. Akademik içerik (çalışma
adı, kaynak adı, alıntı) dergi sayfası gibi sunulur. Onu çevreleyen araçlar
(gezinme, düğme, durum, veri) sessiz ve kesin bir arayüz dilindedir.

## 1. Kimliği taşıyan dört imza öğesi

Süs değil; her biri bir işi görünür kılıyor.

1. **İki ses: editoryal içerik, hassas arayüz.**
   - Çalışma ve kaynak başlıkları, sayfa başlıkları ve kaynaktan birebir
     alıntılar **Newsreader**.
   - Geri kalan her şey **Inter**: gezinme, düğme, veri, durum, form.
   - Belge metni ikisinden de bağımsızdır: üniversite kılavuzunun yazı
     tipi ve şablonu uygulanır (K1).
   - Kullanıcı ilk bakışta neyin kendi akademik içeriği, neyin araç
     olduğunu ayırt eder.
2. **Kâğıt.**
   - Belge her temada bir kâğıt yüzeyidir; koyu temada "loş kâğıt".
   - Kâğıdın genişliği ve okuma ölçüsü (600–760 px) korunur; panel
     açıldığında kâğıt daralmaz, panel kenara çekilir.
3. **Doğrulama izi.**
   - Künye, PDF, metindeki atıf ve kanıt için tek bir görsel dil: aynı
     dört işaret ve her zaman yanında metin.
   - Eksenler birleştirilmez; tek bir "doğrulandı" ya da yüzde yoktur
     (AGENTS.md: "Kanıt durumları birbirinin yerine geçmez").
   - ArvoLAB'ın rakiplerden farkı tam burada görünür olur.
4. **Kenar notu (dayanak çizgisi).**
   - AI yanıtının dayandığı kaynaklar, "Şimdi" önerisi ve uyarılar,
     kitap kenarındaki not gibi solda 2 px'lik bir dayanak çizgisi ve
     küçük bir başlıkla verilir.
   - Kart içinde kart yerine bu kullanılır.

## 2. Tasarım ilkeleri

1. **Bir ekran, bir birincil eylem.** Dolgulu lacivert düğme ekranda bir
   kez; diğerleri ikincil (çerçeveli) ya da üçüncül (metin).
2. **İçerik önce, araç sonra.** Araçlar içeriğin önüne geçmez:
   - editörde yazı alanı ilk ekranın üst üçte birinde başlar;
   - kütüphanede kaynak adı, durumundan önce gelir.
3. **Tek gezinme kaynağı.** Bir ekranda aynı hedefe giden iki gezinme
   sistemi olmaz:
   - çalışmanın bölümleri geniş ekranda kenar çubuğunda;
   - rayda ve telefonda sayfanın üstündeki çalışma şeridinde;
   - Çalışmalarım'da ayrıntı panelinin sekmelerinde (orada kenar çubuğu
     yalnız seçiciyi gösterir).
4. **Dürüst arayüz.** Var olmayan işlev çalışıyor gibi çizilmez. Yeni
   önerilenler her çıktıda "Önerilen yeni işlev" etiketi taşır. Asistan
   kaynak önermez; yalnız kullanıcının kütüphanesinden atıf yapar.
5. **Durum kelimeyle söylenir.** Renk ve şekil yalnızca destekler;
   hiçbir durum yalnız renkle anlatılmaz.
6. **Sakin yüzey, keskin ayrıntı.**
   - Gölge yalnız ana yüzeyde ve üst katmanlarda (menü, alt sayfa,
     pencere).
   - Ayrım 1 px çizgi ve boşlukla yapılır.
   - Yarıçap 6–12 px; rozetler hap değil, 6 px köşeli.
7. **Uzun oturum konforu.**
   - Koyu tema saf siyah değil, derin lacivert-kömür.
   - Belge kâğıdı yüksek kontrastlı ama parlamasız.
   - Hareket kısa (120–320 ms) ve azaltılmış hareket tercihine uyar.
8. **Klavye birinci sınıf.**
   - Her eylemin klavye yolu var; odak halkası her yüzeyde görünür
     (3 px, zeminde ≥6:1).
   - Rayda her simgenin ipucu ve erişilebilir adı var.

## 3. Kaçınılanlar

- Dekoratif gradyan, cam/bulanık yüzey, büyük gölge.
- Hap biçimli rozet yağmuru.
- Her yerde aynı kart.
- Büyük harfli üst etiketin her blokta tekrarı. Etiket yalnız bölüm başına
  ve sayfada en çok üç kez.
- Birbiriyle yarışan birincil düğmeler.
- Jenni AI, Notion ya da Linear'ın birebir yerleşim veya bileşen kopyası.

## 4. Görsel kalite kriterleri (V4.2 ekranları bunlarla değerlendirilecek)

Her ekran için **GEÇER / ZAYIF / KALIR** olarak işaretlenir. Teknik ölçüleri
geçmek tek başına GEÇER değildir.

| Alan | Ölçüt | Nasıl |
|---|---|---|
| Kimlik | İki ses doğru yerde mi (içerik Newsreader, araç Inter)? Logo resmî dosyadan mı? | Görsel inceleme |
| Hiyerarşi | 3 saniyede birincil eylem, aktif çalışma ve sıradaki adım bulunuyor mu? | Görsel inceleme + birincil düğme sayısı = 1 |
| Boşluk | Boşluk ölçeği dışında değer var mı; en büyük boş dikey aralık bölüm aralığını (32 px) aşıyor mu? | Ölçüm |
| Tutarlılık | Aynı bileşen her ekranda aynı mı? Açık/koyu yerleşim farkı = 0 | Ölçüm |
| Tema | Koyu tema derinliği: zemin / yüzey / üst katman ayrışıyor mu? | Görsel inceleme |
| Erişilebilirlik | Metin ≥4,5:1, arayüz öğesi ≥3:1, telefonda hedef ≥44 px, taşma 0 | Ölçüm |
| Editör | İlk ekranda yazı alanının başladığı nokta; panel açıkken metin sütunu ≥600 px | Ölçüm |
| Ürün değeri | Kaynak ↔ belge geçişi, doğrulama görünürlüğü, AI yanıtının dayanağı görünüyor mu? | Görsel inceleme |
| Dürüstlük | Var olmayan işlev etiketli mi? | Liste denetimi |
