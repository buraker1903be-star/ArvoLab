# 08 — V4.3 teknik envanter (salt okunur, PLAN ONLY)

## Durum ve kaynak

| | |
|---|---|
| Tarih | 08.11.2026 |
| Dal | `design/phase-4.5-signature-editor`; çalışma ağacı temiz |
| Son commit | `44bc860` (V4.2R) |
| Push | 55 yerel commit, push yapılmadı |

**Değişmeyenler.** Uygulama kodu, `tokens.css`, veritabanı, migration,
Supabase ve Production değişmedi.

**Tasarım referansı.**
- Onaylı referans: `ekran-goruntuleri-v42r/` ve `07-v42r-revizyon.md`.
- Değerlendirme: masaüstü onaylı, mobil koşullu onaylı.
- V4.2R'de revize edilmeyen ekranlar `ekran-goruntuleri/` (V4.2) içindedir.

**Kanıt kuralı.**
- Her satır dosya ve satır numarasıyla verildi.
- Satır numaraları 44bc860 anındaki koda göredir.
- Doğrulanamayan şey "doğrulanamadı" diye yazıldı.

**Kısaltmalar.**

| Kısaltma | Dosya |
|---|---|
| ME | `app/dashboard/editor/[id]/write/manuscript-editor.tsx` (4.399 satır) |
| YP | `app/dashboard/editor/[id]/write/yazim-paneli.tsx` |
| WS | `app/styles/workspace.css` |
| OS | `app/styles/os-shell.css` |

---

## 1. Uygulama kabuğu ve gezinme

**Dosyalar**
- `app/dashboard/layout.tsx`
- `app/dashboard/_components/`: `os-gezinme.tsx`, `os-bolum-seridi.tsx`, `proje-secici.tsx`, `calisma-baglami.tsx`, `calisma-serit.tsx`, `calisma-secici.tsx`, `header-title.tsx`, `konum-yolu.tsx`, `ekran-sinifi.ts`
- `lib/os/kirilimlar.ts`, `lib/os/uygulamalar.ts`, `lib/os/kenar.ts`
- `app/styles/os-shell.css`, `app/styles/shell.css`

**Yerleşim**
- Üst çubuk `layout.tsx:111-135`. İçinde:
  - `HeaderTitle`, `KonumYolu`, `OsAramaDugmesi` (Ctrl K → `OsKomutPaleti`);
  - `OsSaat`, `NotificationBell`, `ThemeToggle`, `KullaniciMenusu`.
- `OsBolumSeridi` `:138`, `OsGezinme` `:207`.
- Sunucu ilk çizimde genişliği tahmin eder: `ekranTahmini` ve `EkranIpucuSaglayici`.

**Kırılımlar ve ölçüler**
- Kırılımlar (`kirilimlar.ts`):
  - telefon ≤760 (`TELEFON_EN_FAZLA`);
  - tablet 761–1199;
  - masaüstü ≥1200 (`MASAUSTU_EN_AZ`).
- `os-shell.css` aynı sayıları elle tekrarlıyor: 160–168, 170–205, 211–234.
- Ölçüler (`tokens.css:463-469`):

| Token | Değer |
|---|---|
| `--gezinme-genislik` | 248 px |
| `--gezinme-ray` | **88 px** |
| `--alt-cubuk-h` | 64 px |
| `--topbar-height` | 56 px |

**Kenar çubuğu ve ray**
- Daraltma `html[data-kenar="dar"]` ile yapılır.
- Tercih localStorage'da `arvolab.kenar` anahtarında tutulur.
- `KENAR_BETIGI` tercihi boyamadan önce uygular (`app/layout.tsx:97`).

**Telefon**
- Alt çubuk: `ALT_CUBUK = home, tez, kaynaklar, analiz` + "Daha fazla" (`uygulamalar.ts:274`).
- "Daha fazla" bir `<dialog class="os-daha">`.
- Klavye açıkken alt çubuk `translateY(110%)` ile aşağı çekilir (OS:233).

**Çalışma bağlamı**
- Sayfalar bağlamı `CalismaBaglamiYayinla` ile bildirir:
  - `calisma-sekmeleri.tsx:48`, `editor/page.tsx:462`, `write/page.tsx:140`;
  - Literatür, Analiz ve Belge sayfaları da yayınlar.
