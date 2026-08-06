create extension if not exists pgcrypto;

-- ============================================================
-- Roller ve Kurum Yapısı
-- Proje dosyası Bölüm 3 "Hedef Kullanıcılar ve Roller" esas alınmıştır.
-- ============================================================
do $$ begin
  create type public.user_role as enum (
    'employee',          -- Çalışan
    'expert',            -- Uzman
    'controller',        -- Kontrolör
    'academic_manager',  -- Akademik Yönetici
    'system_admin',      -- Sistem Yöneticisi
    'founder'            -- Kurucu/Yönetim
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- auth.users tablosunu genişleten profil kaydı.
-- ÖNEMLİ: rol bilgisi burada (güvenli veritabanı tablosunda) tutulur,
-- kullanıcı tarafından değiştirilebilir JWT/user_metadata'da DEĞİL
-- (bkz. proje dosyası Bölüm 3.1 Yetkilendirme İlkeleri).
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  full_name text,
  role public.user_role not null default 'employee',
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

grant select on public.organizations to authenticated;
grant select, update on public.profiles to authenticated;

create policy "Members can view their own organization"
  on public.organizations
  for select
  to authenticated
  using (
    id in (select organization_id from public.profiles where id = (select auth.uid()))
  );

create policy "Users can view profiles in their organization"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or organization_id = (select organization_id from public.profiles where id = (select auth.uid()))
  );

create policy "Users can update their own profile (not their role)"
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Yeni auth kullanıcısı oluştuğunda otomatik profil satırı açar (varsayılan rol: employee).
-- Rol yükseltmeleri yalnızca güvenilir bir yönetici tarafından SQL/servis anahtarıyla yapılmalıdır.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Yardımcı fonksiyon: çağıran kullanıcının rolü belirtilen listede mi?
create or replace function public.has_role(roles public.user_role[])
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any(roles)
  );
$$;

create table if not exists public.academic_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id),
  assignee_id uuid references public.profiles(id), -- proje dosyası 6.1: sorumlu çalışan ataması
  title text not null check (char_length(title) between 3 and 240),
  project_type text not null check (project_type in ('thesis', 'article', 'project', 'associate-professorship')),
  university text,
  institute text,
  department text,
  citation_style text not null default 'apa7' check (citation_style in ('apa7', 'vancouver', 'chicago', 'ieee')),
  research_method text check (research_method in ('quantitative', 'qualitative', 'mixed', 'review')),
  assignee_name text, -- geriye dönük uyumluluk (assignee_id boşken serbest metin etiket)
  due_date date,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new' check (status in ('new', 'planned', 'writing', 'analysis', 'review', 'revision', 'turnitin', 'ready', 'delivered', 'archived')),
  notes text,
  progress smallint not null default 0 check (progress between 0 and 100),
  -- Kontrolör onayı: proje dosyası 6.2 "Tez ve Makale Üretim Akışı" - Biçim/Teslim aşaması onayı
  controller_approved_by uuid references public.profiles(id),
  controller_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academic_projects_owner_id_idx
  on public.academic_projects(owner_id);

create index if not exists academic_projects_due_date_idx
  on public.academic_projects(due_date);

alter table public.academic_projects enable row level security;

grant select, insert, update, delete on public.academic_projects to authenticated;

-- Görme yetkisi: sahibi, atanan çalışan, ya da denetim rolündeki kullanıcılar
-- (Kontrolör / Akademik Yönetici / Sistem Yöneticisi / Kurucu) - proje dosyası
-- Bölüm 3 "Hedef Kullanıcılar ve Roller" ile uyumlu.
create policy "View own, assigned, or oversight-role projects"
  on public.academic_projects
  for select
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

