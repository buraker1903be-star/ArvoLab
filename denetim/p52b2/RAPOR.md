# P52b-2A — Depo envanteri (salt okunur)

Başlangıç: `design/os5` @ `fbaf4f0`.
- Migration yok, dosya silinmedi, veritabanı satırı değişmedi.
- Production ya da Test'e bağlanılmadı.
- Tasarımlar ayrı belgelerde, **uygulanmadı**:
  - [`TASARIM-2B-cop-kutusu.md`](TASARIM-2B-cop-kutusu.md)
  - [`TASARIM-2C-silme-kuyrugu.md`](TASARIM-2C-silme-kuyrugu.md)

## Ne eklendi

| Dosya | Ne |
|---|---|
| `lib/depo-envanteri.ts` (saf) | Yol çözümü (kategori + sahip klasörü), nesne ve referans sınıflandırması, ikinci doğrulama kararları, metindeki görsel bağlantıları, yalnızca sayı içeren rapor, salt okunurluk ve yerel adres denetimi |
| `lib/depo-envanteri-tarama.ts` | Tarayıcı. Depo ve veritabanı okuyucuları dışarıdan verilir; bu arayüzlerde **hiçbir yazma yöntemi yok**. Sayfalama, istek aralığı (kota), üstel geri çekilme, iki geçiş, nesne üst sınırı |
| `scripts/depo-envanteri.mjs` | Komut (`npm run envanter:depo`). Yalnızca 127.0.0.1/localhost'a bağlanır. Fetch, GET/HEAD ve Storage listeleme dışındaki her isteği ağa çıkmadan reddeder. Çıktı yalnızca sayıdır |
| `tests/unit/depo-envanteri.test.ts` | 17 birim testi (CI'da) |
| `denetim/p52b2/kabul.mjs` | Gerçek Storage API + Postgres 17 + sentetik veriyle 8 kabul senaryosu (CI'da değil, Docker ister) |

## Dosya yaşam döngüsü envanteri

| Kategori | Yol | Sahip klasörü | Referans | Yazan / silen |
|---|---|---|---|---|
| kaynak-pdf | `<çalışma>/kaynak-pdf/…` | çalışma | `kaynak_pdfleri.depo_yolu` | Otomatik bulma / yükleme. Değiştirmede eski dosya sahipsizse silinir (P52b-1). **Çalışma silinince dosya kalır.** |
| editor-images | `<çalışma>/editor-images/…` (eski: `<kullanıcı>/…`) | çalışma ya da kullanıcı | Metindeki bağlantı (güncel metin + sürümler) | Editör ve Word içe aktarma yükler. Görsel kütüphanesi klasördeki her dosyayı sunar. **Hiçbir yolda silinmez.** |
| imports | `<kullanıcı>/imports/…` | kullanıcı | Yok (geçici) | Word içe aktarma dosyayı işler, sonra siler. Akış yarıda kalırsa dosya geride kalır. |
| belge | `<kullanıcı>/<zaman>-<ad>` | kullanıcı | `document_uploads.storage_path` | Belge yükleme. Silme eylemi dosyayı da siler. **Çalışma silinince satır kaskatla gider, dosya kalır.** |
| kilavuz | `<kullanıcı>/kilavuz/…` | kullanıcı | `calisma_kilavuzu.depo_yolu` | Değiştirmede eski dosya silinir. |
| uak | `<kullanıcı>/uak/…` | kullanıcı (yükleyen) | `uak_tablolari.depo_yolu` (kurum) | Değiştirmede eski dosya silinir. |
| docentlik | `<kullanıcı>/docentlik/…` | kullanıcı | `academic_score_entries.belge_yolu` | Değiştirmede eski dosya silinir. |
| etik | `<kullanıcı>/etik/…` | kullanıcı | — | Çözümlenir, sonra silinir. |
| exports | `<kullanıcı>/exports/<çalışma>.docx` | kullanıcı | — | Word dışa aktarma üzerine yazar. |

Hesap silme cron'u kullanıcının klasörünü ve **o an sahibi olduğu** çalışmaların klasörlerini siler. Önceden silinmiş çalışmaların klasörlerini bulamaz.

## Sınıflandırma mantığı

Dört sınıf var. **Emin olunamayan her durum DOGRULANAMADI'dır**; ADAY_YETIM hiçbir durumda varsayılan olarak verilmez.

1. **Yol tanınmıyorsa** (kimlik değil, `..`, boş bölüm, bilinmeyen alt klasör) → DOGRULANAMADI `bilinmeyen_kalip`.
2. **Referansı varsa** → SAHIPLI. Referanslar okunamadıysa → DOGRULANAMADI `referans_okunamadi`; bu, sahibi gitmiş nesneler için de geçerli.
3. **Sahibi okunamıyorsa** → DOGRULANAMADI `sahip_okunamadi`.
4. **Sahibi yoksa** (çalışma ya da profil satırı yok):
   - yaş bilinmiyorsa → DOGRULANAMADI;
   - yaş eşiğinin (varsayılan 24 saat) altındaysa → DOGRULANAMADI `taze`;
   - değilse → aday ADAY_YETIM `sahip_yok`.
5. **Sahibi varsa:**
   - editor-images → SAHIPLI `kutuphane` (metinde geçmese de kütüphanede kullanılabilir);
   - imports → eskiyse aday `gecici_eski`, tazeyse DOGRULANAMADI;
   - kaynak-pdf / belge → eskiyse ve referansı yoksa aday `referanssiz`;
   - kilavuz / uak / docentlik / etik / exports → DOGRULANAMADI `kapsam_disi`. 2A bu kategorileri kurala bağlamadı; başka kullanıcının dosyası aday olmaz.
6. **İkinci doğrulama** (varsayılan 60 sn sonra), her yetim adayı için:
   - nesnenin klasörü yeniden listelenir;
   - yol için referans yeniden sorulur;
   - sahip yeniden okunur.

   Bu arada bağlanan, sahibi geri gelen ya da silinen nesne aday listesinden düşer. Herhangi bir okuma hatası → DOGRULANAMADI.

**Kayıp adayı:** Veritabanı gösteriyor, depo göstermiyor.
- "Yok" yalnızca nesnenin klasörü **eksiksiz** listelendiyse söylenir. Yarım ya da düşen listeleme → DOGRULANAMADI `klasor_okunamadi`.
- HEAD (`exists`) kullanılmıyor. Storage API, dosya yokken de, jeton geçersizken de aynı 400'ü veriyor (P52b-1).
- İkinci geçişte nesne yeniden aranır ve referans yeniden sorulur.

**Rapor yalnızca sayıdır:**
- toplam dosya ve bayt;
- sınıf başına adet ve bayt;
- aday kayıp;
- kategori ve sebep dağılımı;
- okunamayan klasör sayısı;
- istek sayaçları.

`--ayrinti <dosya>` verilirse her karar için yolun SHA-256 özeti (16 hane), kategori ve sınıf yazılır; yol yine yazılmaz.

## Test sonuçları

**Birim (CI): 17/17.**
- Yol çözümü ve sınıflandırma tablosu.
- Taze ve yaşı bilinmeyen nesne asla aday olmuyor.
- Başka kullanıcının dosyası asla aday olmuyor.
- Okunamayan referans ya da sahip → DOGRULANAMADI.
- İkinci doğrulama:
  - araya bağlanan nesne sahipli sayılıyor;
  - sahibi geri gelen nesne sahipli sayılıyor;
  - silinen nesne düşüyor.
- Kayıp yalnızca içeriği bilinen klasörde. Bilinen klasör ya kendisi eksiksiz listelenmiş, ya da üst klasörü eksiksiz listelenmiş ve kendisi orada hiç görünmemiş (kesin boş) olandır. Üst klasörü okunamayan referans DOGRULANAMADI kalır.
- Sayfalama: 2500 nesne → 3 sayfa; istekler arası bekleme.
- 429 sonrası üstel geri çekilme.
- Kalıcı hata alan klasörün içindeki referans kayıp sayılmıyor.
- Storage kapalı → aday yok.
- Nesne üst sınırı → rapor "yarım" diyor, kayıp üretilmiyor.
- Rapor yol ya da kimlik içermiyor.
- Salt okunur istemci ve yerel adres denetimi.

**Kabul (gerçek Storage API + PG17, sentetik): 8/8.**

| # | Senaryo | Sonuç |
|---|---|---|
| E1 | Uçtan uca: 2514 dosya (14 tohum + 2500) | SAHIPLI 2504, ADAY_YETIM 7, DOGRULANAMADI 3, aday kayıp 2. Her sebep beklendiği gibi; rapor kimlik içermiyor |
| E2 | Sayfalama: 2500 nesnelik klasör, sayfa = 1000 | Eksiksiz sayıldı |
| E3 | Dosya ilk geçişte referanssız, ikinci geçiş beklemesinde bağlanıyor | SAHIPLI `ikinci_geciste_referansli`; yetim sayılmadı |
| E4 | Storage tamamen kapalı (ağ hatası, yeniden denendi) | 0 dosya, 0 aday, 5 referans DOGRULANAMADI |
| E5 | Bir klasör kalıcı 403 veriyor | İçindeki 2 referans DOGRULANAMADI; öteki klasördeki 1 kayıp yine bulundu |
| E6 | Art arda iki tarama | Aynı rapor |
| E7 | Salt okunur istemciden silme ve güncelleme | İstek ağa çıkmadan reddedildi |
| E8 | Uzak adres; komut çıktısı | Uzak adres reddedildi; komut çıktısı kimlik içermiyor ve geçerli JSON |

Kabul düzeneği art arda iki kez koşturuldu, ikisinde de 8/8. Her koşu yerel yığındaki önceki sentetik veriyi temizleyerek başlıyor.

İlk tekrar koşusu bir eksiği ortaya çıkardı: klasörü depoda hiç olmayan bir referans "kayıp" yerine "okunamadı" sayılıyordu. Sonuç güvenli taraftaydı ama yanlıştı. "Kesin boş klasör" kuralıyla düzeltildi ve birim testiyle sabitlendi.

Her kabul senaryosundan sonra depo nesnelerinin ve beş tablonun özeti karşılaştırıldı: **değişmedi.**

Kontroller: tsc temiz, lint 0 hata, check:css / check:migrations / check:rakamlar geçti. Unit 2137/2137, editor 112/112, db 331/331.

**Kısmi okumada sayım dışı kalan nesneler:** Okunamayan bir klasörün nesneleri toplam dosyaya girmez; rapor bunu `okunamayan_klasor` ile bildirir. Toplam "en az" anlamına gelir.

## 2A'da çalıştırılmayan kabul kriterleri

Bunlar tasarımda kabul ölçütü olarak duruyor:
- proje silme ve geri yükleme;
- yükleme ile silme isteğinin aynı anda gelmesi;
- çalışma silindikten sonra geç gelen yükleme;
- temizlik worker'ının yeniden başlatılması;
- çift worker ile idempotentlik.

Bunlar silme mekanizması gerektiriyor ve o mekanizma onay bekliyor. Ayrıntı için 2B ve 2C belgelerine bakın.

## UNVERIFIED

- **Barındırılan Supabase Storage:** listeleme yanıt biçimi (`id: null` klasör, `metadata.size`, `created_at`) yerel storage-api v1.11.13 ile ölçüldü.
- **Production ölçeği:** komut Production'da çalıştırılmadı (kural gereği). Gerçek bir tarama ayrı onay, salt okunur bir anahtar ve yerel adres korumasının bilinçli olarak değiştirilmesini gerektiriyor.