- Gezinme bağlamı `useCalismaBaglami` ve `calismaIcindeMi` ile okur.
- Masaüstü geniş görünüm:
  - `os-gezinme-baglam` bölümü, `ProjeSecici` ve bölüm listesi;
  - sayfa sekmeleri gizli (OS:184).
- Tablet ve telefon: bölümler sayfadaki `CalismaSekmeleri` → `SekmeSeridi` (`.calisma-sekmeleri`) içinde.
- `aria-current` tek yerde: `gezinmeVurgusu`.

**Korunacak davranışlar**
- Tek "burası" vurgusu (`aria-current`).
- Daraltma tercihinin boyamadan önce uygulanması.
- Klavyede alt çubuğun gizlenmesi.
- Ctrl K paletindeki "Bu çalışmada" grubu.
- Kayıt güvenliği tıklama yakalama: `gezinme-korumasi.tsx:128`, beforeunload `:224`.

**V4 farkı**

| | Bugün | V4 |
|---|---|---|
| Kenar çubuğu | 248 px | 236 px |
| Ray | 88 px (kısa adlı) | 64 px (yalnız simge, ipucu ve erişilebilir ad) |
| Çalışmalarım'da kenar çubuğu | Bölümleri listeler | Yalnız seçici |
| Telefon şeridi | `OsBolumSeridi` / `SekmeSeridi` kayar | Beş bölüm + ⋯, kaymaz |

- K2 kararı: "88 px bu aşamada değişmez". Değişim V4.3-B'de ayrı karar ister.

## 2. Logo ve tema

**Logo**
- `public/arvolab-logo.png` resmî dosyadır (1920×1080).
- `public/arvolab-logo-koyu.png` resmî değildir. `scripts/logo-koyu-varyant.py` ile orijinalden üretilmiş; yorumu `app/_components/arvolab-logosu.tsx` içinde.
- Bileşen: `ArvoLabLogosu` iki `<Image>` çizer; hangisinin görüneceğini CSS seçer (`base.css:92-97`).
- Kullanıldığı yerler: `os-gezinme.tsx`, `header-title.tsx:57`, `kimlik-kabugu.tsx`.
- Logo yeniden çizilmez; v4 maketleri de bu iki PNG'yi kullanıyor.
- **Karar gerekir:** kurumdan resmî koyu logo istenecek mi, yoksa türetilmiş dosya resmî kabul mü edilecek?

**Tema**
- Mantık `lib/tema.ts` içinde:
  - anahtar `arvolab.theme`;
  - değerler `light`, `dark`, `system`.
- `<html>` üzerinde `data-theme` ve `data-theme-tercih` öznitelikleri.
- FOUC önleme: `app/layout.tsx:95` (`theme-init`, `TEMA_BETIGI`).
- Seçiciler:
  - `theme-toggle.tsx` (üç seçenek);
  - `settings/tema-secimi.tsx`;
  - Ctrl K paleti.
- **V4 farkı:** v4 maketleri `data-theme` ile aynı mekanizmayı varsayıyor; uyumlu.

## 3. Ana Sayfa (`app/dashboard/page.tsx`)

**Sıra**
1. `gb-selam` (:626).
2. `section.tez-kart` (787–941).
   - "Yazmaya devam et" (:809), "Çalışma özeti".
   - Ölçüler: Teslime kalan (yoksa `TeslimTarihiFormu`), Yazılan (hedef çubuğu), Teslim hazırlığı (`manuscriptReadiness`).
   - Tek "Şimdi" satırı: `siradakiIs` / `siradakiTas`.
3. `.ana-izgara`.
   - Sol: `OzetSatiri` "Teslim listesi" (966–978) ve `RitimKarti`.
   - Sağ: `ListeKarti` "Kaynaklar ve kanıt" (Literatür, Kaynakça, Kanıt, Etik, Belge), `DanismanaGonder` ya da danışman yorumları, `AbonelikOzetKarti`.
4. `nav.diger-calismalar`.
5. `details.ana-detay`: Bölümlerim, Son kaynaklar, Son belge kontrolleri, Hızlı eylemler.
6. `GeriBildirimKarti` (:1414).

