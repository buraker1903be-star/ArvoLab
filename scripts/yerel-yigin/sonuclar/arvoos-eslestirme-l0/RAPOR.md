# L0 — ArvoOS eşleştirme raporu, yerel kabul (25.11.2026)

`tasarim/tek-deneyim/ENTEGRASYON-PLANI.md` G maddesi (karar K8), uygulama
sırasındaki **0. iş**: ön koşulu yok. Betik **salt okunur**, hiçbir satırı
değiştirmez; dönüşüm plandaki kurala göre kayıt kayıt onayla yapılır ve bu
işin kapsamında değildir.

Taban `main` @ `cfd404a`. Yerel yığın: Postgres 17 + GoTrue + PostgREST,
geçit `127.0.0.1:54401`. Gerçek Supabase projesine, ArvoOS'a ya da AI'ya
gidilmedi. Production ve paylaşılan Test'e hiçbir istek yapılmadı.

Bu kayıtta e-posta, kullanıcı kimliği, kurum kimliği, anahtar ve bağlantı
dizesi **yok**: rapor çıktısı kişisel veri taşıyor ve depo dışına yazılıyor
(betik depo içine yazmayı reddediyor).

## Kabul maddeleri

| # | Sınama | Beklenen | Gözlenen | |
|---|---|---|---|---|
| L0-1 | Boş `arvoos_members` ile tam koşu | Bağlı profillerin hiçbiri olumsuz hüküm almaz | 537 profil okundu · doğrulanabilir 0 · doğrulanamadı **0** · ölçülemedi 42 · kapsam dışı 495 · kapsanan kurum 0 | PASS |
| L0-2 | Eşleşen üyelik (yerel sınama satırı) | `dogrulanabilir / eslesti` | aynı; `baskaKurumdaDa` hayır | PASS |
| L0-3 | E-posta ArvoOS'ta BAŞKA kurumda | `dogrulanamadi / kurum_uyusmuyor` | aynı; `baskaKurumdaDa` **evet** | PASS |
| L0-4 | Kurum kapsamda, e-posta listede yok | `dogrulanamadi / arvoos_listesinde_yok` | aynı | PASS |
| L0-5 | Üç hükmün bir arada sayımı | 1 / 2 / 39 / 495 | aynı (kapsanan kurum 3) | PASS |
| L0-6 | `--anlik` anlık görüntü girişi | ArvoOS kullanıcı kimliği rapora düşer | düştü; kapsam beyanıyla kapsanan kurum 2 | PASS |
| L0-7 | Aynı kurumda aynı e-postayla iki kimlik | `dogrulanamadi / birden_cok_aday`, kimlik boş | aynı | PASS |
| L0-8 | Koruma: `--cikti` depo içinde | reddedilir | `✗ --cikti depo içinde…`, çıkış 1 | PASS |
| L0-9 | Koruma: `--cikti` verilmedi | reddedilir | `✗ --cikti <dizin> gerekli…` | PASS |
| L0-10 | Koruma: yerel olmayan adres, onay yok | reddedilir, bağlanmadan | `✗ Adres yerel değil…` (istemci hiç kurulmadı) | PASS |
| L0-11 | Koruma: adres/anahtar eksik | reddedilir | `✗ SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.` | PASS |
| L0-12 | Salt okunurluk: GET/HEAD dışı istek | ağa ÇIKMADAN reddedilir | POST/PATCH/PUT/DELETE reddedildi, iç `fetch` hiç çağrılmadı (birim testi sayaçla doğruluyor) | PASS |
| L0-13 | Salt okunurluk: tam koşu sonrası veri | tek satır değişmez | `profiles` + `arvoos_members` + `academic_projects` md5 özeti koşu öncesi/sonrası AYNI (iki ayrı koşuda) | PASS |
| L0-14 | Sınama satırları temizlendi | yerel veri başlangıç durumuna döner | `arvoos_members` 0 satır (başlangıç da 0); temizlik sonrası koşu **ilk koşunun sayılarını birebir** verdi: 537 · 0 / 0 / 42 / 495, kapsanan kurum 0 | PASS |

## Rol önerisinin dayanağı (25.11.2026, incelemede çıkan düzeltme)

