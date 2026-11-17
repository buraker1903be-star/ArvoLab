# RC06k — #104 sonrası birleşik aday: gerçek sağlayıcı kabulü ve tam kullanıcı zinciri (17.11.2026)

Bu rapor, kullanıcının onayladığı sınırlı kapsamın teslimidir: #104'ün design/os5'e birleştirilmesi, yeni adayın
izole yerel kabulü, gerçek sağlayıcı senaryoları ve tek kullanıcıyla tam zincir. Production, paylaşılan Test,
main, PR #96 ve ArvoOS'a dokunulmadı. Onay K, P9, Auth A1 ve hak iadesi bu onayın dışında; Production HOLD sürüyor.

## 1. Birleştirme ve aday
- **#104 HEAD doğrulandı:** tam olarak `1a7ffadb82396cfd7a07cc6cd1fd72e29ce3f168`.
  - PR CI: `kontrol` ×2 success, Vercel Preview success, `mergeable_state: clean`.
  - Kapsam onaylanan 6 dosya; değişmedi.
- **Birleştirme:** yalnızca `design/os5`'e, `merge` yöntemi ve `expectedHeadSha` ile.
- **Yeni aday: `6880ddc846c09ad82ea4e39f447ae118676f4ed2`.**
  - Ağacı `1a7ffad` ile birebir aynı.
  - `main` dokunulmadı: `b62bfcf`.
- **Push CI:** `Kontrol` #1035 (`6880ddc`) **success**. Tam kontroller (tsc, lint, css, migration, rakam, unit, editor, db) bu koşuda çalıştı.
- **Vercel:** `dpl_FRV3LggV4ZsyBCCZGqGyG3rE4ScY`, **READY**, `target: null` (Preview; Production değil).

**Kontrollerin uygulandığı commit:**
- CI: PR başında `1a7ffad`, birleşik adayda `6880ddc`; ikisi de success.
- Yerel kabul (bu rapor): `6880ddc`'nin temiz checkout'u.

## 2. Temiz checkout, izole şema, derleme
- Ayrık temiz checkout: `6880ddc`, `npm ci`, ağaç temiz.
- Şema adayın kendi betikleriyle sıfırdan kuruldu (`kanit/aday/`, betik `betikler/kur-sema.sh.txt`):
  - `kur-depo.sh` (8 Production dışı migration hariç);
  - `00-production-taklidi.sql`;
  - P1, P2, P6, P4, P3, P5, P8.