**Veri**
- `getProjects`, `getWritingStats`, `computeAttention`, `manuscriptReadiness`, `krediOzeti`, `takvimiGetir`.
- Doğrudan sorgular: `project_manuscripts`, `literature_sources`, `citation_checks`, `kanit_kayitlari`, `manuscript_share_links`, `document_uploads`.
- Ortak liste bileşenleri: `_components/genel-bakis.tsx`.

**Korunacak davranışlar**
- Tek birincil eylem (`genel-bakis-kabul.mjs` S6).
- Yeni kullanıcı (`gb-baslangic`) ve personel görünümleri.
- Danışman paylaşımı.
- Geri bildirim akışı.

**V4 farkı**
- Bugün ana sayfada madde madde teslim listesi yok; tek satırlık `OzetSatiri` var. Maddeler editörün Teslim sekmesinde (`write/submission-checklist.tsx`).
- V4'teki "Teslime giden yol" bu maddelerin ana sayfaya çıkması demek. Veri aynı kaynaktan okunmalı: `manuscriptReadiness` ve teslim listesi.
- "Akademik kanıt" dört eksenli yüzey bugünkü `ListeKarti` verisinin yeni sunumu.

## 4. Çalışmalarım

**Rotalar**
- Liste ve ayrıntı tek adreste: `/dashboard/editor?sec=<id>` (`lib/calisma-karti.ts:105`, `calismaAdresi`). Telefonda da ayrı rota yok.
- Bölüm sayfaları: `/dashboard/editor/[id]/{write,kanit,etik,makale}`.

**Düzen** (`editor/page.tsx:389`, `.calismalar-ikili`)
- Sol: "Tüm çalışmalar" (`Link scroll={false}`), "Tamamlananlar ve arşiv" (`details`), `calismalar-ozet`.
- Sağ: `CalismaDurumKarti` (`calisma-durum-karti.tsx`):
  - tek ana eylem (:173), Teslim hazırlığı (:226);
  - "Başka neler var · N";
  - araç ızgarası: Takvim, Literatür, Kaynakça, Kanıt;
  - `AracMenusu` "Diğer araçlar" (382–407);
  - teslim paketi ZIP (:181).

**Duyarlı davranış**
- ≤900 px tek sütun; ayrıntı `order:-1` ile listenin üstüne çıkar (`genel-bakis.css:351-363`).
- 900 bir sistem dışı kırılımdır.

**Korunacak davranışlar**
- Kaydırmasız seçim (`scroll={false}`).
- Arşiv grubu.
- Teslim paketi.
- `genel-bakis-sadelik-kabul.mjs` eşikleri: ≤7 kart, ≤4 araç ve "Diğer araçlar".

**V4 farkı**
- Tek bölünmüş yüzey; "Yeni çalışma" listenin son satırı.
- Telefonda liste ile ayrıntı arası geçiş. Bugün aynı sayfada `order:-1` ile yapılıyor; v4 satır → ayrıntı geçişi istiyor (bkz. 09 · R25).

## 5. Akademik editör (TipTap)

**Eklentiler**
- `lib/tiptap-extensions.ts:51-95` (`editorExtensions`).
- İçerik: StarterKit, TextStyleKit, TextAlign, ParagraphFormatting, `CharacterCount({wordCounter: kelimeSay})`, Image, Table, FootnoteReference, Korunan*, **AsistanIzi**, **SatirIciOneri**, **AsistanAraligi**, Caption, SearchHighlight, HeadingNumbers, Word kısayolları.
- Test ve üretim aynı listeyi kullanır (`tests/editor/sema.test.ts`).

**Kâğıt**
- `ME:1000` (`class "manuscript-editor-content kagit"`).
- Kılavuz yalnız şunları satır içi yazar (`ME:1001-1016`):
  - `font-family`, `font-size` (pt), `line-height`;
  - `--kilavuz-p-once/sonra`, `--kilavuz-alt-girinti`;
  - `data-chapter-case`, `data-paragraf-araligi`.
