# Prova sonuçları (17.11.2026, yalnızca yerel yığın)

Ayrıntı ve yorum: `../RAPOR.md` §4. Bu klasördeki dosyalar betiklerin çıktısıdır.

| Ölçüm | Sonuç | Dosya |
|---|---|---|
| P1–P8 uygulama + tekrar (×2) | hepsi uygulandı; tekrar farkı 0 | `prova.log` |
| Son durum ↔ depo hedefi | 136 satır: tablo yetkisi 82, fonksiyon yetkisi 48, dizin 3, politika 3 | `son-fark-depo-hedefi.txt` |
| Kısmi hata + ters sıra | şema farkı 0; ters sıra = olağan sıra | `prova-hata.log` |
| Geri dönüş R8→R1 (×2) | paketlerden önceki özetle fark 0 | `prova-geri.log` |
| Kayıt bütünlüğü (`kayit-butunlugu.mjs yeni`) | 14/14 — P1–P6, P1–P8, son taklit | — |
| G1 (`kimlik-kabul.mjs`) | 15/15 — P1–P6, P1–P8, son taklit | — |
| DOI (`npm run test:doi-runtime`) | 29/29 | — |
| `rate_limit_take` (PostgREST, service_role) | 3 → 2 → 0 atomik; anon reddedilir | — |
| Yazım Stüdyosu | bkz. tablo | `studyo-kosulari.md` |
| Yönetici istemcisi yolları × Production yetkileri | 31 tablo×işlem + 4 RPC; 1 eksik (`profiles` DELETE, yetim profil yolu) | — |
| Gerçek AI modeli | UNVERIFIED (anahtar yok, yerel taklit) | — |
