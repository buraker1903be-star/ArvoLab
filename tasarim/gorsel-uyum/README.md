# Görsel uyum — onaylı prototipe göre düzeltmeler

Dal `tasarim/gorsel-uyum`, taban `main` = `8b28897` (19.11.2026). Kurum sahibinin dokuz kararı uygulandı.
Bu bir **düzeltme teslimidir; görsel kabul ya da yayın onayı değildir.** Birleştirme ve dağıtım yapılmadı.

Değişmeyenler: belgenin biçimi, kâğıt genişliği (924 px), punto, başlık numaraları, belge ölçüleri, dışa aktarma
(yazdırma/PDF, danışman paylaşımı, Word, LaTeX), resmî logo, işlevler ve rol yetkileri. Okunurluk sınırı **%85**
(metin küçültülerek yer açılmadı).

## Görseller

`teslim/` — `scripts/yerel-yigin/gorsel-uyum-karsilastirma.mjs` üretir (aynı içerik, aynı ölçü, aynı tema):

| Yol | Ne |
|---|---|
| `teslim/karsilastirma/*-masaustu.png` | Solda prototip, sağda uygulama; 1440×900 ve 1280×800, açık/koyu |
| `teslim/karsilastirma/telefon.png` | 390×844: her ekran için prototip açık · uygulama açık · prototip koyu · uygulama koyu |
| `teslim/uygulama/`, `teslim/prototip/` | Tek tek çekimler (`<ekran>-<d1440\|d1280\|t390>-<acik\|koyu>.png`) |
| `teslim/olcumler.json` | Üst bant, gezinme, belge, panel kutuları ve baskın/en küçük yazı boyutları (prototip ve uygulama) |
| `teslim/derleme.json` | git HEAD, BUILD_ID, uygulama kodu temiz mi, veri ve AI notu |

Etiket: **Yerel üretim derlemesi · 8d672a8**, BUILD_ID `hR7cCBZdwCf2Ab_DF8ytl` (`rm -rf .next && next build`,
`next start`). Uygulama kodu `5f2b732` ile aynı; `8d672a8` yalnızca betikleri değiştirdi. Veri yalnızca yerel yığında
(127.0.0.1), sentetik. **Arvo AI cevabı yerel taklittir** (`model-taklidi.mjs`); gerçek model çağrılmadı.
Prototipte 1280 px yalnızca 7. ekranda (kaynaklar + PDF) tanımlı; öteki ekranların 1280 çekimleri prototipin 1440
tasarımıyla karşılaştırıldı ve görselde böyle yazar. `pdfd` = kaynaklar + PDF doğrudan adresle
(`?sol=kaynaklar&sag=pdf`); `pdf` = atıf kartından "Dayanağa git" (pasaj vurgulu).

## Ölçüler (açık tema; `olcumler.json`)

| | Prototip | 8b28897 (önce) | Bu dal |
|---|---|---|---|
| Üst bant (masaüstü) | 52 | 65 | **52** |
| Belgenin başladığı y (editör, 1440 ve 1280) | 124 | 226 / 262 | **127** |
| Editör üstündeki bant sayısı | 2 | 3 | **2** (üst çubuk + araç çubuğu) |
| Araç çubuğu (1280, kaynak listesi açık) | 1 satır | 2 satır (82 px) | **1 satır (46 px)** |
| 1440 + AI: gezinme / belge ölçeği / AI | 236 / ~%100 / 396 | 64 (ray) / %77 / 396 | **240 / %85 / 360** |
| 1280 + AI | — (tanımsız) | çekmece, metni örter | **ray + yan yana, %87** |
| 1440 + PDF (liste açık) | liste 300 + belge + PDF 440 | ray + %87 | **ray + %87, PDF 520** |
| Gezinme yazısı / en küçük arayüz yazısı | 14 / 11 | 14 / 11 | 14 / 11 |
| Telefon: belgenin başladığı y | 64 | 216 | **138** |
| Telefon üst bandı | 52 | 61 | 55 |

## Kararlar ve uygulanışları

1. **PDF yerleşimi.** Önce sol alan şeride/raya iner, PDF belgenin yanında kalır (1440: belge %87, PDF 520).
2. **AI paneli.** 1440'ta gezinme açık, belge ve AI yan yana (belge %85, AI en dar genişliği 360). 1280'de gezinme raya
   iner, AI yine yanda (%87), belgeyi örtmez.
3. **Üst alan.** Tekrarlanan çalışma başlığı satırı kalktı; ölçek, kayıt durumu, Kontroller ve Dışa aktar üst
   çubuğun yuvasında (`#ust-cubuk-yuva`). Üst çubuk 64 → 52 px. Araç çubuğu 1439 px altında sıkışır ve tek satırda kalır.