- **Ekrandaki kâğıt genişliği kılavuza bağlı değil.** Kenar boşluğu ve A4/Letter (`lib/kagit-boyutu.ts`) yalnız baskıyı, Word'ü ve sayfa tahminini etkiler.

**Ölçüler (WS)**
- Yazı sütunu en çok **860 px** (WS:72-97):
  - `padding: 40px max(clamp(18px,5vw,48px), calc((100% - 860px)/2)) 32px`;
  - `font-family: var(--font-belge)`, `line-height: 1.75`.
- Görsel sayfa: `--sayfa-yari: min(494px, calc(50% - 20px))` (WS:1839-1858). ≤760 px'te masa yok.
- Panel açılınca ızgara `minmax(0,1fr) var(--yan-panel-genislik)` olur (WS:1437):
  - panel 340 px, ≥1400 px'te 360 px (WS:1861, `tokens.css:592`);
  - **belge sütunu daralır, satırlar yeniden kırılır.**
- Panel kapalıyken `max-width: 1040px; justify-self:center` (WS:1442-1443).

**Araç çubuğu**
- `ME:2807` (`role="toolbar"`, `data-arac-grup`).
- Taşma kuralı `lib/arac-cubugu.ts:22-62` (`gizlenecekGruplar`). Öncelikler: atif 10, geriAl 9.5, bicim 9 … yazi 1.
- Ölçüm `ResizeObserver` ile (`ME:1810-1837`); test `tests/unit/arac-cubugu.test.ts`.
- "⋯" sabit: Bul, Sayfa ayarı, Kapak, Sürümler, Kısayollar, Kılavuz bağla (`ME:2917-2940`).

**Kılavuz durumu**
- `.kilavuz-bandi` (`ME:3257-3286`); gizleme tercihi çalışma başına (`lib/kilavuz-bandi.ts:24`).
- "Kılavuz uygulandı" bandı `ME:3230`.
- Kritik hatalar `.callout data-tone="danger" role="alert"` (`ME:2972, 2994, 3091, 3116`).
- `?kilavuz=1` derin bağlantısı `ME:1919, 4205`.

**Otomatik kayıt**
- Gecikmeler (`ME:366-370`):
  - kayıt 1.500 ms; 300 KB'ı aşan belgede 4.000 ms;
  - taslak 500 ms;
  - yeniden deneme 10 s.
- Akış: `markDirty` (:904) → `scheduleSave` (:750) → `saveNow` (:758-891). Tek kayıt `inFlightRef` ile; aynı revizyon atlanır (:771).
- Çakışma koruması `expectedUpdatedAt` ile (`app/actions/manuscript.ts:319-333`).
- **Hayalet kayıt engeli:** `onUpdate` yalnız `belgeGercektenDegisti` doğruysa kirli sayar (`ME:993-995`, `lib/tiptap-belge-degisti.ts:23-29`). Testler `tests/editor/belge-degisti.test.ts` ve `kayit-kabul.mjs`.
- Ayrılırken:
  - beforeunload ve visibilitychange (`ME:1282-1298`);
  - `kayitDevret` (`ME:1316-1355`, `lib/bekleyen-kayit.ts:59`);
  - `koruyucuKaydet` (`ME:924-933`), zaman aşımı 20 s.

**Sürümler**
- Otomatik sürüm başarılı kayıttan sonra en çok 10 dakikada bir (`lib/manuscript-versions.ts:8`, `manuscript.ts:395-399`).
- Elle sürüm:
  - zorla kayıttan önce;
  - taslak geri yüklemeden ve uyumsuz içerik düzenlenmeden önce;
  - AI değişikliğinden önce, `surumGerekir` doğruysa (ana hat ya da 150 kelimeyi aşan değişiklik; `lib/ai-duzenleme.ts:61-64`).
- Arayüz: `versions-dialog.tsx`.
- Geri yüklemeden önce "restore" yedeği alınır (`app/actions/manuscript-versions.ts:103-158`).

**Kelime sayısı**
- `lib/kelime-sayimi.ts:38` (`kelimeSay`); sunucu `countWords` (`lib/tiptap-text.ts:95`).
- Durum çubuğu `ME:3442-3445` (`computeDocStats` :439).
- Testler: `tests/unit/kelime-sayimi`, `tests/editor/kelime-sayimi`, `tests/unit/kelime-gosterimi`.

