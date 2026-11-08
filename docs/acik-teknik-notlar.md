# Açık teknik notlar (test altyapısı)

Kapatılmamış, bilerek açık tutulan notlar. Her not kapanınca buradan
silinmez; "Kapandı" satırıyla tarihlenir.

## N1 — Mobil seçim düğmesi testi kararsızdı (AÇIK)

- **Yer:** `scripts/onizleme/ai-kabul.mjs`, senaryo "Seçim düğmesi
  (telefon): seçimi örtmez, ekranda kalır" (iPhone 13 öykünmesi).
- **Belirti:** 07.11.2026'da 3 tam `ai-kabul.mjs` koşusunun 2'sinde "düğme görünmüyor".
- **Ölçülen neden:** sentetik dokunmanın (`tap`) hemen ardından JavaScript ile
  kurulan DOM seçimi bazen ProseMirror'a geçmiyor; editör dokunmanın
  bıraktığı boş imleçte kalıyor (`selection` 1013–1013, `empty: true`),
  odak editörde. Düğme yalnızca boş olmayan metin seçiminde çizildiği için
  çıkmıyor. Ayrı bir ölçüm betiğinde 5 denemenin 2'sinde seçim editöre geçmedi.
- **Alınan önlem:** test seçimin editöre geçmesini bekliyor, geçmediyse
  seçimi bir kez daha kuruyor; geçmezse "seçim editöre geçmedi (test
  kurgusu)" mesajıyla düşüyor. Ardından iki tam koşu 21/21.
- **Neden hâlâ açık:** önlem test kurgusunu sağlamlaştırıyor, ama
  ProseMirror'ın dokunmadan hemen sonraki seçim değişikliğini neden
  yok saydığı doğrulanmadı. Gerçek telefonda seçim uzun basmayla ve
  dokunmadan çok sonra yapıldığı için ürün etkisi beklenmiyor; gerçek bir
  iOS/Android cihazda uzun basma ile seçim → düğme akışı elle denenmedi.
- **Kapanış ölçütü:** gerçek cihazda elle doğrulama ya da Playwright'ın
  dokunmatik seçim (uzun basma + sürükleme) ile kurulmuş bir senaryo.

## N2 — 375 px biçimlendirme denetimi bir kez düştü (AÇIK)

- **Yer:** Phase 4.5 / 3. dilim doğrulaması, oturum betiği (depoda değil).
- **Belirti:** 375 px'te kısayolla kalın ve düğmeyle italik bir koşuda
  `false`; iki tekrarda geçti.
