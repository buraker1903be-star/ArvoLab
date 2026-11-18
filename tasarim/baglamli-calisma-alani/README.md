# Bağlamlı çalışma alanı — tasarım teslimi

Dal `tasarim/baglamli-calisma-alani`, taban `main` = `a076d9d` (18.11.2026).
İlk iki tur: inceleme ve görsel tasarım. Onaylanan 2. tur aynı dalda uygulandı (19.11.2026); durum aşağıda, **Uygulama durumu**.

| Yol | Ne |
|---|---|
| `INCELEME.md` | Mevcut sorunlar, korunacaklar, önerilen düzen, 2. tur düzeltmeleri, mevcut/geliştirme ayrımı |
| `KARARLAR.md` | Onay bekleyen kararlar: belge dili, kaynak–PDF bağı, atıf kartı (seçenekler ve çıktı etkileri) |
| `prototip/index.html` | Etkileşimli prototip. Tarayıcıda açılır (bağımlılık yok; yalnızca Google Fonts). Ekran, tema ve dil seçilir; `#ekran-1` … `#ekran-10` doğrudan bağlantı |
| `prototip/logo/` | `public/arvolab-logo*.png`'nin bayt bayt kopyası (SHA-256 aynı); prototip uygulamadan bağımsız açılsın diye |
| `gorseller/` | Prototipin ekran görüntüleri. Masaüstü `NN-tema-dil.png` (10 ekran açık/TR; seçilenler koyu ve EN), telefon `tel-NN-tema-dil.png` (ekran 1, 2, 3, 5, 6, 7, 8). 2. turda eklenen durumlar: `05secim-*`, `05atif-*` (ekran 5, A ve B), `071440-*`, `071280-*` (ekran 7, iki genişlik) |
| `once/` | Mevcut uygulama (a076d9d, temiz üretim derlemesi, gerçek depolamalı yerel yığın, sentetik içerik) |
| `sonra/` | İlk teslimin görüntüleri (23e927c derlemesi); tarihsel, üzerine yazılmaz |
| `sonra-903bd9a/` | 2. kabul turu: 903bd9a, temiz üretim derlemesi `XRV2st2SilgSkE62Kuq3H`; tarihsel |
| `sonra-8525487/` | 3. kabul turu, son hâl: kabul betiğinin görselleri (8525487; uygulama kodu be40f94 ile aynı, temiz üretim derlemesi `Lr4ceYU3KXnrsryusC0Br`), aynı yerel yığın, sentetik içerik |
| `sonra-2ff370d/` | 4. tur: kaynak listesi + belge + PDF (S16) ve Makale bul kayıtlı yanıtlarla (S17) görselleri; 2ff370d, temiz üretim derlemesi `CiSZT8n1HjF6tw9Dljkit` |
| `karsilastirma-2ff370d/` | Son prototip karşılaştırması (2ff370d, `CiSZT8n1HjF6tw9Dljkit`): 19 sahne, prototiple aynı boyut ve içerik. 06/tel-06'daki Makale bul sonuçları SENTETİK kayıtlı yanıttır, gerçek dizin değil (görselin etiketinde yazar) |
| `karsilastirma-be40f94/` | 3. tur karşılaştırması (tarihsel): `NN.png` üstte prototip, altta uygulama; `uygulama/NN.png` prototip karesiyle birebir aynı ölçüde uygulama görüntüsü. `scripts/yerel-yigin/prototip-karsilastirma.mjs` üretir |

Prototipte içerik sentetik ve davranışlar taklittir: arama sonuçları, PDF sayfası, AI cevabı, kayıtlı cevaplar,
kelime sayıları ve atıf kartı gerçek veriye bağlı değildir. Prototip sunucuya istek göndermez. Her ekranın üstünde **Mevcut** (bugün çalışan),
**Geliştirme** (yapılması gereken) ve **Taklit** (yalnızca gösterim) etiketleri var.

## Ekranlar

1. İlk kullanım ana görünümü · 2. Mevcut çalışmalarla ana görünüm · 3. Yeni çalışma ·
4. Genel → çalışma gezinmesi · 5. Dar çalışma gezinmesi + belge · 6. Geniş makale arama + belge ·
7. Kaynak listesi + sağda PDF · 8. Sağ Arvo AI paneli · 9. Telefonda arama → PDF → belge ·
10. Mevcut/önerilen tipografi

