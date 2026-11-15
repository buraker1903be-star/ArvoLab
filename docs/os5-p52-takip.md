# Signature OS 5 / P52: açık takip maddeleri

P52-0 ([#91](https://github.com/buraker1903be-star/ArvoLab/pull/91), otomatik PDF indirme hotfix'i) sırasında bulunup **bilerek** o PR'a alınmayan maddeler.

Her madde kapatıldığında bu dosyadan silinir ve kapatan PR'ın açıklamasına yazılır.

## P52b: PDF Storage'a yazıldı, veritabanı kaydı başarısız oldu (yetim dosya)

**Durum:** açık. **Etki:** veri kaybı yok; kova şişer, ve kişisel veri taşıyan bir PDF hiçbir kayda bağlı olmadan durur.

İki yol aynı sınıftan:

1. **Otomatik indirme** (`app/actions/kaynak-pdf.ts`, `kaynakPdfleriniBul`).
   - PDF depoya yazılıyor (`upload(hedef, …)`, ~169) ve durum `indirildi` oluyor.
   - Ardından `kaynak_pdfleri` upsert'i düşerse (~194–199) işlem hata döndürüp çıkıyor.
   - Yeni yüklenen `hedef` dosyası silinmiyor.
2. **Öğrencinin yüklemesi** (`kaynakPdfiYuklendi`, ~258–277).
   - Dosya tarayıcıdan zaten yüklenmiş geliyor.
   - Upsert düşerse `girdi.depoYolu` kovada kalıyor.
   - Kullanıcı yükledikten sonra akışı terk ederse de aynısı oluyor (`kaynak-pdf-satiri.tsx`).

**Önerilen düzeltme (P52b):**
- Upsert hatasında bu çağrının yazdığı dosyayı en iyi çabayla silmek. Silme de düşerse yalnızca log'a yazmak; kullanıcıya giden hata aynı kalır.
- Terk edilen yüklemeler için ArvoOS'taki doçentlik temizliğine benzer bir süpürme işi. Kural: hiçbir `kaynak_pdfleri.depo_yolu` tarafından gösterilmeyen, 24 saatten eski `*/kaynak-pdf/*` nesneleri. Kira kullanılmalı ve silmeden hemen önce kayıt yeniden kontrol edilmeli.
- Aynı aşamada yol denetimi de sıkılaşmalı. `kaynakPdfiYuklendi` şu an yalnızca `${projectId}/kaynak-pdf/` önekine bakıyor; tam desene geçmeli. Aksi hâlde bir satır başka satırın dosyasını gösterebiliyor.

**Sınama:** upsert'in düştüğü senaryo `tests/db` ya da yerel Storage ile.
- Kovada yeni nesne kalmamalı.
- Mevcut `indirildi` / `yuklendi` satırının dosyası korunmalı.

## Doğrulanmadı: gerçek dış ağda açık erişim PDF'inin indirilmesi

P52-0'ın kanıtı, istek başlıklarını gerçek `new Headers(...)`'tan geçiren birim testi (`tests/unit/guvenli-indir-baslik.test.ts`). Uçtan uca gerçek bir indirme yapılamadı: geliştirme ortamında DNS çözümlemesi yok, SSRF süzgeci adı çözemeyip duruyor. Önce/sonra aynı sonuç alındı: "Adres genel ağa çözümlenemedi".

**Yapılacak:** Önizlemede, açık erişimli PDF'i olan bir DOI ile (örneğin arXiv) "PDF'leri bul" denenmeli. Beklenen sonuç: satır "PDF hazır · açık erişim" oluyor ve dosya kovada bulunuyor.
