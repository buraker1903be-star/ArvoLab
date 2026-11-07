# Mimari karar taslağı: kaynak ↔ atıf ↔ PDF bütünlüğü

Durum: **ÖNERİ — onay bekliyor.** Bu belge kod, migration ya da veri değişikliği
İÇERMEZ. Her bölümün sonundaki "gerekli değişiklik" ayrı onayla, ayrı dilimde
yapılır. Tarih: 07.11.2026. Dayanak: Araştırma ve Kaynaklar salt okunur
envanteri (Phase 4.5 sonrası) ve aşağıda dosya:satır ile anılan kod.

İlkeler (bütün bölümler için):
1. **Mevcut veri kaybolmaz, sessizce yeniden yazılmaz.** Öğrencinin müsveddesi
   (`project_manuscripts.content`) hiçbir geri doldurma (backfill) işleminde
   otomatik değiştirilmez; bağ kurmak kullanıcının onayıyla olur.
2. **Eski belge, eski kayıt çalışmaya devam eder.** Yeni alanlar boş (NULL)
   olabilir; her okuma yolu "bağ yok" durumunu bugünkü davranışla karşılar.
3. **Çıktı değişmez.** Word, yazdırma/PDF ve paylaşım çıktısı bu kararların
   hiçbiriyle değişmemeli; `tests/editor/cikti-referans.test.ts` ve
   `scripts/onizleme/cikti-kabul.mjs` (R0) bunu her dilimde sınar.
4. Değişmezlikler (AGENTS.md) geçerli: abonelik kapısı, RLS asıl katman, her
   yeni fonksiyonda `revoke … from public, anon, authenticated`, yeni
   tabloda RLS aynı migration'da, migration `npm run db:new` ile.

---

## 1. Editör atıflarının kaynak kimliğiyle ilişkilendirilmesi

**Bugün.** `insertCitation` (`app/dashboard/editor/[id]/write/editor-navigation.ts:236-290`)
atıfı **düz metin** olarak yazar; dipnotlu stilde `footnoteReference`
düğümüne yalnızca `text` özniteliği koyar. Belgede kaynak kimliği yok.
"Metinde atıf var mı" sorusu soyad + yıl metin eşleşmesiyle cevaplanıyor
(`lib/atif-eslesmesi.ts`, `lib/kaynak-kutuphanesi.ts`); numaralı stilde
cevap "bilinmiyor".

**Öneri.** Atıf metnini saran bir satır içi **işaret (mark)**: `atif`,
öznitelikleri `{ kaynaklar: uuid[], sayfa?: string }`. Dipnotlu stilde aynı
bilgi `footnoteReference`'a ek öznitelik olarak (`kaynaklar`).
- Neden düğüm değil işaret: atıf metni öğrencinin düzenleyebildiği metin
  kalmalı (sayfa numarası ekleme, "ve ark." düzeltme). Düğüm onu tek parça
  yapar, kopyala-yapıştırı ve bul-değiştiri bozar.
- Çıktılar işareti **yok sayar**: metin aynen çizilir. Word/yazdırma
  çıktısı değişmez (ilke 3; referans testleri sınar).
- `insertCitation` ve atıf penceresi işareti koyar. Yazım asistanı zaten
  yalnızca kütüphanedeki kaynaklara atıf yapabiliyor (AGENTS.md): eşleşen
  kaynağın kimliği işarete yazılabilir (ayrı dilim).
- "Metinde atıf" hesabı önce işarete bakar, işaret yoksa bugünkü metin
  eşleşmesine düşer. "Bilinmiyor" ile "yok" ayrımı korunur.

**Geriye dönük uyumluluk.** Eski belgelerde işaret yok → bugünkü davranış.
İsteğe bağlı "atıfları kaynaklara bağla" aracı: mevcut eşleştirici aday
gösterir, öğrenci onaylar, yalnızca onaylanan yer işaretlenir (ilke 1).

