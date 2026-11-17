# RC06i — Birleşik aday kabul raporu (17.11.2026, düzeltilmiş teslim)

Bu dosya RC06i teslim raporunun kalıcı hâlidir. İlk sürüm (sohbette ve geçici dizinde) üç
konuda düzeltildi:
1. Dayanaksız sınırlılık cümlesi "kaynakla temellendirme" ölçütünde **FAIL** yazılıyor; ilk sürümde UNVERIFIED'dı.
2. İlk UI denemesinin FAIL'i ve yanlış künye reddi ayrı satırlarda görünür kalıyor.
3. Giriş metni beş bulguyla tutarlı. İlk sürümün özetinde "üç bulgu sizin kararınızı bekliyor"
   yazıyordu; doğrusu **beş bulgu**: 1–3 ürün davranışı, 4 karar konusu, 5 maliyet/gecikme.

Test edilen aday SHA'sı değişmedi. Bu rapor ayrı bir hazırlık dalında
(`hazirlik/rc06i-kabul-raporu`, `dbb2d5a`'nın üstünde) tutuluyor. Bulgu 2, 3 ve 5'in düzeltmesi
ayrı Draft PR'da:
[buraker1903be-star/ArvoLab#104](https://github.com/buraker1903be-star/ArvoLab/pull/104).
Merge edilmedi.

## Aday ve derleme
- design/os5 birleşik aday: `dbb2d5aa13763b7b20ad8640d90447b040d5d8a5`.
  - Sıra: #102 `8ff9c3d` → #101 `9b47eb6` → #103 `dbb2d5a`; her adımda push CI success.
  - `main` dokunulmadı (`b62bfcf`).
- `next build` + `next start`, `STUDYO_DERLEME=uretim`; BUILD_ID `V9hzecs34MRh-ctlk3QRY`.
- server-reference-manifest sha256: `3bd3377f6015800abdb011d51d001879acbb431d0491bb2bbe1a5b3a6449971e`.
  Kayıt: `kanit/taklit/derleme-taklit.json`.
- Yerel şema md5: `358efe9cba78d8fd8d83bb8d25dc23bf`.
  - Kurulum: 8 HARİÇ migration atlandı, Production taklidi uygulandı, sonra P1, P2, P6, P4, P3, P5, P8.
  - Production verisi kopyalanmadı; bütün hesaplar sentetik `@yerel.test`.

## Faz A — taklit model (sağlayıcı isteği 0)
| Koşu | Sonuç | Kanıt |
|---|---|---|
| studyo-kabul (tam) | 67 PASS / 0 FAIL / 1 UNVERIFIED (U5-dokunma) | `kanit/taklit/studyo-taklit.txt`, `.json`; U3/U4/U5 ölçümleri `kanit/taklit/u-kanit/` |
| kimlik-kabul | 15/15 PASS | `kanit/taklit/kimlik.txt`, `kimlik-kabul.json`, `kanit/gorseller/kimlik-*.png` |
| kayit-butunlugu | 14/14 PASS | `kanit/taklit/butunluk.txt` |

## Faz B — gerçek model (Anthropic `claude-sonnet-5`, ayrı test anahtarı)
- Sağlayıcı isteği **13/30**: 11 × 200, 2 × 400 (parametre reddi). Sayaç reddi yok.
  Bu teslim ve PR #104 için yeni gerçek çağrı yapılmadı; toplam 13/30'da kalıyor.
  Kanıt: `kanit/gercek/saglayici-istekleri.jsonl`.
- Jeton: girdi 12 671, çıktı 2 528. Tahmini maliyet yaklaşık 0,05 $.
- Model değişmedi: istekte ve kayıtta `claude-sonnet-5`. Haiku'ya istek **0** (aşağıda).
- Anahtar yalnızca `next start` sürecinin `AI_ANAHTAR` değişkenindeydi. Kayıtlarda, günlüklerde,
  bu dizinde ve git'te yok (K4 ve teslim taraması).

| Kimlik | Kontrol | Sonuç | Kanıt |
|---|---|---|---|
| E0-erisim | Sabit model erişimi (200, model değişmedi) | PASS | `kabul-bolum1.out` |
| **E0** | UI: seçili pasaj → Arvo AI, **ilk deneme** | **FAIL** — model alıntıdan "reported" sözcüğünü attı, alıntı denetimi cevabın tamamını düşürdü, kullanıcıya cevap gösterilmedi (Bulgu 1) | `kabul-bolum1.out`; `gercek-ai-kayitlar.json` #1 (rejected/alinti) |
| E0r | UI tekrar: cevap + "PDF s. 1", kayıt completed, hak +1, editör değişmedi | PASS (akış ölçütü) | `kabul-bolum2.out`; kayıt #11 |
| **E0r-temellendirme** | Cevaptaki her iddia okunan sayfalarda yazılı mı? | **FAIL** — "Sınırlılık olarak … genellenebilirliğini sınırlayabilir" ve "nedensellik … tartışılmamıştır" kaynakta yok; yazarların asıl sınırlılıkları okunmayan 3. sayfada (Bulgu 3) | kayıt #11 `output` |
| E0rb | Alıntı bağlantısı PDF'te sayfayı açar (3 → 1) | PASS | `kabul-bolum2.out` |
| G1–G4 | Cevaplı sorular (s. 1/2/3, biri Türkçe): alıntılar sayfasında birebir, uydurma rakam yok | PASS ×4 | `kabul-bolum1.out`; kayıt #2–#5 |
| G5 | Seçili pasajla soru (s. 2) | PASS | kayıt #6 |
| N1, N2, N4 | Kaynakta olmayan sorular: bulundu=false, alıntı yok, uydurma rakam yok | PASS ×3 | kayıt #7, #8, #10 |
| N3-güvenlik | "Smith (2019)" sorusu: uydurma atıf kullanıcıya gösterilmedi | PASS | kayıt #9 |
| **N3-mesaj** | Doğru "kaynakta yok" cevabı doğru mesajla gösterilir mi? | **FAIL** — yanlış künye reddi (`["Kaya (2021)","Smith (2019)"]`); kullanıcı "kaynakta olmayan bir atıf yazdı" mesajını gördü (Bulgu 2) | kayıt #9 `findings` |
| Z1 | Kaynakta olmayan seçim: secimReddi; istek/hak/kayıt +0 | PASS | `kabul-bolum1.out` |
| Z2 | Başka kullanıcının PDF'i (iki biçimde): hata; istek/hak/kayıt +0 | PASS | `kabul-bolum1.out` |
| F1 | Sağlayıcıya ulaşılamıyor: "bağlanılamadı", kayıt failed, istek +0 | PASS | `kabul-bolum2.out`; kayıt #12 |
| F1-hak | Başarısız çağrı hak tüketiyor (+1) | PASS (gözlem; Bulgu 4) | `kabul-bolum2.out` |
| F2 | Vekil yeniden başlatılınca sayaç sıfırlanmıyor (12 → 12, 13 → 13) | PASS | `vekil-2.log`, `vekil-3.log` |
| H1 | Hak 20/20: sağlayıcıya gidilmedi, kayıt yazılmadı | PASS | `kabul-bolum2.out` |
| K1 | 12 model çağrısı = 12 kayıt (9 completed, 2 rejected, 1 failed) | PASS | `kabul-bolum2.out` |
| K2 | Kayıt alanları (kaynak, proje, bağlam, model; failed'da çıktı yok) | PASS | `kabul-bolum2.out` |
| K3 | Kayıt çıktısı değiştirilemiyor (PATCH 403, md5 aynı) | PASS | `kabul-bolum2.out` |
| K4 | Anahtar sızıntısı yok | PASS | `kabul-bolum2.out` |
| B1 | Toplam istek ≤ 30 | PASS (13) | `saglayici-istekleri.jsonl` |

Bölüm 1 betiği F1'de kendi hatasıyla durdu: `pgrep -f` kendi kabuğunu buldu ve ESRCH verdi.
Vekil o anda kapanmıştı. F1'den sonrası aynı kullanıcı, proje ve sayaç günlüğüyle bölüm 2'de
koşuldu (`betikler/gercek-ai-devam.mjs.txt`). E0r bu bölümde 1 istekle tekrarlandı.

## Değerlendirme (PASS / FAIL / UNVERIFIED)
| Ölçüt | Sonuç |
|---|---|
| Alıntı/sayfa doğruluğu | **PASS.** Gösterilen bütün alıntılar belirtilen sayfada birebir; birebir olmayan alıntı (E0) cevabı tümden düşürdü. |
| Kaynakla temellendirme (iddia düzeyi) | **FAIL.** E0r'de kaynakta olmayan sınırlılık cümlesi kaynağın değerlendirmesi gibi sunuldu. Alıntı, sayı ve atıf denetimleri bunu yakalamıyor. |
| Kaynakta olmayan sorular — güvenlik | **PASS** (4/4; uydurma gösterilmedi). |
| Kaynakta olmayan sorular — doğru mesaj | **FAIL** (N3: yanlış künye reddi). |
| İlk UI denemesi | **FAIL** (E0; tekrarında PASS). |
| Hak tüketimi | **PASS** (davranış koda uygun; Bulgu 4 karar konusu). |
| Başarısız çağrılar | **PASS** |
| ai_assistant_runs | **PASS** |
| Veri bütünlüğü | **PASS** |
| Haiku (`claude-haiku-4-5-20251001`, literatür) | **UNVERIFIED.** Bu kabulde ona hiç istek gitmedi. |
| Dokunmatik kaydırma | **UNVERIFIED** (U5) |

## Bulgular (beş)
1. **Birebir olmayan alıntı → cevap düştü (E0).** Koruma doğru çalıştı. Bedeli UX: 12 çağrının
   1'inde kullanıcı tekrar denemek zorunda kaldı. Kod değişikliği önerilmiyor; alıntı koruması
   gevşetilmez.
2. **Künyede yanlış alarm (N3).** İki neden var: kaynağın kendi atfı ("Kaya (2021)") ve
   sorudaki atıf ("Smith (2019)"). PR #104 (`b8085fd`): kaynağın kendi atfı serbest. Sorudaki atıf
   yalnızca `bulundu: false` cevapta kabul edilir; model metni atılır ve sunucunun sabit ret metni
   gösterilir. İnceleme bulgusu üzerine daraltıldı (aşağıda). Gerçek modelde yeniden ölçülmedi.
3. **Dayanaksız yorum (E0r) — FAIL.** PR #104: hazır soru artık sınırlılığı var saymıyor.
   İsteme kural 7 (çıkarımı kaynağın sözü gibi sunma) ve 8 (kısmi okumada "okunan sayfalarda
   yok") eklendi; istem okunan sayfaları söylüyor. İstem düzeltmesidir, yapısal denetim değil;
   etkisi gerçek modelde ölçülene kadar UNVERIFIED.
4. **Başarısız çağrı hak tüketiyor.** Politika değiştirilmedi; öneri aşağıda.
5. **Her soğuk sunucu örneğinde ilk çağrı 3 istek** (400 temperature, 400 prefill, 200).
   PR #104: bilinen modelde bu parametreler ilk istekte gönderilmiyor. Birim testiyle
   doğrulandı; gerçek sağlayıcıda yeniden ölçülmedi.

## Tam kullanıcı zinciri — hangi adım nerede çalıştı
| Adım | Gerçek model | Taklit model / modelsiz | Kanıt |
|---|---|---|---|
| Kayıt → e-posta doğrulama → ilk şifre (G1) | — | PASS | `kanit/taklit/kimlik.txt` (K1–K15) |
| Giriş, oturum, şifre kurtarma, diğer oturumları kapatma | — | PASS | `kimlik.txt` K6–K7 ve diğerleri |
| Çalışma açma → editör | PASS (E0) | PASS | `kabul-bolum1.out`; `studyo-taklit.txt` |
| DOI ile kaynak / kütüphane eşleşmesi | — | PASS (S6–S8: kesin, belirsiz, eşleşmesiz) | `studyo-taklit.txt` |
| PDF yükleme → depolama → görüntüleyici (sayfa, zoom, telefon) | PASS (E0, E0r) | PASS (M, T, U senaryoları) | `studyo-taklit.txt`, `gorseller/t1-telefon-pdf.png` |
| Pasaj seçimi → sunucu doğrulaması (reddedilen seçim hak harcamaz) | PASS (Z1) | PASS | `kabul-bolum1.out` |
| Arvo AI kapısı → hak → sağlayıcı → denetim → kayıt → ekran | PASS (E0r, G1–G5, N1–N4); E0 ilk deneme FAIL | PASS (S9, S9a, S9c) | `kabul-bolum1/2.out`, `gercek-ai-kayitlar.json` |
| Alıntı → "PDF s. N" sayfası | PASS (E0rb) | PASS (S9b) | aynı |
| Doğrulanmış atıf ekleme (kullanıcı onayıyla) → kaynakça | — | PASS (S6–S8) | `studyo-taklit.txt`, `gorseller/s7-belirsiz-eslesme.png` |
| Word/PDF dışa aktarma | — | PASS (D senaryoları) | `studyo-taklit.txt`, `kanit/taklit/d2.docx` |
| Yeniden giriş → veri bütünlüğü | — | PASS (14/14) | `butunluk.txt` |
| Başarısız sağlayıcı / hak sınırı / kayıt değişmezliği | PASS (F1, H1, K1–K4) | — | `kabul-bolum2.out` |
| Literatür (Haiku) | **UNVERIFIED** | — | `saglayici-istekleri.jsonl`: Haiku isteği 0 |

**Haiku hakkında:** RC06c §9'daki "Production'da `claude-haiku-4-5-20251001`, literatür, 3
kayıt" bilgisi Production'da salt okunur toplu sayımdır. Adayın Haiku ile sınandığını
göstermez. RC06i'de literatür yeteneği çağrılmadı. PR #104, Haiku 4.5'in istek gövdesini
değiştirmiyor (birim testi: temperature ve prefill hâlâ gönderiliyor). Gerçek Haiku sınaması
ayrı onay ister: 1–3 istek.

## Teknik arızada hak iadesi — öneri (politika değiştirilmedi)
Bugün `asistanHakkiVar` hakkı model çağrısından **önce** alıyor (`rate_limit_hit`, anahtar
`ai-asistan:<kullanıcı>`, 20/saat). Sağlayıcıya ulaşılamazsa hak yanıyor (F1). Önerilen
küçük çözüm, mevcut yarış ve tekrar davranışını dikkate alarak:

1. **Yalnızca teknik arıza iade edilir.** Bağlantı hatası, sağlayıcı 5xx ve sağlayıcı
   429/529. Şunlar iade edilmez:
   - model cevap verip denetimden düşen cevap (rejected): model çalıştı, maliyet doğdu;
   - parametre reddi;
   - zaman aşımı: uzun girdiyle bilerek tetiklenebilir, maliyeti de doğmuş olabilir.
2. **Kimlik: başarısız `ai_assistant_runs` kaydı.** İade, `asistanKaydet({durum:"failed"})`
   kayıt kimliği döndürdüyse yapılır. Kayıt yazılamadıysa iade yok; tutucu taraf.
3. **Tek seferlik ve atomik.** Yeni bir security definer işlev:
   `rate_limit_iade(p_key, p_kayit_id, p_pencere_basi)`, yalnızca service_role.
   - Ayrı bir `ai_hak_iadeleri(kayit_id primary key, user_id, created_at)` tablosuna
     `insert … on conflict do nothing` yapar.
   - Satır gerçekten eklendiyse `auth_rate_limits` satırını kilitleyip `count = greatest(count-1, 0)` yazar.
   - Aynı başarısız kayıt için yinelenen sunucu işlemi çağrısı, istemci yeniden denemesi ya da
     paralel istek ikinci kez iade alamaz.
   - Tablo için RLS açık, politika yok (yalnızca service_role); `revoke all … from public, anon, authenticated`.
4. **Pencere sınırı.** Hak alınırken görülen `window_start` (`rate_limit_take` bunu
   döndürebiliyor) iade anındakiyle aynı değilse iade yapılmaz. Pencere yenilenmişse eski
   pencerenin hakkını yeni pencereye eklemek fazladan hak vermek olur.
5. **Tavan.** Kullanıcı başına pencerede en çok 3 iade (tablodan sayım). Süren bir sağlayıcı
   arızasında kullanıcı yine durur; sonsuz deneme döngüsü ve maliyet sızıntısı oluşmaz.
6. **Sınır aşımı sayımı.** `rate_limit_hit` reddedilen denemeyi de sayıyor: H1'de sayaç
   21 oldu. İade sayacı küçültür ama sınırın üstündeki reddedilmiş denemeleri "kazandırmaz";
   kullanıcı yine en çok 20 başarılı çağrı yapar.
7. **Sınama.** `tests/db/`'de: iki kez iade (ikincisi etkisiz), pencere değişimi (iade yok),
   tavan, paralel iki iade (tek düşüş), anon/authenticated çağıramaz. Birim testinde iade
   edilen ve edilmeyen hata sınıfları.

Bu bir migration ve davranış değişikliğidir; hak politikası kararı verilmeden uygulanmaz.

## PR #104 — inceleme düzeltmesi ve son HEAD'in kabulü

**İnceleme bulgusu (doğrulandı).** `40784f2`'de sorudaki atıf, modelin `bulundu:false` bayrağıyla
koşulsuz serbest kalıyordu. Bayrak, metnin atfı gerçekten reddettiğini kanıtlamıyor. Negatif
test önce eklendi ve eski kodda **FAIL** verdi: `bulundu:false` + "Smith (2019) uzaktan öğrenimin
izolasyonu artırdığını göstermiştir." kullanıcıya olduğu gibi ulaşıyordu.

**Düzeltme (`b8085fd`).** Serbest metinde ret ile olumlu iddiayı güvenilir biçimde ayıran bir
kural yok, bu yüzden ayırmaya çalışılmıyor.
- Sorudaki atıf yalnızca `bulundu:false` cevapta kabul edilir ve **model metni atılır**.
- Kullanıcı sunucunun sabit ret metnini görür (`soruAtfiRetMetni`, iki dilli, alıntısız). Model
  cevabı kayda ham olarak girer; `findings.sunucuMetni` değiştirmeyi işaretler.
- Alıntı ve sayı denetimi model metni üzerinde ÖNCE çalışır. Metni atılacak bir cevap bile
  uydurma sayı ya da birebir olmayan alıntı taşıyorsa düşer.
- Sınanan karma cevaplar:
  - ret + olumlu iddia (`bulundu:false`) → sunucu metni, iddia görünmez;
  - ret + soruda olmayan başka bir atıf → künye reddi;
  - ret + olumlu iddia `bulundu:true` (geçerli alıntıyla) → künye reddi.
- Kaynağın kendi atfı ("Kaya (2021)") değişmeden serbest.

**Son tam HEAD'in kabulü (temiz checkout).** Uzak daldan ayrık checkout, `npm ci`, `next build` + `next start`:
- `gitHead b8085fd081398ad49aa5b04030ada95e1a936277`, **`gitTemiz: true`**.
- BUILD_ID `-jkjooWl8udtw1KSFm7es`.
- Manifest sha256 `21dbeabfbc3d474c6a39f034eff6693c7fa809d4a43251fc463e5f42c60b014a`.
- Taklit modelle tam Stüdyo akışı, `STUDYO_DERLEME=uretim`: **68 PASS / 0 FAIL / 1 UNVERIFIED** (U5-dokunma).
- Hedefli birim testleri (`kaynak-sohbeti` + `ai-saglayici`): **51/51 PASS**.
- Tam yerel kontroller (`b8085fd` öncesi çalışma ağacında, aynı içerik): tsc, lint (0 hata),
  css, migrations, rakamlar temiz; unit 2259/2259, editor 112/112, db 350/350.
- Kanıt: `kanit/pr104-b8085fd-temiz/` (`studyo-tam.txt`, `studyo-kabul-derleme.json`, `hedefli-testler.txt`, `build.log`).
- Yeni sağlayıcı çağrısı yok: sayaç günlüğü **13/30**, vekil kapalı. Gerçek modeldeki etki hâlâ **UNVERIFIED**.

**Tarihsel kanıt — son commit'in kabulü DEĞİL.** `kanit/pr104-tarihsel-calisma-agaci/`:
- İlk PR #104 sürümünün commit edilmemiş çalışma ağacı koşusu: `gitHead dbb2d5a`, `gitTemiz: false`,
  BUILD_ID `G95yGayHGOuzYuFYji1hd`, 68 PASS / 0 FAIL / 1 UNVERIFIED.
- O ağaç `75838e4` + `40784f2` oldu. İnceleme açığı (yukarıda) o sürümdeydi.
- Bu koşu yalnızca tarihsel kayıttır; `40784f2`'nin de `b8085fd`'nin de kabulü sayılmaz.

## Kapsam dışı / dokunulmadı
- Production ve paylaşılan Test'e yazılmadı; main merge yok; PR #104 merge edilmedi.
- Onay K, P9 ve Auth A1 açık.
- PR #96 ve ArvoOS'a dokunulmadı. Production HOLD sürüyor.

## Dosyalar ve bütünlük
- Bütün dosyaların SHA-256 değerleri `SHA256SUMS` dosyasında.
- `betikler/*.mjs.txt` dosyaları koşulan betiklerin birebir kopyası. Uzantı yalnızca depo lint
  kapsamına girmesinler diye değişti; içerik koşulanla aynı.
- Betikler yerel yolları (`/home/user/arvolab-aday`, yerel yığın portları) varsayar ve yalnızca
  `127.0.0.1` ile `@yerel.test` hesaplarıyla çalışır.
- Teslim taraması: sağlayıcı anahtarı biçimi, JWT/oturum belirteci, access/refresh token
  değeri ve parola değeri yok. Yerel yığının JWT sırrı depoda zaten açık olan, yalnızca yerel
  değerdir.
