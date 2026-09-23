-- ============================================================
-- PROJE: ArvoLab (zpfpocyajnxcketdjbxm)
--
-- Analiz sonucu çalışmaya KAYDEDİLEBİLSİN.
--
-- Analiz merkezi bugüne kadar hiçbir şey biriktirmiyordu: kaynakça
-- denetiminin ve belgelerin geçmişi var, ürünün en ağır modülünün
-- (gerçek istatistik hesabı) yoktu. Kullanıcı t-testini çalıştırıp
-- sekmeyi kapattığında elinde hiçbir şey kalmıyordu.
--
-- HAM VERİ BURAYA GİRMİYOR. Hesap tarayıcıda yapılıyor ve dosya sunucuya
-- hiç yüklenmiyor (app/dashboard/analysis/data-analyzer.tsx). Bu tablo
-- yalnızca kullanıcının ZATEN EKRANDA GÖRDÜĞÜ APA metnini ve hangi testin
-- hangi değişkenlerle çalıştırıldığını tutar. Katılımcı verisini sessizce
-- sunucuya taşımak, "dosyanız sunucuya yüklenmez" sözünü bozardı;
-- kaydetme de bu yüzden otomatik değil, kullanıcının bastığı bir düğme.
--
-- UPDATE YOK — ne grant ne politika. Kayıt, yapılmış bir hesabın
-- tutanağı; sonradan düzenlenebilseydi tutanak olmaktan çıkıp iddiaya
-- dönerdi. Yanlışsa silinir ve analiz yeniden çalıştırılır.
-- ============================================================

create table if not exists public.analiz_sonuclari (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- Çalışma silinince sonuç silinmez: hesap yapılmıştı, kaydı kalsın.
  project_id uuid references public.academic_projects(id) on delete set null,
  analiz_turu text not null check (char_length(analiz_turu) <= 80),
  baslik text not null check (char_length(baslik) between 1 and 300),
  apa_metni text not null check (char_length(apa_metni) between 1 and 20000),
  created_at timestamptz not null default now()
);

create index if not exists analiz_sonuclari_owner_idx
  on public.analiz_sonuclari(owner_id, created_at desc);

alter table public.analiz_sonuclari enable row level security;

grant select, insert, delete on public.analiz_sonuclari to authenticated;

drop policy if exists "Kullanici kendi analiz sonuclarini gorur" on public.analiz_sonuclari;
create policy "Kullanici kendi analiz sonuclarini gorur"
  on public.analiz_sonuclari
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Kullanici kendi analiz sonucunu kaydeder" on public.analiz_sonuclari;
create policy "Kullanici kendi analiz sonucunu kaydeder"
  on public.analiz_sonuclari
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

drop policy if exists "Kullanici kendi analiz sonucunu siler" on public.analiz_sonuclari;
create policy "Kullanici kendi analiz sonucunu siler"
  on public.analiz_sonuclari
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Yeni içerik yazan yol: abonelik kapısından geçer (20260924100003).
drop trigger if exists guard_subscription_trigger on public.analiz_sonuclari;
create trigger guard_subscription_trigger
  before insert on public.analiz_sonuclari
  for each row execute function public.guard_subscription();

notify pgrst, 'reload schema';
