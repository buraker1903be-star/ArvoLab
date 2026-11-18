# P52b-2D — Dosya kimliği ve envanter güvenilirliği

Başlangıç: `design/os5` @ `05182c7` ve yerel denetim commit'i `6ee1aa8`.

Bu turda yapılmayanlar:
- Migration yok.
- Gerçek dosya silinmedi.
- Production/Test'e bağlanılmadı.
- Çöp kutusu ve silme worker'ı uygulanmadı.

Çalıştırılan her şey yerel sentetik yığında (PG17 + storage-api + PostgREST, 127.0.0.1).

## 1. Denetim kanıtları

`denetim/p52b2/` altında:
- `TASARIM-2BC-sertlestirme.md`
- `yaris/yaris.mjs`
- `yaris/oturum.mjs`
- `sonuclar/yaris.json`
- eski 2B/2C belgelerinde yeni belgeye yönlendirme notu

**Raporlama düzeltildi.** Eskiden anomaliyi yeniden üreten negatif senaryo da "GEÇTİ" yazıyordu. Artık her senaryo şunları ayrı taşıyor:
- `tur`: POZITIF / NEGATIF;
- `beklenen` ve `gozlenen`: GÜVENLİ / ANOMALİ;
- `beklentiye_uydu`.

Negatif bir senaryo "beklentiye uydu — yarış yeniden üretildi: bu tasarım GÜVENSİZ" diye yazılır. Veritabanı yoksa düzenek açık hatayla durur; eskiden ilk ifadede asılı kalıyordu.

Bu turda yeni raporlamayla iki kez koşturuldu (PostgreSQL 17.12, READ COMMITTED), ikisinde de aynı sonuç (önceki turda eski raporlamayla iki koşu daha):

| Grup | Senaryolar | Sonuç |
|---|---|---|
| Pozitif (güvenli beklenen) | A1-i3, A1-i4 (ilk tasarım, yalnızca seri sırada), A2-i1…i4, A3-serializable, B2-oneri, B3-nesne-kimligi | **9/9 GÜVENLİ** |
| Negatif (anomali beklenen) | A1-i1, A1-i2, A2-yanlis-tek-ifade, A2-yanlis-stable, A4-kayit-satiri, B1-ilk-tasarim, B1b-isim-ile-bitlemeli, C1-offset | **8/8 ANOMALİ yeniden üretildi.** Bu tasarımlar güvensiz |
| Beklentiye uymayan | — | yok |

## 2. Envanter sayım doğruluğu

**Kök neden.** Storage listelemesi `ORDER BY name LIMIT/OFFSET` ile sayfalıyor. Tarama sırasında sayfa sınırının önüne bir ekleme olursa sınırdaki yol iki kez görünür; bir silme olursa bir yol hiç görünmez. 2A bunları birleştirirken iki şey yapıyordu:
- tekrar eden yolu iki kez sayıyordu;
- atlanan yolu hiç bilmiyordu ve klasörü yine "eksiksiz" sayıyordu.

**Düzeltme** (`lib/depo-envanteri.ts`, `lib/depo-envanteri-tarama.ts`):
- **Örtüşen sayfalar.** k. sayfa `k·(sayfa−1)` ofsetinden okunur ve önceki sayfanın son öğesiyle başlamalıdır. Başlamıyorsa sınırın önünde net bir kayma vardır.
  - Adlar tekil ve sıra deterministik olduğu için bu, tekrar ve atlamanın olduğu durumları tam olarak yakalar.
  - Kararlı çıkan listelemede, listeleme boyunca var olan her yol tam bir kez görülür.
- **Kayan klasör** baştan en çok iki kez yeniden listelenir. Hâlâ kararsızsa:
  - görülen yollar tekilleştirilip sayılır;
  - klasör eksiksiz sayılmaz (`degisen_klasor`);
  - içindeki eksik referans KAYIP değil DOGRULANAMADI olur;
  - ikinci geçişte kararsız liste "yok" değil "bilinmiyor" döner.
