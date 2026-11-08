# Signature OS v3 — tasarım paketi

Kurum sahibinin "Kesin görsel tasarım ve yerleşim talimatı"na (08.11.2026)
göre hazırlanan durağan maketler. Uygulama kodu değil; görsel onaydan sonra
uygulanır. v1/v2 maketleri (`../`) karşılaştırma için yerinde.

```
node docs/tasarim/asama-3/v3/uret.mjs           # 7 HTML sayfası
node docs/tasarim/asama-3/v3/cek.mjs <klasör>   # 24 görüntü (1440/390 × açık/koyu)
node docs/tasarim/asama-3/v3/olc.mjs            # kalite ölçümü (talimat §9)
```

| Dosya | İçerik |
|---|---|
| `tokens-v3.css` | Renk, tipografi ve boyut token'ları (tek ham renk kaynağı) |
| `v3.css` | Bileşen ve yerleşim; yalnız token adlarını okur |
| `dashboard.html`, `calismalarim.html`, `calisma-ayrinti.html` | Ana Sayfa, Çalışmalarım, telefonda çalışma ayrıntısı |
| `editor.html`, `editor-ai.html` | Editör; Arvo AI paneli ve seçim menüsüyle |
| `kaynaklar.html` | Kaynak Kütüphanesi (liste + bağlamsal ayrıntı paneli) |
| `tokenlar.html` | Token ve bileşen örnekleri |

## Talimattan erişilebilirlik için sapmalar (WCAG 2.2 AA)

Küçük metin 4,5:1, arayüz öğesi 3:1. Ölçüm: `olc.mjs`, her ekranda en düşük metin kontrastı.

| Token | Talimat | v3 | Neden |
|---|---|---|---|
| açık `text-secondary` | #667389 | #616E84 | accent-soft (4,19) ve sidebar (4,35) üstünde yetmiyordu |
| açık `text-tertiary` | #8994A5 | #8994A5, **yalnız simge/ayraç** | metinde 2,9–3,1; yardımcı metin text-secondary kullanır |
| açık uyarı metni | #A97828 | `warning-ink` #916722 | 3,9 → 4,58 (rozet metni) |
| açık başarı metni | #6B9150 | `success-ink` #587742 | rozet metni; çubuk #6B9150 kalır (3:1 yeter) |
| koyu `text-tertiary` | #78869A | #7F8DA0 | surface-subtle üstünde 4,18 |
| koyu `accent` (dolgu) | #4779CE | #4575C8 | beyaz yazıyla 4,29 → 4,53 |
| koyu bağlantı metni | #4779CE | `accent-ink` #6E95D8 | surface üstünde 3,87 → ≥4,5 |
| koyu `accent-hover` | #5A8DE0 | #3D69B5 | açılan hover beyaz yazının kontrastını düşürüyordu |
| koyu danger/warning | (tabloda yok) | eklendi | koyu temada eksik/incelenecek rozetleri için |

## Gerçek uygulamaya göre talimattan sapmalar

Talimat "yalnız mevcut kodda gerçekten varsa" diyor; şu öğeler uygulamadaki
gerçek karşılığıyla çizildi:

- **Seçim menüsü:** talimattaki "Açıkla / Atıf ekle" yok. Gerçek menü
  (`secim-ai.tsx`): Arvo AI → Akademikleştir, Kısalt, Genişlet, Kendi isteğini
  yaz. Atıf ekleme araç çubuğundaki "Atıf" düğmesinde.
- **Arvo AI paneli:** dört sekme (Arvo AI, İnceleme, Kaynaklar, Teslim);
  "Kaynak önerileri" diye ayrı bir bölüm yok. Kaynaklar sekmesinde "Seçili
  cümleye kaynak bul" var.
- **Araç çubuğu:** 1440'ta gruplar sığmadığı için uygulamanın kendi taşma
  kuralı (`lib/arac-cubugu.ts`) uygulandı: Yazı, Üst simge, Yinele ve Odak "⋯"
  içinde.
- **Kaynak ayrıntısı:** PDF görüntüleyici düğmesi ve "atıf kopyala" yok; PDF
  "Kaynağa sor" ile açılıyor (gerçek metin). Önizleme verisinde dergi alanı
  yok, gösterilmedi. Sahte PDF önizlemesi yok.
