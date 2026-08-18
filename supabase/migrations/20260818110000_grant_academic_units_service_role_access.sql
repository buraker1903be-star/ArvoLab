-- The academic directory synchronizer writes verified YOK Atlas data with the
-- server-only Supabase client. Custom tables do not automatically inherit the
-- service_role grants, so explicitly grant the privileges it needs.
grant select, insert, update, delete
  on table public.academic_units
  to service_role;
