# 10 — V4.3 entegrasyon planı (PLAN ONLY)

**Her aşama ayrı kullanıcı onayı gerektirir.** Onay gelmeden hiçbir aşama
başlamaz.

**Her aşamada geçerli kurallar**
- Push, PR, merge ve deploy yok.
- Production'a dokunulmaz.
- Supabase Test'e yalnız G aşamasında ve sizin O1/O2 kararınızla dokunulur.

## 0. Sıra ve gerekçe

Önerilen sıra (istenen sıradan iki fark var):

```
V4.3-0  AI paneli hata düzeltmeleri (R24 G1–G4)  ← yeni, bağımsız, önce
V4.3-A  Temel tasarım altyapısı
V4.3-B  Kabuk ve gezinme
V4.3-D  Akademik editör      ← C'den önce
V4.3-E  Arvo AI              ← D'ye ve 0'a bağlı
V4.3-C  Ana Sayfa ve Çalışmalarım (telefon kısmı V4.2R-2 onayına bağlı)
V4.3-F  Kaynak Kütüphanesi   (B'den sonra C ile paralel olabilir; telefon kısmı V4.2R-2'ye bağlı)
V4.3-G  Regresyon ve kabul (Test ortamı)
```

**Neden 0 önce?**
- R24'te bulunan G1 (seçim menüsü görevinin sessizce kaybolması) bugün
  canlıda olan bir hata.
- Tasarımla ilgisi yok; küçük ve kendi testleriyle geri alınabilir.
- E aşaması mobil karar şeridini ve her zaman açık besteciyi kurarken bu
  davranışlara dayanıyor.

**Neden D, C'den önce?**
- Onaylı tasarımın en yüksek değerli ve en riskli parçası editör: geometri,
  kayıt ve seçim.
- C (Ana Sayfa ve Çalışmalarım) büyük ölçüde sunum işi. Telefon kısmı da
  V4.2R-2 görsel onayını bekliyor.
- Riskli iş, testleri ve geri alması en hazır olduğu anda yapılmalı.

## Ortak test komutları

