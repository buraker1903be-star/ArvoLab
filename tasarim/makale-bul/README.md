# Makale Bul sadeleştirme + PDF durumları (M6/M7, 20.11.2026)

- **Tek alan + Ara + Filtreler.** Yıl, açık erişim ve çalışma seçimi
  "Filtreler"in altında, varsayılan kapalı. Etkin süzgeçler çip; × ile kalkar.
  Arama yapılmışsa süzgeç değişince 600 ms bekletilip yeniden aranır (sorgu
  metni tuş başına aranmaz).
- **Sonuçlar için PDF indirilmez.** Her sonucun PDF durumu "aranmadı" başlar.
- **"PDF'yi oku"** (yalnızca yazım ekranında):
  1. Kaynak çalışmaya "Okunacak" olarak eklenir. Çalışmada DOI ya da başlıkla
     zaten varsa yeniden eklenmez.
  2. Çalışmada hazır PDF varsa o açılır. Yoksa yalnızca o kayıt için açık
     erişim PDF'i aranır.
  3. PDF bulunursa çekmece açılır.
- **Geri al** yalnızca bu eylemin eklediği kaydı siler. Önceden var olan kayıtta
  görünmez. Çalışma seçili değilse çalışma oluşturulmaz.
- **Beş durum ayrı** (`lib/makale-pdf-durumu.ts`): aranmadı / aranıyor /
  bulundu / bulunamadı (kalıcı) / servis hatası (geçici, yeniden denenebilir).
  Yayıncı engeli ya da dizin arızası "bulunamadı" sayılmaz.

Kabul: `GERCEK_PDF=… node tasarim/makale-bul/betikler/kabul.mjs` — **11/11**.
Arama **canlı Crossref/OpenAlex**'e gider. Bu ortamda OpenAlex 429 dönüyordu;
Crossref art arda koşularda zaman zaman 429 verdi (betik bunu "dış servis"
diye ayırıp 2 ile çıkar). Next sunucusu bu konteynerde `NODE_USE_ENV_PROXY=1`
ile başlatılmalı (Node `fetch` vekil ayarını kendiliğinden kullanmıyor).