## Henüz çalışmayan işlevler (prototipte "Geliştirme" etiketli)

- Editörde sol alanın genel ↔ çalışma gezinmesine dönüşmesi ve görevle genişlemesi
- Atıfa tıklayınca kaynak kartı ve "Dayanağa git" (bugün atıf düz metin)
- PDF'te eşleşen pasajın sarı vurgusu; "eşleşme yok" durumu
- Kayıtlı AI cevapları sekmesi
- Seçili pasaj üstünde bağlamsal araç çubuğu
- Çalışma başına belge dili; yeni çalışmadan Word içe aktarma bağlantısı
- Telefonda arama sayfası ve "Çalışma" yaprağı
- Belge ölçeği denetimi (−/+/Sığdır) ve PDF açılınca daralma sırası; telefonda PDF yakınlaştırma ve "Pasaja odaklan"
- Ayrı güven durumları (PDF açılabilir / künye doğrulandı / alıntı birebir eşleşti) tek görünümde

## Başlangıç genişlikleri (prototipte)

Genel/dar gezinme 236 · bölüm ve kaynak listesi 300 · makale arama 372 · AI 396 · PDF 520 px.
Talimattaki aralıkların içinde; gerçek içerikle uygulamada sınanacak.

## Uygulama durumu (18.11.2026, 3. kabul turu)

Beş commit, onaylanan sırayla: 1 kimlik/tipografi/gezinme · 2 yeni çalışma + belge dili (K1-A) ·
3 sol araştırma alanı, tek sağ panel, belge ölçeği, durum koruma · 4 kaynak–PDF bağı (K2-A), atıf kartı (K3-A),
pasaj vurgusu · 5 klavye, dokunma, telefon. Ardından iki kabul turu: inceleme paneli yerleşimi ve dışa aktarma
(2. tur); gezinme gruplaması, Kaynakça ve Kılavuz ve biçim araçları, Kayıtlı AI cevapları, PDF denetimleri,
çekmece erişimi (3. tur). Kabul: `node scripts/yerel-yigin/calisma-alani-kabul.mjs <adres> [görsel-dizini]`.

Kabul sonuçları commit adıyla ayrı dosyalarda (`scripts/yerel-yigin/sonuclar/`); her dosya git HEAD, BUILD_ID ve
uygulama kodunun temiz olup olmadığını taşır. Eski dosyalar yerinde: `calisma-alani-kabul.json` (23e927c, ilk
teslim), `-903bd9a.json` (13 PASS), `-be40f94.json` (16 PASS, 1 FAIL: S8, yazdırma sayfasının sayfalara bölünme
yarışı; senaryo düzeltildi, uygulama değişmedi). 3. turun tam koşusu `calisma-alani-kabul-8525487.json`
(17 PASS); son tam koşu `calisma-alani-kabul-2ff370d.json` (19 PASS, aşağıda 4. tur).

**3. turda yapılanlar**

- Gezinme prototipin gruplamasında: Yaz (Belge, Bölümler) · Araştır (Kaynaklar, Makale bul, Arvo AI) · Kontrol et
  (Kaynakça, Kılavuz ve biçim, Özet ve teslim). İkincil araçlar (Kanıt matrisi, Makale çalışma alanı, Etik kurul,
  Analiz, Belge kontrolü) masaüstünde kapalı başlayan "Diğer araçlar" grubunda; telefonun "Çalışma" sayfasında
  hepsi açık. Hiçbir işlev ve rol yetkisi kaldırılmadı; öğeler aynı listeden (`lib/os/uygulamalar.ts`).