- **Şema özeti (sema-ozeti.sql çıktısının md5'i): `358efe9cba78d8fd8d83bb8d25dc23bf`**. RC06i adayıyla birebir aynı; #104 şemaya dokunmuyor.
- `next build`:
  - **BUILD_ID `Rxq7qCW2B8-KVmo9bRMtT`**; sunucunun HTML'inde doğrulandı.
  - **server-reference-manifest sha256 `4876f90a031e983c640e006242e31d9e5070671cd73680bcf322804f6b11a1a2`**.
- `next start`, adayın kendi başlatıcısıyla: `scripts/uzlastirma/ai-kabul/baslat.sh`, `ADAY_SHA=6880ddc`, sabit modeller.

## 3. Test düzeneği (uygulama kodu DEĞİL; depoya `.txt` olarak kanıt)
Zincirin sentetik kalması ve dışarı sızmaması için yalnızca yerel düzenek kullanıldı:
- **Yerel e-posta yakalayıcı** (`yerel-yakalayici.mjs`). `next start` sürecine `NODE_OPTIONS=--import` ile yüklendi; aşağıdaki alan adlarından hiçbirine istek **iletmez**:
  - `api.resend.com` → posta dosyaya yazılır;
  - `api.crossref.org` → yalnızca `10.5555/` test önekine sentetik künye döner;
  - `api.openalex.org` → boş sonuç;
  - `doi.org` → 404.
  Diğer her istek (yerel Supabase, sayaç vekili) olduğu gibi geçer.
- **CORS'lu ağ geçidi kopyası** (`gecit-cors.mjs`). Asıl `gecit.mjs`'te CORS yok, bu yüzden tarayıcıdan "PDF yükle" yerelde düşüyordu. Barındırılan Supabase'in önündeki Kong buna CORS ile izin veriyor. Kopya yalnızca CORS başlıkları ekler.
- **Yerel veritabanında temizlik.** Koşudan önce:
  - geliştirme denemelerinin doldurduğu kayıt hız sınırı sayaçları sıfırlandı;
  - doğrulama önbelleği (`kaynak_dogrulama_onbellegi`) temizlendi; sebebi Bulgu 2.
- **Betikler önce taklit modelle hatasız hâle getirildi.** Taklit model sağlayıcı sayacına dokunmaz. Gerçek koşu tek seferde yapıldı.

## 4. Gerçek sağlayıcı
- **Sayaç:** RC06i'nin 13 kayıtlık günlüğü birebir kopyalandı (sha256 eşleşti); vekil "önceden iletilen 13" ile açıldı.
- **Bu koşuda 5 istek; toplam 18/30.** Yeniden deneme yok, sayaç reddi yok.
- **Model:** `claude-sonnet-5` ve `claude-haiku-4-5-20251001`. Başka modele geçilmedi.
- **Maliyet:** yaklaşık 0,029 $.
- **Anahtar:** yalnızca `next start` sürecinin `AI_ANAHTAR` değişkenindeydi; kaynak değişken ve `OPENAI_*` o süreçte yoktu. Kabulden sonra `next start` ve vekil kapatıldı; `AI_ANAHTAR` taşıyan süreç kalmadı.

| Sıra | Model | Durum | Girdi/çıktı jetonu | Senaryo |
|---|---|---|---|---|
| 14 | claude-sonnet-5 | 200 | 1689 / 452 | Zincir: sınırlılığı olmayan pasajın analizi (soğuk başlangıcın ilk çağrısı) |
| 15 | claude-sonnet-5 | 200 | 1517 / 167 | K1: künye ("Smith (2019)") |
| 16 | claude-sonnet-5 | 200 | 1620 / 199 | L1: sınırlılık sorusu, seçimli (okunan s. 1–2) |
| 17 | claude-sonnet-5 | 200 | 1520 / 137 | L2: sınırlılık sorusu, tüm sayfalar (pozitif kontrol) |
| 18 | claude-haiku-4-5-20251001 | 200 | 1245 / 1123 | H1: literatür tarama yolu |

## 5. Sonuçlar (PASS / FAIL / UNVERIFIED)
| Ölçüt | Sonuç | Kanıt |
|---|---|---|
| Soğuk başlangıçta gereksiz parametre 400'leri | **PASS.** Yeni `next start` sürecinin ilk Sonnet çağrısı tek istek ve 200 döndü. RC06i'de aynı ilk çağrı 400, 400, 200 idi. Haiku da tek istek ve 200. | `kanit/saglayici/saglayici-istekleri.jsonl` (sıra 14–18) |
| Künye yanlış alarmı (K1) | **PASS.** Cevap `completed` oldu, künye reddi yok. Kaynağın kendi atfı "Kaya (2021)" ve sorudaki "Smith (2019)" artık alarm üretmiyor. | `z2-sonuclar.json` K1 |
| Güvenli ret metni (K1) | **PASS.** Kullanıcıya gösterilen: "Bu atıf (Smith (2019)) hakkında okunan sayfalarda doğrulanabilir bilgi bulunamadı." Modelin ham metni kayıtta duruyor, ekrana girmedi; `findings.sunucuMetni = soru_atfi`. | `z2-sonuclar.json` K1, `vt-ozet.txt` |
| Sınırlılığı olmayan pasaj: dayanaksız yorum yok (zincir) | **PASS.** "Okunan sayfalarda yazarların açıkça belirttiği bir sınırlılık ifadesi yoktur." Her iddia s. 1–2'de geçiyor; RC06i'deki "genellenebilirlik / nedensellik" türü çıkarım yok. | `z1-ai-ekran.txt` |
| Okunan sayfalarla sınırlı cevap (L1) | **PASS.** "Okunan sayfalarda (1 ve 2) … sınırlılık … yok"; uydurma alıntı yok. İstem `OKUNAN SAYFALAR: 1, 2 (kaynak 3 sayfa…)` satırını taşıyor. Son cümle ("okunmayan 3. sayfada yer alıyor olabilir") bir olasılık notu; iddia olarak sunulmadı. | `z2-sonuclar.json` L1 |
| Pozitif kontrol (L2) | **PASS.** Tüm sayfalar okunduğunda s. 3'teki sınırlılık birebir alıntıyla bulundu. | `z2-sonuclar.json` L2 |
| Haiku literatür yolu: model erişimi ve kayıt | **PASS.** 1 istek, 200, `literatur/completed/claude-haiku-4-5-20251001`. | `z2-sonuclar.json` H1 |
| Haiku literatür yolu: "asistan kaynak önermez" değişmezi | **FAIL.** Çıktıda yazar adları var ("Peplau & Perlman, Weiss vb."). Yıl ve DOI yok, bu yüzden `kunyeIzi`'den geçti (Bulgu 1). | `z2-sonuclar.json` H1 |
| Tam kullanıcı zinciri | **PASS** (adım tablosu aşağıda). İki adımın dış servis yanıtı UNVERIFIED. | `z1.out`, `z1-butunluk.json` |
| ai_assistant_runs ve hak | **PASS.** 5 istek, 5 kayıt (hepsi `completed`), hak sayacı 5. | `vt-ozet.txt` |
| Gerçek dış servisler (Resend teslimi, gerçek Crossref/OpenAlex yanıtı, barındırılan Storage CORS) | **UNVERIFIED.** Yerel düzenekle yer değiştirdiler. | §3 |
| Dokunmatik kaydırma | **UNVERIFIED** (önceki koşulardan; kapsam dışı). | — |
| İstatistiksel güven | **UNVERIFIED.** Her davranış tek örnekle ölçüldü; model davranışı tekrarlarda değişebilir. | — |

## 6. Tam kullanıcı zinciri (tek kullanıcı, `@yerel.test`, sentetik veri)
| Adım | Sonuç | Not |
|---|---|---|
| Kayıt (form, sözleşme sonuna kadar okundu, KVKK) | PASS | `/kayit` |
| Yerel e-posta doğrulama | PASS | Yakalanan "ArvoLab hesabınızı doğrulayın" postasındaki bağlantı → `/auth/dogrula` → "Devam et" |
| İlk şifre | PASS | `/reset-password?ilk=1` → panel |
| Çalışma | PASS | Tez; "Kılavuzu sonra eklerim" |
| DOI | PASS (uygulama yolu) | "DOI ile kaynak ekle" → `lookupDoi`, kota, kayıt. **Crossref yanıtı sentetik; gerçek Crossref UNVERIFIED** |
| Metin + kaynakça + kaynakça denetimi | PASS | Editörde paragraf, "Kaynakça" başlığı ve künye → "Kaynakçamı denetle" → "Doğrulandı · Crossref · %100" (sentetik dizin) |
| PDF | PASS | Satırdaki "PDF yükle" → tarayıcıdan Storage'a (CORS'lu ağ geçidi kopyası) → `kaynakPdfiYuklendi` → "PDF yüklendi" |
| Gerçek AI | PASS | Seçili pasaj → "Arvo AI ile analiz et" → cevap + "PDF s. 1"; editöre kendiliğinden girmedi |
| Onaylı atıf / kaynakça | PASS | "Alıntı ve atıf ekle" → DOI ile kesin eşleşme → basılı sayfa 203 → kullanıcının "İmlece ekle" düğmesi → “…” (Kaya, 2021, s. 203) |
| Word / PDF dışa aktarma | PASS | Yazdırma sayfası ve PDF'i: alıntı, atıf, kaynakça. `.docx`: alıntı, atıf, kaynakça |
| Yeniden giriş | PASS | Çerezler silindi → e-posta ve şifreyle giriş → editörde alıntı, atıf, kaynakça duruyor |
| Veri bütünlüğü | PASS | E-posta onaylı ve şifreli; profil 1, sözleşme onayı 1, çalışma 1; literatür ve PDF satırı aynı DOI; düz metin üç ögeyi içeriyor; asistan kaydı `kaynak/completed/claude-sonnet-5`; 3 posta (doğrulama, sözleşme kopyası, hoş geldiniz) |

