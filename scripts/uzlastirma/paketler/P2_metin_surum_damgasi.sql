-- ============================================================
-- P2_metin_surum_damgasi  (RELEASE CLOSURE 06 hazırlık paketi — Production'a UYGULANMADI)
-- Amaç: Metin kaydının veritabanı sürüm damgası (eşzamanlı kayıtta eski sürümün üzerine yazmayı önler).
-- ÖN KOŞUL (salt okunur): select count(*) from pg_trigger where tgname='metin_surum_damgasi';  -- 0
-- DOĞRULAMA (uygulama sonrası): select tgname, pg_get_triggerdef(oid) from pg_trigger where tgname='metin_surum_damgasi';  -- BEFORE UPDATE ON public.project_manuscripts
-- DURDURMA: Tetikleyici oluşmazsa ya da project_manuscripts'e örnek UPDATE (işlem içinde, geri alınarak) hata verirse dur.
-- GERİ DÖNÜŞ: işlem tek transaction; hata olursa hiçbir şey kalmaz. Uygulandıktan
--   sonra geri almak için: scripts/uzlastirma/paketler/GERI_DONUS.md
-- Tekrar çalıştırılabilir (create or replace / if not exists / drop … if exists).
-- ============================================================
begin;
-- ===== 20261115203504_metin_surum_damgasi.sql (birebir) =====
-- P52a2: project_manuscripts.updated_at'i VERİTABANI yazar ve satır başına
-- kesin artar.
--
-- updated_at iyimser kilidin anahtarı: kayıt "satır hâlâ editörün açtığı
-- damgada mı?" diye sorulup yapılıyor (lib/metin-yazimi.ts). Eskiden damgayı
-- uygulama sunucusu yazıyordu (new Date().toISOString(), milisaniye) ve
-- tabloda hiçbir tetikleyici yoktu. Üç sonucu vardı:
--   1. Aynı milisaniyede yapılan iki kayıt AYNI damgayı alabiliyordu; o
--      zaman eski sürümden yazan ikinci sekmenin kaydı çakışmaya düşmeden
--      geçiyor, öteki sekmenin metni sessizce eziliyordu.
--   2. Damga sunucunun saatine bağlıydı: ayrı örneklerin saatleri farklıysa
--      damga geriye gidebiliyordu.
--   3. Doğrudan API'den (oturum jetonu tarayıcıda) updated_at ESKİ bir
--      değere yazılabiliyordu; kilit gören bir değer elle geri çekilebiliyordu.
-- Tetikleyici üçünü de kapatıyor: damga clock_timestamp() (mikrosaniye),
-- güncellemede en az bir önceki damga + 1 mikrosaniye. Gönderilen değer yok
-- sayılır. Uygulama değeri göndermeye devam ediyor: bu migration'ın
-- uygulanmadığı bir veritabanında eski davranış sürer, kayıt düşmez.
--
-- Her güncelleme damgayı ilerletir (içerik değişmese bile): kilidin
-- anlamı "satıra dokunan oldu mu?" ve bunu yalnızca bu cevaplar.

create or replace function public.metin_surum_damgasi()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_at := clock_timestamp();
  else
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  end if;
  return new;
end;
$$;

-- Tetikleyici işlevi çağıranın EXECUTE yetkisine bakılmadan çalışır; doğrudan
-- çağrılmasının anlamı yok, herkese kapalı.
revoke all on function public.metin_surum_damgasi() from public, anon, authenticated;

drop trigger if exists metin_surum_damgasi on public.project_manuscripts;
create trigger metin_surum_damgasi
  before insert or update on public.project_manuscripts
  for each row execute function public.metin_surum_damgasi();

commit;