İncelemede `rolOnerileri` ile `atamaOnerileri` arasında bir asimetri görüldü:
atama önerisi dayanağını (`atananinBagi`) taşıyordu, rol önerisi taşımıyordu.
Bağı "doğrulanamadı" ya da "ölçülemedi" olan bir personel, kayıt kayıt
onaylayan kişinin önüne bu bilgi OLMADAN düşüyordu; ayrıca `organization_id`'si
NULL olan personel rollü hesaplar da `is_yetkisi` önerisi alıyordu.

Düzeltme: `rolOnerileri` artık bağ hükümlerini alıyor, `rol-onerileri.csv`
`bagi` sütunu taşıyor ve kurumu olmayan personel `oneri: "yok"` alıyor.

| # | Sınama | Beklenen | Gözlenen | |
|---|---|---|---|---|
| L0-15 | Kurumlu personel, bağı doğrulanmış | `is_yetkisi` + `bagi=dogrulanabilir` | aynı | PASS |
| L0-16 | Kurumlu personel, e-posta kapsanan kurumun listesinde yok | `is_yetkisi` + `bagi=dogrulanamadi` | aynı | PASS |
| L0-17 | Kurumlu personel, kurumu için ArvoOS verisi yok | `is_yetkisi` + `bagi=olculemedi` | aynı | PASS |
| L0-18 | Kurumu olmayan personel | `oneri=yok` + `bagi=kapsamda_degil`, iş yetkisi önerisi ALMAZ | aynı | PASS |
| L0-19 | Hüküm satırı bulunmayan profil | `bagi=profil_yok` (sessizce geçmez) | aynı (birim sınaması) | PASS |
| L0-20 | `raporla` bağlantısı | hükümler bir kez hesaplanıp hem atama hem rol tablosuna geçer | aynı; kopsa her satır `profil_yok` olurdu | PASS |

Dördü (L0-15…18) yerel yığında **uçtan uca** da üretildi: üç profilin rolü
geçici olarak `employee`/`controller` yapıldı, rapor koşuldu, CSV sütunları
görüldü, sonra roller `client`'a ve `arvoos_members` 0 satıra geri alındı.
Geri alma kanıtı: üç tablonun md5 özeti yine `50cf0209…` ve koşu ilk koşunun
sayılarını birebir verdi (537 · 0 / 0 / 42 / 495, kapsanan kurum 0, rol
önerisi 0).

Öneri, hüküm olumsuz diye DÜŞMÜYOR — karar insanın; hüküm satırda görünüyor.
`OZET.md` ayrıca "bağı doğrulanmamış İŞ YETKİSİ önerisi" sayısını veriyor ve
önerisi "yok" olan satırları bu sayıya katmıyor.

## Çıktı yolu denetimi (25.11.2026, incelemede çıkan P2)

Depo sınırı `process.cwd()` ile ölçülüyordu. `cwd` ÇAĞIRANIN dizini, deponun
kökü değil: `scripts/` içinden `--cikti ../gizli-rapor` verildiğinde hedef
`<depo>/gizli-rapor` oluyor ama denetim `scripts/`'e göre baktığı için
geçiyordu. **Düzeltmeden önce ölçüldü:** alt dizinden koşulan bu komut
denetimi geçti ve akış veritabanı okumasına kadar geldi; bağlantı olsaydı
e-posta ve kimlik taşıyan rapor depo içine yazılacaktı.

Düzeltme: kök **betiğin kendi konumundan** hesaplanıyor
(`dirname(fileURLToPath(import.meta.url))`'ın üst dizini, realpath'li) ve
hedef **gerçek yoluyla**, dizin OLUŞTURULMADAN ÖNCE karşılaştırılıyor.
`gercekYol` var olan en yakın atayı realpath'liyor, kalan parçayı ona
ekliyor ve son parça bağlantıysa — hedefi kırık olsa bile — onu da çözüyor;
döngüde derinlik sınırı kesiyor. Sınır `path.sep` ile, yani `<kök>-yedek`
içinde sayılmıyor. Kök altında `package.json` yoksa betik duruyor: kökü
bilemediğimiz yerde koruma anlamsız, açık kalmasına izin verilmiyor.