Not: Atıf paragrafın ortasına girdi ("öğrencilerinin “…” (Kaya, 2021, s. 203) iyi oluşuna"). Sebep, betiğin imleci
paragraf kutusunun sağ kenarına tıklatması; satır kaydığı için imleç ortaya düştü. Bu düzeneğin konumlama sorunudur;
ürün atfı kullanıcının imlecine ekliyor.

## 7. Bulgular
1. **Literatür yeteneği yazar adı yazabiliyor (FAIL, değişmez ihlali).**
   - AGENTS.md: "Literatür yeteneği arama stratejisi üretir; yazar, başlık, dergi ya da DOI yazması yasaktır (`kunyeIzi` kodda da denetler)."
   - Haiku çıktısı: "Peplau & Perlman, Weiss vb." ve ölçek adları ("UCLA Loneliness Scale").
   - `kunyeIzi` yalnızca "Soyad (yıl)", "(Soyad, yıl)" ve DOI biçimlerini yakalıyor; yılsız yazar adı geçiyor.
   - Uydurma künye değil, ama kuralın açıkça yasakladığı türden bir kaynak önerisi. İstem ve denetim düzeltmesi ayrı karar ister. Kod değiştirilmedi.
2. **Kaynak doğrulama önbelleğinin anahtarı DOI'yi yok sayıyor.**
   - `kaynak_dogrulama_onbellegi` kullanıcılar arası paylaşılıyor, 7 gün tutuluyor. Anahtar `normalize(başlık)|yıl`.
   - Aynı başlık ve yıldaki iki farklı eser çakışıyor: künyede açık DOI olsa bile başka bir DOI'nin kaydı "bestMatch" olarak dönüyor ve PDF satırına o DOI yazılıyor.
   - Geliştirme koşularında görüldü: her denemede aynı başlık, farklı DOI. Sonuç olarak atıf "kesin" eşleşmeye ulaşmadı ve ürün güvenli tarafta kalıp aday seçimi ile onay istedi.
   - Gerçekte genel başlıklarda ("Editorial", "Introduction") görülebilir. Resmî koşudan önce yerel önbellek temizlendi.
   - Öneri: künyede DOI varsa anahtara DOI girsin ya da önbellek kaydı DOI ile doğrulansın. Kod değiştirilmedi.
