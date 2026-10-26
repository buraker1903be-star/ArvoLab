/*
  KANIT ZİNCİRİ, MAKALE ÇALIŞMA ALANI VE LİTERATÜR TARAMA GÜNLÜĞÜ (26.10.2026).

  Üç tablo, tek bir ilke: sistem bir doğrulamayı GERÇEKTEN yapmadıysa
  yapmış gibi görünemesin. Bu ilkenin uygulamadaki karşılığı ekranda
  bir etiket; burada ise kısıt. Etiketi yanlış basmak tek satırlık bir
  hata, kısıtı atlamak ise mümkün değil.

  1) kanit_kayitlari — bir akademik iddianın kanıt zinciri:
       iddia → metin içi atıf → kaynak kaydı → özgün yayın → kanıt → sonuç
     Dört kontrol BİRBİRİNDEN BAĞIMSIZ sütunlarda: künye (kaynak var mı,
     bilgileri doğru mu), erişim (açık erişimli tam metin var mı),
     incelenen metin (hangi metne bakıldı) ve destek düzeyi (iddia ile
     kanıt uyumlu mu). Tek bir "doğrulandı" sütunu yok: künyenin
     doğrulanmış olması kaynağın iddiayı desteklediği anlamına gelmez.

  2) makale_profili — makale türündeki çalışmanın dergi, tür, sınırlar
     ve araştırma sorusu bilgisi. Tez çalışma merkeziyle aynı
     academic_projects satırına bağlı: kaynak, veri ve analiz altyapısı
     ortak, iş akışı ayrı.

  3) literatur_tarama_gunlugu — hangi dizinde, hangi sorguyla, hangi
     tarihte, hangi filtrelerle arama yapıldığı ve kaç sonuç gösterildiği.
     Sistem yalnızca gerçekten taradığı kaynaklar üzerinden konuşabilsin
     diye: "kapsamlı tarama yapıldı" demek yerine günlüğü göstermek.
*/

-- ---------- 0) Asistan kayıtlarında iki yeni yetenek ----------
--
-- Kanıt değerlendirmesi ve makale bölüm denetimi de ai_assistant_runs'a
-- yazılıyor (AGENTS.md: "Her asistan çalışması kaydedilir"). Yeni ret
-- nedeni "alinti": model kaynakta GEÇMEYEN bir alıntı döndürdüyse cevabın
-- tamamı düşüyor (lib/ai/kanit-degerlendirme.ts).
alter table public.ai_assistant_runs drop constraint if exists ai_assistant_runs_capability_check;
alter table public.ai_assistant_runs
  add constraint ai_assistant_runs_capability_check
  check (capability in ('analiz', 'kaynakca', 'literatur', 'belge', 'kanit', 'makale'));

alter table public.ai_assistant_runs drop constraint if exists ai_assistant_runs_reject_reason_check;
alter table public.ai_assistant_runs
  add constraint ai_assistant_runs_reject_reason_check
  check (reject_reason in ('uydurma_sayi', 'kunye', 'bos', 'alinti'));