- **PDF yan yana mod:** uygulamada yok, çizilmedi.
- **Çalışmalarım sekme satırı:** Özet · Yazım · Kaynaklar · Kanıt · Analiz
  çalışmanın gerçek bölüm sayfalarına gider. Bugünkü pencereler (Takvim,
  Kaynakça, Diğer araçlar) aynı satırın sağında. Bugünkü Literatür ve Kanıt
  matrisi pencereleri bölüm sayfalarına taşınır; bu, uygulamada onay
  gerektiren bir değişiklik.

## Gezinme kararları

- Çalışma bağlamı ana gezinmenin altında (talimat §2). Bugün üstünde.
- Hesap üst çubukta (avatar); kenarın altında Kullanım Kılavuzu, Abonelik
  ve Kredi, Ayarlar.
- Çalışma bölümü etkinken "Çalışmalarım" yalnız metinle vurgulanır, zemin
  ve çizgi yalnız etkin bölümde. Çift vurgu yok.
- Başlık sunumu: veritabanındaki özgün başlık değişmez. Tamamı büyük harfle
  girilmiş başlık arayüzde Türkçe başlık düzeniyle gösterilir; özgün hâl
  `title` ve erişilebilir adda.
- Editör: belge sayfası 820 px, metin sütunu 692 px (talimat 680–760). AI
  paneli açıkken sayfa 800 px, metin 672 px (≥600 sınırı korunur). Telefonda
  AI paneli alttan açılan sayfa (%85, bugünkü davranış).

## Kalite ölçümü (talimat §9, açık tema; kontrast iki tema)

"Ana eylem alt kenarı": birincil düğmenin ilk ekrandaki alt kenarı (px). "Yüzey":
kart benzeri kutular (gölgeli olanlar parantezde).

| Ekran | Sürüm | Ana eylem alt kenarı | Yüzey (gölgeli) | Başlık | İçerik gen. | Sayfa boyu | Taşma | En düşük kontrast (açık/koyu) | <44 px hedef |
|---|---|---|---|---|---|---|---|---|---|
| dashboard 1440 | v2 | 438 | 2 (1) | 30px/3 satır | 1160 | 1588 | 0 | 3.56 / 4.37 | — |
| dashboard 1440 | v3 | 335 | 1 (1) | 24px/1 satır | 1204 | 1477 | 0 | 4.5 / 4.51 | — |
| dashboard 390 | v2 | 360 | 2 (1) | 20px/4 satır | 390 | 2469 | 0 | 4.73 / 5.26 | 6 öğe <44 (en küçük 20) |
| dashboard 390 | v3 | 378 | 1 (1) | 22px/4 satır | 390 | 2127 | 0 | 4.52 / 4.51 | 0 öğe <44 (en küçük —) |
| dashboard 360 | v3 | 378 | 1 (1) | 22px/4 satır | 360 | 2127 | 0 | 4.52 / 4.51 | 0 öğe <44 (en küçük —) |
| calismalarim 1440 | v2 | 255 | 3 (2) | 24px/3 satır | 1192 | 1012 | 0 | 3.56 / 4.37 | — |
| calismalarim 1440 | v3 | 233 | 1 (1) | 24px/2 satır | 1204 | 902 | 0 | 4.5 / 4.51 | — |
| calismalarim 390 | v2 | — | 1 (0) | — | 390 | 844 | 0 | 5.76 / 5.49 | 3 öğe <44 (en küçük 40) |
| calismalarim 390 | v3 | — | 1 (0) | — | 390 | 844 | 0 | 4.59 / 4.51 | 0 öğe <44 (en küçük —) |
| calismalarim-ayrinti 390 | v2 | 275 | 4 (0) | 21px/3 satır | 390 | 1412 | 0 | 4.73 / 5.26 | 2 öğe <44 (en küçük 40) |
| calisma-ayrinti 390 | v3 | 282 | 3 (0) | 22px/3 satır | 390 | 1472 | 0 | 4.52 / 4.51 | 0 öğe <44 (en küçük —) |
| calisma-ayrinti 360 | v3 | 282 | 3 (0) | 22px/3 satır | 360 | 1472 | 0 | 4.52 / 4.51 | 0 öğe <44 (en küçük —) |
| editor 1440 | v3 | — | 1 (0) | — | 820 | 1103 | 0 | 4.68 / 4.51 | — |
| editor 390 | v3 | — | 0 (0) | — | 390 | 993 | 0 | 5.16 / 4.51 | 0 öğe <44 (en küçük —) |
| editor 360 | v3 | — | 0 (0) | — | 360 | 1074 | 0 | 5.16 / 4.51 | 0 öğe <44 (en küçük —) |
| editor-ai 1440 | v3 | — | 1 (0) | — | 800 | 1159 | 0 | 4.68 / 4.51 | — |
| editor-ai 390 | v3 | — | 1 (0) | — | 390 | 929 | 0 | 4.93 / 4.51 | 0 öğe <44 (en küçük —) |
| kaynaklar 1440 | v3 | 140 | 1 (0) | — | 1204 | 1030 | 0 | 4.5 / 4.51 | — |
| kaynaklar 390 | v3 | 197 | 1 (0) | — | 390 | 932 | 0 | 4.54 / 4.51 | 0 öğe <44 (en küçük —) |
| kaynaklar 360 | v3 | 197 | 1 (0) | — | 360 | 1002 | 0 | 4.54 / 4.51 | 0 öğe <44 (en küçük —) |