**Dışa aktarma**
- Word: `handleExport` (`ME:1516`) → `/api/manuscripts/[projectId]/export` → `buildDocxFromTiptap` (`lib/tiptap-docx.ts:620`).
- Baskı/PDF: `handlePrint` (`ME:2314`) → `/print/manuscript/[id]` → `buildPrintSheet` → `renderTiptapHtml`.
- LaTeX ZIP: `write/latex-paketi.ts:32`.
- Teslim paketi ZIP: `_components/teslim-paketi.tsx` (Çalışmalarım kartı ve danışmana gönder).
- Üç çıktı yolu birbirine karşı sınanır (`tests/editor/cikti-yollari.test.ts`).

**Mobil**
- Başlık tek satır; Paylaş, Dışa aktar ve Panel "Belge" menüsünde (WS:1673-1688).
- Araç çubuğu yatay kayar, kenarda solar; dokunma hedefleri 40 px (WS:1366-1394, 1941-1950).

**V4 farkı**
- Sabit kâğıt (760 / metin 638), panel aç/kapa sırasında yeniden kırılma yok. Bugün kırılma var.
- Koyu temada kâğıt: bugün açık kâğıt (`tokens.css:610-611`, `--kagit: #ece9e2`); V4.1'de "loş kâğıt". **Karar gerekir** (09 · K-5).
- Kılavuz şeridi yerine çip (A2). Kritik uyarılar ayrıca belge üstünde.
- Telefonda dokunma hedefi 40 → 44 px.

## 6. Arvo AI paneli

**Panel**
- Görünümler: `lib/yazim-yan-panel.ts:25` (asistan, inceleme, kaynaklar, teslim).
- WAI-ARIA sekmeleri: `yan-panel.tsx:100-123`.
- Pasif görünüm gizlenir ama kaldırılmaz (:13-16, 129-143); asistan görünümü ilk açılışta tembel yüklenir (`ME:1058-1066`, :199-200).
- Besteci: `textarea` (en çok 1.500 karakter); Enter gönderir, Shift+Enter yeni satır (YP:573-602). Hızlı eylemler: YP:547-572.

**Mesaj modeli `Kayit`** (YP:79-98)
- `durum`: `oneri | uygulandi | reddedildi | geri_alindi`.
- Diğer alanlar: `secimMetni`, `oneriId`, `uygulama {eklenenId, eklenenMetin, ozgun}`, `isleniyor`, `surumHatasi`.
- Durum yalnız React belleğinde (YP:124); sayfa yenilenince sohbet gider.

**İstek akışı**
- `gonder` (YP:150):
  - `bekliyor` doğruysa sessizce döner (:151);
  - seçimi okur ve `secimMetni`ni alır (:152-155);
  - aralığı istek anında izlemeye alır: `araligiIzle` (:179).
- İstek sürerken gönder düğmesi ve hızlı eylemler kapalı; `textarea` yazılabilir; iptal (abort) yok.
- **Bekleyen öneri yeni istemi engellemez.** Birden çok `oneri` kartı aynı anda var olabilir.

**Seçim bağlama** (`lib/tiptap-asistan-araligi.ts`)
- Aralık her işlemde `mapResult` ile kaydırılır (:44-63).
- `araligiDogrula` birebir metin ister (:96-103).
- Eski bir öneri kabul edildiğinde **özgün izlenen aralığa** uygulanır, o anki seçime değil (YP:226-302).

**Kabul**
- `uygula` (YP:226-349) sırası:
  1. gerekirse sürüm;
  2. hedef doğrulama;
  3. `ASISTAN_IZI` ile kendi geçmiş adımında ekleme;
  4. eklenen aralığın izlenmesi.
- Reddet: YP:374-380.

**Geri al**
- `geriAl` (YP:351-372), `geriAlmaIslemi` (`lib/ai-duzenleme.ts:45-52`).
- Eklenen metin değiştiyse geri alınmaz: "düzenlemeniz kaybolmasın…".

