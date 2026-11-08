# 06 — Terim sözlüğü (TR / EN) · A5, koşullu onay

## Nasıl okunur

**Kaynak.** "Bugün" sütunundaki İngilizce karşılıklar uygulamanın kendi
`t({ tr, en })` çağrılarından alındı (`app/`, `lib/`; 08.11.2026 taraması).
"Öneri" sütunu yalnız v4'ün getirdiği yeni terimler ve çakışmalar içindir.
Uygulama metni bu aşamada değişmedi.

**Ana kural.** Bir kavramın her dilde tek adı vardır ve aynı ad iki ayrı
kavrama verilmez.

## 1. Yerler (gezinme)

| Kavram | TR | EN (bugün) | Kullanım |
|---|---|---|---|
| Uygulama girişi | Ana Sayfa | Home | Kenar çubuğu, alt gezinme |
| Çalışma listesi | Çalışmalarım | My works | Sayfa adı; alt gezinmede kısa biçim **Çalışmalar** / *Works* |
| Kaynak sayfası | Kaynak Kütüphanesi | Source Library | Sayfa adı; alt gezinmede kısa biçim **Kaynaklar** / *Sources* |
| Analiz sayfası | Analiz Merkezi | Analysis Centre | Kenar çubuğu |
| Belge denetimi | Belge Kontrol | Document Check | Kenar çubuğu, "Diğer" menüsü |
| Etik kurul | Etik kurul | Ethics | Çalışma bölümü ("Diğer") |

## 2. Çalışmanın bölümleri

Masaüstü sekmesi, telefon şeridi ve kenar çubuğu alt öğesi **aynı sırada**
gösterilir.

| TR | EN (bugün) | Not |
|---|---|---|
| Özet | Overview | |
| Yazım | Writing | |
| Kaynaklar | Sources | Çalışmaya bağlı kaynaklar. Kütüphane ile aynı veridir, çalışmaya süzülmüş hâlidir. |
| Kanıt | Evidence | Kenar çubuğundaki adı: Kanıt matrisi / Evidence matrix |
| Analiz | Analysis | |
| Diğer araçlar | More tools | Takvim, Kaynakça, Etik kurul, Belge Kontrol |

## 3. Kaynak terimleri — ayrım (A5'in özü)

| Terim | TR | EN | Ne demek | Nerede |
|---|---|---|---|---|
| Kütüphane | Kaynak Kütüphanesi | Source Library | Kullanıcının bütün kaynakları | Sayfa |
| Kaynaklar | Kaynaklar | Sources | Bir çalışmaya bağlı kaynaklar | Sekme ve şerit |
| Literatür | Literatür | Literature | Okuma ve tarama ekseni (Okunacak / Okundu / Kullandım) | Ana Sayfa'da kanıt ekseni; editör penceresi |
| Kaynakça | Kaynakça | References | Belgenin sonundaki liste ve onun denetimi (94/100) | Denetim şeridi, kanıt ekseni |
| Künye | Künye | Reference details | Bir kaynağın bibliyografik alanları | Doğrulama ekseni, ayrıntı paneli |

## 4. Durum ve eksen sözcükleri

Bu sözcükler her zaman işaretin yanında metin olarak yazılır.

| Eksen | TR değerleri | EN (bugün) |
|---|---|---|
| Okuma | Okunacak · Okundu · Kullandım | To read · Read · Marked cited |
| Teslim maddesi | Eksik · Bakılacak · Hazır | Missing · **Review** (bkz. §6) · — |
| Doğrulama (künye) | Dizinlerde karşılaştır | Check against the indexes |
| PDF | indirildi · bakılmadı · bulunamadı · erişilemedi | (PDF satırının mevcut metinleri) |
| Kanıt | doğrudan · değerlendirilmedi · iddiaya bağlı değil | (kanıt matrisinin mevcut metinleri) |

## 5. Eylemler

| TR | EN (bugün) |
|---|---|
| Yazmaya devam et | Continue writing |
| Yeni çalışma | New work |
| Kılavuzumu yükle | Upload my guideline |
| Kaynak bul | Find sources |
| İçe aktar | Import |
| DOI ile ekle / DOI ile kaynak ekle | Add by DOI / Add a source by DOI |
| Kaynağa sor | Ask the source |
| PDF'i aç | Open PDF |
| Atıf ekle | Insert citation |
| Kabul et · Düzenleyerek kabul et · Reddet · Geri al | Accept · Edit, then accept · Reject · Undo |
| Danışmanıma gönder | Send to my advisor |
| Teslim listesi | Submission checklist |

## 6. V4.2R'nin getirdiği terimler ve bulunan çakışma

| TR | EN (öneri) | Neden |
|---|---|---|
| Teslime giden yol | Path to submission | "Teslim için bakılacaklar"ın yerine. Maddeler eylem fiiliyle biter. |
| Teslim hazırlığı | Submission readiness | Bugün var, değişmez. |
| Akademik kanıt | Academic evidence | Ana Sayfa'da dört eksenli bölüm (A1). |
| Önerilen metin | Suggested text | Asistanın önerisinin başlığı ("Akademik hâli" yerine). Görev adı ayrıca istemde yazılı. |
| Dayanak | Basis | Yanıtın neye dayandığı. **"Kaynak" denmez**: asistan kaynak önermez. Yanlış okunmasın. |
| Yanıt gösterilmedi | Response withheld | Bugünkü hata mesajının ("…metin gösterilmedi") başlığı. |
| Sıradaki | Next | Telefonda çalışma satırı. Ana Sayfa'daki "Şimdi" notunun aynısıdır. |

**Çakışma — düzeltme önerisi.**
- Bugün iki ayrı kavram İngilizcede aynı adı taşıyor:
  - "Bakılacak" (teslim maddesi durumu) → *Review*;
  - "İnceleme" (Arvo AI panelinin sekmesi) → *Review*.
- İngilizce arayüzde aynı ekranda iki farklı "Review" görünüyor.
- Öneri: "Bakılacak" → **Needs attention**.
- Uygulama metni V4.3'te değişir; bu aşamada değişmedi.

## 7. Kullanılmayacak sözcükler

| Kaçınılan | Neden | Yerine |
|---|---|---|
| "Doğrulandı" (tek başına), "%… güvenilir" | Eksenleri birleştirir (AGENTS.md: kanıt durumları birbirinin yerine geçmez) | Eksen adı + değer: "Künye · dizinlerde eşleşti" |
| "Önerilen kaynak", "Bunu da okuyun" | Asistan kaynak önermez | — |
| "Kabul olasılığı", "Dergiye uygun" | Makale alanı bu hükmü vermez | "Kontrol tarihi" |
