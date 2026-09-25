-- ============================================================
-- Hesap silme: 30 günlük bekleme ve silmenin gerçekten çalışması.
--
-- Kullanıcı hesabını silmek istediğinde erişimi HEMEN kapanıyor ama veri
-- 30 gün duruyor: bu süre içinde giriş yaparsa her şey geri geliyor.
-- Gerekçe, silmenin geri alınamaz olması ve silinen şeyin bir TEZ olması —
-- öfkeyle ya da yanlışlıkla basılan bir düğme yılların işini yok etmemeli.
-- Hesabı ele geçirilen kullanıcıyı da bu pencere koruyor.
--
-- ---------- Silme neden bugün ÇALIŞMAZDI ----------
--
-- auth.users satırını silmek, aşağıdaki altı yabancı anahtar yüzünden
-- HATA verirdi (varsayılan NO ACTION):
--
--   academic_projects.assignee_id            → profiles
--   academic_projects.controller_approved_by → profiles
--   consultancy_requests.assigned_expert_id  → profiles
--   project_manuscripts.updated_by           → auth.users
--   scoring_criteria.updated_by              → auth.users
--   thesis_guidelines.created_by             → auth.users
--
-- Yani kullanıcı bir çalışmaya atanmışsa, bir onay vermişse ya da
-- başkasının metnine dokunmuşsa silme yarıda kalırdı. Yarım kalan bir
-- silme en kötüsü: kullanıcıya "silindi" denir, veri durur.
--
-- Altısı da ATIF alanı ve hepsi boş bırakılabiliyor; "set null" yapılıyor.
-- Kaydın kendisi duruyor, yalnızca kimin yaptığı bilgisi düşüyor — kişi
-- gittiğine göre doğrusu bu. Silmek (cascade) başkasının çalışmasını ya da
-- kurumun kılavuzunu götürürdü.
-- ============================================================

alter table public.profiles
  add column if not exists silme_talebi_at timestamptz;

comment on column public.profiles.silme_talebi_at is
  'Kullanıcı hesabını silmek istedi; erişim kapalı, veri 30 gün duruyor. Giriş yapıp vazgeçerse temizlenir.';

-- Cron yalnızca süresi dolanları arıyor; kısmi dizin tabloyu taratmasın.
create index if not exists profiles_silme_talebi_idx
  on public.profiles(silme_talebi_at)
  where silme_talebi_at is not null;

-- ---------- Silmeyi tıkayan altı bağ ----------

alter table public.academic_projects
  drop constraint if exists academic_projects_assignee_id_fkey,
  add constraint academic_projects_assignee_id_fkey
    foreign key (assignee_id) references public.profiles(id) on delete set null;

alter table public.academic_projects
  drop constraint if exists academic_projects_controller_approved_by_fkey,
  add constraint academic_projects_controller_approved_by_fkey
    foreign key (controller_approved_by) references public.profiles(id) on delete set null;

alter table public.consultancy_requests
  drop constraint if exists consultancy_requests_assigned_expert_id_fkey,
  add constraint consultancy_requests_assigned_expert_id_fkey
    foreign key (assigned_expert_id) references public.profiles(id) on delete set null;

alter table public.project_manuscripts
  drop constraint if exists project_manuscripts_updated_by_fkey,
  add constraint project_manuscripts_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null;

alter table public.scoring_criteria
  drop constraint if exists scoring_criteria_updated_by_fkey,
  add constraint scoring_criteria_updated_by_fkey
    foreign key (updated_by) references auth.users(id) on delete set null;

alter table public.thesis_guidelines
  drop constraint if exists thesis_guidelines_created_by_fkey,
  add constraint thesis_guidelines_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

notify pgrst, 'reload schema';