- **Aynı yol tek kez sayılır** (`tekrar_ayiklanan`).
- **Raporda yeni alanlar:**
  - `kesin` ve `kesin_degil_cunku`. Varsayılan kesin değildir. Nedenler: nesne üst sınırı, okunamayan klasör, tarama sırasında değişen klasör, referanslar okunamadı, sahipler okunamadı.
  - `nitelik: "yalnizca_aday"`. Rapor hiçbir koşulda silme kararı değildir; 2C her yolu kendi anında, kilit altında yeniden doğrular.
  - Komut, kesin olmayan raporu stderr'de ayrıca uyarır.
- Storage ve referans okuma hataları önceden olduğu gibi DOGRULANAMADI kalır; yeni kesinlik alanı bunları ayrıca "kesin değil" yapar.

### Önce/sonra

**Bellek içi:** Storage'ın listeleme sözleşmesinin birebir taklidi, 2600 nesne (`envanter-once-sonra.mjs`).

| Senaryo | Eski (`05182c7`) | Yeni |
|---|---|---|
| Değişiklik yok | 2600, sorun yok (kesinlik alanı yok) | 2600, `kesin = true` |
| Her ara sayfadan önce önde ekleme | **2 yol iki kez sayıldı**, rapor normal göründü | 0 tekrar, 0 atlanan, `kesin = false`, değişen klasör 1 |
| Her ara sayfadan önce baştan silme | **Tarama boyunca var olan 2 dosya hiç görülmedi**, rapor normal göründü | 0 tekrar, 0 atlanan, `kesin = false`, değişen klasör 1 |

**Gerçek Storage API**, 2500+ nesneli klasör (`denetim/p52b2/kabul.mjs`):
- Eşzamanlı yazar düzeneğin kendisidir: sentetik satırlar ekler ya da siler, senaryo sonunda geri koyar.
- Her senaryoda depo ve tablo özeti öncesi/sonrası aynı çıktı.

| # | Senaryo | Eski | Yeni |
|---|---|---|---|
| E1–E8 | 2A kabulü | 7/8 (E1 yalnızca yeni `kesin` alanını bulamadığı için) | 8/8 |
| E9 | 2. sayfadan önce tek ekleme | **FAIL**: 1 yol iki kez | PASS: yeniden listeleme kararlı, 2515 yol, her biri bir kez, kesin |
| E10 | Sürekli silme | **FAIL**: hep var olan 2 yol görülmedi | PASS: 0 tekrar, 0 atlanan, kesin değil |
| E11 | Sürekli ekleme | **FAIL**: 2 yol iki kez | PASS: 0 tekrar, başlangıçtakilerin hepsi görüldü, kesin değil |
| Toplam | | **7/11** | **11/11** |

**Birim testleri:** 12 yeni test, `tests/unit/depo-envanteri-tutarlilik.test.ts`.
- Saf birleştirme ve 2600 nesneyle eşzamanlı ekleme/silme.
- İkinci geçişte kararsız liste.
- Storage ve referans hatası.

## 3. UUID dosya adı standardı

**Yeni biçim** (`lib/depo-dosya-adi.ts`): `[<önek>-]<zaman>-<uuid>-<güvenli ad>` ya da `…-<uuid>.<uzantı>`.
- Baştaki `<zaman>-` ve sondaki özgün ad ya da uzantı **korunuyor**. Klasör öneki değişmiyor.
- Eski adlı dosyalar olduğu gibi geçerli; hiçbir şey taşınmıyor.

