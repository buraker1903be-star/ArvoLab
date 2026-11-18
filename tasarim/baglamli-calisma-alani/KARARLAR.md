# Uygulamadan önce onay bekleyen kararlar

Hiçbiri onaylanmadı. Bu dalda migration yok, uygulama kodu değişmedi. Her karar ayrı onaylanır.

## K1 — Çalışma başına belge dili

**Bugün:** ayrı bir alan yok. `lib/belge-dili.ts` makale profilindeki dili, yoksa arayüz dilini kullanıyor; yani dil
her açılışta türetiliyor ve kullanıcının arayüz dilini değiştirmesi belge etiketlerini de değiştirebiliyor.

| Seçenek | Ne olur | Veri modeli | Mevcut çalışmalar |
|---|---|---|---|
| **A. Alan ekle, boş başlasın** (öneri) | `academic_projects`'e isteğe bağlı `belge_dili` (NULL = bugünkü türetme). Yeni çalışmada kullanıcının seçtiği dil yazılır. | 1 sütun, `tr`/`en` kısıtı, RLS değişmez | **Topluca doldurulmaz.** NULL kalır, bugünkü kuralla davranır; kullanıcı çalışmanın içinden seçerse yazılır |
| B. Makale profilini genişlet | Dil yalnızca `makale_profili.dil`'de; tez ve proje için de profil açılır | Profil tablosunun anlamı genişler | Değişmez, ama tezlerde profil kaydı yok |
| C. Değişiklik yok | Yeni çalışma penceresi dil sormaz, bugünkü türetme sürer | Yok | Değişmez |

Mevcut çalışmaları kullanıcının o anki arayüz diline göre doldurmak önerilmiyor: bir tezin dili, onu yazan
öğrencinin o gün seçtiği arayüz diline bağlı değil; yanlış bir değer kalıcı hâle gelir.

## K2 — Kaynak kaydı ile PDF arasındaki bağ

**Bugün:** `kaynak_pdfleri` çalışmaya bağlı ve künye METNİYLE (`kunye_anahtari`) eşleşiyor; `literature_sources`'a
yabancı anahtar yok. Künye yazımı değişince eşleşme kopabiliyor.

| Seçenek | Ne olur | Veri modeli | Etki |
|---|---|---|---|
| A. İsteğe bağlı yabancı anahtar | `kaynak_pdfleri.kaynak_id → literature_sources.id`, NULL olabilir | 1 sütun + dizin; RLS'te çalışma kapsamı korunur | Yeni bağlar kesin; eskiler künye eşleşmesiyle çalışmayı sürdürür, toplu doldurma YOK |
| B. Değişiklik yok | Künye eşleşmesi sürer; arayüz "olası eşleşme" durumunu açıkça gösterir | Yok | Prototipteki ayrı güven durumları bu seçenekle de geçerli |

## K3 — Atıf kartı ve "Dayanağa git"

Tasarımda korunuyor (ekran 5, durum B). Kapsamdan çıkarılmadı; uygulama yolu ayrı karar.

**Bugün:** yazar-tarih ve numaralı atıflar belgeye düz metin olarak giriyor (`editor-navigation.ts:236-296`);
dipnot stillerinde `footnoteReference` düğümü var. Seçimin PDF'te doğrulanması (`kaynakSecimiDogrula`) sayfa
ve metin döndürüyor ama **hiçbir yere kaydetmiyor** (`app/actions/kaynak-pdf.ts:105-113`). Kanıt matrisinde
(`kanit_kayitlari`) alıntı ve kullanıcının yazdığı konum kalıcı.

| Seçenek | Nasıl | Belge uyumluluğu | Dışa aktarma etkisi | Dayanağa git |
|---|---|---|---|---|
| **A. Süsleme (kalıcı değişiklik yok)** | Tıklama anında düz metin atıf ("Kaya, 2021") çalışmanın kaynaklarıyla eşleştirilir; kart bu eşleşmeden açılır. Satır içi öneri gibi bir süsleme, belgeye yazılmaz | Tam: belge şeması değişmez, eski belgeler aynen çalışır | **Yok:** Word, PDF/yazdırma, LaTeX ve paylaşım aynı kalır | Yalnızca kaynak düzeyinde (PDF'i aç); pasaj için doğrulamanın saklanması gerekir (K3-ek). Aynı yazar-yıl iki kaynakta "olası eşleşme" olur |
| **B. Görünmez işaret (mark)** | Atıf eklenirken metne `atif` işareti (kaynak kimliği, isteğe bağlı doğrulama kimliği) konur. Öncülü: asistan izi (`lib/tiptap-asistan-izi.ts`) aynı biçimde çalışıyor ve hiçbir çıktıya girmiyor | Eski belgeler işaretsiz kalır, A'ya düşer. Atıf metni elle düzenlenince işaret bölünebilir; bölünmeyi sınayan test gerekir | **Dört çıktıda işaret atılmalı** (editör, yazdırma, Word, LaTeX) ve `cikti-yollari.test.ts`'e satır eklenmeli; görünür çıktı değişmez | Kesin kaynak; doğrulama kimliği varsa kesin pasaj |
| C. Atıf düğümü (node) | Atıf, metin yerine atom düğüm olur; görünür biçim stilden üretilir | Şema değişir; eski düz metin atıflar ya dönüştürülür ya da iki biçim birlikte yaşar | **En geniş:** üç çıktı yolu ve LaTeX'te yeni çizim, kelime sayımı ve bul-değiştir etkilenir | Kesin |

**K3-ek (B ve pasaj düzeyi için):** doğrulanan seçimin (PDF kimliği, sayfa, kanonik metin) saklanması. Bu bir
tablo ya da mevcut kanıt kaydının genişletilmesi demek; ayrı veri modeli kararıdır.

Önerilen sıra: önce **A** (belgeye ve çıktılara dokunmadan kartı açar), pasaja gitme gerekiyorsa **B + K3-ek**.
C bu iş için önerilmiyor.