-- ---------- 1) Kanıt metni normalleştirme ----------
--
-- Alıntının incelenen metinde geçip geçmediği burada ve uygulamada
-- (lib/kanit/alinti.ts) AYNI kuralla bakılıyor. İkisi ayrışırsa uygulamanın
-- "metinde var" dediği alıntıyı veritabanı reddeder ya da tersi; ikisini
-- birbirine karşı sınayan test tests/db/kanit-zinciri.test.mjs.
--
-- Yalnızca dizgi biçimi eşitleniyor, anlam değil: PDF'ten kopyalanan
-- metinde satır sonu tirelemesi, kıvrık tırnak, uzun tire ve yumuşak tire
-- olur; öğrencinin aynı cümleyi elle düz tırnakla yazması "uydurma alıntı"
-- sayılmamalı. Büyük/küçük harf KORUNUYOR: harf değiştirilmiş alıntı
-- doğrudan alıntı değildir.
create or replace function public.kanit_metni_normallestir(p_metin text)
returns text
language sql
immutable
set search_path = public
as $$
  -- Adımlar ve sırası lib/kanit/alinti.ts ile birebir. Boşluk sınıfı
  -- açıkça yazılı (\s değil): \s Postgres'te yerel ayara, JavaScript'te
  -- Unicode'a göre değişiyor ve iki taraf aynı metne farklı karar veriyordu.
  select btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                replace(normalize(coalesce(p_metin, ''), NFC), chr(173), ''),
                '[‘’‚‛]', '''', 'g'),
              '[“”„‟]', '"', 'g'),
            '[‐‑–—―]', '-', 'g'),
          '[' || chr(160) || chr(8199) || chr(8201) || chr(8239) || ']', ' ', 'g'),
        '-[ \t]*\r?\n[ \t]*', '', 'g'),
      '[ \t\r\n\f\v]+', ' ', 'g')
  )
$$;

revoke all on function public.kanit_metni_normallestir(text) from public, anon, authenticated;
grant execute on function public.kanit_metni_normallestir(text) to service_role;

-- ---------- 2) Kanıt kayıtları ----------

create table if not exists public.kanit_kayitlari (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.academic_projects(id) on delete cascade,
  olusturan uuid not null default auth.uid() references auth.users(id) on delete cascade,

  -- İddia ve bağlamı
  iddia text not null check (char_length(iddia) between 5 and 2000),
  bolum text check (bolum is null or char_length(bolum) <= 200),
  atif text check (atif is null or char_length(atif) <= 300),
  kaynak_id uuid references public.literature_sources(id) on delete set null,

  -- A. Bibliyografik doğrulama (Crossref / OpenAlex)
  kunye_durumu text not null default 'bakilmadi'
    check (kunye_durumu in ('bakilmadi', 'dogrulandi', 'kismen', 'uyusmuyor', 'dogrulanamadi')),
  kunye_ayrintisi jsonb,
  kunye_kaynagi text check (kunye_kaynagi in ('crossref', 'openalex')),
  kunye_bakildi timestamptz,

  -- Tam metne erişim (OpenAlex'in açık erişim bilgisi; içerik getirilmiyor)
  erisim_durumu text not null default 'bilinmiyor'
    check (erisim_durumu in ('bilinmiyor', 'acik_erisim', 'acik_erisim_yok')),
  erisim_adresi text check (erisim_adresi is null or char_length(erisim_adresi) <= 1000),

  -- B. İncelenen metin: kullanıcının kaynaktan aldığı bölüm
  incelenen_metin text check (incelenen_metin is null or char_length(incelenen_metin) <= 20000),
  -- Kullanıcının BEYANI: yapıştırdığı metin kaynağın tamamı mı, bir bölümü mü.
  incelenen_kapsam text check (incelenen_kapsam in ('bolum', 'tam_metin')),
  incelenen_surum text check (incelenen_surum is null or char_length(incelenen_surum) <= 300),
  -- Sayfa/bölüm/tablo: YALNIZCA kullanıcı yazar, sistem tahmin etmez.
  konum text check (konum is null or char_length(konum) <= 200),
  alinti text check (alinti is null or char_length(alinti) between 1 and 1000),

  -- C. İddia–kanıt uyumu
  destek_duzeyi text not null default 'degerlendirilmedi'
    check (destek_duzeyi in ('degerlendirilmedi', 'dogrudan', 'kismen', 'dolayli', 'celisiyor', 'dogrulanamadi')),
  degerlendiren text check (degerlendiren in ('asistan', 'kullanici')),
  gerekce text check (gerekce is null or char_length(gerekce) <= 2000),
  asistan_kaydi uuid references public.ai_assistant_runs(id) on delete set null,
  degerlendirildi timestamptz,
  insan_incelemesi text not null default 'bekliyor' check (insan_incelemesi in ('bekliyor', 'yapildi')),

  -- Kanıt matrisi notları (kullanıcının kendi notları)
  celisen text check (celisen is null or char_length(celisen) <= 1000),
  eksik_kanit text check (eksik_kanit is null or char_length(eksik_kanit) <= 1000),
  duzeltme text check (duzeltme is null or char_length(duzeltme) <= 1000),

  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now(),

  /*
    METİNSİZ HÜKÜM YOK. "Doğrudan destekleniyor", "kısmen", "dolaylı" ya
    da "çelişiyor" demek için incelenmiş bir metin ve o metinden bir alıntı
    şart. Kanıt yoksa söylenebilecek tek şey "doğrulanamadı"dır.
  */
  constraint kanit_metinsiz_hukum_yok check (
    destek_duzeyi in ('degerlendirilmedi', 'dogrulanamadi')
    or (incelenen_metin is not null and alinti is not null)
  ),
  constraint kanit_degerlendiren_hukumle check (
    (destek_duzeyi = 'degerlendirilmedi') = (degerlendiren is null)
  ),
  constraint kanit_alinti_metinle check (alinti is null or incelenen_metin is not null),
  constraint kanit_kapsam_metinle check (incelenen_kapsam is null or incelenen_metin is not null),
  /* Künye sonucu bir dizine dayanmalı: hangi dizinin, ne zaman söylediği. */
  constraint kanit_kunye_kaynakli check (
    kunye_durumu = 'bakilmadi' or (kunye_kaynagi is not null and kunye_bakildi is not null)
  )
);

create index if not exists kanit_kayitlari_project_idx on public.kanit_kayitlari(project_id, olusturuldu);
create index if not exists kanit_kayitlari_kaynak_idx on public.kanit_kayitlari(kaynak_id);

/*
  Tablo kısıtlarının yakalayamadığı üç kural:

  1. Alıntı incelenen metinde GEÇMELİ (normalleştirilmiş biçimde). Model
     ya da kullanıcı kaynakta olmayan bir cümleyi "kanıt" diye kaydedemez.
  2. Metin ya da iddia değişirse eski değerlendirme düşer. Başka bir
     metne verilmiş "doğrudan destekleniyor" hükmü, yeni metinde
     taşınamaz — eskiden kalan bir etiket en sinsi yanlış güvendir.
     Kaynak değişirse künye ve erişim sonucu da düşer.
  3. Kaynak, kaydı yazanın erişebildiği bir kaynak olmalı: kendi
     literatür listesi ya da aynı çalışmaya bağlı bir kaynak. Yabancı
     bir kaynağın kimliği tahmin edilip bağlanamaz.

  Ayrıca "asistan değerlendirdi" diyen kayıt, aynı kullanıcının "kanit"
  yeteneğindeki TAMAMLANMIŞ bir asistan çalışmasına bağlı olmalı. O
  kaydın içeriği sonradan değiştirilemiyor (guard_ai_run_update); hüküm
  neye dayandığı görülebilen bir kayda bağlanmış oluyor.

  SECURITY DEFINER: normalleştirme fonksiyonu kimseye açık değil
  (yukarıda). Kaynak denetimi RLS'e güvenmek yerine sahipliği açıkça
  yazıyor.
*/
create or replace function public.kanit_kaydi_denetle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.guncellendi := now();

  if tg_op = 'UPDATE' then
    if new.kaynak_id is distinct from old.kaynak_id then
      new.kunye_durumu := 'bakilmadi';
      new.kunye_ayrintisi := null;
      new.kunye_kaynagi := null;
      new.kunye_bakildi := null;
      new.erisim_durumu := 'bilinmiyor';
      new.erisim_adresi := null;
    end if;

    if (new.incelenen_metin is distinct from old.incelenen_metin or new.iddia is distinct from old.iddia)
       and new.destek_duzeyi is not distinct from old.destek_duzeyi
       and new.degerlendirildi is not distinct from old.degerlendirildi then
      new.destek_duzeyi := 'degerlendirilmedi';
      new.degerlendiren := null;
      new.gerekce := null;
      new.asistan_kaydi := null;
      new.degerlendirildi := null;
      new.insan_incelemesi := 'bekliyor';
    end if;

    /*
      Eskiden kalan alıntı yeni metinde artık geçmiyorsa sessizce düşer
      (metin değişti, alıntı onunla gitti). YENİ yazılan bir alıntı
      geçmiyorsa aşağıda hata verir: kullanıcı bilerek bir şey yazdı ve
      neden kabul edilmediğini görmeli.
    */
    if new.alinti is not null
       and new.alinti is not distinct from old.alinti
       and new.incelenen_metin is distinct from old.incelenen_metin
       and position(public.kanit_metni_normallestir(new.alinti)
                    in public.kanit_metni_normallestir(new.incelenen_metin)) = 0 then
      new.alinti := null;
    end if;

    -- Kaydı yazan değiştirilemez.
    new.olusturan := old.olusturan;
    new.project_id := old.project_id;
  end if;

  if new.alinti is not null
     and position(public.kanit_metni_normallestir(new.alinti)
                  in public.kanit_metni_normallestir(new.incelenen_metin)) = 0 then
    raise exception 'Alıntı incelenen metinde geçmiyor. Kanıt olarak yalnızca kaynaktaki metin kaydedilebilir.'
      using errcode = '23514';
  end if;

  if new.kaynak_id is not null
     and (tg_op = 'INSERT' or new.kaynak_id is distinct from old.kaynak_id)
     and auth.uid() is not null
     and not exists (
       select 1 from public.literature_sources s
       where s.id = new.kaynak_id
         and (s.owner_id = auth.uid() or s.project_id = new.project_id)
     ) then
    raise exception 'Bu kaynağa erişiminiz yok.' using errcode = '42501';
  end if;

  if new.degerlendiren = 'asistan'
     and (tg_op = 'INSERT' or new.asistan_kaydi is distinct from old.asistan_kaydi
          or new.destek_duzeyi is distinct from old.destek_duzeyi)
     and not exists (
       select 1 from public.ai_assistant_runs r
       where r.id = new.asistan_kaydi
         and r.capability = 'kanit'
         and r.status = 'completed'
         and (auth.uid() is null or r.user_id = auth.uid())
     ) then
    raise exception 'Asistan değerlendirmesi tamamlanmış bir asistan kaydına bağlanmalı.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.kanit_kaydi_denetle() from public, anon, authenticated;
grant execute on function public.kanit_kaydi_denetle() to service_role;

drop trigger if exists kanit_kaydi_denetle on public.kanit_kayitlari;
create trigger kanit_kaydi_denetle
  before insert or update on public.kanit_kayitlari
  for each row execute function public.kanit_kaydi_denetle();

alter table public.kanit_kayitlari enable row level security;

revoke all on public.kanit_kayitlari from public, anon, authenticated;
grant select, insert, update, delete on public.kanit_kayitlari to authenticated;
grant all on public.kanit_kayitlari to service_role;

/*
  Okuma çalışmanın görünürlüğünü izler (calisma_kilavuzu ile aynı
  desen): academic_projects'in kendi politikası kurum sınırını zaten
  gozetim_kapsami ile koyuyor. Çıplak has_role yazılmıyor (AGENTS.md).
*/
drop policy if exists "Kanit kayitlarini calismayi gorenler okur" on public.kanit_kayitlari;
create policy "Kanit kayitlarini calismayi gorenler okur"
  on public.kanit_kayitlari
  for select
  to authenticated
  using (exists (select 1 from public.academic_projects p where p.id = kanit_kayitlari.project_id));

/*
  Yazma can_write_project: sahibi, atanan kişi ve KENDİ kurumundaki
  gözetim rolleri. Kontrolörün "insan incelemesi yapıldı" demesi
  matrisin asıl amacı; onu dışarıda bırakmak incelemeyi kayıt dışına
  iterdi.
*/
drop policy if exists "Kanit kaydini calismaya yazabilen ekler" on public.kanit_kayitlari;
create policy "Kanit kaydini calismaya yazabilen ekler"
  on public.kanit_kayitlari
  for insert
  to authenticated
  with check (olusturan = (select auth.uid()) and public.can_write_project(project_id));

drop policy if exists "Kanit kaydini calismaya yazabilen gunceller" on public.kanit_kayitlari;
create policy "Kanit kaydini calismaya yazabilen gunceller"
  on public.kanit_kayitlari
  for update
  to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

drop policy if exists "Kanit kaydini calismaya yazabilen siler" on public.kanit_kayitlari;
create policy "Kanit kaydini calismaya yazabilen siler"
  on public.kanit_kayitlari
  for delete
  to authenticated
  using (public.can_write_project(project_id));

-- ---------- 3) Makale profili ----------

create table if not exists public.makale_profili (
  project_id uuid primary key references public.academic_projects(id) on delete cascade,
  makale_turu text not null default 'ozgun'
    check (makale_turu in ('ozgun', 'sistematik_derleme', 'kapsam_derlemesi', 'anlatisal_derleme',
                           'meta_analiz', 'vaka', 'yontem', 'teknik')),
  arastirma_problemi text check (arastirma_problemi is null or char_length(arastirma_problemi) <= 2000),
  arastirma_sorusu text check (arastirma_sorusu is null or char_length(arastirma_sorusu) <= 1000),
  arastirma_tasarimi text check (arastirma_tasarimi is null or char_length(arastirma_tasarimi) <= 500),
  disiplin text check (disiplin is null or char_length(disiplin) <= 200),
  hedef_dergi text check (hedef_dergi is null or char_length(hedef_dergi) <= 300),
  dergi_kurallari_adresi text check (dergi_kurallari_adresi is null or char_length(dergi_kurallari_adresi) <= 1000),
  /*
    Kullanıcının dergi kurallarını KENDİSİNİN kontrol ettiği tarih. Dergi
    bilgisi (indeks, ücret, sınırlar) değişir ve ArvoLab bunu bir dizinden
    doğrulamıyor; bu yüzden ekranda "doğrulandı" değil "siz şu tarihte
    kontrol ettiniz" yazıyor ve tarih eskidikçe hatırlatılıyor.
  */
  dergi_kurallari_kontrol date,
  dergi_kurallari_notu text check (dergi_kurallari_notu is null or char_length(dergi_kurallari_notu) <= 4000),
  dil text not null default 'tr' check (dil in ('tr', 'en', 'diger')),
  kelime_siniri integer check (kelime_siniri is null or kelime_siniri between 100 and 100000),
  ozet_siniri integer check (ozet_siniri is null or ozet_siniri between 30 and 2000),
  anahtar_en_az smallint check (anahtar_en_az is null or anahtar_en_az between 1 and 20),
  anahtar_en_cok smallint check (anahtar_en_cok is null or anahtar_en_cok between 1 and 20),
  ozet text check (ozet is null or char_length(ozet) <= 8000),
  anahtar_kelimeler text[] not null default '{}'
    check (cardinality(anahtar_kelimeler) <= 20),
  veri_durumu text not null default 'yok'
    check (veri_durumu in ('yok', 'toplaniyor', 'toplandi', 'analiz_edildi', 'gerekmiyor')),
  raporlama_standardi text check (raporlama_standardi is null or char_length(raporlama_standardi) <= 100),
  guncelleyen uuid references auth.users(id) on delete set null,
  olusturuldu timestamptz not null default now(),
  guncellendi timestamptz not null default now(),
  constraint makale_anahtar_araligi check (
    anahtar_en_az is null or anahtar_en_cok is null or anahtar_en_az <= anahtar_en_cok
  )
);

alter table public.makale_profili enable row level security;

revoke all on public.makale_profili from public, anon, authenticated;
grant select, insert, update, delete on public.makale_profili to authenticated;
grant all on public.makale_profili to service_role;

drop policy if exists "Makale profilini calismayi gorenler okur" on public.makale_profili;
create policy "Makale profilini calismayi gorenler okur"
  on public.makale_profili
  for select
  to authenticated
  using (exists (select 1 from public.academic_projects p where p.id = makale_profili.project_id));

/* Yalnızca makale türündeki çalışmaya: tezin "makale profili" olmaz. */
drop policy if exists "Makale profilini yazabilen ekler" on public.makale_profili;
create policy "Makale profilini yazabilen ekler"
  on public.makale_profili
  for insert
  to authenticated
  with check (
    public.can_write_project(project_id)
    and exists (select 1 from public.academic_projects p
                where p.id = makale_profili.project_id and p.project_type = 'article')
  );

drop policy if exists "Makale profilini yazabilen gunceller" on public.makale_profili;
create policy "Makale profilini yazabilen gunceller"
  on public.makale_profili
  for update
  to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

drop policy if exists "Makale profilini yazabilen siler" on public.makale_profili;
create policy "Makale profilini yazabilen siler"
  on public.makale_profili
  for delete
  to authenticated
  using (public.can_write_project(project_id));

-- ---------- 4) Literatür tarama günlüğü ----------

create table if not exists public.literatur_tarama_gunlugu (
  id uuid primary key default gen_random_uuid(),
  kullanici uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.academic_projects(id) on delete set null,
  sorgu text not null check (char_length(sorgu) between 1 and 300),
  filtreler jsonb not null default '{}'::jsonb,
  -- Sorgunun gönderildiği dizinler ve gerçekten cevap verenler AYRI:
  -- cevap vermeyen dizin "tarandı" sayılmaz.
  sorgulanan text[] not null,
  yanit_veren text[] not null,
  ulasilamayan text[] not null default '{}',
  -- Ekranda GÖSTERİLEN sonuç sayısı (üst sınırlı); dizindeki toplam isabet değil.
  gosterilen_sonuc integer not null check (gosterilen_sonuc >= 0),
  olusturuldu timestamptz not null default now()
);

create index if not exists literatur_tarama_gunlugu_kullanici_idx
  on public.literatur_tarama_gunlugu(kullanici, olusturuldu desc);
create index if not exists literatur_tarama_gunlugu_project_idx
  on public.literatur_tarama_gunlugu(project_id, olusturuldu desc);

alter table public.literatur_tarama_gunlugu enable row level security;

/*
  Günlük DEĞİŞTİRİLEMEZ: güncelleme ve silme yetkisi yok. "Hangi tarihte
  ne arandı" kaydının sonradan düzeltilebilmesi, kaydın değerini
  ortadan kaldırırdı. Hesap silinince kullanıcıyla birlikte gider.
*/
revoke all on public.literatur_tarama_gunlugu from public, anon, authenticated;
grant select, insert on public.literatur_tarama_gunlugu to authenticated;
grant all on public.literatur_tarama_gunlugu to service_role;

drop policy if exists "Tarama gunlugunu sahibi ve calismayi gorenler okur" on public.literatur_tarama_gunlugu;
create policy "Tarama gunlugunu sahibi ve calismayi gorenler okur"
  on public.literatur_tarama_gunlugu
  for select
  to authenticated
  using (
    kullanici = (select auth.uid())
    or (project_id is not null
        and exists (select 1 from public.academic_projects p where p.id = literatur_tarama_gunlugu.project_id))
  );

drop policy if exists "Tarama gunlugune kendi adina yazar" on public.literatur_tarama_gunlugu;
create policy "Tarama gunlugune kendi adina yazar"
  on public.literatur_tarama_gunlugu
  for insert
  to authenticated
  with check (
    kullanici = (select auth.uid())
    and (project_id is null or public.can_write_project(project_id))
  );