| Akış | Bugünkü ad | Yeniden kullanılabilir mi | Sabit yol gerekiyor mu | Değiştirme davranışı | Veritabanı referansı | Geriye uyumluluk | Karar |
|---|---|---|---|---|---|---|---|
| Kaynak PDF | `<ç>/kaynak-pdf/<16hex>-<uuid>.pdf`, `y-<k>-<uuid>.pdf` | Hayır | Hayır | Yeni yol; eski dosya sahipsizse silinir (P52b-1) | `kaynak_pdfleri.depo_yolu` (önek kısıtı) | — | **Zaten UUID** |
| Belge yükleme | `<k>/<zaman>-<ad>` | **Evet**: aynı ms + aynı ad ikinci yüklemeyi düşürüyor (U1) | Hayır | Değiştirme yok; silme dosyayı da siler | `document_uploads.storage_path`. Görünen ad `file_name` sütununda | Sunucu yalnızca `<k>/` önekine bakıyor; envanter kategorisi aynı; addan okunan bir şey yok | **Geçirildi** |
| İçe aktarma (Word) | `<k>/imports/<zaman>-<ad>` | Evet | Hayır | Geçici: işlenir, silinir | Yok | Sunucu önek ve `.docx` uzantısına bakıyor; uzantı korunuyor | **Geçirildi** |
| Etik belge | `<k>/etik/<zaman>-<ad>` | Evet | Hayır | Geçici: taranır, silinir | Yok | Sunucu yalnızca öneke bakıyor; görünen ad tarayıcıdaki dosya adından | **Geçirildi** |
| ÜAK | `<k>/uak/<zaman>.pdf` | Evet (aynı kişi, aynı ms) | Hayır | Yeni yol; eski dosya silinir (`uak-tablosu.ts`) | `uak_tablolari.depo_yolu` (≤500). Görünen ad `dosya_adi` sütununda | Önek ve uzunluk sağlanıyor | **Geçirildi** |
| Doçentlik | `<k>/docentlik/<giriş>-<zaman>.pdf` | Evet | Hayır | Yeni yol; eski dosya silinir (`scoring.ts`) | `academic_score_entries.belge_yolu`, kısıt `LIKE owner_id||'/docentlik/%'` | Önek kısıtı sağlanıyor; `<giriş>-` öneki korunuyor | **Geçirildi** |
| Kılavuz | `<k>/kilavuz/<zaman>-<ad>` | Evet | Hayır, ama **ad dosya adından okunuyor** | Yeni yol; eski dosya silinir | `calisma_kilavuzu.depo_yolu` | **Risk:** `kilavuzAdi` (`lib/kilavuz-dogrulama.ts`) görünen adı `^\d{10,}-` sonrasından çıkarıyor; yeni biçim UUID'yi kılavuz adına taşırdı. Birim testi bunu gösteriyor | **Öneri:** `kilavuzAdi` UUID'yi de ayıklayacak şekilde, eski ve yeni adla testli, ayrı bir değişiklikte |
| Editör görselleri | `<ç>/editor-images/<zaman>-<ad>`; Word içe aktarma: `<zaman>-word-<n>.<uzantı>` (tek içe aktarmadaki bütün görseller aynı damgayı paylaşıyor) | Evet | Hayır, ama **ad kullanıcıya görünüyor** | Hiç silinmez (kütüphane) | Metindeki bağlantı (`EDITOR_IMAGE_PATH` her adı kabul ediyor) | **Risk:** görsel kütüphanesi depo adını gösteriyor ve seçilen görsele `alt` olarak veriyor (`image-library-dialog.tsx`, `onPick(url, name)`); yeni biçim belgelere UUID'li alt metin yazardı | **Öneri:** alt metni yükleme anındaki özgün addan almak ve kütüphanede öneki ayıklamak, sonra geçiş |
| Dışa aktarma | `<k>/exports/<ç>.docx` | **Bilerek** sabit | **Evet**: her dışa aktarma aynı yola upsert eder (birikmesin diye), service_role ile | Üzerine yazar | Yok | Rastgele ad, eski dosyaların birikmesi demek; silme mekanizması (2C) olmadan yapılamaz | **Değiştirilmedi.** 2C'de kuyruğun dışında; yalnızca hesap silmede |

