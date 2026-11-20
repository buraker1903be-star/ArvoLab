# Kaynak bağlantıları ve durumları — M5/M9, 20.11.2026

Taban: `claude/m8-pdf-cekmecesi` (#118). PDF açan bütün girişler artık editörün
PDF çekmecesini kullanıyor; kaynağın kayıt / PDF / alıntı durumları tek kuraldan
(`lib/kaynak-durumu.ts`, testi `tests/unit/kaynak-durumu.test.ts`).

## Değişenler

| Yer | Eskiden | Şimdi |
|---|---|---|
| Kaynaklar sayfası, telefon | Uzun yazar listesi (nowrap) satırı 390 px'te 828 px'e çıkarıyor, sayfa yana kayıyordu; DOI bağlantısı üç noktanın arkasında kalıyordu | Satır gövdesi satır genişliğinde; dar ekranda künye satırı sarılır, DOI görünür |
| Kaynaklar sayfası | Kayda doğrudan adres yoktu | `?kaynak=<id>`: satır görünür alana kaydırılır, vurgulanır, odak alır; çalışma verilmezse kaydın çalışması seçilir |
| Kaynaklar sayfası | PDF eylemi yoktu | Satırda PDF durumu + "PDF'i oku" → editör çekmecesi |
| Kaynakça penceresi | "PDF'i aç" imzalı adresi yeni sekmede açıyordu (seçim, alıntı, AI yok) | "PDF'i oku" → editör çekmecesi; ham dosya için ayrı ve ikincil "İndir" |
| Editör | Çekmece yalnızca içeriden açılıyordu | `?sag=pdf&pdf=<id>&sayfa=<n>` çekmeceyi o PDF'le açar; istek bir kez işlenir, adresten silinir. Bilinmeyen kimlikte panel bunu SÖYLER |
| Atıf kartı | Üç durum ayrı satırlarda; DOI'si tutan BAĞLANMAMIŞ PDF "Açılabilir" diye onay tonunda | Kısa özet (üç çip) + "Ayrıntılar"; DOI eşleşmesi uyarı tonunda "DOI ile eşleşti"; "Kaynak kaydı" o kaydın kendisine gider |
| Editör Kaynaklar aracı | Aynı DOI'ye iki PDF düşünce kaynak sessizce "PDF yok" görünüyordu | "2 PDF aynı DOI'de" (uyarı), açılmaz; her kaynağın kaydına "Kayıt" bağlantısı |

Durum kuralı (üçü birbirinin yerine geçmez; tek bir "doğrulandı" yok). İlki "Künye" diye adlandırıldı: PDF çekmecesindeki "Kayıt" işareti PDF'in kaynak kaydına BAĞLI olup olmadığını söylüyor, aynı sözcük iki denetime verilmesin.
- **Künye:** dizin denetimi (doğrulandı / kısmen / uyuşmuyor / doğrulanamadı / denetlenmedi). Eksik alan, doğrulanmış künyeyi bile onay tonundan çıkarır.
- **PDF:** bağlı (onay) / tek DOI eşleşmesi (uyarı, açılır) / aynı DOI'de birden çok dosya (uyarı, AÇILMAZ) / yok.
- **Alıntı:** PDF metnine karşı birebir doğrulanmış pasaj (sayfa PDF'in kendi numarası) / yok.

## Kabul

`node tasarim/kaynak-baglantilari/betikler/kabul.mjs` — yerel yığın, sentetik
hesap ve PDF'ler, **21/21** (`kabul-sonucu.json`). iPhone 13 ve 1440 px.
Telefonda tam ekran PDF çekmecesinin alt gezinmeyi örttüğü ölçüldü
(`gorseller/telefon-cekmece-tam-ekran.png`: panel 0–664 px, ekranın altındaki
nokta panelin içinde).

**Tarayıcıda sınanmayan:** Kaynakça penceresindeki "PDF'i oku" bağlantısı
(pencere bir kaynakça denetimi sonucu gerektiriyor). Bağlantı, sınanan editör
adresini (`editorPdfAdresi`) üretiyor.
