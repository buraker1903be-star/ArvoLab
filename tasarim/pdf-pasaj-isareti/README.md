# PDF pasaj işareti (kalıcı fosforlu vurgu)

PDF çekmecesinden belgeye **alıntı** ya da **pasaja bağlı atıf** ("Yalnızca atıf")
başarıyla eklendiğinde, kullanılan pasaj PDF'te fosforlu sarı işaretle kalır.

## Nerede tutuluyor

Belgenin kendisinde: alıntı ve atıf metni görünmez bir `pdfDayanak` işaretiyle
yazılır (`lib/tiptap-pdf-dayanak.ts`). PDF'teki vurgu bu işaretten türer, ayrı
bir kayıt yoktur. Şema değişikliği gerekmedi, migration yok.

| İstenen | Nasıl karşılanıyor |
| --- | --- |
| Kapat/aç, yenileme, yeni oturum | Belge veritabanından okunur; tarayıcı belleğine dayanmaz |
| Çalışma, belge atfı, PDF sürümü | İşaret çalışmanın belgesinde, atfın metninde; `pdf` (kaynak_pdfleri kimliği), `surum` (dosyanın SHA-256 özeti), `sayfa` (PDF sayfası), `pasaj`, `kaynak` taşır |
| Aynı PDF'te birden çok pasaj | Her ekleme ayrı işaret |
| Dayanağa git | Atıf kartı belgedeki işaretlerden okur: doğru sayfa + pasaj |
| Yakınlaştırma, boyut, iki sütun | Koordinat saklanmaz; vurgu her çizimde METİNLE bulunur ve metin katmanının kendi span'larına konur |
| Yalnızca seçim | İşaret konmaz (yalnızca başarılı ekleme) |
| Genel kaynak atfı | Pasaj yok → işaret yok |
| Geri al / yinele / atfı sil | İşaret metnin parçası: metinle birlikte gider/gelir |
| Başarısız ekleme | Ekleme tek işlem; işlem yoksa işaret de yok |
| PDF değişti | Özet tutmazsa eski işaret çizilmez, çekmece "eski sürüme ait" der |

İşaret hiçbir çıktıya (yazdırma, paylaşım, Word) girmez (`tests/editor/pdf-dayanak.test.ts`).

### Neden mevcut kanıt kaydı (kanit_kayitlari) değil

Her satırı bir iddia (≥ 5 karakter) istiyor ve kanıt matrisine düşüyor; belgedeki
atfı ve PDF sürümünü taşıyan bir alanı yok. Ayrıca bir tablo satırı geri al/yinele
ile belgeyle tutarlı tutulamaz (Ctrl+Z ile dönen atfın satırı yeniden yazılmalı,
silinen atfın satırı silinmeli). İşaret belgede olunca bu tutarlılık kendiliğinden gelir.

### Neden pdf.js parmak izi değil

`fingerprints[0]` PDF'in `/ID` alanından gelir ve dosyayı değiştiren araçların
çoğu ilk kimliği korur. Aynı künyeye yeni PDF yüklenince `kaynak_pdfleri` satırı
aynı kalır (`unique (project_id, kunye_anahtari)`), yani kimlik de aynıdır.
Sürüm bu yüzden dosya baytlarının SHA-256 özeti.

## Bu turda bulunan ek hata

`lib/pdf-pasaj.ts` satır sonu tirelemesini ("com-" + "pile") hesaba katmıyordu:
gerçek makalelerde pasaj bulunamıyor, ne kalıcı işaret ne de mevcut "Dayanağa git"
vurgusu çiziliyordu. Tireler iki taraftan da atılıyor; birim testi eklendi.

## Bilinen sınır

Vurgu metin katmanı span'ı düzeyinde: pasaj bir satırın ortasında bitiyorsa o
satırın span'ı bütün olarak boyanır (pdf.js satırı tek span verir).

## Kabul

```
GERCEK_PDF=<iki sütunlu gerçek PDF> node tasarim/pdf-pasaj-isareti/betikler/kabul.mjs
```

25/25 (sentetik PDF + TraceMonkey, PLDI 2009). Görseller `gorseller/`.
