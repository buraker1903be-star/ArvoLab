# Bağlamlı çalışma alanı — mevcut yapı incelemesi (18.11.2026)

Taban: `main` = `a076d9d`. "Önce" görüntüleri bu tabanın temiz üretim derlemesinden
(`next build` + `next start`, BUILD_ID `kM6F068Ltd2CBPllq7KQY`), yerel yığında ve sentetik
içerikle alındı (`once/`). Satır numaraları bu tabana göredir.

## 1. Somut sorunlar

| # | Sorun | Kanıt |
|---|---|---|
| S1 | **Editörde üç gezinme katmanı.** Genel kenar çubuğu değişmeden duruyor; altında çalışma sekmeleri (Özet · Yazım · Kanıt matrisi · Etik kurul │ Kaynaklar · Analiz · Belge Kontrol) ve ayrıca bir "Çalışmalarım" düğmesi var. Bu düğme listeye değil çalışmanın özetine gidiyor. | `editor/[id]/write/page.tsx:114-150`, `calisma-sekmeleri.tsx`; `once/05-editor.png` |
| S2 | **Çalışma bağlamı neden görünmüyor:** kenar çubuğundaki çalışma alt menüsü `333e76e` (17.11.2026, "Premium çalışma alanı 1/5") ile bilerek silindi. Gerekçe o günkü kurum sahibi kararıydı: "editör açılınca gezinme değişmez" (`os-gezinme.tsx:33-38`). Yayın tarafı kaldı: `CalismaBaglamiYayinla` dört sayfada bağlamı yazıyor, `useCalismaBaglami`'yı okuyan yok. `calisma-sekmeleri.tsx:46-52`'deki "Ctrl+K ve üst çubuk onu okuyor" yorumu doğru değil. | `git show 333e76e`; `app/dashboard/_components/calisma-baglami.tsx` |
| S3 | **Bölüm listesi yalnızca inceleme panelinde.** Kılavuz bölümleri ve İçindekiler, varsayılan olarak kapalı ve 340 px sabit bir panelde; ayrı bir bölüm gezgini yok. | `manuscript-outline.tsx`, `workspace.css:517-527` |
| S4 | **Üç ayrı panel mekanizması.** İnceleme paneli: CSS sütunu, sabit 340 px. Yazım asistanı: yüzen sabit panel, 400 px, boyutlandırılamıyor. PDF: ızgara sütunu, 360–960 px, sürükleme + klavye, genişlik hatırlanıyor. Ortak bir panel bileşeni yok. | `workspace.css:1246-1260, 1477-1481`; `pdf-panel-ayirici.tsx`; `lib/pdf-goruntu.ts:25-35` |
| S5 | **Atıf düz metin.** Yazar-tarih ve numaralı atıflar metin olarak ekleniyor; tıklanınca hiçbir şey olmuyor, kaynağa ya da dayanağa gidilemiyor. | `editor-navigation.ts:236-296` |
| S6 | **PDF'te pasaj vurgusu yok.** Doğrulanmış alıntıdan sayfaya gidiliyor, eşleşen pasaj vurgulanmıyor (`gidilecekSayfa` yalnızca `{sayfa}` taşıyor). `kaynak_pdfleri` kütüphane kaydına yabancı anahtarla değil künye metniyle bağlı. | `kaynak-pdf-paneli.tsx:349`, `lib/pdf-secim.ts:24-33` |
| S7 | **Kayıtlı AI cevapları yok.** Sohbet `useState` içinde; panel kapanınca kayboluyor. Çalışmalar sunucuda `ai_assistant_runs`'a yazılıyor ama geri gösterilmiyor. | `yazim-paneli.tsx:63` |
| S8 | **Yeni çalışma Türkiye'ye özgü ve uzun.** Öğrenci penceresi üniversite, anabilim dalı, teslim tarihi soruyor; tezde ikinci adım kılavuz yükleme. Örnek metin "Dokuz Eylül Üniversitesi". Personel formu YÖK kataloğundan seçtiriyor. Çalışma başına belge dili alanı yok (`lib/belge-dili.ts` makale profilinden ya da arayüz dilinden okuyor). | `yeni-calisma-penceresi.tsx:127-246`, `academic-unit-fields.tsx:144-213`; `once/03-yeni-calisma.png` |
| S9 | **Kılavuz eksikliği satırı kalıcı.** Kılavuzu olmayan tezde her açılışta "Bu çalışmaya bağlı kılavuz yok" satırı çıkıyor, kapatılamıyor. | `manuscript-editor.tsx:2866-2891` |
| S10 | **Tipografi.** Sayfa ve çalışma başlıkları serif (Newsreader 28/500 ve 18/500), bölüm başlıkları 18, panel başlıkları 17 px; araç çubuğu 12/650. Ölçülen değerler `prototip` ekran 10'da. | `tokens.css:289-313`, ölçüm 18.11 |
| S11 | **Açık tema fildişi.** Talimat sakin beyaz/açık gri istiyor; bugünkü zemin `--fildisi-*` sıcak tonları. Değişiklik `tokens.css` üzerinden bütün ekranlara (giriş dahil) yayılır. | `tokens.css:73-79, 107-127` |

