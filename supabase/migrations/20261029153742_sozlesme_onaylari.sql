-- ============================================================
-- SÖZLEŞME ONAY KAYDI (29.10.2026, kurum sahibinin isteği).
--
-- Kullanıcının Kullanım Sözleşmesi'ni (lib/sozlesme/kullanim-sozlesmesi.ts)
-- gördüğünün, sonuna kadar kaydırdığının ve onayladığının DELİLİ. Ödemeden
-- sonra da yeniden onay alınır; itirazda gösterilecek kayıt budur.
--
-- Kurallar:
--   * Yalnızca SUNUCU yazar (service_role). IP ve cihaz bilgisi isteğin
--     başlıklarından sunucuda okunur; istemci bunları yazabilseydi kayıt
--     delil olmazdı.
--   * DEĞİŞTİRİLEMEZ: hiçbir rol satırı güncelleyemez ya da silemez
--     (service_role dâhil). Tek istisna, hesap kalıcı silinince yabancı
--     anahtarın user_id'yi NULL'a çekmesi; e-posta ve ad o anki hâliyle
--     satırda kalır. Saklamanın dayanağı KVKK m.5/2-e (bir hakkın tesisi,
--     kullanılması veya korunması) ve sözleşmenin 13. maddesi.
--   * Kullanıcı yalnızca KENDİ onaylarını okur (Ayarlar → Onaylanan
--     sözleşmeler).
--   * Metnin kendisi değil SHA-256 özeti tutulur; metin sürümüyle birlikte
--     depoda (git geçmişi) duruyor, özet hangi metnin onaylandığını
--     kanıtlar.
-- ============================================================

create table if not exists public.sozlesme_onaylari (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  belge text not null check (belge in ('kullanim_sozlesmesi')),
  surum text not null check (char_length(surum) between 1 and 40),
  dil text not null check (dil in ('tr', 'en')),
  metin_ozeti text not null check (metin_ozeti ~ '^[0-9a-f]{64}$'),
  -- giris: ilk giriş ya da yeni sürüm; odeme_sonrasi: ödemeden dönüşte.
  olay text not null check (olay in ('giris', 'odeme_sonrasi')),
  odeme_referansi text check (odeme_referansi is null or char_length(odeme_referansi) <= 300),
  kaydirma_tamamlandi boolean not null,
  ip text check (ip is null or char_length(ip) <= 100),
  kullanici_araci text check (kullanici_araci is null or char_length(kullanici_araci) <= 1000),
  tarayici_dili text check (tarayici_dili is null or char_length(tarayici_dili) <= 200),
  eposta text check (eposta is null or char_length(eposta) <= 320),
  ad_soyad text check (ad_soyad is null or char_length(ad_soyad) <= 200),
  organization_id uuid,
  onaylandi timestamptz not null default now()
);

create index if not exists sozlesme_onaylari_kullanici_idx
  on public.sozlesme_onaylari (user_id, belge, surum, onaylandi desc);

alter table public.sozlesme_onaylari enable row level security;

revoke all on public.sozlesme_onaylari from public, anon, authenticated;
grant select on public.sozlesme_onaylari to authenticated;
revoke all on public.sozlesme_onaylari from service_role;
grant select, insert on public.sozlesme_onaylari to service_role;

drop policy if exists "Kendi sözleşme onaylarını görür" on public.sozlesme_onaylari;
create policy "Kendi sözleşme onaylarını görür"
  on public.sozlesme_onaylari
  for select
  to authenticated
  using (user_id = (select auth.uid()));

/*
  Değişmezlik tetikleyicisi. Yetkiler zaten UPDATE/DELETE vermiyor; bu
  ikinci kat, tablo sahibinin (SQL Editor) yanlışlıkla yapacağı bir
  değişikliği de durdurur. Yabancı anahtarın "on delete set null" eylemi
  bir UPDATE olarak çalıştığı için yalnızca user_id'nin NULL'a çekilmesine
  izin verilir; başka her alan aynı kalmalı.
*/
create or replace function public.sozlesme_onayi_degismez()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_beklenen public.sozlesme_onaylari;
begin
  if tg_op = 'DELETE' then
    raise exception 'Sözleşme onay kaydı silinemez.' using errcode = 'insufficient_privilege';
  end if;
  v_beklenen := old;
  v_beklenen.user_id := null;
  if new.user_id is not null or new is distinct from v_beklenen then
    raise exception 'Sözleşme onay kaydı değiştirilemez.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke all on function public.sozlesme_onayi_degismez() from public, anon, authenticated;

drop trigger if exists sozlesme_onayi_degismez on public.sozlesme_onaylari;
create trigger sozlesme_onayi_degismez
  before update or delete on public.sozlesme_onaylari
  for each row execute function public.sozlesme_onayi_degismez();

notify pgrst, 'reload schema';