- Üst başlık çalışmanın içinde "<açık araç> · <çalışmanın adı>" yazar (ör. "Belge · Uzaktan Öğrenmede…").
- Kalıcı "Kılavuz yok / Kurumu seç" şeridi editörden kalktı. İşlevleri sol alandaki **Kılavuz ve biçim** aracında:
  kılavuz varsa adı/stil/sürüm ve "Kuralları gör"; yoksa "Kılavuzumu yükle" ve "Kurumu seç"; biçim özeti, sayfa
  düzenini kılavuza göre ayarlama, yapı uyarıları, kontrol. **Kaynakça** aracı: atıf stili, kaynakça bölümüne git,
  atıf–kaynakça uyumu, atıf yapılmamış kaynaklar, kontrol. İkisi de çalışma menüsünde doğrudan; "Özet ve teslim"
  yalnızca teslim durumunu gösterir.
- **Kayıtlı AI cevapları** (Arvo AI panelinde "Kayıtlı" sekmesi), yalnızca yazım asistanı; kaynakla sohbet geçmişi yok (kapsam farkı, aşağıda).
- PDF denetimleri (kaynak seçici, sayfa kutusu, PDF içinde arama, Kaynağa sor) ortak `field-control` görünümünde;
  koyu temada varsayılan açık gri zemin kalmadı. Telefonda PDF ve AI paneli alt çubuğun üstünde biter.
- Çekmece (AI/PDF) editör başlığının ALTINDAN başlar; Kontroller, Dışa aktar ve kapatma düğmesi her zaman
  tıklanabilir.
- Telefonda "Dayanağa git" düzeltmesi: panel alıntı eklenince kapanıyor, kart paneli yeniden açınca görüntüleyici
  isteği bağlanırken elde bulduğu için uygulanmış sayıp PDF'i sığdırılmış 1. sayfada, vurgusuz açıyordu (masaüstünde
  de panel kapalıyken aynısı). Artık pasaj okunur ölçekte (%160) açılır, pasajın başı görünür alana kaydırılır;
  kaydırma yalnızca PDF alanında yapılır (eskiden `scrollIntoView` paneli de kaydırıp kapatma düğmesini ekrandan
  çıkarıyordu). Pasaj yoksa sığdırma ve yakınlaştırma çalışır.

**Kabul senaryoları** (S1–S11 önceki turlardan, S12–S15 bu turda):
S12 Kayıtlı AI (yerel model taklidiyle: üretim +1 kayıt/+1 model isteği; yeniden açma, sekme ve iki ekleme
denemesi +0; başka kullanıcının, başka çalışmanın ve başka yeteneğin kaydı görünmez; silinmiş kaynağa atıflı cevap
eklenmez) · S13 gezinme grupları, Diğer araçlar, kalıcı şerit yok, üst başlık, iki araç, telefon Çalışma sayfası ·
S14 koyu tema denetimleri, 1280 çekmece başlığın altında, 1472 AI açılışında kayma yok, telefon alt çubuk ve ölçek ·
S15 telefonda pasaj odağı (%160, pasajın başı görünür, "Pasaja odaklan", kapatma düğmesi ekranda).

### 4. tur (18.11.2026): kaynak listesi + belge + PDF

Kural: PDF açılınca belge %85'in altına inmez; önce sol kaynak alanı daralır, gerçekten yer yetmezse PDF çekmece olur.

