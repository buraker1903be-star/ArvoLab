# PDF çekmecesi (20.11.2026)

Onaylı karar: PDF, sağdan açılan geniş bir çekmecede editörün üstüne gelir. Bu karar 2. turdaki yan
yana yerleşimin yerine geçer.

- Editör daralmaz, kaymaz, yeniden ölçeklenmez; arkası hafifçe kararır.
- Başlangıç genişliği ekranın %65'idir. Genişlik kenardaki tutamakla ayarlanır ve saklanır. Tam
  ekran düğmesi vardır. Telefonda çekmece tam ekran açılır.
- Seçimde okuma alanı küçülmez: seçim araç çubuğu (Alıntı ekle, Yalnızca atıf, AI'a sor,
  Kopyala) ve kısa onay katmanı seçimin yanında açılır.
- PDF'e soru sorma çekmecenin içinde, ayrı bir görünümdedir. PDF'e dönünce okuma konumu yerindedir.
- Esc önce iç katmanı kapatır: önce kısa onay, sonra seçim, sonra AI görünümü, en son çekmece. Odak
  çekmecenin içinde döner. Çekmece kapanınca odak editöre döner.
- Kapatıp açınca sayfa, yakınlaştırma ve sayfa içi kaydırma korunur. Otomatik sığdırma yalnızca
  "Genişliğe sığdır" modunda çalışır.
- Alıntı kayıtlı editör konumuna yazılır. Alıntı ve atıf tek işlemdir (PR M2), tek geri almayla
  birlikte kaldırılır.

## Kabul

Kabul betiği: [`betikler/cekmece-kabul.mjs`](betikler/cekmece-kabul.mjs). Yerel yığında, sentetik
hesap ve veriyle, `next build` + `next start` üzerinde koşar.

- Son koşu: 22/22 kontrol geçti ([`kabul-sonucu.json`](kabul-sonucu.json)).
- Görseller: `gorseller/` (masaüstü 1440 ve 1280 px açık/kapalı, seçim, onay, ekleme, AI, tam ekran,
  telefon açık/kapalı).
- Yapay zekâ cevabı yerel model taklidinden gelir. Taklit bu soruda geçerli bir alıntı üretmediği için
  sunucu cevabı reddetti; görüntüdeki hata mesajı bu yüzdendir. Gerçek modelle bu kabulde
  denenmedi.

## Ek tur (20.11.2026, ikinci talimat)

- Telefonda çekmece alt gezinme dahil bütün ekranı örter; arkadaki sayfa kaydırılamaz (kök öğe
  `data-pdf-tam-ekran`). Başlık sade: kaynak seçici ayrıntılarda, "PDF'e sor" yalnızca simge; üç
  durum tek satırda ayrı işaretlerle, çipler dokununca açılır.
- Onay katmanında belgeye eklenecek TAM metin (alıntı + atıf) önizlenir; önizleme "Ekle" ile aynı
  yoldan, belgeye yazmadan kurulur. PDF sayfası (dosyadaki sıra, atfa girmez) ile basılı sayfa
  (atıfta, yalnızca kullanıcının yazdığı) ayrı satırlarda.
- Katman görünür alanın kenarlarına göre yerleşir (sağ kenar, uzun seçim, alt kenar).
- Kabul 33/33: sentetik PDF + **gerçek iki sütunlu akademik PDF** (TraceMonkey, PLDI 2009; pdf.js'in
  açık test derlemi). Dosya depoya konmadı; betik `GERCEK_PDF=<yol>` ile koşar. Ölçülenler: sol
  sütunda üç satırlık seçim sağ sütuna taşmıyor; iki adım yakınlaştırmadan sonra aynı seçim aynı
  metni veriyor; sunucu alıntıyı PDF metninde doğruluyor ve satır sonu tirelemesini birleştiriyor
  ("com-pile" → "compile"); eklenen metin doğrulanan dilim ve atıf önizlemesiyle birebir.
- Telefon klavyesi Playwright'ta görünür alanın daraltılmasıyla ÖYKÜNÜLDÜ (gerçek klavye değil).
