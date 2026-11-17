-- ============================================================
-- ÖNERİ (migration DEĞİL; bu turda eklenmedi): DEPODA TEKRARLANABİLİR YETKİ POLİTİKASI
--
-- Sorun: Production'ın tablo ve fonksiyon yetkileri depodan DAR (RAPOR §3.3). Depodan kurulan her yeni
-- ortam (yerel, Test, önizleme) Supabase'in varsayılan ayrıcalıklarıyla GENİŞ kurulur; service_role ile
-- yeni bir yol yazan kod yerelde geçer, Production'da 42501 ile düşer (yetim profil dalı böyle bulundu).
--
-- Öneri: Production'daki kümeyi depoya bir "yetki sabitleme" migration'ı olarak yazmak. İçeriği aşağıda:
-- 17.11.2026'da Production kataloğundan ölçülen tablo, fonksiyon ve sütun yetkileri + P9. Bu dosya
-- prova/00-production-taklidi.sql'in yetki bölümleriyle AYNI kaynaktan üretildi; provada bu küme
-- altında bütün kabul testleri ve yönetici istemcisi yolları sınandı (RAPOR §4).
--
-- Production'a uygulanması gerekmez (zaten bu hâlde); depoya migration olarak alınması ve yeni ortamların
-- bu kümeyle kurulması ayrı bir karardır. Yeni bir yetki ihtiyacı doğduğunda bu küme bilerek ve dar
-- biçimde genişletilir (P9 örneği).
-- ============================================================
begin;
-- 1) Tablo yetkileri: Production'daki küme birebir (anon, authenticated, service_role).
revoke all on public.academic_projects from anon, authenticated, service_role;
grant delete, insert, select, update on public.academic_projects to authenticated;
grant references, select, trigger, truncate on public.academic_projects to service_role;
revoke all on public.academic_score_entries from anon, authenticated, service_role;
grant delete, insert, select, update on public.academic_score_entries to authenticated;
grant references, trigger, truncate on public.academic_score_entries to service_role;
revoke all on public.academic_unit_import_staging from anon, authenticated, service_role;
grant references, trigger, truncate on public.academic_unit_import_staging to service_role;
revoke all on public.academic_units from anon, authenticated, service_role;
grant select on public.academic_units to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.academic_units to service_role;
revoke all on public.ai_assistant_runs from anon, authenticated, service_role;
grant select, update on public.ai_assistant_runs to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.ai_assistant_runs to service_role;
revoke all on public.ai_bireysel_kredi_hareketleri from anon, authenticated, service_role;
grant insert, references, select, trigger, truncate on public.ai_bireysel_kredi_hareketleri to service_role;
revoke all on public.ai_bireysel_kredi_hesabi from anon, authenticated, service_role;
grant insert, references, select, trigger, truncate, update on public.ai_bireysel_kredi_hesabi to service_role;
revoke all on public.ai_feedback_requests from anon, authenticated, service_role;
grant insert, select on public.ai_feedback_requests to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.ai_feedback_requests to service_role;
revoke all on public.ai_kredi_hareketleri from anon, authenticated, service_role;
grant insert, references, select, trigger, truncate on public.ai_kredi_hareketleri to service_role;
revoke all on public.ai_kredi_hesabi from anon, authenticated, service_role;
grant insert, references, select, trigger, truncate, update on public.ai_kredi_hesabi to service_role;
revoke all on public.analiz_sonuclari from anon, authenticated, service_role;
grant delete, insert, select on public.analiz_sonuclari to authenticated;
grant references, trigger, truncate on public.analiz_sonuclari to service_role;
revoke all on public.app_support_requests from anon, authenticated, service_role;
grant insert, select, update on public.app_support_requests to authenticated;
grant references, trigger, truncate on public.app_support_requests to service_role;
revoke all on public.arvoos_members from anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.arvoos_members to service_role;
revoke all on public.auth_rate_limits from anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.auth_rate_limits to service_role;
revoke all on public.bridge_health from anon, authenticated, service_role;
grant insert, references, select, trigger, truncate, update on public.bridge_health to service_role;
revoke all on public.calisma_kilavuzu from anon, authenticated, service_role;
grant delete, insert, select, update on public.calisma_kilavuzu to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.calisma_kilavuzu to service_role;
revoke all on public.calisma_kilavuzu_sinyali from anon, authenticated, service_role;
grant select on public.calisma_kilavuzu_sinyali to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.calisma_kilavuzu_sinyali to service_role;
revoke all on public.calisma_takvimi from anon, authenticated, service_role;
grant delete, insert, select, update on public.calisma_takvimi to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.calisma_takvimi to service_role;
revoke all on public.calisma_yapilacaklari from anon, authenticated, service_role;
grant delete, insert, select, update on public.calisma_yapilacaklari to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.calisma_yapilacaklari to service_role;
revoke all on public.citation_checks from anon, authenticated, service_role;
grant delete, insert, select on public.citation_checks to authenticated;
grant references, trigger, truncate on public.citation_checks to service_role;
revoke all on public.consultancy_requests from anon, authenticated, service_role;
grant delete, insert, select, update on public.consultancy_requests to authenticated;
grant references, trigger, truncate on public.consultancy_requests to service_role;
revoke all on public.destek_mesajlari from anon, authenticated, service_role;
grant insert, select on public.destek_mesajlari to authenticated;
grant references, trigger, truncate on public.destek_mesajlari to service_role;
revoke all on public.docentlik_hedefleri from anon, authenticated, service_role;
grant delete, insert, select, update on public.docentlik_hedefleri to authenticated;
grant references, trigger, truncate on public.docentlik_hedefleri to service_role;
revoke all on public.docentlik_profili from anon, authenticated, service_role;
grant insert, select, update on public.docentlik_profili to authenticated;
grant references, trigger, truncate on public.docentlik_profili to service_role;
revoke all on public.document_uploads from anon, authenticated, service_role;
grant delete, insert, select on public.document_uploads to authenticated;
grant references, trigger, truncate on public.document_uploads to service_role;
revoke all on public.etik_kurul from anon, authenticated, service_role;
grant delete, insert, select, update on public.etik_kurul to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.etik_kurul to service_role;
revoke all on public.individual_subscriptions from anon, authenticated, service_role;
grant select on public.individual_subscriptions to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.individual_subscriptions to service_role;
revoke all on public.kanit_kayitlari from anon, authenticated, service_role;
grant delete, insert, select, update on public.kanit_kayitlari to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.kanit_kayitlari to service_role;
revoke all on public.kaynak_dogrulama_onbellegi from anon, authenticated, service_role;
grant delete, insert, references, select, trigger, truncate, update on public.kaynak_dogrulama_onbellegi to service_role;
revoke all on public.kaynak_pdfleri from anon, authenticated, service_role;
grant delete, insert, select, update on public.kaynak_pdfleri to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.kaynak_pdfleri to service_role;
revoke all on public.literatur_tarama_gunlugu from anon, authenticated, service_role;
grant insert, select on public.literatur_tarama_gunlugu to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.literatur_tarama_gunlugu to service_role;
revoke all on public.literature_sources from anon, authenticated, service_role;
grant delete, insert, select, update on public.literature_sources to authenticated;
grant references, trigger, truncate on public.literature_sources to service_role;
revoke all on public.makale_profili from anon, authenticated, service_role;
grant delete, insert, select, update on public.makale_profili to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.makale_profili to service_role;
revoke all on public.manuscript_comments from anon, authenticated, service_role;
grant delete, insert, select on public.manuscript_comments to authenticated;
grant references, trigger, truncate on public.manuscript_comments to service_role;
revoke all on public.manuscript_share_links from anon, authenticated, service_role;
grant select on public.manuscript_share_links to authenticated;
grant references, select, trigger, truncate on public.manuscript_share_links to service_role;
revoke all on public.notifications from anon, authenticated, service_role;
grant delete, select on public.notifications to authenticated;
grant insert, references, select, trigger, truncate on public.notifications to service_role;
revoke all on public.organizations from anon, authenticated, service_role;
grant insert, select, update on public.organizations to authenticated;
grant insert, references, select, trigger, truncate, update on public.organizations to service_role;
revoke all on public.originality_checks from anon, authenticated, service_role;
grant delete, insert, select on public.originality_checks to authenticated;
grant references, trigger, truncate on public.originality_checks to service_role;
revoke all on public.product_feedback from anon, authenticated, service_role;
grant insert, select, update on public.product_feedback to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.product_feedback to service_role;
revoke all on public.profiles from anon, authenticated, service_role;
grant select, update on public.profiles to authenticated;
grant references, select, trigger, truncate on public.profiles to service_role;
revoke all on public.project_manuscript_versions from anon, authenticated, service_role;
grant insert, select on public.project_manuscript_versions to authenticated;
grant references, trigger, truncate on public.project_manuscript_versions to service_role;
revoke all on public.project_manuscripts from anon, authenticated, service_role;
grant insert, select, update on public.project_manuscripts to authenticated;
grant references, select, trigger, truncate on public.project_manuscripts to service_role;
revoke all on public.scoring_criteria from anon, authenticated, service_role;
grant delete, insert, select, update on public.scoring_criteria to authenticated;
grant references, trigger, truncate on public.scoring_criteria to service_role;
revoke all on public.sozlesme_onaylari from anon, authenticated, service_role;
grant select on public.sozlesme_onaylari to authenticated;
grant insert, select on public.sozlesme_onaylari to service_role;
revoke all on public.thesis_guidelines from anon, authenticated, service_role;
grant delete, insert, select, update on public.thesis_guidelines to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.thesis_guidelines to service_role;
revoke all on public.uak_tablolari from anon, authenticated, service_role;
grant delete, insert, select, update on public.uak_tablolari to authenticated;
grant references, trigger, truncate on public.uak_tablolari to service_role;
revoke all on public.universities from anon, authenticated, service_role;
grant insert, select on public.universities to authenticated;
grant references, select, trigger, truncate, update on public.universities to service_role;
revoke all on public.yazim_kontrolleri from anon, authenticated, service_role;
grant insert, select on public.yazim_kontrolleri to authenticated;
grant references, trigger, truncate on public.yazim_kontrolleri to service_role;
-- 2) Fonksiyon çalıştırma yetkileri: Production'daki küme.
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_bireysel_aylik_hak' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_bireysel_hesabini_hazirla' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_bireysel_kredi_hareketlerim' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to authenticated', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_bireysel_kredi_yukle' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_bireysel_mi' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_kredi_durumum' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to authenticated', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_kredi_dus' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_kredi_hesabini_hazirla' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_kredi_yukle' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ai_kurum_kredi_hareketleri' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to authenticated', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='arvoos_ai_kredi_durumu' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='arvoos_ai_kullanimi' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='arvoos_uye_adini_isle' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='arvoos_uyeligimi_bagla' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to authenticated', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='arvoos_uyeligimi_bagla_kurum' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to authenticated', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='arvoos_uyeligini_bagla' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='asistan_model_ozetleri' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to authenticated', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='best_guideline_for' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='bump_share_view' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='calisma_hareketlerim' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to authenticated,service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='calisma_klasoru' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to anon,authenticated,service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='can_view_project' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to anon,authenticated,service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='can_write_project' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to anon,authenticated,service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='citation_style_label' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='destek_mesaji_hazirla' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='destek_talebini_yeniden_ac' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_my_organization_id' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to anon,authenticated,service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='gozetim_kapsami' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to anon,authenticated,service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_academic_project_insert' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_academic_project_update' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_ai_run_update' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_consultancy_request_insert' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_consultancy_request_update' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_kanit_hukmu' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_profile_lifecycle' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_project_link_insert' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_subscription' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to public', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_support_request_insert' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_support_request_update' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to public', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='handle_new_user' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='has_role' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to anon,authenticated,service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='import_academic_units' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='kanit_kaydi_denetle' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='kanit_metni_normallestir' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='kaynak_onbellegini_temizle' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='kullanici_kurumu' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to anon,authenticated,service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='notify' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='notify_guideline_approved' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='notify_guideline_ready' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='notify_manuscript_comment' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='notify_project_changes' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='olcum_ozeti' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to authenticated,service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='prevent_self_role_escalation' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='product_feedback_kurumu' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='project_status_label' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='prune_auth_rate_limits' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='prune_manuscript_versions' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rate_limit_hit' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='resync_project_guidelines' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to authenticated,service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_thesis_guideline_ready' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_thesis_guideline_updated_at' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='sozlesme_onayi_degismez' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='subscription_open' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to anon,authenticated,service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='sync_academic_project_guideline' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to service_role', r.s);
end loop; end $$;
do $$ declare r record; begin for r in select p.oid::regprocedure as s from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='yazim_ritmi' loop
  execute format('revoke all on function %s from public, anon, authenticated, service_role', r.s);
  execute format('grant execute on function %s to authenticated,service_role', r.s);
end loop; end $$;
-- 6) Production'daki SÜTUN düzeyi yetkiler (pg_attribute.attacl, 17.11.2026 salt okunur katalog).
--    Yukarıdaki "revoke all on <tablo>" bunları da siler. Eskiden yeniden verilmiyordu: taklitte
--    paylaşım bağlantısı oluşturma, yorum çözme ve bildirimi okundu yapma Production'dan SIKI kalıyordu.
grant update (teze_eklendi, teze_eklenecek) on public.analiz_sonuclari to authenticated;
grant update (resolved_at, resolved_by) on public.manuscript_comments to authenticated;
grant insert (project_id, token_hash, label, created_by, expires_at) on public.manuscript_share_links to authenticated;
grant update (revoked_at) on public.manuscript_share_links to authenticated;
grant update (view_count, last_viewed_at) on public.manuscript_share_links to service_role;
grant update (read_at) on public.notifications to authenticated;
-- P9: yetim profil dalı için tek genişletme.
grant delete on public.profiles to service_role;
commit;