| Genişlik | Kaynak listesi + PDF açılınca | Belge |
|---|---|---|
| 1472 | Liste 64 px'lik şeride iner, PDF belgenin yanında sütun (520 px) | %86 |
| 1440 | Liste şeride iner, PDF sütun (440 px) | %91 |
| 1280 | Şeritle de belge %74'e inerdi: liste açık kalır, PDF belgenin üstünde geçici çekmece | %98 |
| Şeritten liste geri açılırsa (1472'de ölçüldü) | PDF geçici çekmeceye geçer | — |

- Şerit listeyi SÖKMEZ: arama, süzgeç ve liste konumu korunur; şeritteki düğme listeyi geri açar.
- Çekmece geçici bir inceleme görünümüdür: başlığında "Geçici görünüm · Esc ile kapatın" yazar; Esc ya da çarpı kapatır,
  kapanınca yerleşim eski hâline döner (liste tam genişlikte). Esc yalnızca açık bir pencere, atıf kartı ya da Esc'i
  kendisi işleyen bir öğe yokken kapatır. İlk sürümde kontrol kapalı pencereleri de sayıyordu ve Esc çekmeceyi hiç
  kapatmıyordu; S16 bunu yakaladı.
- PDF paneli kapanınca odak belgeye, bırakılan konuma döner (eskiden odak kapatma düğmesinde kalıyordu ve yazmaya devam
  etmek için belgeye yeniden tıklamak gerekiyordu). Seçim değişmez, belge kaymaz.
- AI paneli için araç daraltılmaz (önceki kural); yalnızca PDF.
- S16 her üç genişlikte PDF açıkken belgeye tıklar, yazar, kaydın veritabanında göründüğünü bekler; PDF'i kapatır;
  seçimin, odağın ve kaydırma konumunun aynı kaldığını ve kaldığı yerden yazılabildiğini doğrular.

**Makale bul, kayıtlı yanıtlarla (S17; gerçek dizin kabulü DEĞİL).** Yerel ortamın OpenAlex/Crossref'e ağ erişimi yok.
`scripts/yerel-yigin/kayitli-dizin-yanitlari.mjs` sunucu başlamadan yüklenir (`NODE_OPTIONS="--import …"`) ve yalnızca bu
iki dizinin `/works` aramalarını `scripts/yerel-yigin/kayitli-yanitlar/` altındaki elle yazılmış SENTETİK yanıtlara
çevirir; uygulama kodu değişmez, her yakalanan istek bir kayda yazılır. S17: 3 + 2 kayıt → 4 satır (aynı DOI
birleşir), taşma yok, satır boyu ≤ 260 px; "Listeme ekle" bu çalışmaya tek kayıt yazar, yeniden aramada "Listenizde".
Bu düzenek dar araçta sonuç satırının ~400 px'e uzadığını gösterdi (ortak kuraldaki `flex: 1 1 320px` dikey satırda
yüksekliğe dönüşüyordu); düzeltildi (2ff370d). Gerçek dizinlerin yanıtı, hızı ve hata davranışı sınanmadı.

Kabul: `calisma-alani-kabul-2ff370d.json`, 19 PASS (S1–S17 + S0). Ara koşu `-f2f6b90.json` da 19 PASS'tir ama Makale bul
satır boyu denetimi o zaman yoktu ve satır hatasını yakalamadı; olduğu gibi korunuyor.

### Migration → şema önbelleği → kod sırası

Migration'lar yalnızca izole yerel yığında ve PGlite testlerinde uygulandı; Production ya da paylaşılan Test'e
uygulanmadı.

1. `20261118122556_calisma_belge_dili` (`academic_projects.belge_dili`: NULL serbest, `tr`/`en`, varsayılan ve toplu
   doldurma yok) ve `20261118125346_kaynak_pdf_kaynak_bagi` (`kaynak_pdfleri.kaynak_id`: silmede NULL, kısmi dizin,
   security invoker kapsam tetikleyicisi). İkisi de yalnızca EKLER; mevcut satırlar değişmez, eski kod çalışmaya devam eder.
2. `notify pgrst, 'reload schema';` — PostgREST önbelleği yenilenmeden yeni sütuna dokunan her istek PGRST204 ile
   düşer (yeni çalışma oluşturma dahil). Yerel kabulün ilk koşusu tam bu yüzden düştü.
3. Uygulama kodu. Kod iki sütunu okuyup yazıyor; sütunlar yokken dağıtılırsa yeni çalışma ve PDF bağı düşer.

### Geri alma koşulları

Ne zaman: belge dili ya da kaynak–PDF bağı veri bozuyor, yetki açığı çıkıyor ya da kod geri alınmak zorunda.
Sıra kurulumun TERSİDİR: önce kod (bu dalın öncesi), sonra `supabase/geri-alma/` dosyaları
(`…kaynak_pdf_kaynak_bagi.sql`, sonra `…calisma_belge_dili.sql`), sonra şema önbelleği (dosyaların sonunda).
Kaybolan: kullanıcıların seçtiği belge dilleri (çalışmalar arayüz dili kuralına döner) ve kurulan PDF–kaynak
bağları (eşleşme künye/DOI tahminine döner). PDF'ler, kaynaklar ve belgeler silinmez. İki dosya yerel veritabanında
bir işlem içinde çalıştırılıp geri sarıldı: sütunlar ve tetikleyici kalktı, 20 PDF satırı yerinde kaldı.

