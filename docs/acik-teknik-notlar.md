# Açık teknik notlar (test altyapısı)

Kapatılmamış, bilerek açık tutulan notlar. Her not kapanınca buradan
silinmez; "Kapandı" satırıyla tarihlenir.

## N1 — Mobil seçim düğmesi testi kararsızdı (AÇIK)

- **Yer:** `scripts/onizleme/ai-kabul.mjs`, senaryo "Seçim düğmesi
  (telefon): seçimi örtmez, ekranda kalır" (iPhone 13 öykünmesi).
- **Belirti:** 07.11.2026'da 5 koşunun 2'sinde "düğme görünmüyor".
- **Ölçülen neden:** sentetik dokunmanın (`tap`) hemen ardından JavaScript ile
  kurulan DOM seçimi bazen ProseMirror'a geçmiyor; editör dokunmanın
  bıraktığı boş imleçte kalıyor (`selection` 1013–1013, `empty: true`),
  odak editörde. Düğme yalnızca boş olmayan metin seçiminde çizildiği için
  çıkmıyor. 5 tekrarın 2'sinde seçim geçmedi.
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