**Dürüst başarısızlık**
- Mesajlar `app/actions/ai-yazim.ts:156-170`.
- Panelde kartsız asistan mesajı olarak görünür (YP:186-188).

**Mobil**
- Alt sayfa, **85dvh** (WS:1634-1641).
- Örtü düğmesi `.yan-panel-ortu`.
- Modal değil, odak tuzağı yok, bilerek (`yan-panel.tsx:18-21`).
- Esc kapatır (:92-97); odak açınca sekmeye, kapanınca açana döner (:56-65).
- `visualViewport` kullanımı yok.
- Seçili metin örtünün altında kalır.

**Testler**
- `tests/editor/asistan-araligi.test.ts`.
- Birim testleri: `yazim-asistani`, `metin-farki`, `yazim-yan-panel`, `secim-dugmesi-konumu`, `asistan-istemci`.
- Kabul: `ai-kabul.mjs`, `asistan-paneli-kabul.mjs`.

## 7. Kaynak Kütüphanesi, DOI, PDF, atıf

**Sayfa ve liste**
- Rota: `app/dashboard/literature/page.tsx` (`KaynaklarPage`); `citations/page.tsx` yalnız yönlendirir.
- İki kart:
  - Literatür: `DoiEkleKutusu` + `KaynakListesi`;
  - Kaynakça: puan, bulgular, `KaynakcaPenceresi`.
- Liste: `literature/kaynak-listesi.tsx`.
  - Durum: `to_review | read | used` (:64-81); tek "sonraki adım" düğmesi, ↶ geri.
  - Süzgeçler: Hepsi, Okunacak, Okundu, Kullandım, Eksik künye, Olası tekrar (:195-202).
  - Ayrıntı: `KaynakAyrintisi` (:294) → `PanelDrawer`.

**DOI**
- `doi-ekle-kutusu.tsx` → `doiIleEkle` (`app/actions/kaynak-aktarim.ts:154`).
- Kota: saatte 60, üç akış ortak (`lib/dizin-kotasi-kurali.ts`, `lib/dizin-kotasi.ts`).

**PDF**
- `citations/kaynak-pdf-satiri.tsx`.
- `DURUM` (:19-26): indirildi, yuklendi, bulunamadi, erisilemedi, kayit_yok.
- "PDF'i aç": imzalı adres 600 s, yeni sekme (:46-54).
- **Veri:** `kaynak_pdfleri` tablosu (`supabase/migrations/20261026110024_kaynak_pdfleri.sql:24-42`), anahtarı `project_id` + `kunye_anahtari`.
  - PDF durumu bir çalışmanın **kaynakça satırına** bağlı, kütüphane kaynağına değil.
  - Kütüphane ayrıntısı kaynakla yalnız DOI üzerinden eşleştirir (`kaynak-listesi.tsx:432-443`).

**Kaynağa sor**
- `kaynak-sohbet-penceresi.tsx`: `PanelDrawer` (:89), sunucu işlemi `kaynaklaSohbet`.
- Yalnız PDF varsa ve yalnız Kaynakça penceresindeki satırdan açılır.

**Künye doğrulama**
- "Dizinlerde karşılaştır" (`kaynak-listesi.tsx:527`) → `kaynakKunyesiniKarsilastir` (`app/actions/literature.ts:394`).
- **Sonuç kaydedilmez.**
- `kunye_durumu` yalnız `kanit_kayitlari` tablosunda (migration `20261026065320`, :99-100), yani iddia–kaynak çifti başına.

**Atıf**
- Editörde: `cite-dialog.tsx`, `bekleyen-kaynaklar-karti.tsx:157`, `kaynak-bul-penceresi.tsx`.
- CSL: `lib/atif/csl.ts`, `lib/atif/stiller.ts`.
- Kaynakça bölümü: `lib/kaynakca-bolumu.ts`.

**V4 farkı**

| V4 hedefi | Bugün |
|---|---|
| Kütüphane satırında Künye / PDF / Kanıt / Okuma eksenleri | Satırda yalnız okuma, eksik künye ve tekrar var |
| Satır başına "Künye: bakılmadı / eşleşti" | Saklanan bir değer yok (bkz. 09 · K-3) |
| Kütüphaneden "Kaynağa sor" ve "PDF'i aç" | Bugün yalnız Kaynakça penceresinde |