create policy "Users can create their own academic projects"
  on public.academic_projects
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Update own, assigned, or oversight-role projects"
  on public.academic_projects
  for update
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  )
  with check (
    (select auth.uid()) = owner_id
    or (select auth.uid()) = assignee_id
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

create policy "Owner or oversight-role can delete projects"
  on public.academic_projects
  for delete
  to authenticated
  using (
    (select auth.uid()) = owner_id
    or public.has_role(array['academic_manager','system_admin','founder']::public.user_role[])
  );

-- ============================================================
-- APA7 Kaynakça Doğrulama Kayıtları
-- Her kayıt bir academic_projects satırına bağlıdır.
-- Bu tablo İÇERİK ÜRETMEZ; yalnızca kural bazlı format/atıf
-- denetim sonuçlarını saklar (ArvoLab dahili doğrulama motoru).
-- ============================================================
create table if not exists public.citation_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.academic_projects(id) on delete cascade,
  project_title text, -- academic_projects henüz seçilmediyse/kaydedilmediyse geçici etiket
  raw_reference_list text not null,
  body_text text,
  parsed_references jsonb not null default '[]'::jsonb,
  in_text_citations jsonb not null default '[]'::jsonb,
  cross_check jsonb not null default '{}'::jsonb,
  compliance_score numeric,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists citation_checks_project_id_idx
  on public.citation_checks(project_id);

create index if not exists citation_checks_created_by_idx
  on public.citation_checks(created_by);

alter table public.citation_checks enable row level security;

grant select, insert, delete on public.citation_checks to authenticated;

-- Kaydı oluşturan kişi görebilir; ayrıca bağlı bir projeye sahipse o yoldan da erişebilir
create policy "Users can view their own citation checks"
  on public.citation_checks
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or exists (
      select 1 from public.academic_projects p
      where p.id = citation_checks.project_id
      and (p.owner_id = (select auth.uid()) or p.assignee_id = (select auth.uid()))
    )
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

create policy "Users can create their own citation checks"
  on public.citation_checks
  for insert
  to authenticated
  with check (created_by = (select auth.uid()));

create policy "Users can delete their own citation checks"
  on public.citation_checks
  for delete
  to authenticated
  using (created_by = (select auth.uid()));

-- ============================================================
-- Doküman Yükleme ve Otomatik Analiz
-- Kullanıcı DOCX/PDF yükler; sistem metni çıkarıp kaynakça/atıf
-- kontrolünden geçirir. Dosyanın kendisi Storage'da, çıkarılan
-- metin ve analiz sonucu burada JSON olarak tutulur.
-- İÇERİK ÜRETİLMEZ; yalnızca kullanıcının kendi dosyası okunup
-- kural bazlı denetlenir.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('project-files', 'project-files', false)
on conflict (id) do nothing;

create table if not exists public.document_uploads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.academic_projects(id) on delete cascade,
  project_title text, -- proje seçilmediyse geçici etiket
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  extracted_text text,
  reference_text text,
  analysis jsonb, -- APA7 motor çıktısı (parsed_references, cross_check, complianceScore)
  status text not null default 'processing' check (status in ('processing', 'analyzed', 'failed')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists document_uploads_project_id_idx
  on public.document_uploads(project_id);

create index if not exists document_uploads_uploaded_by_idx
  on public.document_uploads(uploaded_by);

alter table public.document_uploads enable row level security;

grant select, insert, delete on public.document_uploads to authenticated;

create policy "Users can view their own document uploads"
  on public.document_uploads
  for select
  to authenticated
  using (
    uploaded_by = (select auth.uid())
    or exists (
      select 1 from public.academic_projects p
      where p.id = document_uploads.project_id
      and (p.owner_id = (select auth.uid()) or p.assignee_id = (select auth.uid()))
    )
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

create policy "Users can create their own document uploads"
  on public.document_uploads
  for insert
  to authenticated
  with check (uploaded_by = (select auth.uid()));

create policy "Users can delete their own document uploads"
  on public.document_uploads
  for delete
  to authenticated
  using (uploaded_by = (select auth.uid()));

-- Storage nesne erişimi: yalnızca dosyayı yükleyen kişi kendi
-- klasöründeki (kullanıcı-id/...) dosyalara erişebilir.
create policy "Users can upload to their own folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can read their own files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'project-files'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
    )
  );

create policy "Users can delete their own files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============================================================
-- Üniversite Tez Yazım Kılavuzları
-- Proje dosyası Bölüm 5.6 "Üniversite Kılavuzları" ile uyumlu.
-- Kılavuzlar burada YAPILANDIRILMIŞ kurallar (zorunlu bölümler,
-- kaynakça sistemi, sayfa aralığı) olarak tutulur; belge yükleme
-- akışında bu kurallara göre otomatik ön kontrol yapılabilir.
-- Ekleme/güncelleme/silme yalnızca Akademik Yönetici ve üzeri
-- rollere açıktır; okuma tüm kimlik doğrulaması yapılmış
-- kullanıcılara açıktır (paylaşılan referans verisi).
-- ============================================================
create table if not exists public.thesis_guidelines (
  id uuid primary key default gen_random_uuid(),
  university_name text not null,
  institute_name text,
  version_label text,              -- örn. "2025 Güz"
  source_url text,                 -- kılavuzun resmi kaynağı
  citation_style text not null default 'apa7' check (citation_style in ('apa7', 'vancouver', 'chicago', 'ieee')),
  required_sections text[] not null default '{}', -- örn. {"Giriş","Yöntem","Bulgular","Sonuç","Kaynakça"}
  min_pages integer,
  max_pages integer,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists thesis_guidelines_university_idx
  on public.thesis_guidelines(university_name);

alter table public.thesis_guidelines enable row level security;

grant select, insert, update, delete on public.thesis_guidelines to authenticated;

create policy "All authenticated users can view guidelines"
  on public.thesis_guidelines
  for select
  to authenticated
  using (true);

create policy "Academic managers and above can create guidelines"
  on public.thesis_guidelines
  for insert
  to authenticated
  with check (
    created_by = (select auth.uid())
    and public.has_role(array['academic_manager','system_admin','founder']::public.user_role[])
  );

create policy "Academic managers and above can update guidelines"
  on public.thesis_guidelines
  for update
  to authenticated
  using (public.has_role(array['academic_manager','system_admin','founder']::public.user_role[]))
  with check (public.has_role(array['academic_manager','system_admin','founder']::public.user_role[]));

create policy "Academic managers and above can delete guidelines"
  on public.thesis_guidelines
  for delete
  to authenticated
  using (public.has_role(array['academic_manager','system_admin','founder']::public.user_role[]));

-- academic_projects'i bir kılavuza bağlama imkânı
alter table public.academic_projects
  add column if not exists guideline_id uuid references public.thesis_guidelines(id);

-- ============================================================
-- Doçentlik Puan Hesaplayıcı
-- ÖNEMLİ: ÜAK puanlama kriterleri temel alana göre değişir ve
-- periyodik olarak güncellenir. ArvoLab resmi/güncel sayıları
-- kendiliğinden UYDURMAZ; kriterler ve puan değerleri Akademik
-- Yönetici tarafından güncel resmi duyuruya göre girilir/güncellenir.
-- Sistem yalnızca kullanıcının kendi beyan ettiği yayın/faaliyet
-- sayılarına bu kriterleri uygulayarak toplam puanı hesaplar.
-- ============================================================
create table if not exists public.scoring_criteria (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- örn. "A1", "B2"
  label text not null,                -- örn. "SCI-E indeksli makale"
  category_group text,                -- örn. "Makaleler", "Kitaplar", "Atıflar"
  points_per_unit numeric not null default 0,
  notes text,
  is_active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.scoring_criteria enable row level security;

grant select, insert, update, delete on public.scoring_criteria to authenticated;

create policy "All authenticated users can view scoring criteria"
  on public.scoring_criteria
  for select
  to authenticated
  using (true);

create policy "Academic managers and above can manage scoring criteria"
  on public.scoring_criteria
  for all
  to authenticated
  using (public.has_role(array['academic_manager','system_admin','founder']::public.user_role[]))
  with check (public.has_role(array['academic_manager','system_admin','founder']::public.user_role[]));

create table if not exists public.academic_score_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  criteria_id uuid not null references public.scoring_criteria(id),
  title text not null,
  unit_count numeric not null default 1 check (unit_count > 0),
  computed_points numeric not null, -- girildiği andaki points_per_unit * unit_count (geçmişe dönük tutarlılık için sabitlenir)
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists academic_score_entries_owner_id_idx
  on public.academic_score_entries(owner_id);

alter table public.academic_score_entries enable row level security;

grant select, insert, delete on public.academic_score_entries to authenticated;

create policy "Users can view their own score entries"
  on public.academic_score_entries
  for select
  to authenticated
  using (
    owner_id = (select auth.uid())
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

create policy "Users can create their own score entries"
  on public.academic_score_entries
  for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Users can delete their own score entries"
  on public.academic_score_entries
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- ============================================================
-- Uzmandan Destek Talebi
-- Kullanıcı bir çalışma için uzman desteği talep edebilir;
-- Uzman/Kontrolör/Akademik Yönetici/Sistem Yöneticisi/Kurucu
-- rolündeki kişiler açık talepleri görüp üstlenebilir.
-- ============================================================
create table if not exists public.consultancy_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.academic_projects(id) on delete cascade,
  project_title text, -- proje bağlı değilse geçici etiket
  requested_by uuid not null references auth.users(id) on delete cascade,
  request_type text not null check (request_type in ('analysis', 'editing', 'methodology', 'statistics', 'full_review', 'other')),
  message text,
  status text not null default 'open' check (status in ('open', 'accepted', 'completed', 'cancelled')),
  assigned_expert_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists consultancy_requests_status_idx
  on public.consultancy_requests(status);

create index if not exists consultancy_requests_requested_by_idx
  on public.consultancy_requests(requested_by);

alter table public.consultancy_requests enable row level security;

grant select, insert, update, delete on public.consultancy_requests to authenticated;

-- Görme yetkisi: talebi açan kişi, atanan uzman, ya da
-- Uzman/Kontrolör/Akademik Yönetici/Sistem Yöneticisi/Kurucu rolleri
-- (açık talepleri görüp üstlenebilmeleri için).
create policy "View own, assigned, or expert-eligible requests"
  on public.consultancy_requests
  for select
  to authenticated
  using (
    requested_by = (select auth.uid())
    or assigned_expert_id = (select auth.uid())
    or public.has_role(array['expert','controller','academic_manager','system_admin','founder']::public.user_role[])
  );

create policy "Users can create their own requests"
  on public.consultancy_requests
  for insert
  to authenticated
  with check (requested_by = (select auth.uid()));

-- Güncelleme: talebi açan kişi (iptal edebilir) veya uzman rolündeki
-- kişiler (üstlenme/tamamlama) güncelleyebilir.
create policy "Owner or expert-eligible roles can update requests"
  on public.consultancy_requests
  for update
  to authenticated
  using (
    requested_by = (select auth.uid())
    or assigned_expert_id = (select auth.uid())
    or public.has_role(array['expert','controller','academic_manager','system_admin','founder']::public.user_role[])
  )
  with check (
    requested_by = (select auth.uid())
    or assigned_expert_id = (select auth.uid())
    or public.has_role(array['expert','controller','academic_manager','system_admin','founder']::public.user_role[])
  );

create policy "Owner can delete their own requests"
  on public.consultancy_requests
  for delete
  to authenticated
  using (requested_by = (select auth.uid()));

-- ============================================================
-- ArvoLab Orijinallik Ön-Kontrolü
-- ÖNEMLİ: Bu, Turnitin'in resmi raporunun YERİNE GEÇMEZ ve onu
-- taklit etmez — Turnitin'in dünya çapındaki kapalı veritabanına
-- erişimimiz yok. Bu araç yalnızca ArvoLab'a yüklenmiş, kullanıcının
-- erişim yetkisi olan belge havuzuyla karşılaştırma yapan, kendi
-- markalı bir ÖN-KONTROL aracıdır. Amaç, resmi teslimden önce
-- kurum içi tekrar/çakışma riskini erken görebilmektir.
-- ============================================================
create table if not exists public.originality_checks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.document_uploads(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  overall_similarity numeric not null default 0, -- 0-100 arası, en yüksek eşleşme
  compared_document_count integer not null default 0,
  matches jsonb not null default '[]'::jsonb, -- [{documentId, fileName, similarity, sampleOverlap}]
  created_at timestamptz not null default now()
);

create index if not exists originality_checks_document_id_idx
  on public.originality_checks(document_id);

alter table public.originality_checks enable row level security;

grant select, insert, delete on public.originality_checks to authenticated;

create policy "Users can view their own originality checks"
  on public.originality_checks
  for select
  to authenticated
  using (
    requested_by = (select auth.uid())
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

create policy "Users can create their own originality checks"
  on public.originality_checks
  for insert
  to authenticated
  with check (requested_by = (select auth.uid()));

create policy "Users can delete their own originality checks"
  on public.originality_checks
  for delete
  to authenticated
  using (requested_by = (select auth.uid()));

-- ============================================================
-- Panelde Yazma: Çalışma Metni (Manuscript)
-- Öğrenci/çalışan tezini/makalesini doğrudan ArvoLab editöründe
-- yazar. İçerik Tiptap/ProseMirror JSON formatında saklanır.
-- Bu, "yükle-sonra-kontrol-et" akışına EK bir seçenektir; belge
-- yükleme özelliği (document_uploads) kaldırılmamıştır.
-- ============================================================
create table if not exists public.project_manuscripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.academic_projects(id) on delete cascade,
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  plain_text text, -- her kayıtta güncellenen düz metin önbelleği (kontrol motorları için)
  word_count integer not null default 0,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_manuscripts enable row level security;

grant select, insert, update on public.project_manuscripts to authenticated;

create policy "Users can view manuscripts they have project access to"
  on public.project_manuscripts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.academic_projects p
      where p.id = project_manuscripts.project_id
      and (p.owner_id = (select auth.uid()) or p.assignee_id = (select auth.uid()))
    )
    or public.has_role(array['controller','academic_manager','system_admin','founder']::public.user_role[])
  );

create policy "Users can create manuscripts for their own projects"
  on public.project_manuscripts
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.academic_projects p
      where p.id = project_manuscripts.project_id
      and (p.owner_id = (select auth.uid()) or p.assignee_id = (select auth.uid()))
    )
  );

create policy "Users can update manuscripts they have project access to"
  on public.project_manuscripts
  for update
  to authenticated
  using (
    exists (
      select 1 from public.academic_projects p
      where p.id = project_manuscripts.project_id
      and (p.owner_id = (select auth.uid()) or p.assignee_id = (select auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.academic_projects p
      where p.id = project_manuscripts.project_id
      and (p.owner_id = (select auth.uid()) or p.assignee_id = (select auth.uid()))
    )
  );

-- Editörde eklenen resimler için ayrı klasör alanı (project-files bucket'ı zaten var)
