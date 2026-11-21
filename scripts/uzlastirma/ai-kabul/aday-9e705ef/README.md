# Gerçek AI kabulü — aday 9e705ef (hazır, koşulmadı)

Dört deneme: TR/EN cümle tamamlama (Alt+/), anlamı koruyan kısaltma (olumsuzluk, sayı, atıf),
sentetik test PDF'ine cevabı olan ve olmayan soru. Sentetik çalışma ve PDF, yalnızca yerel yığın.

Bütçe: 21.11.2026'da 1 istek harcandı (401: oturumdaki anahtar eskiydi). Kalan en çok 7;
`baslat.sh` vekil sınırı 7. 401 gelince betik ilk denemede durur.

Yeni oturumda (ortam değişkeni ancak oturum açılırken yüklenir), birleşik adayın temiz
ağacında (`git checkout 9e705ef`, `next build`), yerel yığın ayaktayken:

    CIKTI=/tmp/ai-kabul ORTAM=<yerel yığın ortam dosyası> bash scripts/uzlastirma/ai-kabul/aday-9e705ef/baslat.sh
    CIKTI=/tmp/ai-kabul VEKIL_GUNLUK=/tmp/ai-kabul/saglayici-istekleri.jsonl URL=http://localhost:3124 \
      node scripts/uzlastirma/ai-kabul/aday-9e705ef/kabul.mjs

Anahtar yalnızca next sürecinin AI_ANAHTAR'ına geçer; yazdırılmaz. Sonuç: $CIKTI/sonuc.json
(girdi, görünen yanıt, süre, asistan kaydının durumu/elenme nedeni).