## 8. Token'lar ve CSS denetimi

**Dosyalar**
- Hepsi `app/styles/` altında: tokens, base, components, shell, os-shell, auth, workspace, overlays, genel-bakis, sayfa-standardi, print, odak.
- Hepsi `app/layout.tsx:7-19`'da yüklenir.

**Sayılar** (yeniden ölçüldü)

| Ölçü | Değer | Komut |
|---|---|---|
| `tokens.css` benzersiz token | **242** | `grep -oE '^\s*--[a-zA-Z0-9_-]+\s*:' app/styles/tokens.css \| sort -u \| wc -l` |
| `var(--` toplam | 3.952 | — |
| ↳ `tokens.css` dışında | 3.826 | — |
| ↳ `tokens.css` içinde | 126 | — |
| ↳ TSX/TS dosyalarında | 0 | — |
| V4.1 göç haritasındaki sayı | 3.719 | Yalnız bu 242 adın `tokens.css` dışındaki kullanımı (`araclar/goc-haritasi.mjs:17-20`); yerel değişkenler ve `--font-inter` hariç. Çelişki yok, ölçülen şey farklı. |

**Tema**
- Açık tema: `:root, .kagit` (:20).
- Koyu tema: `html[data-theme="dark"]` (:522, :594).
- Koyu temada kâğıt açık kalır (:610).

**`check:css` kuralları** (`scripts/check-css-tokens.mjs`)
- Ham renk yalnız `tokens.css`'te.
- Palet adları yalnız `tokens.css`'te.
- Tanımsız `var` yasak.
- En küçük yazı 11 px.
- `HAM_YARICAP_BORCU` ve `KIRILIM_BORCU`: yalnız 760/761 ve 1199/1200 serbest.
- Tema eşitliği; `TEMADAN_BAGIMSIZ` listesinde 17 kayıt.

**Yazı tipleri**
- Inter `next/font/google` ile (`app/layout.tsx:4,34-39`).
- `--font-belge`: `tokens.css:341` (sistem sans).
- **Newsreader yüklü değil.** Tek serif `--print-font: Times New Roman` (:507).

**Görsel fark aracı**
- `scripts/onizleme/gorsel-fark.mjs`: 12 sayfa × 6 genişlik × 2 tema = 144 görüntü, eşik 24.

## 9. Test ortamı

**CI'da çalışanlar** (`.github/workflows/ci.yml`)
- `tsc`, `lint`, `check:css`, `check:migrations`, `check:rakamlar`.
- `test:unit`, `test:editor`, `test:db`.

**Önizleme kabul betikleri** (`scripts/onizleme/`, CI'da yok)
- Önizleme sunucusu gerekir: `npm run onizleme` (`ARVOLAB_ONIZLEME=1 next dev -p 3123`), `onizleme:ai` de var.
- Sahte Supabase: `server.ts`, `sahte-istemci.ts`, veri `veri.ts`.
- Betikler:

| Betik | Not |
|---|---|
| `kabuk-kabul` | 18 senaryo × 6 genişlik |
| `duyarlilik` | 14 sayfa × 3 genişlik |
| `dokunma-kabul` | **40 px eşiği** |
| `genel-bakis-kabul` | |
| `genel-bakis-sadelik-kabul` | |
| `editor-merkezi-kabul` | |
| `arac-cubugu-kabul` | |
| `kagit-kabul` | |
| `kayit-kabul` | |
| `gezinme-korumasi-kabul` | 21 senaryo |
| `ai-kabul` | |
| `asistan-paneli-kabul` | |
| `odak-kabul` | |
| `cikti-kabul` | |
| `kaynak-kabul` | |
| `kaynak-ekleme-kabul` | |
| `doi-kotasi-kabul` | |
| `tablo-kabul` | |
| `makale-kabul` | |
| `gorsel-fark` | |

**Gerçek Supabase Test**
- Proje `kyvjftrsweqjlgjeobnq`.
- Giriş yöntemi için O1/O2 kararı **bekliyor**.
- Gerçek ortamda doğrulanan kayıt güvenliği senaryosu yok: UNVERIFIED.