- **Olası neden (doğrulanmadı):** N1 ile aynı sınıf — sentetik giriş ile
  seçim arasındaki yarış (Shift+Home'un kısa satırda seçtiği aralık).
- **Kapanış ölçütü:** biçimlendirme akışının depoya kararlı bir kabul
  senaryosu olarak alınması ve 10 ardışık koşuda geçmesi.

## N3 — PDF sayfa düzeni ortama bağlı (BİLİNEN SINIR)

- **Yer:** `scripts/onizleme/cikti-kabul.mjs`, referans
  `scripts/onizleme/referans/tez-pdf.json`.
- Sayfa sayısı ve başlıkların sayfası Chromium sürümüne ve yazı tiplerine
  bağlı. Bu kapsayıcıda `Times New Roman` → `Liberation Serif` (metrik
  eşdeğeri). Referans üretildiği ortamın parmak izini taşır; ortam
  farklıysa düzen denetimleri FAIL değil UNVERIFIED sayılır. Word ve metin
  denetimleri ortamdan bağımsız.
- Başka bir ortamda kesin karşılaştırma için referans o ortamda, referans
  sürümün (d12de9f) önizlemesinden yeniden üretilmeli.

## N4 — Yazma kipi önizleme verisini değiştirir (BİLİNEN SINIR)

- `ONIZLEME_YAZ=1` iken betikler belgeyi ve kaynakları BELLEKTE değiştirir;
  sonraki betik başka bir veriyle karşılaşır. `cikti-kabul.mjs` bunu
  kendisi algılayıp 2 koduyla durur; `kabul.mjs` ve `ai-kabul.mjs`
  algılamaz — her betikten önce sunucu yeniden başlatılmalı (başlık
  açıklamalarında yazılı).

## N5 — `kayit-kabul` sonrası `ai-kabul` aynı sunucuda düşüyor (AÇIK, teknik borç)

- **Belirti (07.11.2026):** aynı önizleme sunucusunda `kayit-kabul.mjs`'ten
  sonra koşan `ai-kabul.mjs` 21 senaryonun 13'ünde düşüyor
  (`selectNodeContents ... parameter 1 is not of type 'Node'`, seçim
  düğmesi tıklanamıyor). Taze sunucuda `ai-kabul` 21/21.
- **Neden:** N4'ün özel bir hâli. `kayit-kabul` yazma kipinde belgeyi
  BELLEKTE değiştiriyor (kılavuz uygulaması, kayıt); `ai-kabul` örnek
  tezin belirli paragraflarını varsayıyor ve bulamıyor. Ürün hatası değil.
- **Öneri (bu turda uygulanmadı):**
  1. Sahte istemciye betik başına sıfırlama ucu: yalnızca `ARVOLAB_ONIZLEME=1`
     ve üretim dışında açık bir `POST /api/onizleme/sifirla` (ya da
     `ONIZLEME_YAZ=1` iken her betiğin başında çağrılan bir sunucu işlemi)
     ORNEK verisini ilk hâline döndürür. Betikler başlarken bunu çağırır.
  2. Yazan betikler kendi çalışmalarını açar (ikinci örnek tez kimliği);
     okuyan betikler örnek teze dokunmaz.
  3. Birden çok betik koşan bir yürütücü (`scripts/onizleme/hepsi.mjs`)
     her betikten önce sıfırlar ve özet tablo basar; sıra bağımlılığı
     böylece görünür olur.
  4. Kısa vadede: betik başlığına "yazan betik" / "okuyan betik" etiketi ve
     `cikti-kabul`'daki gibi "veri ilk hâlinde değil" algılaması (2 koduyla dur).

## N6 — Kelime sayısı: kalan tutarlılık riski ve B planı (AÇIK)

- **Uygulanan (A, 07.11.2026, `lib/kelime-gosterimi.ts`):** içerik okunan
  ekranlarda (Özet, teslim hazırlığı, ana sayfa ve Çalışmalarım'da
  öğrencinin en son düzenlenen 12 çalışması) sayı içerikten, editörle aynı
  `countWords` ile. Veritabanına yazma yok.
- **Kalan risk:** personel listeleri (Kontrolör, Akademik Yönetici, Uzman;
  kurumun bütün tezleri) ve öğrencinin 13. ve sonraki çalışmaları kayıttaki
  `word_count`'u gösterir. 4.3.5 (B7) kuralından önce kaydedilmiş ve o
  günden beri kaydedilmemiş bir metinde bu sayı editörden farklı olabilir
  (örnek tezde 6.304 / 6.354). Metin bir kez kaydedilince fark kapanır.
  Sürüm geçmişindeki sayılar o anın kaydıdır, bilerek değişmez.
- **B — tek seferlik yeniden hesaplama, YALNIZCA PLAN (onay yok, uygulanmadı):**
  1. Kuru koşu betiği (salt okunur, servis anahtarıyla, önce Test):
     `project_manuscripts`'ten `project_id, word_count, updated_at, content`
     sayfalı okunur (500'er satır, `project_id` sırasıyla; satır tavanına
     takılmamak için). Her satırda `countWords(content)` hesaplanır.
  2. Çıktı yalnızca bir rapor: toplam satır, farklı çıkan satır sayısı,
     farkın dağılımı (min/medyan/max, yüzde), en büyük 20 fark (yalnızca
     `project_id` ve iki sayı; içerik yazılmaz), `updated_at` aralığı.
  3. Kuru koşu hiçbir şey yazmaz; betik `--uygula` olmadan güncelleme
     kodunu hiç çağırmaz. Üretimde ayrıca betik hedef kuralı
     (`betikHedefKarari`, onay cümlesi) geçerli.
  4. Uygulama (ayrı onayla): yalnızca `word_count` güncellenir, koşullu
     (`where word_count = <okunan>`; arada kaydedilen satır atlanır).
     `updated_at` ve `updated_by` DEĞİŞMEMELİ: tablonun güncelleme
     tetikleyicisi bunları yazıyorsa önce o doğrulanmalı (yoksa her satır
     "az önce düzenlendi" görünür ve otomatik sürüm ritmi bozulur).
     Sürüm tablosuna ve yazım ritmi kayıtlarına dokunulmaz.
  5. Yazım ritmi: düzeltilen bir satırın ertesi kaydı, önceki günün eski
     kurallı sayısıyla karşılaştırılır; o gün için tek seferlik küçük bir
     artış/azalış görünebilir (doğal kayıtta da aynısı olur).

## N7 — Tarayıcının geri/ileri düğmesi gezinme korumasının dışında (KISMEN KAPANDI)

- **Yer:** `lib/gezinme-korumasi.ts`, `lib/bekleyen-kayit.ts`,
  `app/dashboard/_components/gezinme-korumasi.tsx`.
- **Neden durdurulamıyor:** Next App Router geçmiş hareketini `popstate`
  ile kendisi işliyor; olay iptal edilemiyor. Navigation API'nin iptal
  desteği tarayıcılar arasında tutarsız ve Next'le çakışıyor; geçmiş kaydı
  hileleri (sahte kayıt itmek) kullanıcıyı geri/ileri döngüsüne sokar.
  Bu yüzden geçiş DURDURULMUYOR.
- **Ne yapıldı (Aşama 2.1, 08.11.2026):** uygulama içi geri/ileride editör
  kapanırken içeriğin anlık görüntüsünü alır ve kaydı kabuğa devreder;
  kabuk gezinme bitince gönderir, geçici hatada yeniden dener, düşerse
  vardığı sayfada kalıcı uyarı (taslağın gerçek yeri, "Yeniden dene",
  "Çalışmaya dön"). Belgeler arası geri, yenileme ve sekme kapatmada
  tarayıcının "ayrılmak istiyor musunuz" uyarısı ve tarayıcı taslağı.
  Senaryolar: `gezinme-korumasi-kabul.mjs` (16).
- **Neden hâlâ açık:** (1) sahte veriyle sınandı; gerçek Supabase Test'te
  ağ hatası, oturum kapanması ve sürüm çakışması doğrulanmadı. (2) Gerçek
  mobil tarayıcıda (iOS Safari geri kaydırma hareketi, Android geri tuşu)
  denenmedi; yalnızca iPhone 13 öykünmesi. (3) Kullanıcı tarayıcı
  uyarısını onaylayıp ayrılırsa metin yalnız o tarayıcının taslağındadır
  (başka cihazda yok); bu, kullanıcının açık seçimi.
- **Kapanış ölçütü:** (1) ve (2) gerçek ortamda.
