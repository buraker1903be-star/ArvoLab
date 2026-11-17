-- ============================================================
-- R2 — P2_metin_surum_damgasi paketinin GERİ DÖNÜŞÜ (RELEASE CLOSURE 06; Production'a UYGULANMADI)
-- Kod tetikleyicisiz veritabanında da çalışır (kayit-butunlugu.mjs MIGRATIONSIZ=1); yalnızca tetikleyiciye bağlı iki koruma (S4 yedekten sonra yazılan metin, S11 damganın geri çekilememesi) kalkar. Veri kaybı yok: sürüm sütunu tetikleyiciden önce de vardı.
-- Tek işlem: hata olursa hiçbir şey değişmez. Tekrar çalıştırılabilir.
-- Sınandığı yer: scripts/uzlastirma/prova-geri.sh (paket + geri dönüş = paketten önceki şema özeti).
-- ============================================================
begin;
drop trigger if exists metin_surum_damgasi on public.project_manuscripts;
drop function if exists public.metin_surum_damgasi();
commit;
