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
| 1440 + PDF (liste açık) | liste 300 + belge + PDF 440 | ray + %87 | ilk teslim: ray + %87, PDF 520 → **2. tur: liste 246 + belge %85 + PDF 360** |
| Gezinme yazısı / en küçük arayüz yazısı | 14 / 12 | 14 / 11 | 14 / **12** (2. tur; ilk teslimde 11 idi) |
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
| ~~1280 px + PDF yan yana~~ | 2. turda çözüldü: en dar PDF 440 → 360. | Ray + PDF 382 + belge %85 |
| 1200–1255 px + AI | Ray 64 + en dar AI 360 + paylar 46 → 1200'de belgeye 730 px = %79. Yan yana %85 için en az **1256 px**. | AI çekmece |
| 1440 + AI genişliği | AI 396'da gezinme açıkken belge %82 olurdu (758 px). | AI en dar genişliğinde (360); kullanıcı ayırıcıyla genişletirse sınırı aşmayacak kadar |
| Prototipin kâğıdı 760 px | Uygulamanın kâğıdı 924 px (860 metin sütunu); değiştirmek satır sonlarını değiştirir. | Kâğıt aynı; ferahlık çevre paylarından |
| ~~1200–1279 px + sol araç açık~~ | 2. turda tarayıcıda ölçüldü ve çözüldü (aşağıda). | Tek satır, kaymadan sığar |
| Telefon üst bandı | Dokunma hedefleri 44 px; arama simgesi editörde gizli (sekiz düğme 390 px'e sığmıyordu); dönüş yalnızca simge. | 55 px bant; arama editör dışındaki ekranlarda |

## Kontroller (ilk teslim, 19.11.2026)

`npx tsc --noEmit` ✓ · `npm run lint` ✓ (2 eski uyarı, bu değişiklikte değil) · `check:css` ✓ · `check:migrations` ✓ ·
`check:rakamlar` ✓ · `test:unit` 2358/2358 · `test:editor` 112/112 · `test:db` 362/362.
Tarayıcı kabulü (`calisma-alani-kabul.mjs`, üretim derlemesi): **21 PASS, 0 FAIL, 1 UNVERIFIED** (S17: kayıtlı
dizin düzeneği verilmedi) → `scripts/yerel-yigin/sonuclar/calisma-alani-kabul-5f2b732.json`. Güncellenen testler
yeni kararları sabitler: yerleşim kararı (AI 1440 gezinme açık, PDF 1440 520), seçim kartı konumu, kâğıt
tokenı, ana sayfa tablosu.

---

# 2. tur (19.11.2026) — PDF yerleşimi, AI yazma alanı, okunurluk, eksik kabul

Uygulama commit'i **`4b4d665`** (sonrakiler yalnızca kabul/karşılaştırma betikleri ve sonuç dosyaları).
Etiket: **Yerel üretim derlemesi · 4b4d665 uygulama kodu**, BUILD_ID `w4s0PW_VUbnb3EaHr-NRR`
(`rm -rf .next && next build`, `next start`). Görseller ve ölçümler: `teslim/tur2/` (yalnızca etkilenen ekranlar).
`teslim/tur2/derleme.json` `gitHead 4983980` ve `uygulamaKoduTemiz: false` yazar: o anda yalnızca
izlenmeyen sonuç/teslim dosyaları vardı; `git diff 4b4d665 4983980 -- app lib` boş. Veri yerel ve sentetik;
**AI cevapları yerel taklit** (`model-taklidi.mjs`), gerçek model çağrılmadı.

| Yol | Ne |
|---|---|
| `teslim/tur2/karsilastirma/pdfy-masaustu.png` | Yalnızca PDF (`?sag=pdf`), 1440/1280, açık/koyu, prototip ekran 7 ile |
| `teslim/tur2/karsilastirma/pdfd-masaustu.png` | Kaynak listesi + PDF (`?sol=kaynaklar&sag=pdf`) |
| `teslim/tur2/karsilastirma/pdf-masaustu.png` | Atıf kartından "Dayanağa git" (pasaj vurgulu) |
| `teslim/tur2/karsilastirma/ai-masaustu.png` | Arvo AI paneli, istem ve Gönder görünür |
| `teslim/tur2/karsilastirma/telefon.png` | 390: ana ekran (Yeni çalışma hizası), PDF, AI, **AI + klavye benzetimi** |
| `teslim/tur2/olcumler/*.txt` | Aşağıdaki tabloların ham ölçümleri (üretim derlemesi, tarayıcı) |

## 1. PDF yerleşimi

En dar PDF genişliği **440 → 360**. Belge ölçeği alt sınırı **%85 değişmedi**, kâğıt (924 px) ve biçim aynı.
Belgenin %85 olması için belge sütunu en az **788 px** (`ceil(0,85 × 924) + 2`).

| Ekran · durum | Sol | PDF | Belge | Önce (ilk teslim) |
|---|---|---|---|---|
| 1280 · yalnızca PDF | ray 64 | **382** | **%85** | çekmece (belgeyi örtüyordu) |
| 1280 · liste + PDF | şerit 64 | 382 | %85 | liste açık + çekmece |
| 1360 · liste + PDF | şerit 64 | 462 | %85 | — |
| 1440 · yalnızca PDF | ray 64 | 520 | %87 | aynı |
| **1440 · liste + PDF** | **liste 246** | **360** | **%85** | şerit 64 + PDF 520 |
| 1472 · liste + PDF | liste 246 | 392 | %85 | şerit |
| 1560+ · liste + PDF | liste 300 | 466+ | %85 | — |
| 1200–1257 · PDF | — | çekmece | %100 | 1200–1335 çekmeceydi |

PDF denetimleri 340–440 px arasında hiçbirinde kesilmedi (`olcumler/pdf2.txt`: `pdfKesik: []`). Bedel PDF'in
sığdır yazısında: 520 px'te metin 8,9 px, 462'de 7,8, 392'de 6,6, 382'de 6,4, 360'ta 6,0 px yüksekliğinde.
Okumak için yakınlaştırma (+) ya da "Pasaja odaklan" gerekir; kullanıcı ayırıcıyla PDF'i genişletebilir
(`sagEnCok` belge %85'in altına inmeyecek kadar).

**Liste için en küçük kullanılabilir genişlik 246 px**: iki düğme ("Atıf ekle", "PDF'i aç") yan yana ve kesilmeden
sığıyor. 200 px'te ikinci düğme alt satıra kırılıyor ve arama kutusunun yer tutucusu kesiliyor. 1440'ta liste
(246) + belge %85 (788 + paylar 46) + PDF 360 = 1440: tam sığıyor, pay kalmıyor. 1439 ve altında liste şeride
iner (1360–1439 arası şerit + PDF 462–520). Liste 300 px'te kalsın istenirse PDF ile birlikte en az **1494 px**
gerekir.

## 2. AI yazma alanı

**Yerleşim hatasıydı, çekim değil.** 1440×900'de panelin altı 938 px'teydi (ekran 900); istem kutusu 923'te
bitiyordu, Gönder düğmesi ekranın dışındaydı. Panel yapışık konumuyla görünür alanın içine alındı; başlık, Kapat
ve istem sabit, yalnızca `.yazim-paneli-liste` kayar.

| Durum | Panel (üst–alt) | Başlık | Kapat | İstem | Gönder |
|---|---|---|---|---|---|
| 1440×900 | 126–888 | 127–182 | 139–169 | 806–873 | 837–873 |
| 1280×800 | 126–788 | 127–182 | 139–169 | 706–773 | 737–773 |
| 390×844 | 0–844 | 1–66 | 13–53 | 753–829 | 785–829 |
| 390, görünen alan 500 (klavye benzetimi) | 0–500 | 1–66 | 13–53 | 409–485 | 441–485 |

Uzun sohbette ve sayfa kaydırılmışken de aynı (`olcumler/ai.txt`). **Telefon klavyesi:** panel telefonda
`visualViewport`'un üstüne ve yüksekliğine bağlandı (klavye açılınca yalnızca görünen alan küçülür). Tarayıcıda
klavye açılamadığı için görünen alan 844 → 500 px'e indirilerek **benzetildi**; gerçek iOS/Android cihazda
sınanmadı. Bağlama ilk yazıldığında panel kapalıyken bağlanmıyordu (lint'in koşullu kanca hatası yakaladı);
`4b4d665`'te her açılışta bağlanıyor.

## 3. Okunurluk ve erişim

- **Düzeltme:** İlk teslimde "en küçük 11 px, prototiple aynı" yazmıştım; yanlıştı. **Prototipin alt sınırı 12 px.**
  Arayüzün en küçük yazısı 12 px'e çıkarıldı (`--fs-micro`, `--os5-fs-en-kucuk`, üç sabit 11 px; `check:css`
  ve AGENTS.md alt sınırı 12). Belge puntosuna dokunulmadı. Tarayıcıda sekiz ekranda görünür yazı tarandı:
  12 px'in altında görünür yazı yok (`olcumler/yazi.txt`; telefonda 0 px görünen kayıt durumu bilerek
  görsel olarak gizli, ekran okuyucuya açık).
- **Telefonda "Yeni çalışma":** düğmenin merkezi başlığın merkezinden 10 px aşağıdaydı; şimdi 390 ve 360'ta fark
  **0 px** (başlık kutusu en az 44 px ve dikeyde ortalı; punto aynı).
- **Araç çubuğu, 1200–1279 (tarayıcıda ölçüldü, 5 genişlik × 6 durum):** önce çekmeceli durumlarda çekmece araç
  çubuğunun üstüne biniyor, sol araç açıkken çubuk yatay kayıyordu. Çekmece artık araç çubuğunun altından başlıyor;
  çubuk 1279 px altında sıkışıyor. Ölçüm: 30 durumun **30'unda** içerik görünür alana sığıyor, 23 öğenin her biri
  odaklanınca görünür ve tıklanabilir (`olcumler/arac.txt`; en dar: 1200 + arama, içerik 802 / alan 802).

## 4. Kabul (üretim derlemesi, BUILD_ID `w4s0PW_VUbnb3EaHr-NRR`)

**22 PASS, 0 FAIL, 0 UNVERIFIED** → `scripts/yerel-yigin/sonuclar/calisma-alani-kabul-4983980.json` (gitHead `4983980`, BUILD_ID `w4s0PW_VUbnb3EaHr-NRR`, uygulama kodu temiz; `4983980` ile `4b4d665` arasında `app/` ve `lib/` farkı yok). Aynı derlemedeki bir önceki tam koşu (`0335a77`): 21 PASS, 1 FAIL — S0'da bir kez hidrasyon uyarısı ("Açık kalanlar").

**S17** kayıtlı dizin düzeneğiyle çalıştırıldı: sunucu
`NODE_OPTIONS="--import ./scripts/yerel-yigin/kayitli-dizin-yanitlari.mjs" KAYITLI_DIZIN_KAYDI=<dosya>` ile
başlatıldı. OpenAlex ve Crossref aramaları **elle yazılmış sentetik yanıtlara** çevrildi; **bu gerçek dizin
erişimi değildir** ve dizinlerin bugünkü yanıt biçimini doğrulamaz. Sonuç: OpenAlex 3 + Crossref 2 kayıt → 4
satır (aynı DOI birleşti), taşma yok, "Listeme ekle" bu çalışmaya 1 kayıt yazdı.

Değişen yerleşimde korunanlar: **S11** inceleme paneli belgeyi sıkıştırmıyor, AI/PDF ile örtüşmüyor; **S18 ve
S20** Esc sırası (açık pencere önce kapanır, sonra çekmece; yavaş cihazda 10/10); **S1** kayıt; **S8** Word ve
yazdırma çıktısının içeriği (belge dili dahil). Çekmece senaryoları (S14, S16, S20) 1280'den 1200'e taşındı,
çünkü 1280'de artık çekmece oluşmuyor.

Düzenek düzeltmesi: `4b4d665` üzerindeki ilk koşuda S16 düştü (`calisma-alani-kabul-4b4d665-S16-duzenek-hatasi.json`).
Neden testteydi: her adım aynı cümlenin önüne işaret yazdığı için cümle 1200'de çekmecenin altına kaymış, tıklama
belgeye düşmemişti. 1200 adımı artık çekmecenin örtmediği bir cümleye tıklıyor ve tıklanan noktanın belgede olduğu
ayrıca denetleniyor (`0335a77`).

## Açık kalanlar (ölçülerle)

| Konu | Ölçü | Durum |
|---|---|---|
| PDF sığdır yazısı küçük | 360–392 px'te 6,0–6,6 px | Yakınlaştırma ya da Pasaja odaklan; ayırıcıyla genişletme |
| ~~PDF panelinin alt notu~~ | kapanışta düzeltildi (aşağıda) | Not tamamen görünür |
| Telefon klavyesi | yalnızca görünen alan küçültülerek benzetildi | Gerçek cihazda sınanmadı |
| 1440'ta liste 300 + PDF | 1494 px gerekir | 1440'ta liste 246'ya iner |
| Ara sıra hidrasyon uyarısı (React #418) | `0335a77` tam koşusunda bir kez | Kapanışta hedefli kontrol: 192 + 96 açılışta yeniden üretilemedi (aşağıda). **Açık, belirsiz** |

## Kontroller (2. tur, `4b4d665`)

`npx tsc --noEmit` ✓ · `npm run lint` ✓ (0 hata, 2 eski uyarı) · `check:css` ✓ · `check:migrations` ✓ ·
`check:rakamlar` ✓ · `test:unit` 2358/2358 · `test:editor` 112/112 · `test:db` 362/362.

---

# 2. tur kapanışı (19.11.2026)

**Son HEAD ve kod:** uygulama commit'i **`af329b4`**; sonraki commit'ler yalnızca teslim/ölçüm dosyaları.
**BUILD_ID `hDmEoQJubAbloP-ZWCddu`** (`rm -rf .next && next build`, `next start`, S17 kayıtlı dizin düzeneğiyle).
**Kabul:** 22 PASS · 0 FAIL · 0 UNVERIFIED, `af329b4` HEAD'iyle bu derlemede koştu →
`scripts/yerel-yigin/sonuclar/calisma-alani-kabul-af329b4.json` (uygulama kodu temiz). Görseller ve ölçümler aynı
derlemeden: `teslim/tur2/karsilastirma/`, `teslim/tur2/kapanis/`, `teslim/tur2/olcumler/`. AI cevabı yerel taklit.

## PDF güven notu
Eskiden alt bölüm flex içinde içeriğinin altına küçülüyordu: not 1440'ta 852–921 (bölüm 887'de bitiyor), 1280'de
791–843 (bölüm 787) — yarım ya da hiç görünmüyordu. Alt bölüm artık içeriği kadar yer alır (üst sınır %45), küçülen
okuma alanıdır; not üç satırdan iki satıra kısaltıldı ("Yalnızca bu PDF'e dayanır; doğrulanamayan cevap
gösterilmez, belgeye kendiliğinden girmez."), boş analiz listesinin boşluğu kaldırıldı. Ölçüm (`olcumler/pdf-alt-not.txt`):

| Ekran | Not | Alt bölüm sonu | Kayan? | PDF okuma alanı (önce → sonra) |
|---|---|---|---|---|
| 1440 · liste + PDF | 830–865 | 887 | hayır | ~334 → 320 px |
| 1280 · PDF | 730–765 | 787 | hayır | ~272 → 220 px |
| 1200 · çekmece | 734–769 | 791 | hayır | — → 256 px |
| 1920 · PDF | 1010–1045 | 1067 | hayır | — → 524 px |

Bedel: 1280'de okuma alanı ~52 px kısaldı (yönerge, iki satırlık not ve yazma kutusu birlikte ~180 px).

## Yakınlaştırma ve Pasaja odaklan (`olcumler/yakinlastirma.txt`, `kapanis/`)
6 px yalnızca sığdır görünümünde: 1440'ta (PDF 360) sığdır %55 → 6,0 px; **+2 → %105, 11,5 px; +3 → %130, 14,3 px**.
1280'de (PDF 382) %58 → 6,4 px; +2 → %108, 11,9 px. Doğrulanmış pasajda "Dayanağa git" pasajı %55'te vurgular ve
görünür alanda tutar; **"Pasaja odaklan" → %160, pasaj 17,6 px, görünür alanda** (`pasaj-odaklan-1440.png`).
Telefonda Dayanağa git doğrudan %160 açar (S15, `s15-telefon-pasaj.png`).
Eşleşme yokken: doğrulanmış pasajı olmayan atıfta "PDF'i aç" → vurgulanan pasaj 0, düğme yok (`eslesme-yok-pdf.png`);
pasaj başka PDF/sayfada bulunamazsa önceki ya da yanlış yer vurgulanmaz, kullanıcıya söylenir (S10, `s10-pasaj-bulunamadi.png`).
Not: doğrulanmış pasajlar yalnızca oturum boyunca bellekte tutulur (bilinçli, K3-ek onaylı değil); sayfa yeniden
yüklenince kart "Doğrulanmış pasaj yok" der ve hiçbir yer vurgulanmaz. Bu tur değiştirilmedi.

## React #418
**Kayıt:** tek görülme `calisma-alani-kabul-0335a77.json`, S0: "Minified React error #418 … args[]=HTML" (sunucunun
çizdiği HTML istemciyle uyuşmadı), adres `/dashboard/editor/<ESKI>/write?sol=kaynaklar&sag=pdf`, BUILD_ID
`w4s0PW_VUbnb3EaHr-NRR`. Kayıt hangi senaryoda/hangi düğümde olduğunu söylemiyor; sunucu günlüğünde iz yok.
**Hedefli kontrol** (`olcumler/olc-418.mjs`, `418-*.txt`): aynı ekran, her durumda soğuk açılış (yeni bağlam, ilk
istek) + iki yeniden yükleme; 1440/1280/1200/390 × TR/EN × açık/koyu × normal ve 6× yavaş CPU; pageerror ve
hidrasyon console.error'ları toplandı.
- Üretim derlemesi (`hDmEoQJubAbloP-ZWCddu`): 2 tur, **192 açılış, 0 hata**.
- Geliştirme sunucusu (uyuşmazlığın ayrıntısını yazan mod): **96 açılış, 0 hata/uyarı**.
- Önceki tam kabullerde (`4983980`, `af329b4`) S0 temiz; hedefli altı tekrar (S20 ×2, S3, S19, S16 ×2) temiz.
- Kodda taranan adaylar (render sırasında `Date`, `localStorage`, `matchMedia`, `navigator`) istemciye
  `useSyncExternalStore`/effect ile alınmış ya da sunucu ile aynı saat dilimini kullanıyor; kaynak bulunamadı.

**Sonuç: yeniden üretilemedi, kapanmış sayılmıyor.** Olasılıklar (doğrulanmadı): test sürücüsünün hidrasyon
bitmeden sayfayla etkileşmesi ya da tam kabulde peş peşe gezinmelerin sırası. Hata gizlenmedi; kabulün S0 denetimi
her koşuda pageerror'ı FAIL sayıyor.

## Kontroller (`af329b4`)
`tsc` ✓ · `lint` 0 hata (2 eski uyarı) · `check:css` ✓ · `check:migrations` ✓ · `check:rakamlar` ✓ ·
`test:unit` 2358/2358 · `test:editor` 112/112 · `test:db` 362/362.

## Kod incelemesi (PR #112)

İnceleme `origin/main...HEAD` üzerinde yapıldı; Codex incelemesi `4301703`'te bulgu bildirmedi. Dört nit bulundu:
1. `lib/calisma-alani-yerlesimi.ts` ve `gorsel-uyum.css`'te ilk turun kuralını anlatan eskimiş yorumlar → **düzeltildi** (`95f0d9b`, davranış değişmedi).
2. Telefonda PDF "⋯" düğmesinde `aria-controls` yok → **düzeltildi** (`95f0d9b`, görünüm değişmedi).
3. Yerleşim kararı `clientWidth`, CSS medya sorgusu kaydırma çubuğu dahil genişlik kullanıyor; Windows'ta ~1200–1215 px'te karar tablet, kabuk masaüstü olabiliyor → **bu turda değiştirilmedi** (1. turda bilinçli seçim; değiştirmek yerleşim davranışını değiştirir).
4. Telefonda yeni çalışma düğmeleri `column-reverse`: görsel sıra ≠ odak sırası → **bu turda değiştirilmedi** (onaylı tasarım kararı; yorumda belgeli).

Son uygulama kodu **`95f0d9b`**, BUILD_ID **`ulDWz5SEVrYzO2Ej5KFak`** (temiz derleme, S17 düzeneği):
tam kabul **22/22 PASS, 0 FAIL, 0 UNVERIFIED** → `scripts/yerel-yigin/sonuclar/calisma-alani-kabul-95f0d9b.json`.
CI (`kontrol`) `95f0d9b`'de başarılı. React #418 açık bulgu olarak kalıyor.

## İnceleme kapanışı: son iki nokta

1. **Yeni çalışma düğme sırası** → **düzeltildi** (`795b213`). Telefonda görünüm eskiden `column-reverse` ile
   ters çevriliyordu (Tab önce alttaki Word'e gidiyordu). Sıra artık DOM'da kuruluyor: telefonda "Oluştur ve yaz",
   Word; masaüstünde Word, "Oluştur ve yaz". Pozitif `tabindex` yok; görünüm aynı. Tarayıcıda Tab ve Shift+Tab ile
   doğrulandı (`teslim/tur2/olcumler/yeni-calisma-sekme.txt`, `teslim/tur2/kapanis/yeni-calisma-*.png`).
2. **Kaydırma çubuğu, 1200–1215 px** → **ölçüm kanıtıyla kabul edilen fark**, kod değişmedi. Klasik 15 px
   çubukla, 5 durum (panelsiz, AI, PDF, liste, liste + PDF) × 10 genişlik (1195–1220): 1200–1214 px'te CSS
   masaüstü kabuğu, yerleşim kararı tablet davranışı (belge akar %100, panel çekmece) seçiyor. Bu 25 ölçümün
   hiçbirinde yatay taşma, belge–gezinme ya da belge–panel örtüşmesi, erişilemeyen araç çubuğu öğesi yok;
   "Kontroller" ve dışa aktarma menüsü 50 ölçümün hepsinde tıklanabilir
   (`teslim/tur2/olcumler/kaydirma-cubugu-1200-1215.txt`, `olc-cubuk.mjs`). Not: 1195–1199 px (her iki tarafın
   da tablet olduğu bant) liste açıkken listenin belgeyi örtmesi tabletin mevcut davranışı, bu PR değiştirmedi.

Son uygulama kodu **`795b213`**, BUILD_ID **`FODXRAzjYWENiK6Hy5dRP`** (temiz derleme, S17 düzeneği): tam kabul
**22/22 PASS, 0 FAIL, 0 UNVERIFIED** → `scripts/yerel-yigin/sonuclar/calisma-alani-kabul-795b213.json`.
CI (`kontrol`) `cc972dc`'de (aynı uygulama kodu) başarılı. React #418 açık bulgu olarak kalıyor.