### Kayıtlı AI cevapları (yazım asistanı için; bütün AI geçmişi DEĞİL)

**Kapsam farkı, açık:** Kayıtlı sekmesi yalnızca yazım asistanının (`yazim`) cevaplarını gösterir. Kaynakla sohbet
(`kaynak`, PDF panelindeki "Kaynağa sor") geçmişi bu sekmede YOK; o cevaplar yine `ai_assistant_runs`'a yazılıyor ama
listelenmiyor ve yeniden açılamıyor. Diğer yeteneklerin (analiz, kaynakça, literatür, belge, kanıt, makale, kılavuz)
kayıtları da gösterilmiyor. "AI geçmişi tamamlandı" denemez; tamamlanan, yazım asistanının kayıtlı cevaplarıdır.

Önceki turda yapılmamıştı; kapsam dışı sayılmamıştı. Migration gerekmedi:

- Okuma `app/actions/ai-yazim-kayitlari.ts` → `kayitliYazimCevaplari`: oturumdaki kullanıcının, bu çalışmaya ait,
  `capability = 'yazim'`, `status = 'completed'` satırları, en yenisi başta, 20'şerli. Sorgu `user_id` ile açıkça
  daraltılır: gözetim rollerinin RLS'teki okuma hakkı bu "benim geçmişim" görünümünde kullanılmaz.
- Geçmişi açmak model çağırmaz, hak tüketmez, satır yazmaz (`asistanKapisi`/`asistanHakkiVar` çağrılmaz; saatlik
  hak bu tablodaki satırlardan sayıldığı için okumak hakkı etkilemez). Abonelik kapısı yok (`lib/access.ts`
  okumalar listesi): aboneliği biten öğrenci kendi geçmişini görebilmeli.
- Gösterim kaydedilen ham çıktının yazım asistanının kendi çözümleyicisiyle okunmasıdır (`lib/ai/kayitli-cevaplar.ts`);
  okunamayan satır listeden düşer. Yeni kayıtlarda istek ve görev `findings`'e yazılıyor; eski kayıtlarda istek
  gösterilmez.
- Belgeye ekleme kullanıcının "İmlece ekle" düğmesidir ve eklemeden önce sunucuda güncel kaynak denetimi yeniden
  çalışır (`kayitliCevabiDenetle`, üretimdeki `yazimDenetle`, BUGÜNKÜ Literatür kütüphanesiyle). Kaynağı sonradan
  silinmiş atıf varsa metin eklenmez ve nedeni kartta yazar. Eklenen metin asistan izi taşır.
- Kaynakla sohbet cevapları neden dışarıda: biçimleri farklı (alıntılı bulgu, PDF sayfası) ve belgeye ekleme yolları
  PDF panelinde, doğrulanmış pasajla birlikte. Eklemek için ayrı bir çözümleme, PDF'in hâlâ çalışmada olup olmadığının
  denetimi ve alıntının metinde yeniden doğrulanması gerekir; bu turda yapılmadı.

**Prototipten kalan farklar** (karşılaştırma görüntüleri `karsilastirma-be40f94/`; bilerek ya da henüz yapılmadı):

- İlerleme çubuğu/kelime hedefi yok: uygulamada kullanıcının girdiği bir hedef alanı bulunmuyor, uydurulmadı (05).
- Başlık numaraları ve kâğıt yazı tipi: prototip "1. GİRİŞ" ve serif gövde gösteriyor; uygulamada numara ve yazı
  tipi kılavuzdan gelir, kılavuzsuz çalışmada numarasız ve sans (05, 07, 08).
- Seçim işlemleri prototipte belgenin sağında dikey bir kutu; uygulamada seçimin hemen altında yatay şerit (05secim).
- Yeni çalışma penceresi ana sayfadan açılınca Çalışmalarım'ın üstünde açılır; prototipte ana sayfanın üstünde (03).
- Kaynak listesi + PDF: 1472 ve 1440'ta liste şeride iner, belge ile PDF yan yana (prototipte liste açık, belge %86 ile
  üç sütun; uygulamanın 924 px'lik kâğıdıyla liste açıkken belge %69–%71'e inerdi). 1280'de prototip listeyi raya indirip
  belge ile PDF'i yan yana gösteriyor; uygulamada şeritle de belge %74'e ineceği için liste açık kalır, PDF geçici
  çekmecedir (07, 071440, 071280).