**Kanıtlar:**
- **Birim**, `tests/unit/depo-dosya-adi.test.ts`, 9 test:
  - biçim;
  - aynı ms + aynı ad: eski biçimde 1000 yükleme tek yola düşüyor, yeni biçimde 1000 ayrı yol;
  - `guvenliAd` kısa adda eski temizlemeyle birebir aynı;
  - geçirilen beş akışın her birinde eski ve yeni yol aynı öneke, aynı kısıta ve aynı envanter kategorisine uyuyor;
  - kılavuzun neden geçirilmediği.
- **Gerçek yerel yığın**, `uuid-uyum.mjs`, 9/9:
  - U1: eski biçim, aynı ms + aynı ad → ikinci yükleme "The resource already exists". Çakışma yeniden üretildi.
  - U2: yeni biçim → ikisi de geçti.
  - U3: beş akışın yeni yolu, oturum açmış kullanıcı olarak depo politikasından geçti.
  - U4: doçentlik kısıt ifadesi yeni yolu kabul ediyor, başka sahibin önekini reddediyor; ÜAK önek ve uzunluk kısıtını sağlıyor.

  Not: yerel yığında `scoring_criteria` boş olduğu için doçentlik kısıtı satır ekleyerek değil, katalogdan okunan ifadesiyle sınandı.

## Değiştirilen dosyalar

**Uygulama:**
- `lib/depo-envanteri.ts`
- `lib/depo-envanteri-tarama.ts`
- `scripts/depo-envanteri.mjs`
- `lib/depo-dosya-adi.ts` (yeni)
- `app/dashboard/documents/document-upload-form.tsx`
- `app/dashboard/editor/[id]/write/import-dialog.tsx`
- `app/dashboard/editor/[id]/etik/etik-belgeleri.tsx`
- `app/dashboard/associate-professorship/belge-satiri.tsx`
- `app/dashboard/associate-professorship/uak-yukle.tsx`

**Test:**
- `tests/unit/depo-envanteri-tutarlilik.test.ts` (12)
- `tests/unit/depo-dosya-adi.test.ts` (9)

**Denetim:**
- `denetim/p52b2/yaris/*`, `TASARIM-2BC-sertlestirme.md`, eski 2B/2C notları
- `denetim/p52b2/kabul.mjs` (E9–E11)
- `denetim/p52b2d/*`

## Regresyon

| Kontrol | Önce (`05182c7`) | Sonra |
|---|---|---|
| tsc | temiz | temiz |
| lint | 0 hata, 2 uyarı | 0 hata, 2 uyarı (aynı iki dosya, bu PR'ın dokunmadığı) |
| check:css / migrations / rakamlar | geçti | geçti |
| test:unit | 2138 | **2159** (+21) |
| test:editor | 112 | 112 |
| test:db | 331 | 331 |
| 2A gerçek Storage kabulü | 8/8 (E1–E8) | 11/11 (E1–E11) |
| Yarış kanıtları | — | pozitif 9/9 güvenli, negatif 8/8 anomali |

## UNVERIFIED

- Barındırılan Supabase Storage'ın listeleme sıralaması. Yerel storage-api v1.11.13'te `storage.search` `ORDER BY name` ile sıralıyor. Örtüşme denetimi sıranın deterministik olmasını gerektiriyor; barındırılan sürüm farklı sıralarsa kayma yanlış alarm verir. Güvenli taraf: kesin değil.
- Yeni adların tarayıcıda çalışması. `crypto.randomUUID` güvenli bağlam ister; kaynak PDF yüklemesi P52b-1'den beri aynı çağrıyı istemcide kullanıyor. Beş ekran bu turda tarayıcıda tıklanarak sınanmadı; yollar birim testinde ve gerçek depo politikasında sınandı.
