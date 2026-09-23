-- ============================================================
-- Akademik kaynak doğrulaması önbelleğe alınıyor.
--
-- Doğrulama her çalıştırmada aynı künyeleri yeniden soruyordu: öğrenci bir
-- yazım hatasını düzeltip denetimi tekrarladığında Crossref ve OpenAlex'e
-- aynı 25 künye için yine 50 istek gidiyordu.
--
-- Asıl zarar sınırdaydı. 25 künyelik ağ sınırı KOTA DEĞİL NEZAKET gereği
-- konmuştu (iki dizin de ücretsiz), ama o sınır boşa giden isteklerle
-- doluyordu ve 120 kaynaklı bir tezde 95 künyeye HİÇ bakılamıyordu.
--
-- Önbellekle sınır yalnızca daha önce bakılmamış künyelere harcanıyor:
-- uzun kaynakça birkaç çalıştırmada tamamen kapanıyor, dizinlere giden
-- yük de düşüyor.
--
-- ÖNBELLEK PLATFORM GENELİNDE ORTAK, kullanıcı başına değil. Aynı DOI
-- herkes için aynı sonucu verir; çok kullanılan bir kaynak bir kez
-- sorulup herkese yetiyor. Kullanıcıya özel hiçbir şey saklanmıyor:
-- anahtar normalleştirilmiş biçim (lib/kaynak-anahtari.ts), değer de
-- dizinden dönen KAMUYA AÇIK künye bilgisi. Öğrencinin yazdığı ham metin
-- buraya girmiyor.
-- ============================================================

create table if not exists public.kaynak_dogrulama_onbellegi (
  -- Normalleştirilmiş "başlık kelimeleri|yıl" (lib/kaynak-anahtari.ts).
  anahtar text primary key,
  -- 'verified' | 'possible_match' | 'not_found'
  durum text not null check (durum in ('verified', 'possible_match', 'not_found')),
  /*
    Dizinden dönen eşleşmeler. Ham künye ve Google Scholar bağlantısı
    BURADA DEĞİL: ikisi de kullanıcının girdisinden türüyor ve her
    çağrıda yerelde yeniden üretiliyor.
  */
  eslesmeler jsonb not null default '[]'::jsonb,
  en_iyi jsonb,
  gecerlilik timestamptz not null,
  created_at timestamptz not null default now()
);

comment on table public.kaynak_dogrulama_onbellegi is
  'Crossref/OpenAlex doğrulama sonuçları. Platform geneli ortak, kullanıcıya özel veri içermez.';

/*
  Süresi geçmiş satır okunmasın diye indeks gecerlilik üzerinde; temizlik
  de bunu kullanıyor.
*/
create index if not exists kaynak_dogrulama_onbellegi_gecerlilik_idx
  on public.kaynak_dogrulama_onbellegi (gecerlilik);

alter table public.kaynak_dogrulama_onbellegi enable row level security;

/*
  POLİTİKA YOK. Önbelleği yalnızca sunucudaki doğrulama yolu okuyup
  yazıyor. İstemciye açılsaydı, kullanıcı "bu künye doğrulandı" satırını
  kendisi yazabilirdi — yani uydurma bir kaynağı sisteme doğrulanmış
  gösterebilirdi. Akademik denetimde bundan ağır bir açık yok.
*/
revoke all on public.kaynak_dogrulama_onbellegi from anon, authenticated;
grant select, insert, update, delete on public.kaynak_dogrulama_onbellegi to service_role;

-- ---------------------------------------------------------------------------
-- Temizlik
-- ---------------------------------------------------------------------------
/*
  Süresi dolan satırlar siliniyor. Doğrulama yolu zaten süreyi kontrol
  ediyor (geçmişse dizine tekrar soruyor), bu yalnızca tablonun sonsuza
  kadar büyümesini engelliyor.
*/
create or replace function public.kaynak_onbellegini_temizle()
returns integer
language sql
security definer
set search_path = ''
as $$
  with silinen as (
    delete from public.kaynak_dogrulama_onbellegi
    where gecerlilik < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer from silinen;
$$;

revoke all on function public.kaynak_onbellegini_temizle() from public, anon, authenticated;
grant execute on function public.kaynak_onbellegini_temizle() to service_role;