**Gerekli değişiklik.** TipTap şeması (`lib/tiptap-extensions.ts`) — **TipTap
mimarisine dokunur, ayrı onay gerekir.** Veritabanı migration'ı yok
(belge JSON'u `jsonb`). `tests/editor/sema.test.ts`'e işaret, kopyala-yapıştır
ve çıktı testleri; `cikti-yollari.test.ts`'e "işaret çıktıyı değiştirmez"
satırı.

**Riskler.**
- Başka bir çalışmadan yapıştırılan atıf yabancı kaynak kimliği taşır →
  okurken kimlik o çalışmanın kaynağı değilse yok sayılır (ve uyarılır).
- Kullanıcı atıf metnini tamamen silip yeniden yazarsa işaret kaybolur →
  metin eşleşmesi yedeği bu yüzden kalıcı.
- Word'den içe aktarılan belgede işaret yok (docx-import kaynak üretmiyor).

---

## 2. DOI ekleme yollarının tek iş kuralına bağlanması

**Bugün iki yol var, kuralları farklı:**

| | Kaynaklar (`doiIleEkle`, `app/actions/kaynak-aktarim.ts:137-194`) | Editör (`lookupDoi` + `createCitationSource`, `app/actions/literature.ts:225-320`) |
|---|---|---|
| Abonelik kapısı | var | arama: yok (`lib/access.ts` listesinde de yok); kayıt: var |
| Tekrar | aynı DOI eklenmez ("vardı") | denetim yok |
| Durum | varsayılan (`to_review`) | doğrudan `used` |
| Zaman aşımı | 8 sn | 8 sn |

**Öneri.** Tek saf karar modülü (`lib/kaynak-ekleme.ts`) + tek sunucu işlemi:
`kaynakEkle({ projectId, giris: { doi } | { kunye } | { arama } , baglam: "kutuphane" | "editor" })`.
- DOI normalleştirme tek yerde (`lib/doi.ts`; `doiAyikla`'nın ikinci kopyası
  `lib/kanit/kunye-karsilastirma.ts`'ten kaldırılır ya da birine bağlanır).
- Abonelik kapısı her yolda; `lookupDoi` ya kapıya alınır ya da `lib/access.ts`
  listesine gerekçesiyle "bilerek kapısız" yazılır (karar gerekli: arama
  maliyetsiz ama dış servise gidiyor).
- Tekrar kuralı bölüm 3'teki anahtarla.
- Durum kuralı: kaynak `to_review` doğar; `used` olması **atıfın belgeye
  girmesiyle** olur (bugün editör yolu kayıtta `used` yazıyor, atıf
  iptal edilse bile kalıyor).
- Hata sınıfları tek: bulunamadı / zaman aşımı / dizin hatası / geçersiz.

**Gerekli değişiklik.** Sunucu işlemleri ve iki arayüzün çağrısı. Migration
yok. Birim testleri: karar modülü; zaman aşımı ve 404 için `fetch` taklidiyle
eylem testi (bugün yok).

**Risk.** Editör yolunda kaynak artık `used` doğmadığı için "kullanılan
kaynak" sayıları ilk günlerde düşük görünebilir — bu doğru sayıdır;
sürüm notunda yazılmalı.

---

## 3. Mükerrer kaynakların yönetimi

**Bugün.** Dört ekleme yolunda dört davranış: içe aktarma ve DOI listesi
atlıyor, elle ekleme uyarıyor, editör yolu denetlemiyor; aramadan ekleme
doğrulanamadı. Veritabanında tekrar kısıtı yok.

**Öneri.**
- **Kimlik anahtarı:** normalleştirilmiş DOI varsa o; yoksa künye anahtarı
  (ilk yazar soyadı + yıl + başlığın normal hâli; `lib/kaynak-pdf.ts`'teki
  `kunyeAnahtari` ile aynı kural, tek fonksiyon).
- **Kapsam:** kullanıcı + çalışma. (Aynı kaynağın iki çalışmada ayrı kaydı
  meşru: notlar ve durum çalışmaya özgü.)
- **Ekleme anında:** DOI eşleşmesi → eklenmez, mevcut kayıt döner. Künye
  eşleşmesi → uyarı + "yine de ekle" (künye anahtarı kesin değil).
- **Mevcut tekrarlar:** "Olası tekrar" süzgeci zaten var. "Birleştir" eylemi:
  bir kayıt kalır, ötekinin notu eklenir; kanıt kayıtları
  (`kanit_kayitlari.kaynak_id`) ve PDF bağı (bölüm 4) kalan kayda taşınır.
  Belgedeki atıf işaretleri **yeniden yazılmaz**; bunun yerine bir
  `kaynak_birlesmeleri(eski_id → yeni_id)` tablosu okurken çözülür (ilke 1).

**Gerekli migration'lar.**
- M2a: `literature_sources.doi_normal` (üretilmiş sütun, `doi_or_url`'den)
  + **benzersiz OLMAYAN** dizin `(owner_id, project_id, doi_normal)`.
  Benzersiz dizin mevcut tekrarlar yüzünden ilk gün kurulamaz; önce
  rapor + birleştirme, sonra ayrı bir migration'la benzersizlik (M2b).
- M2c: `kaynak_birlesmeleri` tablosu, RLS (sahip okur/yazar), tetikleyiciyle
  birleştirme işlemi `security definer` değil invoker.

**Riskler.** Künye anahtarının yanlış pozitifi (aynı yazar + yıl + benzer
başlık) → bu yüzden yalnızca DOI otomatik, künye yalnızca uyarı. Birleştirme
geri alınamaz olmamalı: `kaynak_birlesmeleri` aynı zamanda geri alma kaydı.

---

## 4. PDF dosyalarının kaynak kayıtlarına kalıcı bağlanması

**Bugün.** `kaynak_pdfleri` (`supabase/migrations/20261026110024_kaynak_pdfleri.sql`)
çalışma + **künye anahtarı** ile anahtarlı (`unique (project_id, kunye_anahtari)`);
`literature_sources`'a yabancı anahtarı yok. Kütüphanedeki kayıtla bağ
yalnızca ekranda DOI eşleşmesiyle kuruluyor
(`app/dashboard/literature/page.tsx:377`). Ayrı "PDF sil" işlemi yok.

**Öneri.**
- M3: `kaynak_pdfleri.kaynak_id uuid null references literature_sources(id) on delete set null`.
  `kunye_anahtari` KALIR: kaynakçada olup kütüphanede olmayan künyenin de
  PDF'i olabiliyor (bugünkü kullanım).
- Tetikleyici: `kaynak_id` doluysa kaynağın `project_id`'si satırınkiyle
  aynı olmalı (başka çalışmanın kaynağına bağlanamaz).
- Geri doldurma (yalnızca rapor + onaylı uygulama): önce DOI tam eşleşmesi,
  sonra künye anahtarı tam eşleşmesi; belirsiz (birden çok aday) satırlar
  bağlanmaz, listelenir. İdempotent; Test'te çalıştırılıp sayıları
  raporlanır, Production ayrı onay.
- Arayüz bağı "kalıcı" olarak yalnızca `kaynak_id` doluyken gösterir; DOI ile
  tahmin edilen bağ "eşleşme" olarak etiketlenir (envanter riski 6).
- "PDF'i kaldır" işlemi: depolamadaki dosya + satırın durumu
  (`bulunamadi`'ya döner); kanıt kaydı etkilenmez.

**Riskler.** Depolama yolu değişmiyor (`project-files/<çalışma>/kaynak-pdf/…`),
storage politikası etkilenmez. Kaynak silinince PDF satırı kalır
(`set null`) — bilinçli: dosya kaybolmasın.

---

## 5. Kaynak silindiğinde belge ve kaynakça tutarlılığı

**Bugün.** Kaynak silinince metindeki atıf ve kaynakça satırı olduğu gibi
kalıyor; `kanit_kayitlari.kaynak_id` NULL oluyor; PDF satırı etkilenmiyor.
Uyarı yok.

**Öneri.**
- Silme öncesi denetim: kaynak belgede (bölüm 1 işaretiyle, yoksa metin
  eşleşmesiyle) kaç yerde atıflı, kanıt kaydı ve PDF'i var mı → onay
  penceresi bunları sayar. AGENTS (ArvoOS) kuralı burada da geçerli:
  **engel sorgusu hata yutmaz**, okunamazsa silme yapılmaz.
- Atıflı kaynak için önerilen varsayılan **yumuşak silme**: M4
  `literature_sources.silindi_at timestamptz`. Liste ve sayaçlar silinmişi
  göstermez; belge ve kaynakça üretimi atıflı kaydı okumaya devam eder;
  "geri al" mümkün. Atıfsız kaynak doğrudan silinebilir.
- Belgedeki atıf metni ve kaynakça satırı **asla otomatik silinmez**; yapı
  denetimi (`lib/structure-check.ts`) "kütüphanede olmayan kaynağa atıf"
  uyarısı verir.

**Gerekli değişiklik.** M4 + RLS seçim politikalarında değişiklik YOK
(süzme uygulamada; RLS sahiplik sınırı aynı). Sayaçları üreten her sorguya
`silindi_at is null` — `npm run check:rakamlar` sınıfı bir hata riski;
sorgular tek yardımcıdan geçmeli.

---

## 6. Belge + kaynakça + referans PDF'leri tek ZIP

**Bugün.** `teslimPaketi` (`app/actions/kaynak-pdf.ts:262-310`) kaynak
PDF'leri için kısa ömürlü imzalı bağlantılar ve bir kaynak raporu döndürür;
ZIP **tarayıcıda** kurulur (sunucunun ~4,5 MB yanıt sınırı yüzünden).
Abonelik kapısı var. Belgenin kendisi ve kaynakça pakete girmiyor.

**Öneri.** Aynı tarayıcı tarafı ZIP'e eklenecekler:
- `belge.docx` — editörün Word düğmesinin kullandığı aynı
  `buildDocxFromTiptap` çağrısı (tarayıcıda; ek sunucu maliyeti yok).
- `kaynakca.ris` ve `kaynakca.bib` — Kaynaklar'ın mevcut dışa aktarma
  kodu (`kaynak-aktarim-araclari.tsx`), yalnızca bu çalışmanın kaynakları.
- `kaynakca.txt` — kaynakçanın biçimlenmiş metni (`kaynakcaMetni`).
- `kaynak-pdf/…` ve `rapor.txt` — bugünkü içerik.
- Belgenin PDF'i: **önerilmez (şimdilik).** Sunucuda başsız tarayıcı Vercel'de
  pahalı ve yavaş; tarayıcıda yazdırma kullanıcı etkileşimi ister. Pakete
  "PDF için Yazdır → PDF olarak kaydet" notu yazılır.

**Gerekli değişiklik.** Yalnızca istemci kodu; migration yok. Kabul:
`cikti-kabul.mjs`'nin Word özetleyicisi ZIP'teki `belge.docx`'e de uygulanır
(paketteki belge, düğmeden inen belgeyle aynı yapıda olmalı).

**Riskler.** Tarayıcı belleği (büyük PDF'ler); imzalı bağlantıların 10
dakikalık ömrü (paket yavaş kurulursa süre dolar → kurulum sırasında
yenileme). Dosya adlarında Türkçe karakter ve çakışma (bugünkü
`paketDosyalari` kuralı korunur).

---

## Migration özeti (hiçbiri oluşturulmadı)

| Kod | Tablo | Değişiklik | Veri etkisi | Geri alma |
|---|---|---|---|---|
| M2a | literature_sources | `doi_normal` üretilmiş sütun + benzersiz olmayan dizin | yok (türetilmiş) | sütunu düşür |
| M2b | literature_sources | benzersiz kısıt `(owner_id, project_id, doi_normal)` | mevcut tekrarlar birleştirilmeden kurulamaz | kısıtı düşür |
| M2c | kaynak_birlesmeleri (yeni) | eski→yeni eşlemesi, RLS | yok | tabloyu düşür |
| M3 | kaynak_pdfleri | `kaynak_id` (set null) + proje eşleşmesi tetikleyicisi | geri doldurma ayrı, raporlu, onaylı | sütunu düşür |
| M4 | literature_sources | `silindi_at` | yok | sütunu düşür |

Sıra önerisi: M3 → M4 → M2a → (birleştirme aracı) → M2c → M2b. Her biri:
Test'te uygula, `tests/db` meşru akış + saldırı senaryoları, anlık görüntü
yenile, Production ayrı onay. Bölüm 1 (TipTap işareti) ve 2 (tek DOI kuralı)
migration gerektirmez ama ayrı onay gerektirir (TipTap mimarisi, sunucu
işlemleri).

## Açık kararlar

1. `lookupDoi` abonelik kapısına mı alınsın, yoksa gerekçeli istisna mı?
2. Tekrar kapsamı kullanıcı + çalışma mı, yoksa kullanıcı geneli mi?
3. Atıflı kaynak silinince varsayılan yumuşak silme mi, engel mi?
4. ZIP'te belgenin PDF'i ileride sunucuda üretilecek mi?
5. Atıf işareti (bölüm 1) Phase 4.6 tasarım dilimlerinden ÖNCE mi sonra mı?
   (Önce yapılırsa Kaynaklar ekranı "metinde atıf" bilgisini kesin
   gösterebilir; sonra yapılırsa tasarım dilimleri bugünkü tahmini gösterir.)