3. **Kayıt formunda telefon alanının `pattern` ifadesi geçersiz** (`\+?[\d\s().\-]{10,20}`, tarayıcı `v` bayrağıyla derliyor).
   - Tarayıcı hata verip deseni yok sayıyor; istemci tarafı biçim denetimi çalışmıyor.
   - Sunucu (`kayitGirdisiniDenetle`) denetliyor; düşük önem.
4. **Yerel ağ geçidinde CORS yok** (düzenek eksiği, ürün değil). Tarayıcıdan PDF yükleme yerelde ancak CORS'lu kopyayla sınanabildi. Asıl `gecit.mjs`'e CORS eklemek ayrı bir küçük iş.

## 8. Kapsam dışı / dokunulmadı
- main, Production, paylaşılan Test, PR #96, ArvoOS: dokunulmadı.
- Onay K, P9, Auth A1 ve hak iadesi: uygulanmadı.
- Production HOLD sürüyor.

## 9. Dosyalar
- `kanit/aday/`: derleme günlüğü, şema kurulum günlüğü, şema özeti (1484 satır; md5 `358efe9c…`).
- `kanit/saglayici/`: sayaç günlüğü (18 iletilen; istem, yanıt ve başlık içermez), vekil ve `next start` günlükleri.
- `kanit/zincir/`:
  - zincir ve senaryo çıktıları, bütünlük, asistan cevabı;
  - yazdırma metni ve PDF'i, Word `.docx`'i ve metni;
  - yakalanan postalar (tek kullanımlık `token_hash` değerleri silindi), hesap dosyası (parola silindi).
- `betikler/`: koşulan betiklerin birebir kopyaları; uzantı lint kapsamı dışında kalsın diye `.txt`.
- Bütünlük: `SHA256SUMS`.
- Teslim taraması: sağlayıcı anahtarı, JWT/oturum belirteci, `token_hash` değeri ve parola yok.
