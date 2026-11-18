# Production yayın günlüğü (18.11.2026) — aday a08b61d

| Adım | İşlem | Sonuç |
|---|---|---|
| Ön koşul | salt okunur | geçmiş 12 eski kayıt; onaysız hesap 0; P5 veri adımı 0; dokunulacak 17 nesne yerel taklitle birebir; özet 1518 satır, md5 52c53165… |
| Dalga A | 97 sürüm geçmişe (version, name; statements boş) | geçmiş 109, bekleyen 12 |
| Onay K | 3 sürüm geçmişe | geçmiş 112, şema özeti değişmedi |
| P1 | paket + geçmiş 20261112195236 | toplam 1520 = beklenen; 17 nesne birebir |
| P2 | `P2-uygulanan-varyant.sql` (drop if exists çıkarıldı) | toplam 1523 = beklenen; **1 fark**: `fonksiyon_yetki public.metin_surum_damgasi()` Production `-` (hiçbir uygulama rolünde EXECUTE yok), yerel `service_role`. Neden: Production'da `postgres`'in public şemasındaki fonksiyonlar için varsayılan yetkisi `{postgres=X/postgres}` (anon/authenticated/service_role'e otomatik EXECUTE YOK); yerel taklit bu varsayılanı taşımıyor. Paket metni service_role'e grant yazmıyor. Geçmiş kaydı YAZILMADI; karar bekleniyor |