| # | Sınama | Beklenen | Gözlenen | |
|---|---|---|---|---|
| L0-21 | `scripts/` içinden `--cikti ../gizli-rapor` | reddedilir | `✗ --cikti depo içinde: <depo>/gizli-rapor`, çıkış 1 (düzeltmeden önce GEÇİYORDU) | PASS |
| L0-22 | `scripts/` içinden depo DIŞINDA geçerli hedef | çalışır | canlı yerel yığında dört dosya yazıldı, çıkış 0, 537 profil | PASS |
| L0-23 | Depo içini gösteren sembolik bağlantı (hedefi YOK) | engellenir, gerçek yol yazılır | `✗ --cikti depo içinde: <depo>/sizdiran`, çıkış 1 | PASS |
| L0-24 | Henüz oluşturulmamış derin hedef | var olan atasına göre çözülür | aynı (birim sınaması) | PASS |
| L0-25 | Hedefi VAR olan bağlantı | çözülür | aynı | PASS |
| L0-26 | Bağlantı döngüsü | sonsuza gitmez | derinlik sınırı kesti | PASS |
| L0-27 | `<kök>-yedek` sınırı | içinde SAYILMAZ | aynı | PASS |

L0-21/22/23 regresyon testinde betiği `scripts/` dizininden gerçekten
koşturuyor (`spawnSync`, ölü bir YEREL veritabanı adresiyle; ağ gerekmiyor).
Üç koşunun hiçbiri depoya dosya bırakmadı.

### L0-1'in anlamı

42 bağın "ölçülemedi" çıkması kusur değil, kuralın kendisi: ArvoOS üye
listesi kurum lisansı kapanınca SİLİNİYOR (`arvoos_members`,
20260924100011), yani boş liste "bu kişi üye değil" demez. Hüküm
"doğrulanamadı" olsaydı rapor, onaylayan kişiye var olan kurum bağlarını
kaldırtırdı. Aynı kural ürünün erişim kapısında da böyle
(`lib/license-decision.ts`): kapıyı yalnızca net bir "hayır" kapatır.

### Yansıma listesinin yapısal sınırı

`arvoos_members.email` birincil anahtar: bir e-posta yalnızca bir kurumda
durabiliyor. Bu yüzden `baskaKurumdaDa` ve `birden_cok_aday`, yansıma
listesiyle çalışırken **yapısal olarak** üretilemez; ikisi de yalnızca
`--anlik` anlık görüntüsüyle görülebilir (L0-3 kurum uyuşmazlığını yansımayla
üretti çünkü orada iki AYRI e-posta kullanıldı; L0-7 anlık görüntüyle).

### Bulgu: teknik yetki önerisi bugün boş

Asistan Kayıtları sayfasının kapısı `KAYIT_ROLLERI` ve o küme yalnızca
`system_admin` + `founder` (`lib/ai/kayit-gorunum.ts`). Yani C maddesi
(teknik yetki, K3) geldiğinde **taşınacak mevcut bir hak yok**: bugün o
sayfayı iç ekip dışında kimse açamıyor. `rolOnerileri` bunu bir testle
sabitliyor; kapı başka bir role açılırsa test düşer.

## Zorunlu kontroller

CI (`.github/workflows/ci.yml`) **dokuz** adım koşuyor; `AGENTS.md`
sekizini sayıyor, `npm run test:doi-runtime` listede yok. Dokuzu da koşuldu.

| Kontrol | Sonuç |
|---|---|
| `npx tsc --noEmit` | PASS (çıkış 0) |
| `npm run lint` | PASS (çıkış 0, uyarı yok) |
| `npm run check:css` | PASS |
| `npm run check:migrations` | PASS |
| `npm run check:rakamlar` | PASS |
| `npm run test:unit` | PASS 3034/3034 |
| `npm run test:doi-runtime` | PASS 29/29 |
| `npm run test:editor` | PASS 150/150 |
| `npm run test:db` | PASS 367/367 |

## Kapsam dışı (bu işte yapılmadı)

- **Production ve paylaşılan Test'te koşturma.** Betik yerel olmayan adresi
  reddediyor; servis anahtarıyla uzak okuma ayrı bir karar
  (`ARVOOS_ESLESTIRME_UZAK_ONAYI`). Production HOLD yürürlükte.
- **ArvoOS tarafının doğrulanması.** ArvoOS deposu bu oturumun GitHub
  kapsamında değil; `--anlik` biçimi plandaki sözleşmeden (§3 A, §2) yazıldı
  ve gerçek bir ArvoOS çıktısına karşı sınanmadı: **UNVERIFIED**.
- **L1 ve sonrası** (kimlik bağı tablosu, `arvoos_uyelik_esitle`,
  `profiles.kurum_bagi_kaynagi`). L0 yalnızca rapor verir.
