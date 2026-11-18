# Production yayın günlüğü (18.11.2026) — aday a08b61d

Geçmiş kayıtlarına yalnızca sürüm ve ad yazıldı (`statements` boş). Her paketten sonra Production
şema özeti (toplam satır + dokunulan 17 nesnenin özet satırları) yereldeki aynı adımla karşılaştırıldı
(`denetim-ciktilari.txt`).

| Adım | İşlem | Sonuç |
|---|---|---|
| Ön koşul | salt okunur | geçmiş 12 eski kayıt; onaysız hesap 0; P5 veri adımı 0; dokunulacak 17 nesne yerel taklitle birebir; özet 1518 satır, md5 52c53165… |
| Dalga A | 97 sürüm geçmişe | geçmiş 109, bekleyen 12 |
| Onay K | 3 sürüm geçmişe | geçmiş 112, şema özeti değişmedi |
| P1 | paket birebir + geçmiş 20261112195236 | 1520 = beklenen; birebir |
| P2 | `P2-uygulanan-varyant.sql` (işlevsiz drop çıkarıldı) + geçmiş 20261115203504 | 1523 = beklenen. **İstisna (kullanıcı onaylı):** `metin_surum_damgasi()` EXECUTE Production `{postgres=X}` ↔ yerel `+service_role`. Sahip postgres, secdef=false, search_path='', gövde md5 949f38c4…, tetikleyici tanımı birebir. Neden: Production'da postgres'in public fonksiyonları için varsayılan ACL `{postgres=X/postgres}`. Yerel dar kontrol: aynı ACL'de belge kaydı (`authenticated`, app/actions/manuscript.ts) çalıştı, damgayı tetikleyici yazdı |
| P6 | işlevsiz iki drop çıkarıldı (tetikleyiciler yoktu) + geçmiş 20260913120000 | 1525 = beklenen; birebir (P2 istisnası dışında) |
| P4 | paket birebir + geçmiş 20260926131150 | 1525 = beklenen; birebir |
| P3 | paket birebir + geçmiş 20260924100026, 20260924100027 | 1528 = beklenen; birebir |
| P5 | `P5-uygulanan-varyant.sql` (üç işlevsiz drop çıkarıldı), ~08:50 UTC; geçmiş 20261106184046, 20261107113542, 20261107120542 (kullanıcı ilk_sifre_gerekli istisnasını onayladıktan sonra) | 1536 = beklenen. İki tetikleyici fonksiyonu (onaylı istisna): sahip postgres, secdef=true, search_path='', gövde ve tetikleyici tanımları birebir, ACL `{postgres=X}`. **İkinci istisna (kullanıcı onaylı, yalnızca bu fonksiyon, ek GRANT yok):** `ilk_sifre_gerekli()` EXECUTE Production `authenticated` ↔ yerel `authenticated,service_role` (aynı varsayılan-ACL nedeni). Gövde/secdef/search_path birebir. Uygulamadaki üç çağıran (auth-guards, auth/confirm, actions/auth) kullanıcı oturumuyla çağırıyor; fonksiyon `auth.uid()` ile çalışıyor |
| P8 | paket birebir (`profiles.role` varsayılanı `client`) | `profiles.role` özet satırı yerelle aynı (732b2918…); 2 `employee` hesabı değişmedi; toplam 1536 |
| Son durum | — | geçmiş 121, bekleyen 0, depoda olmayan kayıt 0; şema özeti 1536 satır, md5 1507bd26… |
| #108 | CI `kontrol` success, HEAD a08b61d doğrulandı; Draft → hazır; merge commit (beklenen HEAD sabit) | `main` = ce23df74b2b63724a75cd57f881529bc28a8d636, ağacı a08b61d ile aynı (a77fd986…) |
| Dağıtım | `main` push'u otomatik Production dağıtımı üretmedi (~6 dk beklendi); aynı commit'ten Git kaynaklı Production dağıtımı başlatıldı | dpl_4pBFTF7oJDz69hS1d8Xkbd8N86WC |
| Canlı zincir (lab.arvo-os.com, yeni test hesabı `delivered+arvolab-yayin-832748@resend.dev`) | kayıt → e-posta onayı → ilk şifre → çalışma → editör kaydı → Kaynaklar → Word → çıkış → yeniden giriş | hepsi PASS; sayfa hatası 0 (`canli/`). Onay bağlantısı, e-postadakiyle aynı biçimde, test hesabının `confirmation_token` değerinden kuruldu (salt okunur) |
| M.5 | P5 başlangıcı 08:50 UTC (11:50 TSİ) → dağıtım 09:02:34 UTC; kontrol 09:07:51 UTC | **kontrol anında hâlâ şifresi boş hesap: 0**; aynı pencerede onaylanan hesap 0, açılan hesap 0. M.5 toplam etkilenen kullanıcı sayısı DEĞİLDİR |
