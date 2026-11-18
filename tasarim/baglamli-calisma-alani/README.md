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
| `karsilastirma-be40f94/` | Prototiple aynı boyut ve içerikte karşılaştırma: `NN.png` üstte prototip, altta uygulama; `uygulama/NN.png` prototip karesiyle birebir aynı ölçüde uygulama görüntüsü. `scripts/yerel-yigin/prototip-karsilastirma.mjs` üretir |

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
yarışı; senaryo düzeltildi, uygulama değişmedi). Son tam koşu: `calisma-alani-kabul-8525487.json`.

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
- **Kayıtlı AI cevapları** (Arvo AI panelinde "Kayıtlı" sekmesi), aşağıda.
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

### Kayıtlı AI cevapları (3. turda tamamlandı)

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
- Kapsam yalnızca yazım asistanı (`yazim`). Kaynakla sohbet (`kaynak`) cevaplarının biçimi farklı (alıntılı bulgu)
  ve belgeye ekleme yolu PDF panelinde; o kayıtlar bu sekmede listelenmiyor.

**Prototipten kalan farklar** (karşılaştırma görüntüleri `karsilastirma-be40f94/`; bilerek ya da henüz yapılmadı):

- İlerleme çubuğu/kelime hedefi yok: uygulamada kullanıcının girdiği bir hedef alanı bulunmuyor, uydurulmadı (05).
- Başlık numaraları ve kâğıt yazı tipi: prototip "1. GİRİŞ" ve serif gövde gösteriyor; uygulamada numara ve yazı
  tipi kılavuzdan gelir, kılavuzsuz çalışmada numarasız ve sans (05, 07, 08).
- Seçim işlemleri prototipte belgenin sağında dikey bir kutu; uygulamada seçimin hemen altında yatay şerit (05secim).
- Yeni çalışma penceresi ana sayfadan açılınca Çalışmalarım'ın üstünde açılır; prototipte ana sayfanın üstünde (03).
- 1472'de kaynak listesi + PDF birlikte açıkken PDF sütun değil çekmece: belge %85'in altına sıkıştırılmaz kuralı
  (prototipte belge %86'ya küçülüp üç sütun). 1440/1280'de de çekmece (07, 071440, 071280).
- AI paneli açıkken 1472'de genel kenar çubuğu raya iner; panel başlığı "Yazım asistanı", sekme "Kayıtlı"
  (prototipte "Arvo AI", "Kayıtlı cevaplar") (08).
- Makale bul bu ortamda sonuç gösteremiyor: yerel yığının dış dizinlere (OpenAlex, Crossref) ağ erişimi yok,
  ekranda "Dizinlere şu anda ulaşılamıyor" yazıyor; prototipteki sonuç listesi taklit (06, tel-06).
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
- Prototipin koyu tema ve İngilizce kareleri karşılaştırmaya alınmadı (açık/TR karşılaştırıldı); koyu tema PDF
  denetimleri S14'te ölçülüyor.
