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