| Grup | Komutlar |
|---|---|
| CI | `npx tsc --noEmit` · `npm run lint` · `npm run check:css` · `npm run check:migrations` · `npm run check:rakamlar` · `npm run test:unit` · `npm run test:editor` · `npm run test:db` |
| Önizleme | `npm run onizleme` (port 3123) ya da `onizleme:ai`, sonra `NODE_PATH=$(npm root -g) node scripts/onizleme/<betik>.mjs` |
| Görsel fark | `node scripts/onizleme/gorsel-fark.mjs cek <önce>`, değişiklik sonrası `cek <sonra>`, sonra `karsilastir <önce> <sonra> <fark>` (12 sayfa × 6 genişlik × 2 tema) |
| Derleme | `npm run build` (CI'da yok; CSS toplu değiştiğinde zorunlu) |

## Ortak geri alma

- Her aşama ayrı yerel dalda (`v43/<harf>-<ad>`) ve küçük commit'lerle
  yapılır. Geri alma `git revert <commit>`.
- CSS-yalnız commit'ler mantık commit'lerinden **ayrı** tutulur.
- Hiçbir aşama veritabanı ya da migration içermez. Dolayısıyla veri geri
  alması da yoktur.

---

## V4.3-0 · AI paneli hata düzeltmeleri

**Kapsam.** Tasarım değişikliği yok. R24'teki dört açık:
- **G1:** istek sürerken seçim menüsü görevinin kaybolmaması. Görev kuyrukta
  kalır ve durum duyurulur.
- **G2:** "Altına ekle" yolunda `silindi` denetimi.
- **G3:** izlenen aralığın hata ve bitiş durumlarında bırakılması.
- **G4:** `uygula` başında `durum` denetimi ve `useRef` kilidi.

**Dosyalar.** `write/yazim-paneli.tsx` (`gonder`, `uygula`, görev
dinleyicisi), `lib/ai-duzenleme.ts` (`bekleyenGoreviAl`),
`lib/tiptap-asistan-araligi.ts` (yalnız çağrı, değişmez).

**Ön koşul.** Bu aşama için ayrı onay. Bir hata düzeltmesi olduğu için mevcut
davranışı değiştirir.

**Riskler.** Kuyruk mantığı yeni bir yarış açabilir. Aynı görevin iki kez
gönderilmemesi (bugünkü yorum, `ai-duzenleme.ts:84`) korunmalı.

**Korunacaklar**
- Özgün aralığa uygulama.
- Birebir metin denetimi.
- Ctrl+Z adımlarının ayrı kalması.
- Sürüm eşiği.
- "Asistan yalnız sohbette yazar" kuralı.
- Asistan izi.

**Testler.** `tests/editor/asistan-araligi.test.ts`'e dört senaryo eklenir:
- birden çok bekleyen öneri;
- çift kabul;
- silinmiş bağlamda "altına ekle";
- aralık sızıntısı.

Ayrıca `ai-kabul.mjs`'e "istek sürerken seçim menüsü" senaryosu eklenir.

**Görsel kabul.** Yok (davranış).

**Geri alma.** Tek commit, revert.

**Karmaşıklık.** Küçük.

**Geçiş kapısı.** Yeni testler kırmızıdan yeşile geçer. Mevcut
`asistan-araligi` ve `ai-kabul` yeşil kalır.

## V4.3-A · Temel tasarım altyapısı

**Kapsam**
- v4 palet ve anlamsal roller.
- Eski token adları için uyumluluk katmanı.
- Newsreader (K-6).
- Ortak bileşen sınıfları: düğme kademeleri, rozet 6 px, kenar notu,
  doğrulama izi (`.iz` ve işaretler), segmentli ilerleme.
- **İlk adımda görünür değişiklik yok.**

**Token yaklaşımı (5 adım)**
1. **Ekleme.** v4 palet ve rolleri `tokens.css`'e **yeni adlarla** eklenir:
   `--yuzey-*`, `--metin-*`, `--vurgu*`, `--cizgi*`, `--basari/uyari/hata*`,
   `--tip-*`, `--r-1..5`, `--golge-1..3`.
   - Ham renk yalnız `tokens.css`'te serbest (`check:css` kural 1). Ayrı bir
     dosya bu kuralı çiğner; bu yüzden ekleme `tokens.css`'e yapılır.
   - **Bu aşamada `tokens.css` değişir: açık onay gerekir.**
   - Koyu tema karşılıkları aynı commit'te (tema eşitliği kuralı).
   - Görsel fark: 0 (yeni adları kullanan yok).
2. **Uyumluluk katmanı.** Eski ad → v4 rolü takma adları, örneğin
   `--ink: var(--metin-1)`.
   - Göç haritası `03-token-goc-haritasi.md`'de: eşlenir 126, birleşir 23,
     yeniden 22, korunur 11, kaldırılır 9, karar 8, palet 43.
   - Bu adım **görünür değişiklik yapar** (renkler v4'e geçer).
   - Önce "eşlenir" grubu, sonra "birleşir" grubu; her biri ayrı commit ve
     `gorsel-fark` (144 görüntü).
3. **Bileşen bazında geçiş.** Ekranlar B–F aşamalarında v4 adlarına geçer.
   Eski adlar yalnız takma ad olarak yaşar.
4. **Tema eşdeğerliği.** Her commit'te açık ve koyu yerleşim imzası aynı
   olmalı; `gorsel-fark` her iki temada.
5. **Kaldırma.** G'den sonra kullanımı 0 olan eski adlar silinir. Bunu
   `check:css` kural 3 (tanımsız `var` yasak) güvenceye alır.

**Dosyalar**
- `app/styles/tokens.css`.
- `app/layout.tsx` (Newsreader için `next/font`).
- `app/styles/components.css` (ortak sınıflar).
- `scripts/check-css-tokens.mjs`: palet adları listesine v4 öneki
  (`--p-*`) eklenir.

**Ön koşullar.** K-6 (Newsreader). `tokens.css` değişikliğine onay.

**Riskler**
- R1 (3.826 başvuru).
- R2 (`check:css` listeleri).
- R3 (Newsreader CLS).
- Uyumluluk katmanının iki temada farklı sonuç vermesi.

**Korunacaklar**
- Baskı renkleri (`--print-*`).
- Kâğıt kuralları (`kagit-kabul`).
- 11 px alt sınırı.
- Odak halkası (`odak-kabul`).

**Testler.** CI sekizlisi, `npm run build`, `gorsel-fark` (adım 1'de fark 0
beklenir), `odak-kabul`, `kagit-kabul`.

**Görsel kabul**
- Adım 1: piksel farkı 0.
- Adım 2: fark yalnız renk ve yarıçapta; yerleşim imzası değişmez.
- Kontrast her metinde ≥4,5:1.

**Geri alma.** Adım commit'leri ayrı; adım 2 tek başına geri alınabilir.

**Karmaşıklık.** Orta; adım 2 dikkat ister.

**Geçiş kapısı.** CI yeşil, `build` başarılı, `gorsel-fark` raporu onayınızla
kabul.

## V4.3-B · Kabuk ve gezinme

**Kapsam**
- Kenar çubuğu 248 → 236 px.
- Ray 88 → 64 px, yalnız simge, ipucu ve `aria-label` (K-1).
- Alt çubuk görünümü.
- Çalışmalarım'da kenar çubuğu yalnız seçiciyi gösterir.
- Telefon çalışma şeridi: beş bölüm + ⋯, kaymaz. Sıra: Özet, Yazım,
  Kaynaklar, Kanıt, Analiz.
- Logo yalnız resmî dosyalardan (K-2).

**Dosyalar**
- `app/dashboard/layout.tsx`.
- `_components/os-gezinme.tsx`, `os-bolum-seridi.tsx`, `calisma-baglami.tsx`.
- `app/dashboard/editor/[id]/sekme-seridi.tsx`.
- `lib/os/uygulamalar.ts` (`calismaBaglantilari` sırası), `lib/os/kirilimlar.ts`.
- `app/styles/os-shell.css`, `shell.css`.

**Ön koşullar.** A tamam; K-1 ve K-2 kararı.

**Riskler**
- 64 px rayda kısa adların kalkması: ipucu ve klavye erişimi şart.
- Kayıt güvenliğinin tıklama yakalaması (`gezinme-korumasi.tsx:128`)
  bağlantı yapısı değişince kaçabilir.

**Korunacaklar**
- `aria-current` tek yerde.
- Daraltma tercihi ve `KENAR_BETIGI`.
- Klavyede alt çubuğun gizlenmesi.
- Ctrl K.
- `gezinme-korumasi` (21 senaryo).

**Testler.** `kabuk-kabul` (18 senaryo; ray genişliği eşiği güncellenir),
`gezinme-korumasi-kabul`, `duyarlilik`, `odak-kabul`, `dokunma-kabul`
(eşik 44).

**Görsel kabul**
- 1440, 1200, 1024, 768, 390 ve 360 px'te taşma 0.
- Şeritte kesik sekme 0.
- V4.2R görselleriyle yan yana karşılaştırma.

**Geri alma.** CSS commit'i ile `uygulamalar.ts` sıra commit'i ayrı.

**Karmaşıklık.** Orta.

**Geçiş kapısı.** Tüm kabuk ve gezinme betikleri yeşil; görsel onay.

## V4.3-D · Akademik editör

**Kapsam**
- **Sabit kâğıt:** 760 px, metin 638 px (K-4). Panel aç/kapa sırasında
  kâğıt yeniden kırılmaz.
- **Genişlik kuralları (R23):**
  - ≥1200: yerleşik panel; gerekirse kenar çubuğu raya iner.
  - 761–1199: panel katman.
- Araç çubuğu 48 px tek satır; taşma kuralı (`arac-cubugu.ts`) korunur.
- Kılavuz şeridi yerine çip (A2). Kritik uyarılar belgenin üstünde,
  kapatılamaz kenar notu olarak.
- Durum çubuğu; koyu temada kâğıt (K-5).
- Telefonda dokunma hedefi 44 px.

**Dosyalar**
- `app/styles/workspace.css`:
  - 72-97 (yazı sütunu);
  - 1428-1445 (ızgara);
  - 1839-1861 (masa ve kâğıt);
  - 1366-1394 ve 1941-1950 (çubuk);
  - 1673-1688 (telefon başlığı).
- `write/manuscript-editor.tsx`: kılavuz bandı 3257-3286, durum çubuğu
  3442-3447, çubuk 2807-2940.
- `lib/kilavuz-bandi.ts`, `lib/yazim-yan-panel.ts` (`bicim` kararı).

**Ön koşullar.** A ve B tamam; K-4 ve K-5 kararı.

**Riskler**
- Kâğıt genişliği değişince sayfa tahmini (`≈ sayfa`) aynı kalmalı; o
  baskı ölçüsünden hesaplanıyor, doğrulanmalı.
- Satır içi öneri ve seçim düğmesi konumu (`secim-dugmesi-konumu`).
- Tablo sarmalayıcısı (`tablo-kabul`).
- `:has()` tabanlı ızgara kuralı.

**Korunacaklar**
- Otomatik kayıt (1.500 / 4.000 ms) ve hayalet kayıt engeli.
- Sürümler, kelime sayısı.
- Üç çıktı yolu: **dokunulmaz**. Bu aşama yalnız ekran CSS'idir.
- `?kilavuz=1`.
- Odak modu.

**Testler**
- `editor-merkezi-kabul` (ilk satır, kılavuz bandı eşikleri güncellenir).
- `arac-cubugu-kabul`, `kagit-kabul`, `kayit-kabul` (hayalet kayıt 0),
  `tablo-kabul`, `cikti-kabul`, `gezinme-korumasi-kabul`.
- `test:editor` (çıktı yolları).
- **Yeni ölçüm betiği `kagit-geometri-kabul.mjs`** (plan; G'de yazılır):
  - panel kapalı ve açık durumda ilk 10 paragrafın satır sayısı;
  - imleç konumu ve `scrollTop`;
  - 1440, 1366, 1280, 1200, 1024, 768, 390, 360 px × iki tema.

**Görsel kabul**
- ≥1200'de yeniden kırılma 0.
- Seçim ve imleç kaybı 0.
- Yazı alanı ilk ekranın üst üçte birinde başlar.

**Geri alma.** Geometri commit'i ayrı; geri alınınca bugünkü 860 px
akışkan sütuna dönülür.

**Karmaşıklık.** Yüksek.

**Geçiş kapısı.** Bütün editör betikleri yeşil; geometri ölçümü raporu;
görsel onay.

## V4.3-E · Arvo AI

**Kapsam (sunum)**
- Masaüstü tur yapısı: istem → önerilen metin (fark) → dayanak → karar.
  Kart içinde kart yok.
- Uyarı kenar notu olarak.
- Geri al olay satırı olarak.
- Mobil: R22 Çözüm A (62dvh, örtüsüz, karar şeridi + her zaman görünen
  daraltılmış besteci, klavyede alıntı satırı).
- "Dayanak" metni yalnız mevcut veriden: seçim var mı, atıf ve sayı denetimi
  geçti mi.

**Dosyalar.** `write/yazim-paneli.tsx` (görünüm), `write/yan-panel.tsx`,
`workspace.css` 1620-1645, `metin-farki.tsx`.

**Ön koşullar**
- 0 ve D tamam.
- Dayanak verisi R14 (V4.2): bugün istemciye dönmüyorsa **yalnız**
  "seçili metin; yeni atıf ve sayı yok" gibi istemcinin bildiği bilgi
  yazılır. Sunucu dönüşü genişletilecekse ayrı onay gerekir.

**Riskler**
- `visualViewport` (iOS ve Android farkı).
- `pushState` ile geri tuşu (R22-T5).
- Odak dönüşü ve seçimin korunması.
- `aria-live` gürültüsü.

**Korunacaklar**
- Kabul, düzenleyerek kabul, reddet ve geri al akışının **kodu**.
- Sürüm eşiği.
- Asistan izi.
- "Gösterilmedi" kuralı.
- Kredi uyarısı.
- Sekmelerin bağlamı koruması (`asistan-paneli-kabul`).

**Testler.** `ai-kabul`, `asistan-paneli-kabul`, `dokunma-kabul`,
`odak-kabul`, `test:editor` (`asistan-araligi`). Yeni senaryolar:
- telefonda öneri beklerken yeni istem gönderme;
- klavye açıkken karar çipinin görünmesi;
- Esc ve kapatınca odağın ve seçimin geri gelmesi.

**Görsel kabul.** V4.2R ile yan yana. Telefonda öneri beklerken besteci
görünür (V4.2R'den bilinçli sapma).

**Geri alma.** Görünüm commit'leri; mantık commit'i ayrı.

**Karmaşıklık.** Yüksek (mobil).

**Geçiş kapısı.** Bütün AI betikleri yeşil. **Gerçek cihaz testi**
(iOS Safari ve Android Chrome) yapılana kadar mobil sonuç UNVERIFIED.

## V4.3-C · Ana Sayfa ve Çalışmalarım

**Kapsam**
- Ana Sayfa:
  - "Teslime giden yol": maddeler editörün Teslim listesiyle aynı
    kaynaktan.
  - "Akademik kanıt" dört eksen (A1).
  - İkincil bilgiler tek şerit.
- Çalışmalarım:
  - masaüstünde tek bölünmüş yüzey, "Yeni çalışma" listenin son satırı;
  - telefonda kart bağlantısı (R25 A + C).
  - İlk kullanım boş durumu (A3).

**Dosyalar**
- `app/dashboard/page.tsx` (787-1414), `_components/genel-bakis.tsx`.
- `editor/page.tsx` (389-), `calisma-durum-karti.tsx`.
- `genel-bakis.css` (351-363, 548; sistem dışı 900 kırılımı → 760/1200).

**Ön koşullar.** B tamam; telefon kısmı için V4.2R-2 görsel onayı (R26).

**Riskler**
- Teslim maddelerini ana sayfaya taşımak yeni bir okuma ekleyebilir. Ekstra
  sorgu P2.1 düzeneğiyle ölçülmeli; bugün `manuscriptReadiness` zaten
  okunuyor.
- "≤7 kart" ve sadelik eşikleri.

**Korunacaklar**
- Tek birincil eylem.
- Yeni kullanıcı, personel ve danışman görünümleri.
- Teslim paketi ZIP.
- `scroll={false}`.
- Arşiv grubu.

**Testler.** `genel-bakis-kabul`, `genel-bakis-sadelik-kabul` (eşikler
gözden geçirilir), `duyarlilik`, `kabuk-kabul`, `check:rakamlar` (yeni sayı
kaynakları).

**Görsel kabul.** V4.2R ile yan yana; birincil düğme 1.

**Geri alma.** Ekran başına commit.

**Karmaşıklık.** Orta.

**Geçiş kapısı.** Betikler yeşil, sorgu sayısı artışı raporlanmış, görsel
onay.

## V4.3-F · Kaynak Kütüphanesi

**Kapsam**
- Masaüstünde hizalı eksen sütunları: Kaynak, Künye, PDF, Kanıt, Okuma.
  K-3 (a) etiketleriyle.
- Kaynakça şeridi.
- Ayrıntı paneli görünümle sınırlı ve kendi içinde kayar.
- "Kaynağa sor" ve "PDF'i aç": bugünkü bileşenler (`kaynak-pdf-satiri`,
  `kaynak-sohbet-penceresi`) **yeniden kullanılır**, davranışları değişmez.
  Yalnız kütüphane ayrıntısından da erişilebilir olurlar (DOI eşleşmesi).

**Dosyalar.** `literature/page.tsx`, `kaynak-listesi.tsx` (64-81, 195-202,
294-, 432-443, 527), `citations/kaynak-pdf-satiri.tsx` (yalnız yeniden
kullanım), `sayfa-standardi.css`, `genel-bakis.css:548`.

**Ön koşullar.** B tamam; K-3 kararı; telefon kısmı için V4.2R-2.

**Riskler**
- PDF durumunun çalışmaya bağlı olması: çalışma seçili değilken PDF sütunu
  "—" gösterir.
- Kaynağa sor ve PDF'i aç bugün yalnız Kaynakça penceresinde. Kütüphaneye
  taşımak yeni bir erişim yolu, yeni bir yetenek değil. Yetki ve RLS aynı
  kalır (imzalı adres, `kaynaklaSohbet`).
- DOI kotası (60 / saat).

**Korunacaklar**
- Okuma durumu ve geri alma.
- Eksik künye, olası tekrar.
- Dizinlerde karşılaştır (sonuç saklanmaz).
- İçe ve dışa aktarma.
- DOI kotası mesajları.

**Testler.** `kaynak-kabul`, `kaynak-ekleme-kabul`, `doi-kotasi-kabul`,
`duyarlilik`, `odak-kabul`, `check:rakamlar`.

**Görsel kabul.** PDF ekseninin satırlar arası x sapması 0. Ayrıntı paneli
görünüme sığar.

**Geri alma.** Liste ve panel commit'leri ayrı.

**Karmaşıklık.** Orta.

**Geçiş kapısı.** Betikler yeşil; görsel onay.

## V4.3-G · Regresyon ve kabul

**Kapsam**
- Bütün önizleme betikleri.
- `gorsel-fark` (144 görüntü, önce ve sonra).
- Yeni `kagit-geometri-kabul` ve AI mobil senaryoları.
- Gerçek Supabase Test ortamında kayıt güvenliği:
  - `kayit-kabul`;
  - `gezinme-korumasi-kabul` (yalnız sentetik hesaplar);
  - O1/O2 kararından sonra.
- Gerçek cihazlar: iOS Safari ve Android Chrome.

**Ön koşullar.** K-9 (O1/O2). Gerçek cihaz erişimi (bu oturumda yok).

**Riskler**
- Test ortamı verisi.
- Ortam farkı nedeniyle `cikti-kabul`'deki PDF düzeni UNVERIFIED kalabilir.

**Geri alma.** Yok (yalnız ölçüm).

**Karmaşıklık.** Orta.

**Geçiş kapısı.** `11-v43-kabul-kriterleri.md`'deki her satır PASS. Gerçekten
koşulmayan satır UNVERIFIED kalır ve sizin kararınıza sunulur.
