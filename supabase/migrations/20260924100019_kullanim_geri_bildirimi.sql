-- ============================================================
-- Kullanım geri bildirimi.
--
-- ArvoLab'ı kullanan personelden, kullandıktan SONRA tek bir kısa soru:
-- işine yaradı mı, en çok neyi kullandı, eksik ne. Bugüne kadar böyle bir
-- yol yoktu; tek kanal "Uygulama Destek Talebi"ydi ve oraya yalnızca bir
-- şey BOZULDUĞUNDA yazılıyor. Çalışan bir ekranın nerede yetmediğini
-- kimse söylemiyordu.
--
-- Kullanıcı başına TEK satır: soru bir kez sorulur. "Sonra" denirse satır
-- 'postponed' olarak durur ve uygulama iki hafta sonra yeniden sorar;
-- "istemiyorum" denirse 'declined' kalır ve bir daha sorulmaz. Cevap
-- geldiğinde aynı satır 'answered' olur. Ayrı bir "soruldu mu" tablosu
-- tutmuyoruz: iki tabloyu tutarlı tutmak, tek satırı güncellemekten zor.
--
-- organization_id cevap anındaki kurumun kopyasıdır: personel kurumdan
-- ayrılsa da geri bildirim hangi kurumun kullanımından geldiği bilgisiyle
-- kalmalı.
-- ============================================================

create table if not exists public.product_feedback (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  status text not null check (status in ('answered', 'postponed', 'declined')),
  -- 1 hiç yaramadı … 5 çok işime yaradı
  score smallint check (score is null or score between 1 and 5),
  -- En çok kullanılan bölüm (editor, citations, documents, literature, analysis, asistan)
  most_used text check (most_used is null or char_length(most_used) <= 40),
  comment text check (comment is null or char_length(comment) <= 2000),
  -- Sorunun hangi kullanımdan sonra sorulduğu; cevabı okurken bağlam veriyor.
  asked_context text check (asked_context is null or char_length(asked_context) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Cevap verildi deniyorsa puan zorunlu: yorumsuz puan olur, puansız cevap olmaz.
  constraint product_feedback_cevap_puanli check (status <> 'answered' or score is not null)
);

create index if not exists product_feedback_updated_idx
  on public.product_feedback (updated_at desc)
  where status = 'answered';

alter table public.product_feedback enable row level security;

revoke all on public.product_feedback from public, anon, authenticated;
grant select, insert, update on public.product_feedback to authenticated;
grant all on public.product_feedback to service_role;

-- Okuma: kendi satırı herkese; hepsi yalnızca yönetime. Kontrolör dışarıda
-- bırakıldı — geri bildirim ürün kararı, akademik denetim değil.
drop policy if exists "Kendi geri bildirimini görür" on public.product_feedback;
create policy "Kendi geri bildirimini görür"
  on public.product_feedback
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role(array['academic_manager','system_admin','founder']::public.user_role[])
  );

drop policy if exists "Kendi geri bildirimini yazar" on public.product_feedback;
create policy "Kendi geri bildirimini yazar"
  on public.product_feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Güncelleme kendi satırıyla sınırlı: "sonra" diyen sonra cevap verebilsin.
-- Silme kimseye açık değil; verilen cevap kaydı kalır.
drop policy if exists "Kendi geri bildirimini günceller" on public.product_feedback;
create policy "Kendi geri bildirimini günceller"
  on public.product_feedback
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