## Son revizyon (kurum sahibinin "Son tasarım revizyonu ve onay kapısı")

- **Ana Sayfa masaüstü:** iki dengeli sütun (sol: Teslim durumu, Diğer
  çalışmalar; sağ: Kaynaklar ve kanıt). Danışmanıma gönder, Abonelik ve
  kredi, Yazım ritmi ikincil şeritte; geri bildirim en altta. "Çalışma
  özeti" düğme değil metin bağlantısı (tekrarlanan düğme yok). Meta satırı
  yalnız tür, kurum, durum.
- **Ana Sayfa telefon:** başlık en çok 4 satır (tamamı `title` ve
  `aria-label`'da); tam genişlikte "Yazmaya devam et", altında "Çalışma
  özeti" bağlantısı; Teslim durumu ve Kaynaklardan sonra "Diğer bilgiler"
  açılır bölümlerde (Hızlı erişim dahil).
- **Alt gezinme sabit** (`position: fixed`); içerik onun yüksekliği kadar
  alttan boşluk bırakır. Eski tam sayfa çekimi çubuğu ilk görünümün altına
  (sayfanın ortasına) çiziyordu; `cek.mjs` artık telefonda görünümü sayfa
  boyuna büyütüp tek kare çekiyor.
- **Çalışmalarım masaüstü:** bu sayfada kenar çubuğundaki çalışma bağlamı
  yalnız seçici (ikinci bir gezinme sistemi olmasın; bölümler sağ paneldeki
  sekmelerde). Takvim ve Kaynakça "Diğer araçlar" menüsünde. Liste
  öğeleri `?sec=` bağlantısı ve `aria-current`; seçili olmayanlarda sınır yok.
- **Çalışma ayrıntısı telefon:** araçlarda dört öğe (Yazım, Kaynaklar, Kanıt
  matrisi, Analiz) + "Diğer araçlar"; "Diğer işlemler" (teslim paketi,
  düzenle, belge yükle, sil) üst çubukta; birincil düğme tam genişlik.
- **Kaynak Kütüphanesi:** PDF'i olan kaynakta satırda "Kaynağa sor"; satır
  artık iç içe bağlantı içermiyor (başlık, DOI ve eylemler yan yana).
- **Editör telefon AI:** alt sayfa `role="dialog"`, `aria-modal="true"`.

### Ölçüm: önceki v3 ve revize v3

`node docs/tasarim/asama-3/v3/olc.mjs [kök] [etiket]`. "Son içerik ile alt
çubuk arası": sayfa sonuna kaydırınca son içeriğin alt kenarı ile sabit alt
çubuğun üst kenarı arasındaki pay (pozitif = hiçbir şey çubuğun altında
kalmıyor). "Açık/koyu yerleşim farkı": iki temada konumu ya da boyutu farklı
öğe sayısı (temaya özgü logo ve güneş/ay simgesi hariç).

| Ekran | Sürüm | Ana eylem alt kenarı (px) | İçerik yüksekliği | En büyük boşluk | Taşma (açık/koyu) | En düşük kontrast (açık/koyu) | Dokunma <44 px | Son içerik ile alt çubuk arası | Açık/koyu yerleşim farkı |
|---|---|---|---|---|---|---|---|---|---|
| dashboard 1440 | önceki | 335 | 1477 | 32 | 0/0 | 4.5 / 4.51 | — | — | 0 öğe |
| dashboard 1440 | revize | 335 | 1328 | 32 | 0/0 | 4.5 / 4.51 | — | — | 0 öğe |
| dashboard 390 | önceki | 378 | 2127 | 28 | 0/0 | 4.52 / 4.51 | 0 | 28 px | 0 öğe |
| dashboard 390 | revize | 405 | 2096 | 28 | 0/0 | 4.52 / 4.51 | 0 | 28 px | 0 öğe |
| dashboard 360 | önceki | 378 | 2127 | 28 | 0/0 | 4.52 / 4.51 | 0 | 28 px | 0 öğe |
| dashboard 360 | revize | 405 | 2096 | 28 | 0/0 | 4.52 / 4.51 | 0 | 28 px | 0 öğe |
| calismalarim 1440 | önceki | 233 | 902 | 24 | 0/0 | 4.5 / 4.51 | — | — | 0 öğe |
| calismalarim 1440 | revize | 233 | 902 | 24 | 0/0 | 4.5 / 4.51 | — | — | 0 öğe |
| calismalarim 390 | önceki | — | 844 | 24 | 0/0 | 4.59 / 4.51 | 0 | 305 px | 0 öğe |
| calismalarim 390 | revize | — | 844 | 24 | 0/0 | 4.59 / 4.51 | 0 | 305 px | 0 öğe |
| calisma-ayrinti 390 | önceki | 282 | 1472 | 28 | 0/0 | 4.52 / 4.51 | 0 | 28 px | 0 öğe |
| calisma-ayrinti 390 | revize | 278 | 1342 | 28 | 0/0 | 4.52 / 4.51 | 0 | 28 px | 0 öğe |
| calisma-ayrinti 360 | önceki | 282 | 1472 | 28 | 0/0 | 4.52 / 4.51 | 0 | 28 px | 0 öğe |
| calisma-ayrinti 360 | revize | 278 | 1342 | 28 | 0/0 | 4.52 / 4.51 | 0 | 28 px | 0 öğe |
| editor 1440 | önceki | — | 1103 | 0 | 0/0 | 4.68 / 4.51 | — | — | 0 öğe |
| editor 1440 | revize | — | 1103 | 0 | 0/0 | 4.68 / 4.51 | — | — | 0 öğe |
| editor 390 | önceki | — | 993 | 14 | 0/0 | 5.16 / 4.51 | 0 | 46 px | 0 öğe |
| editor 390 | revize | — | 993 | 14 | 0/0 | 5.16 / 4.51 | 0 | 46 px | 0 öğe |
| editor-ai 1440 | önceki | — | 1159 | 0 | 0/0 | 4.68 / 4.51 | — | — | 0 öğe |
| editor-ai 1440 | revize | — | 1159 | 0 | 0/0 | 4.68 / 4.51 | — | — | 0 öğe |
| editor-ai 390 | önceki | — | 929 | 14 | 0/0 | 4.93 / 4.51 | 0 | — | 0 öğe |
| editor-ai 390 | revize | — | 993 | 14 | 0/0 | 4.93 / 4.51 | 0 | — | 0 öğe |
| kaynaklar 1440 | önceki | 140 | 1030 | 24 | 0/0 | 4.5 / 4.51 | — | — | 0 öğe |
| kaynaklar 1440 | revize | 140 | 1030 | 24 | 0/0 | 4.5 / 4.51 | — | — | 0 öğe |
| kaynaklar 390 | önceki | 197 | 932 | 28 | 0/0 | 4.54 / 4.51 | 0 | 28 px | 0 öğe |
| kaynaklar 390 | revize | 197 | 1074 | 28 | 0/0 | 4.54 / 4.51 | 0 | 28 px | 0 öğe |
| kaynaklar 360 | önceki | 197 | 1002 | 28 | 0/0 | 4.54 / 4.51 | 0 | 28 px | 0 öğe |
| kaynaklar 360 | revize | 197 | 1099 | 28 | 0/0 | 4.54 / 4.51 | 0 | 28 px | 0 öğe |