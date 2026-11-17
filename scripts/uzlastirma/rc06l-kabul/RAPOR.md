# RC06l kabul raporu — #105 sonrası aday `a0b6834`

17.11.2026. Production HOLD sürüyor. main, Production, paylaşılan Test, PR #96 ve ArvoOS'a dokunulmadı.
Gerçek Resend gönderimi bu onayda yok; Onay K, P9, Auth A1 ve hak iadesi açık.

**Aday SHA: `a0b68349310c268945ffb80888bfd8e3e218ec3d`** (design/os5). Bütün yerel kabul bu SHA'nın temiz checkout'unda koştu.

## Özet

| Alan | Sonuç |
|---|---|
| DOI'li önbellek, iki kullanıcı, soğuk/sıcak | **PASS** |
| DOI'li çelişkili künye (aynı DOI, başka yazar/başlık) | **PASS** |
| **DOI'siz belirsiz eşleşme "doğrulandı" sayılmaz** | **FAIL** (gerçek veride; aşağıda Bulgu 1) |
| Gerçek Crossref/OpenAlex, sonuç yalnızca yerel veritabanında | **PASS**, sınırlamayla (Bulgu 2: OpenAlex 7 aramadan 6'sında 429) |
| Dizine ulaşılamazken hüküm yazılmaz (ilk deneme, vekilsiz) | **PASS** (gözlem) |
| Haiku: geçerli kategori kodları | **PASS** (3 çağrı, 6/6 kod geçerli) |
| Haiku: sunucu şablonları (TR/EN) | **PASS** |
| Haiku: yararlı arama dizeleri | **PASS**, 2 kusurla (Bulgu 3) |
| Haiku: kategori seçiminin doğruluğu | **UNVERIFIED** (güvence değil; ölçüt yok) |
| Eski kayıt otomatik çağrı başlatmaz | **PASS** (sayaç +0) |
| Telefon deseni gerçek tarayıcıda + sunucu doğrulaması | **PASS** |
| Gerçek Resend | **UNVERIFIED** (onay dışı; posta yerel yakalayıcıda) |

Sağlayıcı sayacı: **18 → 21 / 30**. Üç Haiku çağrısı, hepsi ilk denemede 200; yeniden deneme yok, sayaç reddi yok, kayıp yok.

## 1. Birleştirme ve CI

- **PR #105, birleştirmeden hemen önce:**
  - HEAD `1831fb85e3f85944bf726693345207a975f12007`;
  - 3 commit (`92a0e91`, `c8f0b9f`, `1831fb8`);
  - iki `kontrol` işi success: [44142489213/134248722711](https://github.com/buraker1903be-star/ArvoLab/actions/runs/44142489213/job/134248722711), [44142499892/134248753897](https://github.com/buraker1903be-star/ArvoLab/actions/runs/44142499892/job/134248753897).
- **Birleştirme:**
  - Taslak durumu kaldırıldı; yalnızca `design/os5`'e, `expectedHeadSha=1831fb8` ile merge commit (#104 ile aynı yöntem) yapıldı.
  - Aday `a0b6834`; ebeveynleri `6880ddc` + `1831fb8`. Ağaç `2aa91f5e…` PR HEAD'iyle birebir aynı. `main` = `b62bfcf` (değişmedi).
- **Push CI:** `Kontrol` #1043, [run 44143888717](https://github.com/buraker1903be-star/ArvoLab/actions/runs/44143888717), success. Bütün adımlar geçti: tipler, lint, CSS, migration, rakam, birim, DOI runtime, editör, veritabanı.
- **Vercel (GitHub Actions'tan ayrı):** `dpl_GgnqYDLB7DoAe23AXoEZTUYMxN58`, **READY**, `target: null` (Preview; Production değil).

## 2. Temiz checkout, izole şema, derleme

- `git worktree add --detach … a0b6834`, `npm ci`; uygulama ağacı temiz.
- **Şema:** adayın kendi betikleriyle sıfırdan kuruldu (`betikler/kur-sema.sh.txt`, RC06k ile aynı tarif).
  - **sema-ozeti md5 `358efe9cba78d8fd8d83bb8d25dc23bf`.** RC06k ile aynı; #105 şemaya dokunmuyor.
- **`next build`** (yerel yığının JWT'leriyle):
  - **BUILD_ID `oLgdERp2sfry8kRmrpIb1`**; çalışan sunucunun HTML'inde doğrulandı.
  - **server-reference-manifest sha256 `9fee1c6d41fcc3d7c835cc5dfcc96bfb1ea32f0e6b035e77fa53df83ddcf3779`**.
- **`next start`:** adayın kendi başlatıcısıyla, `ONAY=evet ADAY_SHA=a0b6834 bash scripts/uzlastirma/ai-kabul/baslat.sh`.
  - Vekil sınırı 30.
  - Modeller sabit: `claude-sonnet-5` / `claude-haiku-4-5-20251001`.

## 3. Test düzeneği (uygulama kodu DEĞİL; depoya `.txt`)

- **Yakalayıcı** (`betikler/yerel-yakalayici.mjs.txt`), RC06k'dan farklı:
  - `api.resend.com` iletilmez; posta dosyaya yazılır. Uygulamaya `RESEND_API_KEY` olarak yer tutucu bir değer verildi; gerçek anahtar değil, istek dışarı çıkmaz.
  - **Crossref ve OpenAlex gerçek.** İstekler değiştirilmeden iletilir; yalnızca zaman, alan, yol, durum ve süre yazılır (`kanit/onbellek/dizin-istekleri.jsonl`). Yanıt gövdesi yazılmaz.
- **Ortam ağı:** kişisel "ArvoLab Preview testleri" ortamına `api.crossref.org` ve `api.openalex.org` eklendi. Kullanıcı onay kartında kabul etti; ayar ortamda kalıcıdır, kaldırmak kullanıcıya kalmış.
- **Vekil ayarı:** `next start` sürecinde `NODE_USE_ENV_PROXY=1` gerekti.
  - Node'un yerleşik `fetch`'i ortamın HTTPS vekilini kendiliğinden kullanmıyor; Anthropic doğrudan erişim listesinde olduğu için RC06k'da bu hiç görünmedi.
  - İlk koşu bu ayar olmadan yapıldı: bütün dizin istekleri "fetch failed" oldu. Kanıt: `kanit/deneme1-proxysiz/`.
  - Bu, uygulamanın değil test ortamının özelliği; Vercel'de doğrudan ağ var.
- **Kuru koşu:** betikler önce taklitlerle hatasız hâle getirildi.
  - Ayrı bir `next start`, port 3125, anahtarsız.
  - RC06k'nın sentetik Crossref'i ve yerel literatür taklidi (`betikler/taklit-lit.mjs.txt`).
  - Taklit sağlayıcı sayacına ve gerçek dizinlere dokunmaz. Kuru koşu kayıtları yerel veritabanında `taklit` modeliyle duruyor (`kanit/vt-ozet.txt`).
- **Yerel veritabanında temizlik:**
  - kayıt hız sınırı satırları (`auth_rate_limits`, `kayit%`) her sentetik kayıttan önce;
  - gerçek koşudan önce doğrulama önbelleği.
- **Test verisinin bulunması:** veri Crossref'ten salt okunur keşif sorgularıyla seçildi (`kanit/kesif/`, 7 satır).
  - İlk satır vekil tarafından reddedildi (ağ izni öncesi). İkincisi gövdesiz 429 döndü.

## 4. K1 — doğrulama önbelleği (gerçek dizinler, iki kullanıcı)

Künyeler gerçek eserlerden. A ve B ayrı sentetik kullanıcılar; her biri kaynakçasını editöre yazıp "Kaynakçamı denetle"yi çalıştırdı. Sonuçlar uygulamanın kendi `citation_checks` satırından okundu (`kanit/onbellek/k1-onbellek.json`).

- **A:**
  - Leitón (2021) *Editorial*, DOI `10.15517/aie.v21i3.48220`;
  - Heidingsfelder (2021) *Guest editorial*, *Kybernetes*, DOI'siz.
- **B:**
  - Mendes (2021) *Editorial*, DOI `10.68259/raeu-bengo.v2i3.405`;
  - Sohret (2021) *Guest editorial*, *Aircraft Eng.*, DOI'siz;
  - Demir (2021), uydurma başlık + **A'nın DOI'si** (çelişkili künye).

| Adım | Dizin isteği | Leitón | Heidingsfelder | Mendes | Sohret | Demir (A'nın DOI'si) |
|---|---|---|---|---|---|---|
| A soğuk | 5 | verified · kendi DOI'si | **verified · `10.1093/jof/70.7.395`** | | | |
| B soğuk | 8 | | | possible_match · başka DOI (DOI sorgusu 429) | **verified · `10.1093/jof/70.7.395`** | possible_match · A'nın eseri |
| A sıcak | **0** | verified · kendi DOI'si | verified · aynı yanlış eser | | | |
| B sıcak | 6 | | | verified · kendi DOI'si | verified · aynı yanlış eser | possible_match |

- **PASS, DOI'li:**
  - B'nin künyesine A'nın DOI'si ya da hükmü hiç taşınmadı.
  - Mendes'in soğuk koşusunda DOI sorgusu 429 aldı; sonuç "olası eşleşme"de kaldı. Önbelleğe yazılmadı ve PDF satırına DOI geçmedi. Sıcak koşuda yeniden sorulup kendi DOI'siyle doğrulandı.
- **PASS, çelişkili künye:**
  - Demir, A'nın DOI'sini taşısa da "doğrulandı" almadı.
  - A'nın sıcak hükmü bozulmadı; A sıcakta dizine 0 istek gitti.
- **B sıcakta 6 istek:** tasarım gereği. B'nin soğuk sonucu kısmiydi (dizin 429), kısmi sonuçta yalnızca "verified" saklanıyor; kalanı yeniden soruldu.
- **FAIL, DOI'siz (Bulgu 1):** iki farklı yazarın "Guest editorial"ı aynı yanlış esere "doğrulandı".

### Bulgu 1 — DOI'siz genel başlıkta yanlış "doğrulandı" (FAIL)

- **Eşleşen eser:** `10.1093/jof/70.7.395`, *Guest Editorial*, *Journal of Forestry*, **1972**, **yazarsız**.
- **Kök neden:**
  - **Puan:** `scoreCandidate` puanı = başlık × 0,82 + yıl × 0,18. Birebir aynı başlık tek başına 0,82 veriyor (yıl 2021↔1972, yıl puanı 0); bu, "doğrulandı" eşiği olan 0,78'i geçiyor.
  - **Yazar kapısı:** `yazarTutmuyor`, adayda yazar yoksa "bilinmiyor" sayıp kapıyı açıyor.
  - **Sonuç:** her DOI'siz "Guest editorial" künyesi, kimin yazdığından bağımsız olarak, 50 yıl önceki bir ormancılık başyazısına doğrulanıyor ve önbelleğe 90 günlüğüne `verified` yazılıyor (`kanit/vt-ozet.txt`, iki satır).
- **Kapsam:**
  - Önbellek aktarımı değil: anahtarlar ayrı (`v2|heidingsfelder|…`, `v2|sohret|…`), hüküm her künyede yeniden ve yanlış veriliyor.
  - Puanlama #105'ten önce de böyleydi. #105 bunu çözmüyor; #105'in kanıtladığı, yanlış hükmün BAŞKA künyeye önbellekten taşınmaması.
  - Kullanıcının ölçütü ("DOI olmayan belirsiz eşleşmeyi kesin eşleşme sayma") gerçek veride sağlanmıyor.
- **Önerilen düzeltme (uygulanmadı; yeni geliştirme fazı açılmadı):**
  - künyede yıl varken aday yılı ±1 dışındaysa en çok `possible_match`;
  - künyede yazar varken aday yazarsızsa en çok `possible_match`;
  - kabul testi olarak bu iki gerçek künye.
- **Production etkisi:** Production önbelleğinde yeni (`v2`) anahtar yok; düzeltme yayından ÖNCE yapılırsa yanlış satır hiç oluşmaz.

### Bulgu 2 — dizin hız sınırları

- **Ölçüm:**
  - Crossref arama 7/7: 200.
  - Crossref DOI sorgusu: 4 × 200, 1 × 429.
  - OpenAlex arama: **1 × 200, 6 × 429**.
- **Muhtemel neden:** uygulama künye başına Crossref araması, Crossref DOI sorgusu ve OpenAlex aramasını paralel, künyeleri de 4'erli yolluyor. Crossref'in açık havuzu yanıt başlığında eşzamanlılık 1, saniyede 5 diyor. OpenAlex'e istek tanımlayıcısız (mailto/anahtar yok) gidiyor.
- **Etki:** doğruluk korunuyor, kapsam düşüyor.
  - Düşen dizin "kısmi" sayılıyor; "bulunamadı" denmiyor, "ulaşılamadı" deniyor ve önbelleğe yalnızca "verified" yazılıyor.
  - Ama kullanıcı aynı künyeyi yeniden denetlediğinde dizine yeniden gidiliyor; Mendes örneğinde ilk denetimde başka bir eser "olası eşleşme" olarak gösterildi.
- **Öneri (uygulanmadı):**
  - Crossref isteklerini sıraya koymak, kibar havuz için iletişim adresi eklemek;
  - OpenAlex'in güncel erişim koşullarını doğrulamak.
  - Production'daki oranı bilinmiyor (UNVERIFIED).

### Dizine ulaşılamazken (ilk deneme, PASS gözlem)

- Vekil ayarı olmadan bütün dizin istekleri düştü: 4 adımda 9 künye, 26 istek.
- Sonuç her künyede `ulasilamadi` oldu. Önbelleğe hiçbir satır yazılmadı, hiçbir "doğrulandı" verilmedi.
- Kanıt: `kanit/deneme1-proxysiz/`.

## 5. K2 — Haiku literatür yolu (gerçek model)

Sonuçlar ekrandan ve uygulamanın `ai_assistant_runs` satırından okundu (`kanit/literatur/k2-literatur.json`; ham model çıktısı `sonKayit.output`'ta).

| Adım | Sayaç | Ham bulgular (model) | Ekranda | Arama dizesi |
|---|---|---|---|---|
| H1 RC06k sorusu (TR) | +1 (#19) | `tarama_plani`, `kuram_kaynagi_eksik`, `olcek_kaynagi_eksik`, `gri_literatur` | 4 şablon | 6 |
| H2 İngilizce arayüz | +1 (#20) | `tarama_plani` | 1 İngilizce şablon | 6 |
| H3 soruda "Bandura" | +1 (#21) | `tarama_plani` | 1 şablon | 6 |
| H4 eski kayıt (H1 sorusu yeniden) | **+0** | — | 0 bulgu + not | 1 (süzülmüş) |

- **Kodlar PASS:** 6/6 kod geçerli. Model `kod` ve `tur` dışında alan yazmadı; bilinmeyen kod yok.
- **Şablonlar PASS:** ekrandaki her bulgu metni sunucu şablonunun birebir aynısı; İngilizce kullanıcıda İngilizce. Bulgularda hiçbir özel ad, yazar ya da eser yok.
- **Eski kayıt PASS:** H1'in bağlamıyla birebir aynı bağlamda, bu düzeltmeden önceki biçimde (kodsuz, serbest metin, "Peplau & Perlman", "Weiss'i okuyun") bir kayıt yerleştirildi, ardından aynı soru soruldu.
  - "Kayıtlı cevap" + "bir kısmı eski biçimde olduğu için gösterilmiyor" notu çıktı.
  - Serbest bulgular gösterilmedi; `"Hawkley & Cacioppo"` içeren arama dizesi düştü, diğeri kaldı.
  - **Sayaç +0, yeni kayıt 0, hak sayacı artmadı** (`kanit/vt-ozet.txt`).
  - "Önceki sorgularım" listesinde de serbest metin yok.
- **Kategori doğruluğu (UNVERIFIED):** H1'de liste boşken "kuram/ölçek kaynakları eksik" seçildi. Makul, ama şablonlar kategori seçiminin doğru olduğunu garanti etmez; bunu ölçecek bir ölçüt yok.

### Bulgu 3 — arama dizeleri (ayrı yüzey; güvence şablonlardan farklı)

- **Genel:** 18 dizenin çoğu kullanılabilir: tırnaklı kavramlar, parantezli OR grupları, TR/EN karşılıklar.
- **İki kusur:**
  - H1#6 `"e-öğrenme" OR "çevrimiçi öğrenme" AND "yalnızlık" AND "üniversite"`: OR grubu parantezsiz (istemin açık kuralı); veri tabanı bunu `"e-öğrenme" OR (… AND …)` diye okur.
  - H3#6 `… site:tez.yok.gov.tr OR site:trdizin.gov.tr`: Google sözdizimi; YÖK Tez ve TR Dizin arama kutusu bunu anlamaz.
- **Adlar:** H3'te `"Bandura"` arama dizesinde geçiyor. Kullanıcının sorusunda geçtiği için serbest (doğru davranış); modelin kendi eklediği bir ad görülmedi.
- **Değerlendirme:** arama dizeleri **doğrulanmış kaynak önerisi değildir**. Modelin serbest metnidir; yalnızca künye izi ve dar yazar kalıplarından geçer. Sözdizimi ve anlam denetimi yoktur. Bilinen açık ("Weiss" AND "loneliness" geçer) PR #105'te testle sabit.

## 6. Güvencelerin ayrı değerlendirmesi

| | Bulgu şablonları | Arama dizeleri |
|---|---|---|
| Kullanıcının gördüğü metin | Sunucunun sabit TR/EN metni | Modelin serbest metni |
| Yazar/eser önerisi | **Yapısal olarak yok** (gerçek modelde de yok) | Yalnızca dar kalıplar süzülür; tek ad geçer |
| Doğruluk | Kategori seçimi garanti DEĞİL | Sözdizimi ve anlam garanti değil (Bulgu 3) |
| Eski kayıtlar | Kodsuzlar gösterilmez, otomatik çağrı yok | Aynı süzgeç |

## 7. K3 — telefon deseni (Chromium 153, gerçek tarayıcı)

`kanit/telefon/k3-telefon.json`

- **Yeni desen `\+?[\d\s\(\)\.\-]{10,20}`:** konsolda hata yok.
  - Geçerli: `0532 123 45 67`, `+90 (532) 123-4567`, `05321234567`, `0532.123.45.67`.
  - Reddedilen (patternMismatch): `abc1234567890`, `12345`, `0532/123/45/67`.
- **Negatif kontrol, aynı sayfada eski desen:**
  - Konsolda "Pattern attribute value … is not a valid regular expression … /v: Invalid character in character class".
  - Yedi yazımın yedisi de "geçerli" sayıldı; desen yok sayılıyordu.
- **Sunucu:** istemci denetimi kapatılıp (`novalidate`) `((((()))))` gönderildi. "Geçerli bir telefon numarası yazın (10–15 rakam)." döndü, hesap açılmadı.

## 8. Sağlayıcı ve süreçler

| Sıra | Model | Durum | Girdi/çıktı jetonu | Senaryo |
|---|---|---|---|---|
| 19 | claude-haiku-4-5-20251001 | 200 | 1636 / 364 | H1 |
| 20 | claude-haiku-4-5-20251001 | 200 | 1791 / 227 | H2 |
| 21 | claude-haiku-4-5-20251001 | 200 | 1645 / 308 | H3 |

- **Toplam ve maliyet:** 3 istek, toplam **21/30**. Tahmini maliyet yaklaşık 0,01 $ (Haiku 4.5 liste fiyatıyla).
- **Sayaç sürekliliği:** sayaç günlüğü RC06k'nın 18 kayıtlık günlüğünden devam etti (sha256 eşleşti). Vekil iki kez başlatıldı (vekil ayarı için); ikisinde de "önceden iletilen 18" yazdı. İlk denemede sağlayıcıya istek gitmedi.
- **Anahtar:**
  - yalnızca `next start` sürecinin `AI_ANAHTAR`'ındaydı;
  - kabulden sonra `next start` ve vekil kapatıldı, `AI_ANAHTAR` taşıyan süreç kalmadı;
  - kaynak değişken oturum ortamında hâlâ var; silmek ve test anahtarını iptal etmek kullanıcıya kalmış.
- Kanıtlarda `sk-ant`, JWT ya da doğrulama belirteci yok; postadaki `token_hash` karartıldı.

## 9. Açık kalanlar

- **Bulgu 1 (FAIL):** DOI'siz genel başlıkta yanlış "doğrulandı". Yayından önce düzeltilmeli.
- **Bulgu 2:** dizin hız sınırları; Production oranı UNVERIFIED.
- **Bulgu 3:** arama dizesi sözdizimi; bilinen sınır.
- Gerçek Resend, Onay K, P9, Auth A1, hak iadesi: bu onayın dışında.
- Ortam ağı değişikliği (`api.crossref.org`, `api.openalex.org`) kişisel ortamda kalıcı.
