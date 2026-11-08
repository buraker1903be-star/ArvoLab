# 11 — V4.3 kabul kriterleri

## Durum değerleri

| Değer | Anlamı |
|---|---|
| **PASS** | Gerçek uygulamada ölçüldü ve geçti. |
| **PROTOTİP** | Yalnız V4.2R statik maketinde ölçüldü. Gerçek uygulama için kanıt değildir. |
| **UNVERIFIED** | Gerçek uygulamada henüz ölçülmedi. |
| **BUGÜN-GEÇİYOR** | Mevcut uygulamada, değişiklikten önce, mevcut betikle geçtiği önceki aşamalarda raporlandı. V4.3 sonrası yeniden ölçülmeli. |

Bu belge hazırlanırken uygulama çalıştırılmadı. Bu yüzden hiçbir satır
**PASS** değil.

## 1. Ölçülebilir hedefler

| # | Kriter | Hedef | Nasıl ölçülür | Aşama | Durum |
|---|---|---|---|---|---|
| 1 | Yatay taşma (1440, 1200, 1024, 768, 390, 360) | 0 | `duyarlilik.mjs` (çıkış kodu 1 = taşma), `kabuk-kabul.mjs`, `tablo-kabul.mjs` | B, C, D, F | UNVERIFIED · prototipte 0 |
| 2 | Tema kaynaklı yerleşim farkı | 0 | `gorsel-fark.mjs`: açık ve koyu görüntülerin yerleşim imzası. Gerçek uygulama için imza karşılaştırması eklenir; bugün yalnız piksel farkı var. | A–F | UNVERIFIED · prototipte 0 |
| 3 | Normal metin kontrastı | ≥4,5:1 | `kagit-kabul.mjs` (kâğıt); arayüz için `ekranlar/olc.mjs` yönteminin önizleme sayfalarına uyarlanması | A, D | UNVERIFIED · prototipte en düşük 4,87 |
| 4 | Mobil dokunma hedefi | ≥44 × 44 px | `dokunma-kabul.mjs` ve `duyarlilik.mjs` (**bugünkü eşik 40; 44'e çekilir**, K-7) | B–F | UNVERIFIED |
| 5 | Ekranda baskın birincil eylem | 1 | `genel-bakis-kabul.mjs` S6; diğer ekranlara aynı sayım | C, D, F | BUGÜN-GEÇİYOR (Ana Sayfa) · diğerleri UNVERIFIED |
| 6 | Panel aç/kapa sırasında istenmeyen paragraf yeniden kırılması (≥1200 masaüstü) | 0 | Yeni `kagit-geometri-kabul.mjs`: ilk 10 paragrafın satır sayısı panel kapalı ve açık | D | UNVERIFIED · prototipte 8/8 · **bugünkü uygulamada kırılma var** (WS:1437) |
| 7 | Seçim ve imleç kaybı | 0 | `ai-kabul.mjs` (bayat seçim reddi, 220-232), `asistan-araligi.test.ts`, yeni panel aç/kapa ve telefon kapat senaryoları | D, E | Kısmen BUGÜN-GEÇİYOR (izlenen aralık) · panel geçişi UNVERIFIED |
| 8 | Gereksiz (hayalet) otomatik kayıt | 0 | `kayit-kabul.mjs`; açılışta 4 s sıfır yazma (`arac-cubugu-kabul.mjs`) | D, E | BUGÜN-GEÇİYOR (yerel önizleme) · gerçek Test ortamında UNVERIFIED |
| 9 | Mevcut akademik işlevlerde regresyon | 0 | §2 matrisi; CI sekizlisi ve önizleme betikleri | Hepsi | UNVERIFIED |
| 10 | Klavye ve ekran okuyucuda kritik hata | 0 | `odak-kabul.mjs` (12 sayfa), `kabuk-kabul` klavye senaryoları, el ile VoiceOver ve TalkBack turu (gerçek cihaz) | B, E | UNVERIFIED · ekran okuyucu bu ortamda test edilemez |
| 11 | Öneri beklerken yeni istem gönderilebilir (telefon dahil) | Evet | Yeni AI senaryosu | E | Masaüstünde koddan doğrulandı (YP:150-200) · telefon tasarımı V4.2R'de engelliyordu, plan düzeltiyor |
| 12 | Seçim menüsü görevi kaybolmaz | 0 kayıp | Yeni test (R24 G1) | 0 | **Bugün başarısız** (koddan doğrulandı) |
| 13 | Kesik sekme (telefon şeridi, 390/360) | 0 | `kabuk-kabul.mjs` + `revizyon-olc.mjs` yöntemi | B | UNVERIFIED · prototipte 0 |
| 14 | Görsel fark onayı | Her aşamada raporlu ve kabul edilmiş | `gorsel-fark.mjs` (144 görüntü) | A–F | — |

## 2. İşlev koruma matrisi

| İşlev | Mevcut davranış (kanıt) | Etkilenecek dosyalar | Risk | Test | Kabul ölçütü |
|---|---|---|---|---|---|
| Otomatik kayıt | 1.500 ms, büyük belgede 4.000 ms; tek kayıt `inFlightRef`; çakışmada `expectedUpdatedAt` (`ME:366-370, 758-891`; `manuscript.ts:319-333`) | D: `workspace.css`, `ME` (yalnız görünüm) | Düşük; yalnız durum göstergesinin yeri değişir | `kayit-kabul`, `gezinme-korumasi-kabul` | Kaydedilmemiş değişiklik kaybı 0; göstergede "Kaydedildi · saat" |
| Hayalet kayıt önleme | `belgeGercektenDegisti` (`ME:993-995`) | D, E | Panel aç/kapa sırasında `setMeta` ya da süsleme işlemlerinin `docChanged` üretmemesi gerekir | `kayit-kabul`, `test:editor` (`belge-degisti`) | Açılışta ve panel geçişinde yazma isteği 0 |
| Belge sürümleri | 10 dakikada bir otomatik; AI'da `surumGerekir` (`ai-duzenleme.ts:61-64`); geri yüklemeden önce yedek | E (yalnız görünüm) | Düşük | `ai-kabul` sürüm hatası senaryoları (265-293) | Sürüm alınamazsa değişiklik uygulanmaz |
| Kelime sayımı | `kelimeSay` (`lib/kelime-sayimi.ts:38`), durum çubuğu `ME:3442` | D | Düşük; yer değişir | `test:unit`, `test:editor` (`kelime-sayimi`), `kaynak-kabul` B7 | Özet ve editörde aynı sayı |
| Seçim ve imleç | `AsistanAraligi` eşlemesi; birebir metin denetimi | D, E | **Orta:** panel geçişi, telefonda kaydırma, odak dönüşü | `asistan-araligi.test`, `ai-kabul`, yeni senaryolar | Kayıp 0 (§1 #7) |
| AI öneri kabul, reddet, geri al | `uygula` / `geriAl` (YP:226-380); ayrı geçmiş adımı; düzenlenmiş metin geri alınmaz | 0 (hata düzeltme), E (görünüm) | **Orta:** R24 G1–G4 | `ai-kabul`, yeni testler | Özgün aralığa uygulama; G1–G4 kapanır |
| Kaynak ve atıf bütünlüğü | CSL (`lib/atif/*`), kaynakça bölümü (`lib/kaynakca-bolumu.ts`), atıf penceresi (`cite-dialog.tsx`) | F (görünüm), D (atıf işareti süslemesi, ileride) | Düşük | `test:unit` (atıf), `kaynak-ekleme-kabul` | Kaynakça çıktısı değişmez; aynı DOI ikinci satır açmaz |
| DOI ekleme | `doiIleEkle`; kota saatte 60, üç akış ortak | F | Düşük | `doi-kotasi-kabul`, `kaynak-ekleme-kabul` | Mesajlar ve kota davranışı aynı |
| PDF erişimi | İmzalı adres 600 s, yeni sekme; PDF durumu çalışmanın kaynakça satırında (`kaynak_pdfleri`) | F | **Orta:** kütüphaneye taşınan erişim yolu yanlış çalışmaya bağlanmamalı | `kaynak-kabul` B1/B2/B6 (çalışma hedefi) + yeni "kütüphaneden PDF'i aç" senaryosu | Başka çalışmanın PDF'i açılmaz; yetki ve RLS aynı |
| Word, PDF ve ZIP dışa aktarma | `tiptap-docx`, `tiptap-html`, `latex-paketi`, `teslim-paketi`; üç yol birbirine karşı sınanır | Hiçbiri (ekran CSS'i baskıya girmemeli) | Düşük; koyu kâğıt (K-5) baskıya sızmamalı | `test:editor` (`cikti-yollari`), `cikti-kabul` | Çıktılar referansla aynı |
| Kılavuz uyarıları | Kılavuz bandı, "uygulandı" bandı, `role="alert"` kritik hatalar, `?kilavuz=1` | D (çip + kritik kenar notu, A2) | **Orta:** kritik uyarının çipe indirgenmesi | `editor-merkezi-kabul` (eşikler güncellenir), yeni "kritik uyarı görünür" senaryosu | Kritik uyarı kapatılamaz ve belge üstünde görünür |
| Mobil gezinme | Alt çubuk, "Daha fazla" dialog'u, klavyede gizlenme, bölüm şeridi | B | Orta | `kabuk-kabul`, `duyarlilik`, `dokunma-kabul` | Taşma 0, kesik sekme 0, ≥44 px |
| Erişilebilirlik | Sekmeler WAI-ARIA, odak halkası, Esc, odak dönüşü | B, E | Orta: 64 px rayda ad yalnız `aria-label` | `odak-kabul`, `kabuk-kabul` klavye, el ile ekran okuyucu | §1 #10 |
| Tema geçişleri | `data-theme`, FOUC betiği, üç seçenek | A | Düşük | `gorsel-fark` (iki tema), `kagit-kabul` | Yerleşim farkı 0; geçişte yanıp sönme yok |

## 3. Ortam hazırlığı

| Koşul | Durum |
|---|---|
| CI sekiz kontrolü | Hazır (`.github/workflows/ci.yml`) |
| Önizleme sunucusu ve sahte Supabase | Hazır (`npm run onizleme`) |
| Görsel fark aracı | Hazır |
| Yerleşim imzası ve geometri betikleri | Yok; G'de yazılır (`kagit-geometri-kabul.mjs`) |
| Gerçek Supabase Test girişi | **Bekliyor:** O1/O2 kararı |
| Gerçek cihazlar (iOS Safari, Android Chrome) | **Yok** bu ortamda |
| Firefox ve Safari masaüstü | Yok; Chromium var |

## 4. Karar tablosu

| Konu | Durum | Gerekçe | Gerekli karar |
|---|---|---|---|
| Masaüstü tasarım entegrasyonuna hazırlık | **UNVERIFIED** (plan hazır) | Envanter tamam. Aşamalar, testler ve geri alma yolu tanımlı. Gerçek uygulamada hiçbir ölçüm yapılmadı. | V4.3-0 ve V4.3-A onayı; `tokens.css` değişikliğine izin; K-6 |
| Mobil AI etkileşimi | **BLOCKED** | V4.2R maketi öneri beklerken besteciyi gizliyordu (kurala aykırı); Çözüm A öneriliyor. `visualViewport` ve geri tuşu gerçek cihaz ister. | R22 Çözüm A'nın onayı; gerçek cihaz erişimi |
| Editör belge geometrisi | **UNVERIFIED** | Hedef (638/638, kırılma 0) yalnız prototipte ölçüldü. Bugünkü editör panel açılınca yeniden kırıyor (WS:1437). 1200 px'te sığması 64 px raya bağlı. | K-1 (ray 64), K-4 (sabit ölçü), K-5 (koyu kâğıt) |
| Mobil Çalışmalarım | **UNVERIFIED** | R25: kart bağlantısı + › + "Sıradaki" öneriliyor. Ana Sayfa ve Kütüphane telefonu V4.2R'de revize edilmedi. | R25 seçimi; V4.2R-2 görsel onayı (R26) |
| Token göçü | **UNVERIFIED** | 242 token doğrulandı. 3.826 başvuru (`tokens.css` dışı; V4.1'in 3.719'u yalnız 242 adı sayıyordu). Ham renk kuralı nedeniyle ekleme `tokens.css`'e yapılmalı. | `tokens.css` değişikliğine izin; adım 2'nin görsel fark onayı |
| Akademik işlev koruması | **BLOCKED** (bir madde) | Matris tanımlı. R24 G1 (seçim menüsü görevi sessizce kayboluyor) bugün açık bir hata. K-3: kütüphanede künye sonucu saklanmıyor, tasarım etiketleri buna göre değişmeli. | V4.3-0 onayı; K-3 |
| Test ortamı hazırlığı | **BLOCKED** | Önizleme ve CI hazır. Gerçek Supabase Test girişi (O1/O2) ve gerçek cihazlar yok. | O1/O2 (K-9); cihaz testi kimde ve nasıl yapılacak |
