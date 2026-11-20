# Makale Bul: arama sırasında otomatik künye kontrolü

Makale Bul sonuçları gelir gelmez her sonucun künyesi (DOI, başlık, ilk yazar, yıl)
arkada kontrol edilir; öğrencinin ayrıca kaynakça denetimi çalıştırması gerekmez.
Sonuçlar beklemeden listelenir, rozetler geldikçe güncellenir.

## Bağımsızlık kuralı

Sonucu **OpenAlex** getirdiyse **Crossref**'e, **Crossref** getirdiyse **OpenAlex**'e
sorulur. Aynı dizinin kaydını yeniden okumak doğrulama sayılmaz. Sonuç aramada iki
dizinden birden geldiyse iki dizinin **ham** künyesi birbirine karşı sınanır (ağa
yeniden çıkılmaz); birleştirilmiş kayıt kullanılmaz, çünkü birleştirme alanları
karıştırıyor (yıl OpenAlex'ten, dergi Crossref'ten). Rozet karşılaştırılan dizini
yazar: "Künye eşleşti · Crossref". Not: OpenAlex verisinin bir kısmı Crossref'ten
türer; rozet "dizinler arasında tutarlı" der, "kaynak doğru" demez.

## Durumlar

| Rozet | Anlamı | Ton |
| --- | --- | --- |
| Künye kontrol ediliyor | istek sürüyor | nötr |
| Künye eşleşti · <dizin> | başlık, ilk yazar ve yıl öteki dizinle tutarlı; iki tarafta DOI varsa o da aynı | başarı |
| Eksik bilgi | temel alanlardan biri bir tarafta yok, karşılaştırılamadı | uyarı |
| Belirsiz eşleşme | bir temel alan farklı, DOI başka başlığa çıkıyor ya da aynı başlıkta birden çok yayın var | uyarı |
| Kontrol edilemedi | öteki dizine ulaşılamadı **ya da** kayıt orada yok | nötr |

"Kontrol edilemedi" hiçbir zaman "yanlış kaynak" demek değildir ve tehlike tonunda
gösterilmez. Servis arızası geçicidir (önbelleğe girmez, sonra yeniden denenir).
Yıl ±1 farkı (çevrim içi ilk yayım / sayı yılı) belirsiz sayılmaz; künyede sayı yılı
kullanılır ve açıklamada söylenir. Soyadı önekleri ("van der Berg") son sözcükle
karşılaştırılır; yanlış alarm, kaçırılan hatadan sinsidir.

Bu yalnızca **künye** kontrolüdür. PDF'in varlığı ve pasajın PDF'te geçmesi ayrı
kontroller (`lib/kaynak-durumu.ts`).

## İstekler, önbellek, eski aramalar

- Uç nokta `POST /api/kunye-kontrol` (oturum, abonelik, aynı köken, saatlik 400 hak).
  **Sunucu işlemi değil:** Next sunucu işlemlerini istemcide sırayla gönderiyor; önce
  öyle yazıldı ve ölçüldü — "üç eşzamanlı" gerçekte tek tek gidiyor, kontroller
  "Listeme ekle"yi ve yeni aramayı arkalarında bekletiyordu.
- En çok 3 eşzamanlı istek; görünür sonuçlar sıranın başına (IntersectionObserver).
- Önbellek iki katmanlı: sunucu örneğinin belleği (24 saat) ve sayfa ömrü. Anahtar
  içerikten (karşılaştırılan alanlar); aynı yayın başka aramada çıkınca sorulmaz.
  Önbellekten dönen sonuç saatlik hakkı tüketmez.
- Yeni arama: eski aramanın bekleyenleri atılır, uçuştakiler iptal edilir
  (AbortController). Sonuç yalnızca içerik anahtarı güncel listede varsa ekrana
  uygulanır; eski aramanın yanıtı yeni listeyi değiştiremez.

## Ekleme

"Listeme ekle" ve "PDF'yi oku" kontrol edilmiş bilgiyi kullanır: öteki dizinin teyit
ettiği eksikler (DOI, yıl, dergi) yalnızca başlık ve ilk yazar tutmuş, hiçbir temel
alan farklı değilken doldurulur. Belirsiz eşleşmenin verisi kaynağa yazılmaz.
Kontrol sürüyorsa ekleme beklemez, sonucun kendi bilgisiyle yapılır.

## Kabul

```
ASAMA=normal node tasarim/makale-bul-kunye/betikler/kabul.mjs   # 13/13
# sunucuyu HTTPS_PROXY=http://127.0.0.1:9 ile (dizinlere ulaşamaz) yeniden başlat
ASAMA=ariza  node tasarim/makale-bul-kunye/betikler/kabul.mjs   # 5/5
```

Gerçek Crossref/OpenAlex'e karşı. Eski arama senaryosunda künye istekleri tarayıcıda
1,2 sn bekletilir (sunucu önbelleği sıcakken de ilk arama yarıda kalsın).
Birim testi: `tests/unit/arama-kunye-kontrolu.test.ts` (16).
