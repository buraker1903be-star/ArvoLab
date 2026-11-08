# 04 — Uygulama entegrasyonu riskleri ve bağımlılıklar (V4.1)

Entegrasyon ayrı bir aşamadır; bu belge yalnız neyin etkileneceğini söyler.

| # | Risk / bağımlılık | Etki | Azaltma |
|---|---|---|---|
| R1 | **Token göçü:** 242 token, uygulamada 3.719 `var(--…)` başvurusu. En geniş etki `--ink`, `--muted` (265'er), `--fs-sm` (246), `--line-soft` (202), `--primary-ink` (194). | Bütün ekranlar | Önce takma ad katmanı (eski ad → v4 rolü), ekran ekran geçiş; her adımda `gorsel-fark.mjs` ile 12 sayfa × 6 genişlik × 2 tema karşılaştırma |
| R2 | **`check:css` kuralları** (ham renk yasağı, `HAM_YARICAP_BORCU`, `KIRILIM_BORCU`, tema eşitliği) v4 token adlarını tanımıyor | CI | Denetim listeleri göçle aynı commit'te güncellenir |
| R3 | **Newsreader** (next/font ile yaklaşık 30–45 KB ek, iki ağırlık + italik) | İlk yükleme, CLS | Yalnız 400/500 + 400 italik; `display: swap`; yedek yazı ölçüleri ayarlı |
| R4 | **Başlık sunumu** (büyük harf → başlık düzeni) yalnız görüntü; arama, sıralama, dışa aktarma özgün başlığı kullanmalı | Veri tutarlılığı | Tek saf yardımcı + birim testi; özgün başlık `title` ve `aria-label`'da |
| R5 | **64 px ray** (K2): uygulama bugün 88 px etiketli ray kullanıyor; bu aşamada değişmez | 761–1199 gezinme | Ayrı karar ve ayrı aşama; ipucu, erişilebilir ad, klavye testi |
| R6 | **PDF bölmesi — önerilen yeni işlev:** pdf.js (ya da eşdeğeri) bağımlılığı, imzalı depolama adreslerinin süresi, CSP (`worker-src`, `connect-src`), büyük PDF performansı, alıntı işaretleme | Yeni özellik | Ayrı ürün kararı ve ayrı aşama; mevcut "PDF'i aç" ve "Kaynağa sor" değişmez |
| R7 | **AI sunum önerileri** (bağlam satırı, dayanak notu, atıf işaretinde doğrulama) mevcut verinin görünür kılınması; asistanın atıf/sayı denetimi sonucu bileşene taşınmalı | `lib/ai/*` ile arayüz arasında veri | Yalnız okuma; denetim mantığı değişmez. "Asistan kaynak önermez" kuralı korunur |
| R8 | **Doğrulama izi:** künye, PDF, atıf, kanıt durumlarının tek bileşende okunması; durumlar farklı tablolarda | Sorgu sayısı | Mevcut özet işlevlerinden okunur; yeni sorgu gerekiyorsa P2.1 ölçüm düzeneğiyle sınanır |
| R9 | **Koyu tema "loş kâğıt":** yazdırma ve Word çıktısı etkilenmemeli (`.kagit` yazdırmada her temada açık kalır, `--print-*` korunur) | Çıktı yolları | `tests/editor/cikti-yollari.test.ts` dokunulmaz; yalnız ekran rengi değişir |
| R10 | **Editör çubuğu birleşmesi** (kılavuz şeridi → çip): kılavuz bağlama akışı ve `?kilavuz=1` derin bağlantısı korunmalı | Editör | Mevcut kabul betikleri (`editor-merkezi`, `arac-cubugu`) yeşil kalmalı |
| R11 | **Hap rozetlerin kaldırılması** (`--r-pill` 78 başvuru) | Görsel tutarlılık | Anahtar ve ilerleme çubuğu dışında `--r-1` |
| R12 | **Adlandırma birleştirme** (Kaynaklar / Literatür / Kaynakça; Teslim listesi / durumu / kontrolü / hazırlığı) | Metin, iki dil, kılavuz belgeleri | Sözlük tablosu V4.2'de; Kullanım Kılavuzu ve İngilizce metinler birlikte güncellenir |
