-- ============================================================
-- İki eksik: anon'un tablolardaki artık yetkileri ve analiz sonucunun
-- başkasının çalışmasına bağlanabilmesi.
--
-- ---------- 1) anon'un tablo yetkileri ----------
-- Supabase yeni tabloları kendiliğinden anon ve authenticated'a AÇIYOR
-- (alter default privileges … grant all on tables). Bu projede
-- migration'lar bir süredir bunu geri alıyor (individual_subscriptions,
-- notifications, product_feedback, kaynak_dogrulama_onbellegi) ama eski
-- tablolarda ve yeni açılan analiz_sonuclari'nda geri alınmamış:
-- 19 tabloda anon'un DELETE, INSERT, SELECT, UPDATE, TRUNCATE yetkisi var.
--
-- Bugün sömürülebilir değil çünkü RLS her tabloda açık ve HİÇBİR
-- politika anon'u hedeflemiyor — anon'a hiçbir satır görünmüyor. Ama
-- TRUNCATE RLS'e tabi DEĞİLDİR; bugün PostgREST onu dışarı açmadığı için
-- erişilemiyor, yani koruma bizim kararımız değil, aracın o anki
-- davranışı. Güvenliği araca emanet etmemek gerekir.
--
-- anon bu uygulamada hiçbir tabloya erişmiyor: giriş yapılmamış sayfalar
-- (/, /auth, /share) tabloyu ya hiç okumuyor ya servis anahtarıyla
-- okuyor, tarayıcı istemcisi yalnızca /dashboard içinde kullanılıyor ve
-- orada rol authenticated. Dolayısıyla anon'dan hepsini almak hiçbir
-- yolu kırmıyor.
--
-- authenticated'ın SELECT/INSERT/UPDATE/DELETE yetkilerine DOKUNULMUYOR:
-- erişimi RLS yönetiyor ve bir politikanın atlandığı yerde yetkiyi
-- kaldırmak çalışan bir akışı sessizce kırardı. Yalnızca PostgREST'in
-- hiç kullanmadığı üçü (TRUNCATE, TRIGGER, REFERENCES) alınıyor.
--
-- ---------- 2) Analiz sonucu ↔ çalışma bağı ----------
-- analiz_sonuclari.project_id istemciden geliyor ve doğrulanmıyordu:
-- kayıt başkasının çalışmasına bağlanabiliyordu. RLS engellemiyor, çünkü
-- insert politikası yalnızca owner_id'ye bakıyor. Bugün görünür bir
-- sonucu yok (kayıtlar yalnızca owner_id ile okunuyor), ama çalışma
-- merkezine "bu çalışmanın analizleri" eklendiği gün açılır.
--
-- Aynı hata document_uploads ve citation_checks'te yaşanıp
-- 20260924100001'de düzeltilmişti; oradaki tetikleyici burada da
-- kullanılıyor — kural tek yerde kalsın.
-- ============================================================

-- ---------- 1) anon'dan tablo yetkileri ----------
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on public.%I from anon', t.tablename);
    execute format('revoke truncate, trigger, references on public.%I from authenticated', t.tablename);
  end loop;
end
$$;

-- Bundan sonra açılan tablolar da anon'a kapalı doğsun. Supabase'in
-- kurulumda verdiği varsayılanı geri alıyoruz; authenticated'ınki
-- duruyor, onu her migration kendi ihtiyacına göre daraltıyor.
alter default privileges in schema public revoke all on tables from anon;

-- ---------- 2) Analiz sonucu başkasının çalışmasına bağlanamasın ----------
drop trigger if exists guard_analiz_sonucu_project_trigger on public.analiz_sonuclari;
create trigger guard_analiz_sonucu_project_trigger
  before insert or update of project_id on public.analiz_sonuclari
  for each row execute function public.guard_project_link_insert();

notify pgrst, 'reload schema';