"Önce" görüntüleri gerçek depolama içeren yerel yığında alındı (`scripts/yerel-yigin/kur-depo.sh`); PDF paneli
gerçek PDF'i gösteriyor. Tohum belgesi biçim özniteliği taşımadığı için editörün açtığı "eski kayıt hatası"
uyarısı, kullanıcının yapacağı gibi "Anladım" ile kapatıldı; bu uyarı ürün sorunu sayılmadı. İlk turdaki yerel
kurulum hatası içeren ("PDF açılamadı") görüntü teslimden çıkarıldı.

## 2. Korunacak bileşen ve davranışlar

- **Gezinme:** `os-gezinme.tsx` (masaüstü kenar / tablet ray / telefon alt çubuk), rol süzgeci `gorunenUygulamalar`, personel araçlarının hesap menüsünde kalması, daraltma tercihi (`arvolab.gezinme.dar`, ilk boyamadan önce uygulanan betik).
- **Ctrl K** komut paleti (`os-komut-paleti.tsx`).
- **Çalışma bağlamı:** `calismaBolumleri` / `calismaBaglantilari` (`lib/os/uygulamalar.ts:366-396`) çalışma gezinmesinin TEK kaynağı olur; `calisma-baglami.tsx` yayıncısı yeniden okunur. İkinci bir öğe listesi yazılmaz.
- **Panel boyutlandırma:** `pdf-panel-ayirici.tsx` (sürükleme, ok tuşları ±24, Home/End, `role="separator"`, genişlik hatırlama) ve `lib/pdf-goruntu.ts` sınırları. AI ve sol alan aynı ayırıcıyı kullanır.
- **PDF:** `pdf-goruntuleyici.tsx`, sunucu doğrulaması `kaynakSecimiDogrula`, "PDF s. N" ile sayfaya gitme, telefonda tam ekran.
- **Arama:** `literatur-bulucu.tsx` (OpenAlex + Crossref, açık erişim süzgeci, "Eklenecek çalışma"), `doi-ekle-kutusu.tsx`.
- **AI kuralları:** cevap belgeye kendiliğinden girmez ("İmlece ekle" / "Seçilenin yerine koy"), panel açmak istek göndermez, asistan izi, atıf ve sayı denetimi.
- **Kayıt:** "Kaydediliyor / Kaydedildi · saat / Kaydedilemedi · tekrar dene", üstel geri çekilme, sekme başına taslak, çakışma şeridi.
- **Ana sayfa:** yeni kullanıcıya tek birincil eylem ve öğrenci görünümünde tek "devam" düğmesi zaten var (PR #107); korunur.
- **Logo:** `arvolab-logosu.tsx`, açık/koyu iki resmî dosya.

## 3. Önerilen ekran düzeni

Prototip: `prototip/index.html` (etkileşimli; tema ve dil seçilebilir). Görseller: `gorseller/`.

- **İki seviyeli sol alan, tek yuva.** Genel seviye: Ana sayfa, Çalışmalarım, Kütüphane, Araçlar (Analiz, Belge kontrolü), Yardım, Ayarlar, hesap. Çalışma seviyesi: "Çalışmalarıma dön", çalışma adı, Yaz (Belge, Bölümler) · Araştır (Kaynaklar, Makale bul, Arvo AI) · Kontrol et (Kaynakça, Kılavuz ve biçim, Özet ve teslim). Özet, Kanıt matrisi ve Etik kurul "Özet ve teslim" altında; çalışma sekme satırı kalkar.
- **Sol alan görevle genişler:** dar 236 px → bölüm listesi ve kaynaklar 300 px → makale arama 372 px. Başlık ve arama sabit, liste kendi içinde kayar. "Geri" araçtan dar gezinmeye, "Çalışmalarıma dön" genel seviyeye.
- **Sağ alan tek yardımcı panel:** Arvo AI (396 px) ya da PDF (520 px), aynı yuvayı paylaşır. Üç sütun yalnızca belge en az 560 px kalıyorsa; yetmezse önce sol alan daralır, sonra sağ panel belgenin üstüne çekmece olur.
- **Belge ana odak;** üstte bölüm adı, kayıt durumu, Kontroller, Dışa aktar. Seçili pasaj ve atıf için bağlamsal işlemler.
- **Telefon:** alt çubuk çalışma içinde Belge · Araştır · AI · Diğer; arama ve PDF tam ekran; geri etiketi gidilen yeri söyler.
- **Görsel kimlik:** açıkta beyaz/açık gri (`#f6f7f9` zemin, `#ffffff` yüzey), koyuda lacivert-gri (`#0f1625` / `#151d2e`), ölçülü lacivert vurgu. Inter arayüz; belge tipografisi kullanıcının biçimi, dokunulmaz. Değerler prototip içinde `:root`'ta; uygulamada `tokens.css`'e taşınır.
- **Tipografi:** gövde, gezinme, düğme 14; ikincil 12,5; panel başlıkları 15/600; sayfa başlığı Inter 26/600; telefonda girdi 16, dokunma hedefi 44.

### Kimlik kararları: bugünkü görünüm → önerilen

Mevcut token katmanı yeniden kullanılır, ama görünüm sürdürülmez.

| | Bugün (`once/`) | Önerilen (`gorseller/`) |
|---|---|---|
| Kenar çubuğu | Koyu lacivert dolgu, beyaz yazı | Açık yüzey, ince sınır; seçili öğe açık lacivert zemin |
| Zemin | Sıcak fildişi | Sakin beyaz / açık gri; koyuda lacivert-gri |
| Başlıklar | Newsreader serif (28 / 18) | Inter 26/600, sıkı harf aralığı |
| Editörde gezinme | Genel menü + sekme satırı + "Çalışmalarım" düğmesi | Tek sol yuva: çalışma gezinmesi, görevle genişler |
| Yeni çalışma | İki sütunlu pencere, üniversite/bölüm/tarih, tezde kılavuz adımı | Ad + tür + belge dili; geri kalanı çalışmanın içinden |
| Paneller | Üç ayrı mekanizma, yalnızca PDF boyutlanıyor | Tek sağ yuva (AI ya da PDF), ortak ayırıcı |

## 4. Mevcut yetenekler ve geliştirme gerektiren eksikler

| Alan | Bugün çalışan | Geliştirme gerekir | Veri modeli |
|---|---|---|---|
| Çalışma gezinmesi | Bağlam yayıncısı, öğe listesi | Sol yuvanın genel/çalışma geçişi, geri dönüşte liste konumu ve süzgeç | Yok (URL + oturum belleği) |
| Bölümler | `collectHeadings` / `jumpToHeading`, İçindekiler | Sol alanda bölüm listesi | Yok |
| Makale arama | OpenAlex + Crossref, açık erişim süzgeci, ekle | Sol alanda genişleyen yerleşim, durum koruma | Yok |
| PDF | Panel, sayfa, boyutlandırma, seçim doğrulama, telefonda tam ekran | Eşleşen pasajın sarı vurgusu; "eşleşme yok" durumu; kaynak kaydı ↔ PDF ↔ atıf dönüşü | Pasaj vurgusu yok. Kaynak–PDF bağı için `kaynak_pdfleri` → `literature_sources` bağı önerilecek (ayrı onay) |
| Atıf kartı | — | Atıfa tıklayınca kart, "Dayanağa git" | **Atıf düğümü** gerekir: belge şeması değişir; editör, yazdırma ve Word yolları birlikte sınanır (`cikti-yollari.test.ts`). Bu turda önerilmiyor; ayrı kapsam |
| Arvo AI | Sohbet, ekleme kuralları, kaynakla sohbet | Kayıtlı cevaplar sekmesi | Okuma `ai_assistant_runs`'tan; şema değişikliği beklenmiyor, RLS doğrulanacak |
| Yeni çalışma | Ad + tür, Word içe aktarma (editörde) | Üniversite/bölüm/tarih alanlarını ve kılavuz adımını başlangıçtan çıkarmak; içe aktarmayı başlangıca bağlamak | **Çalışma başına belge dili** için alan gerekir (bugün yok). Geçiş etkisi: mevcut çalışmalar bugünkü kuralla (makale profili → arayüz dili) doldurulur |
| Kılavuz uyarısı | Kılavuz penceresi, teslim listesi maddesi | Kalıcı satırı kaldırıp "Kılavuz ve biçim" altına almak | Yok |
| Tipografi ve tema | Token katmanı (`tokens.css`, `os5-tokens.css`) | Yeni değerler, açık temanın beyaz/gri olması | Yok |
| Panel boyutlandırma | Yalnızca PDF | AI ve sol alanın aynı ayırıcıya geçmesi | Yok |

**Onay gerektiren veri modeli kararları** (uygulamadan önce ayrıca sunulacak): çalışma başına belge dili; isteğe bağlı kaynak–PDF bağı. Atıf düğümü bu işin dışında önerildi.

## Kapsam dışı kalan ve ayrı listeye alınan talepler

- Atıf düğümü ve atıftan dayanağa gitme (belge şeması değişikliği).
- Otomatik açık erişim PDF getirme (bugün yalnızca kaynakça kontrolündeki "PDF'leri bul" ile).
- Personel/kurum ekranlarının yeni kimliğe geçişi (bu teslim öğrenci akışını kapsıyor).