- AI paneli açıkken 1472'de genel kenar çubuğu raya iner; panel başlığı "Yazım asistanı", sekme "Kayıtlı"
  (prototipte "Arvo AI", "Kayıtlı cevaplar") (08).
- Makale bul: yerel ortamın dış dizinlere ağ erişimi yok. `karsilastirma-2ff370d/` 06 ve tel-06'daki sonuçlar SENTETİK
  kayıtlı yanıttır (S17), gerçek dizin değil. Prototipte süzgeçler çip; uygulamada yıl kutuları ve açık erişim kutucuğu;
  prototipteki "PDF açılabilir / Kütüphanede" rozetleri yerine "Açık erişim / N atıf" ve "Listeme ekle".
- Telefonda üst satır prototipteki "‹ Çalışmalarım · Belge" değil, uygulamanın genel üst çubuğu; alt çubuk
  Çalışmalar · Belge · Kaynaklar · Arvo AI · Çalışma (prototipte Belge · Araştır · AI · Çalışma) (tel-*).
- Telefonda metin kutusu odaktayken alt çubuk klavyeye yer açmak için aşağı kayar; odak bırakılınca döner.
- Editöre tıklanınca kâğıdın çevresinde klavye odak halkası çizilir (base.css genel `:focus-visible` kuralı;
  bu turdan önce de böyleydi, prototipte yok).
- Doğrulanmış pasaj yalnızca oturum boyunca tutulur (K3-ek onaylı değil); yenilemeden sonra kartta yalnızca "PDF'i aç".
- Atıf kartı dipnotlu stillerde açılmaz; numaralı atıf belgenin kaynakça sırası ve başlığıyla eşlenir.
- Dar ekranda kart kâğıdın sağına sığmazsa satırın altına/üstüne iner.
- İnceleme paneli sağ panelle aynı yuvayı paylaşır, AI/PDF açıkken gizlenir; yalnız açıkken belgeyi %85'in altına
  sıkıştırmaz (önce ray, sonra çekmece). Çekmece 3. turdan beri editör başlığının altından başlar (eskiden Kontroller
  ve Dışa aktar'ı örtüyordu); incelemeye geçmek için çekmece kapatılır.
- Odak modu Esc (son kabul turu, düzeltildi): 2ff370d'de Esc odak modundan çıkarmıyordu; tarayıcıda yeniden
  üretildi (yeni S18 senaryosu 2ff370d derlemesinde FAIL; o ölçüm depoya yazılmadı,
  `calisma-alani-kabul-2ff370d.json` S18'den öncedir ve değiştirilmedi). Üç neden vardı, üçü ayrı commit:
  (1) açık pencere denetimi `[role=dialog]` ile 18 KAPALI pencereyi sayıyordu (204e6f0; S18 hâlâ FAIL,
  `calisma-alani-kabul-204e6f0.json`); (2) ProseMirror Esc'i her zaman `preventDefault` ediyor, imleç belgedeyken
  kabarcık dinleyicisi işlenmiş sayıp çıkmıyordu — aynı neden 1280'de PDF çekmecesinin Esc'le kapanmasını da
  engelliyordu, S16 bu turda bunu da ölçüyor (7315cdb, karar `lib/editor-esc.ts`); (3) Kısayollar penceresi kendi
  Esc'iyle kapanınca aynı Esc odak modundan da çıkıyordu (7b05256, yakalama aşamasındaki durum kaydediliyor).
  7b05256'da 21/21 PASS (`calisma-alani-kabul-7b05256.json`); S19 1200–1560 arası ara genişlikleri tek sayfada tarar.
- Prototipin koyu tema ve İngilizce kareleri karşılaştırmaya alınmadı (açık/TR karşılaştırıldı); koyu tema PDF
  denetimleri S14'te ölçülüyor.