4. **Belge.** Koyu temada kâğıt koyu (`--kagit` koyu blokta); yalnızca ekran. Paylar: editör yan payı 64 → 24 px,
   panel aralığı 26 → 22 px; kâğıdın kendisi ve biçimi aynı.
5. **Seçim kartı.** Metin sütununun sağında açılır (kâğıdın iç boşluğuna taşabilir, metni örtmez); yer yoksa eskisi
   gibi seçimin altında.
6. **Ana ekran.** Başlığın sağında görünür "Yeni çalışma" düğmesi, "Kaldığınız yer" kartı (tür · son düzenleme ·
   kelime), son çalışmalar kompakt tabloda (Çalışma, Tür, Son düzenleme, Kelime; gerçek veri). İlerleme çubuğu yok.
   Son kaynaklar ikincil bölüm.
7. **Telefon — yeni çalışma ve AI.** İkisi de tam ekran; yeni çalışmanın birincil düğmesi altta, tam genişlikte.
8. **Telefon gezinmesi.** Editörde dört sekme: Belge, Araştır, Arvo AI, Çalışma. "Çalışmalarıma dön" üst çubukta.
   Çalışma yaprağı yarım boy açılır, tutamaçla tam boya genişler; Kaynaklar ve öteki bütün araçlar yaprakta.
9. **Telefon PDF'i.** İki kompakt satır: (1) kaynak seçici + bağ çipi + "⋯", (2) sayfa, yakınlaştırma, sığdır,
   pasaja odaklan. "⋯" altında: kaynak bağı (bağla/bağı kaldır) ve PDF içinde arama. PDF'te seçim yapılınca
   "Sor" ve "Alıntı ve atıf ekle" panelin altında sabit. Yeni PDF özelliği yok.

**Sarı uyarı** ("biçim bilgileri eski bir kayıt hatası nedeniyle kaybolmuş"): ürün doğru çalışıyor. Neden tohumdu:
kabul betikleri paragrafları `attrs` olmadan yazıyordu ve `lib/format-loss.ts` bunu eski kayıt hatasının izi sayıyor.
Tohumlar düzeltildi (`calisma-alani-kabul.mjs`, `prototip-karsilastirma.mjs`, yeni betik şemadan üretiyor); uyarı
gizlenmedi.

## Belgeyi bozmadan sağlanamayanlar (ölçülerle)

| Durum | Neden | Bugünkü davranış |
|---|---|---|
| **1280 px + PDF yan yana** | Ray 64 + en dar PDF 440 + paylar 46 → belgeye 730 px = %79 (< %85). %85 için en az **1336 px** ekran gerekir. | PDF geçici çekmece (belge %100; "Geçici görünüm · Esc ile kapatın") |
| 1200–1255 px + AI | Ray 64 + en dar AI 360 + paylar 46 → 1200'de belgeye 730 px = %79. Yan yana %85 için en az **1256 px**. | AI çekmece |
| 1440 + AI genişliği | AI 396'da gezinme açıkken belge %82 olurdu (758 px). | AI en dar genişliğinde (360); kullanıcı ayırıcıyla genişletirse sınırı aşmayacak kadar |
| Prototipin kâğıdı 760 px | Uygulamanın kâğıdı 924 px (860 metin sütunu); değiştirmek satır sonlarını değiştirir. | Kâğıt aynı; ferahlık çevre paylarından |
| 1200–1279 px + sol araç açık | Araç çubuğu içeriği ~954 px; alan ~876 px (hesap, ölçülmedi). | Tek satır, yatay kayar (satır sarmaz) |
| Telefon üst bandı | Dokunma hedefleri 44 px; arama simgesi editörde gizli (sekiz düğme 390 px'e sığmıyordu); dönüş yalnızca simge. | 55 px bant; arama editör dışındaki ekranlarda |

## Kontroller (19.11.2026)

`npx tsc --noEmit` ✓ · `npm run lint` ✓ (2 eski uyarı, bu değişiklikte değil) · `check:css` ✓ · `check:migrations` ✓ ·
`check:rakamlar` ✓ · `test:unit` 2358/2358 · `test:editor` 112/112 · `test:db` 362/362.
Tarayıcı kabulü (`calisma-alani-kabul.mjs`, üretim derlemesi): **21 PASS, 0 FAIL, 1 UNVERIFIED** (S17: kayıtlı
dizin düzeneği verilmedi) → `scripts/yerel-yigin/sonuclar/calisma-alani-kabul-5f2b732.json`. Güncellenen testler
yeni kararları sabitler: yerleşim kararı (AI 1440 gezinme açık, PDF 1440 520), seçim kartı konumu, kâğıt
tokenı, ana sayfa tablosu.
