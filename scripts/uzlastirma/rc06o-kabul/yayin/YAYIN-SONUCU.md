# ArvoLAB yayın sonucu — 18.11.2026

| | |
|---|---|
| Canlı adres | https://lab.arvo-os.com |
| Production commit | `main` @ `ce23df74b2b63724a75cd57f881529bc28a8d636` (PR #108 merge commit; ağacı aday `a08b61d` ile aynı, `a77fd986…`) |
| Vercel Production dağıtımı | `dpl_4pBFTF7oJDz69hS1d8Xkbd8N86WC`, READY 09:02:34 UTC, alias `lab.arvo-os.com`. `main` push'u otomatik dağıtım üretmedi (~6 dk beklendi); aynı commit'ten Git kaynaklı Production dağıtımı başlatıldı |
| Önceki Production (geri dönüş adayı) | `dpl_APyCvwtvTpZQLwEThF3aDxiF76LX` (`b62bfcf`) |
| CI | #108 `kontrol` success (HEAD a08b61d); `main` push CI run 44271579330 başlatıldı |
| Yedek | 18.11.2026 05:00 UTC COMPLETED (kullanıcı, panel); izole geri yükleme provası kullanıcı kararıyla ATLANDI |

## Veritabanı işlemleri (Production, sırasıyla)
Ayrıntı ve her adımın karşılaştırması: `GUNLUK.md`, `denetim-ciktilari.txt`.
1. Dalga A — 97 sürüm geçmişe (yalnızca version + name; `statements` boş).
2. Onay K — 3 KISMİ sürüm geçmişe.
3. P1 birebir → geçmiş 1 sürüm.
4. P2 (işlevsiz `drop trigger if exists` çıkarıldı, `P2-uygulanan-varyant.sql`) → geçmiş 1.
5. P6 (iki işlevsiz drop çıkarıldı) → geçmiş 1.
6. P4 birebir → geçmiş 1.
7. P3 birebir → geçmiş 2.
8. P5 (üç işlevsiz drop çıkarıldı, `P5-uygulanan-varyant.sql`; veri adımı 0 satır) → geçmiş 3.
9. P8 birebir (`profiles.role` varsayılanı `client`; mevcut 2 `employee` hesabı değişmedi).
Son durum: geçmiş 121 kayıt = depodaki 121 sürüm, bekleyen 0, depoda olmayan 0. Şema özeti 1536 satır, md5 1507bd26…

**Kabul edilen istisnalar (kullanıcı onaylı, ek GRANT yok):** Production'da `postgres`'in public şemasındaki yeni fonksiyonları için varsayılan ACL `{postgres=X/postgres}`; yerel taklit bunu taşımadığından yerelde `service_role` EXECUTE vardı.
- `public.metin_surum_damgasi()` — Production EXECUTE yok (yerel `service_role`).
- `public.eposta_onayinda_sifreyi_temizle()`, `public.eposta_onayinda_profili_kur()` — aynı.
- `public.ilk_sifre_gerekli()` — Production yalnızca `authenticated` (yerel `authenticated,service_role`).
Hepsinde gövde, sahip (`postgres`), SECURITY DEFINER, `search_path` ve tetikleyici tanımları yerelle birebir.

## Canlı kontroller (lab.arvo-os.com) — hepsi PASS
kayıt → e-posta onayı (`/reset-password?ilk=1`) → ilk şifre → çalışma oluşturma → editörde yazma + kayıt + yenilemede geri gelme → Kaynaklar (Kaynakça sekmesi) → Word dışa aktarma (metin var) → çıkış → yeniden giriş + belge açık. Sayfa hatası 0. AI çağrısı yapılmadı.
Test hesabı Production'da duruyor: `delivered+arvolab-yayin-832748@resend.dev` (Resend test alıcısı; gerçek kişi yok), bir çalışma `3281d48f-…`. Silmek istenirse panelden.

## M.5 — kontrol anında hâlâ şifresi boş hesaplar
Pencere: P5 başlangıcı 08:50 UTC (11:50 TSİ) → yeni dağıtım 09:02:34 UTC; kontrol 09:07:51 UTC.
Sonuç: **0**. Aynı pencerede onaylanan hesap 0, açılan hesap 0.
Not: M.5 yalnızca kontrol anında şifresi hâlâ boş olanları sayar; arada "Şifremi unuttum" ile şifre belirleyenleri kaçırabilir. **Toplam etkilenen kullanıcı sayısı değildir.**

## Yayın dışı / ertelenen maddeler
| Madde | Durum |
|---|---|
| Auth A1 (Auth API'de mevcut şifre zorunluluğu, 12 karakter) | yayından sonra ayrı iş |
| P7 (akademik birim tetikleyicileri) | ertelendi |
| P9 (`service_role`'e `profiles` DELETE) | ertelendi; geri yükleme provası olmadan önerilmez |
| Hak iadesi (teknik arızada asistan hakkı) | ertelendi |
| İzole geri yükleme provası | atlandı (kullanıcı kararı); geri yüklenebilirlik sınanmadı |
| Dokunmatik kaydırma (U5-dokunma), Preview çalışma anı | UNVERIFIED (yayın öncesi raporda) |
| Mevcut 2 `employee` hesabı | dokunulmadı |
| Uzak dal temizliği (32 aday dal) | silme izni engellendi; yayından bağımsız |
| Vercel otomatik Production dağıtımı | incelendi (`VERCEL-OTOMATIK-DAGITIM.md`): kök neden kanıtlanamadı, ayar değişmedi; doğrulama sonraki onaylı yayında |
| Geçmiş kayıtlarında `statements` alanı | boş bırakıldı (CLI repair dosya SQL'ini yazar); sürüm karşılaştırması etkilenmez |
