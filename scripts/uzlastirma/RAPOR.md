# RELEASE CLOSURE 06 — Production veritabanı uzlaştırması / güvenli prova

17.11.2026 · Depo `design/os5` @ `11044d6` · Production `zpfpocyajnxcketdjbxm`

**Production'a hiçbir yazma yapılmadı.** Production'da yalnızca katalog ve toplu sayım
SELECT'leri çalıştı (kişisel veri okunmadı). Paylaşılan Test'e dokunulmadı. Migration
repair, `db push`, main birleştirmesi ve yayın yok. Paketler yalnızca yerel yığında
(127.0.0.1, Postgres 17 + GoTrue + PostgREST + storage-api) sentetik veriyle denendi;
e-posta (Resend anahtarı yok), ödeme ve webhook yan etkileri kapalı, model yerine
yerel taklit (gerçek AI testi YOK).

## 1. Özet karar: **HOLD**

Prova temiz: P1–P8 tek tek ve birlikte uygulanıyor, ikinci kez uygulamak şemayı
değiştirmiyor, kısmi hata iz bırakmıyor, geri dönüş şemayı paketlerden önceki
hâline birebir döndürüyor, kabul testleri bu şema üzerinde geçiyor. Production'a
geçişi tutan şey prova değil, doğrulanamayan üç dış koşul:

1. **Yedek / PITR UNVERIFIED** (§6). Veri adımı içeren paket (P5) ve P3'ün tam
   geri dönüşü yedeğe dayanıyor.
2. **Supabase GitHub entegrasyonu (Production dalı, otomatik dağıtım) UNVERIFIED.**
   Depo 109 migration taşıyor; Production'ın geçmiş tablosunda bunların hiçbiri yok
   (12 kayıt, sürüm ve adları depoyla uyuşmuyor). Entegrasyon açıksa main'e
   birleştirme, 109 migration'ı geçmişte yok diye yeniden çalıştırmayı deneyebilir:
   tohum verisi, `create table`, geri doldurmalar. Geçmiş onarımı (§8) bu yüzden
   main birleştirmesinden **önce** gelir.
3. **Gerçek AI modeliyle test yapılmadı** (anahtar yok). Asistan hattı yalnızca
   yerel model taklidiyle sınandı → PASS yazılmadı, UNVERIFIED.

Ayrıca kullanıcı kararı bekleyen iki konu var: P8 (yeni hesapların rolü) ve
Production'ın dar tablo yetkilerinin depoya nasıl yansıyacağı (§3).

## 2. Migration × durum × kanıt × eylem

Yöntem: her migration'ın yarattığı nesneler (fonksiyon, tablo, tetikleyici,
politika, dizin, yetki satırı) çıkarıldı ve **son hâlleri** Production kataloğuyla
özet (md5) üzerinden karşılaştırıldı (`sema-ozeti.sql`). Nesnenin var olması kanıt
sayılmadı: fonksiyon gövdesi (boşluksuz prosrc), SECURITY DEFINER, search_path,
dönüş tipi, oynaklık; tablo sütun/tip/varsayılan/kısıt/dizin/RLS; politika
ifadesi; tablo ve SÜTUN düzeyi yetkiler; tetikleyici tanımı. Bir fonksiyonu sonradan
yeniden tanımlayan migration varsa önceki "yerine geçti" olarak işaretlendi. Veri
adımı (insert/update) içeren migration'ların izi Production'da toplu sayımla
arandı; aranamayanlar BELİRSİZ.

**Toplam 109: 90 EŞDEĞER · 8 EKSİK · 5 SAPMIŞ · 6 BELİRSİZ.** Depo dışı:
`supabase/schema.sql` SAPMIŞ (rol varsayılanı `'client'` ↔ Production `'employee'`;
organizations SELECT ifadesi) ve sistematik tablo/fonksiyon yetki farkı (§3).

| # | Migration | Durum | Kanıt | Eylem |
|---|---|---|---|---|
| 1 | `20260806234000` academic_unit_directory | **SAPMIŞ** | validate_academic_unit_parent() yok; set_academic_unit_updated_at() yok; validate_academic_unit_parent_trigger tetikleyicisi yok; set_academic_unit_updated_at_trigger tetikleyicisi yok | P7 (ertelenebilir) ya da kabul edilen sapma |
| 2 | `20260806235500` academic_unit_import_pipeline | **SAPMIŞ** | academic_unit_import_staging: yapı farklı (başka soy); academic_unit_import_staging@service_role: SELECT,INSERT,UPDATE,DELETE Production'da yok; import_academic_units(): 20260914090000 yerine geçti | Kabul edilen sapma: Production dizini farklı soy; çalışma anı kullanmıyor |
| 3 | `20260807113000` thesis_guideline_intelligence | **EŞDEĞER** | set_thesis_guideline_updated_at() md5 eşit; thesis_guidelines yapı özeti eşit; dizin thesis_guidelines_university_id_idx: thesis_guidelines yapı özeti eşit; dizin thesis_guidelines_academic_unit_id_idx: thesis_guidelines yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 4 | `20260817120000` seed_istanbul_university_root_units | **BELİRSİZ** | tohum verisi: Production'daki akademik dizin farklı soydan (2870 kök birim, academic_programs/data_sources); tohumun kendisi aranmadı; academic_units@authenticated yetkisi var | Şema kısmı eşit; veri adımı belgelenip geçmişe kaydedilir (yeniden çalıştırılmaz) |
| 5 | `20260818110000` grant_academic_units_service_role_access | **EŞDEĞER** | academic_units@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 6 | `20260818113000` guideline_automatic_discovery | **EŞDEĞER** | universities yapı özeti eşit; dizin universities_guideline_discovery_idx: universities yapı özeti eşit; universities@service_role yetkisi var; thesis_guidelines@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 7 | `20260913120000` phase1_role_guards | **SAPMIŞ** | guard_consultancy_request_update_trigger tetikleyicisi yok; guard_support_request_update_trigger tetikleyicisi yok; guard_academic_project_update() md5 eşit; guard_consultancy_request_update(): 20260924100001 yerine geçti | P6 (tetikleyiciler) |
| 8 | `20260914090000` phase2_live_alignment | **EŞDEĞER** | prevent_self_role_escalation(): 20260924100011 yerine geçti; import_academic_units() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 9 | `20260915090000` guideline_sync | **BELİRSİZ** | şema kısmı eşit; çalışmalara kılavuz atayan geri doldurma (update) sonradan resync ile yeniden yapılıyor, tek başına doğrulanamaz; best_guideline_for(): 20260926131150 yerine geçti; sync_academic_project_guideline(): 20260924100034 yerine geçti; resync_project | Şema kısmı eşit; veri adımı belgelenip geçmişe kaydedilir (yeniden çalıştırılmaz) |
| 10 | `20260916090000` manuscript_versions_comments | **EŞDEĞER** | can_view_project(): 20260924100028 yerine geçti; can_write_project(): 20260924100028 yerine geçti; prune_manuscript_versions() md5 eşit; project_manuscript_versions yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 11 | `20260917090000` literature_publication_fields | **EŞDEĞER** | literature_sources yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 12 | `20260918090000` notifications | **EŞDEĞER** | project_status_label() md5 eşit; notify() md5 eşit; notify_manuscript_comment() md5 eşit; notify_project_changes(): 20260924100035 yerine geçti | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 13 | `20260919090000` heading_numbering | **EŞDEĞER** | project_manuscripts yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 14 | `20260920090000` manuscript_share_links | **EŞDEĞER** | son hâl: INSERT 20261029133812'de beş sütuna daraltıldı; Production'da aynı beş sütun (attacl); manuscript_share_links@authenticated: INSERT Production'da yok; manuscript_share_links yapı özeti eşit; dizin manuscript_share_links_project_idx: manuscript_share_l | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 15 | `20260921090000` share_view_notifications | **EŞDEĞER** | notifications yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 16 | `20260922090000` arvoos_license_sync | **EŞDEĞER** | organizations yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 17 | `20260923090000` bridge_health | **EŞDEĞER** | bridge_health yapı özeti eşit, tohum satırı var (1); bridge_health yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 18 | `20260923100000` bridge_health_grants | **EŞDEĞER** | bridge_health@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 19 | `20260923110000` arvoos_service_grants | **EŞDEĞER** | profiles@service_role yetkisi var; organizations@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 20 | `20260924090000` share_links_service_grants | **EŞDEĞER** | bump_share_view() md5 eşit; manuscript_share_links@service_role yetkisi var; academic_projects@service_role yetkisi var; project_manuscripts@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 21 | `20260924100000` project_files_bucket_limits | **EŞDEĞER** | project-files kovası: özel, 20 MB, 5 MIME türü — Production'da birebir | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 22 | `20260924100001` guvenlik_sertlestirme | **EŞDEĞER** | prevent_self_role_escalation(): 20260924100011 yerine geçti; guard_academic_project_insert() md5 eşit; guard_consultancy_request_insert() md5 eşit; guard_support_request_insert() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 23 | `20260924100002` hiz_siniri | **EŞDEĞER** | rate_limit_hit() md5 eşit; prune_auth_rate_limits() md5 eşit; auth_rate_limits yapı özeti eşit; auth_rate_limits@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 24 | `20260924100003` abonelik_kapisi_veritabaninda | **SAPMIŞ** | individual_subscriptions: deneme_hatirlatildi_at + dizin yok; subscription_open(): 20261029151315 yerine geçti; guard_subscription() md5 eşit; individual_subscriptions@authenticated yetkisi var | Karar: pakete al ya da kabul edilen sapma olarak belgele; geçmişe ancak karardan sonra |
| 25 | `20260924100004` ai_geri_bildirim_tablosu | **EŞDEĞER** | ai_feedback_requests yapı özeti eşit; dizin ai_feedback_requests_document_id_idx: ai_feedback_requests yapı özeti eşit; ai_feedback_requests@authenticated yetkisi var; ai_feedback_requests@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 26 | `20260924100005` ai_asistan_kayitlari | **EŞDEĞER** | son hâl: INSERT 20261029133812'de depoda da kaldırıldı; Production'la aynı (authenticated=SELECT,UPDATE); ai_assistant_runs@authenticated: INSERT Production'da yok; guard_ai_run_update(): 20260924100006 yerine geçti; ai_assistant_runs yapı özeti eşit; dizin ai | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 27 | `20260924100006` asistan_calismaya_baglandi | **EŞDEĞER** | guard_ai_run_update() md5 eşit; ai_assistant_runs yapı özeti eşit; dizin ai_assistant_runs_project_idx: ai_assistant_runs yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 28 | `20260924100007` kilavuz_onay_kuyrugu | **BELİRSİZ** | şema kısmı eşit (fonksiyon, tetikleyici, dizin); kılavuz kuyruk durumunu dolduran update doğrulanamaz; set_thesis_guideline_ready(): 20260926135648 yerine geçti; notify_guideline_ready() md5 eşit; thesis_guidelines yapı özeti eşit; dizin thesis_guidelines_onay | Şema kısmı eşit; veri adımı belgelenip geçmişe kaydedilir (yeniden çalıştırılmaz) |
| 29 | `20260924100008` kilavuz_bildirim_tetikleyici_duzeltme | **EŞDEĞER** | notify_guideline_ready_trigger tetikleyici var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 30 | `20260924100009` kilavuz_kosullu_istek | **EŞDEĞER** | thesis_guidelines yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 31 | `20260924100010` kilavuz_ocr | **BELİRSİZ** | fonksiyon yerine geçti; OCR kılavuzlarının durumunu düzelten update doğrulanamaz; set_thesis_guideline_ready(): 20260926135648 yerine geçti | Şema kısmı eşit; veri adımı belgelenip geçmişe kaydedilir (yeniden çalıştırılmaz) |
| 32 | `20260924100011` arvoos_uyeleri_ilk_giriste_baglansin | **EŞDEĞER** | arvoos_uyeligini_bagla(): 20261106184046 yerine geçti; prevent_self_role_escalation() md5 eşit; handle_new_user(): 20260924100026 yerine geçti; arvoos_uyeligimi_bagla() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 33 | `20260924100012` arvoos_ai_kullanim_olcumu | **EŞDEĞER** | arvoos_ai_kullanimi() md5 eşit; dizin ai_assistant_runs_created_idx: ai_assistant_runs yapı özeti eşit; ai_assistant_runs@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 34 | `20260924100013` ai_kredi_kapisi | **EŞDEĞER** | ai_kredi_durumum(): 20261026181929 yerine geçti; organizations yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 35 | `20260924100014` ai_kredi_bakiyesi | **EŞDEĞER** | ai_kredi_hesabini_hazirla(): 20261029133812 yerine geçti; ai_kredi_dus(): 20261029133812 yerine geçti; ai_kredi_durumum(): 20261026181929 yerine geçti; ai_kredi_yukle() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 36 | `20260924100015` arvoos_uye_adi | **EŞDEĞER** | arvoos_uyeligini_bagla(): 20261106184046 yerine geçti; arvoos_members yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 37 | `20260924100016` arvoos_kredi_bakiyesini_okur | **EŞDEĞER** | arvoos_ai_kredi_durumu(): 20260924100017 yerine geçti | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 38 | `20260924100017` kredi_durumu_bildirilmemis_limiti_ayirsin | **EŞDEĞER** | arvoos_ai_kredi_durumu() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 39 | `20260924100018` denetim_rolleri_metni_duzeltebilsin | **EŞDEĞER** | can_write_project(): 20260924100028 yerine geçti; can_view_project(): 20260924100028 yerine geçti; calisma_klasoru() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 40 | `20260924100019` kullanim_geri_bildirimi | **EŞDEĞER** | product_feedback yapı özeti eşit; dizin product_feedback_updated_idx: product_feedback yapı özeti eşit; product_feedback@authenticated yetkisi var; product_feedback@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 41 | `20260924100020` mla_atif_stili | **EŞDEĞER** | citation_style kısıtı iki tabloda 'mla' içeriyor (Production pg_constraint) | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 42 | `20260924100021` kaynak_dogrulama_onbellegi | **EŞDEĞER** | kaynak_onbellegini_temizle() md5 eşit; kaynak_dogrulama_onbellegi yapı özeti eşit; dizin kaynak_dogrulama_onbellegi_gecerlilik_idx: kaynak_dogrulama_onbellegi yapı özeti eşit; kaynak_dogrulama_onbellegi@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 43 | `20260924100022` destek_yaniti | **EŞDEĞER** | guard_support_request_update(): 20261027074716 yerine geçti; app_support_requests yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 44 | `20260924100023` docentlik_kayit_duzenleme | **EŞDEĞER** | academic_score_entries@authenticated yetkisi var; guard_subscription_trigger tetikleyici var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 45 | `20260924100024` analiz_sonuclari | **EŞDEĞER** | analiz_sonuclari yapı özeti eşit; dizin analiz_sonuclari_owner_idx: analiz_sonuclari yapı özeti eşit; analiz_sonuclari@authenticated yetkisi var; guard_subscription_trigger tetikleyici var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 46 | `20260924100025` anon_tablo_yetkileri_ve_analiz_calisma_bagi | **EŞDEĞER** | guard_analiz_sonucu_project_trigger tetikleyici var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 47 | `20260924100026` kvkk_onayi_kaydi | **EKSİK** | handle_new_user() gövdesi farklı; profiles.kvkk_onay_at Production'da yok | P3 ile uygula, sonra geçmişe kaydet |
| 48 | `20260924100027` deneme_hatirlatma_isareti | **EKSİK** | individual_subscriptions.deneme_hatirlatildi_at Production'da yok | P3 ile uygula, sonra geçmişe kaydet |
| 49 | `20260924100028` kurum_kapsamli_okuma | **EŞDEĞER** | kullanici_kurumu() md5 eşit; gozetim_kapsami() md5 eşit; can_view_project() md5 eşit; can_write_project() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 50 | `20260924100029` olcum_ic_ekip_abonelikleri_gorur | **EŞDEĞER** | individual_subscriptions politika grubu özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 51 | `20260924100030` olcum_sayimi_veritabaninda | **EŞDEĞER** | olcum_ozeti() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 52 | `20260924100031` calisma_yazma_kurumla_sinirli | **EŞDEĞER** | academic_projects politika grubu özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 53 | `20260924100032` puanlama_kriterleri_kuruma_ait | **EŞDEĞER** | scoring_criteria yapı özeti eşit; dizin scoring_criteria_organization_idx: scoring_criteria yapı özeti eşit; dizin scoring_criteria_kurum_kod_key: scoring_criteria yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 54 | `20260924100033` ortak_veri_ve_yorum_yazma_kapsami | **SAPMIŞ** | politika universities: depoda fazladan yinelenen SELECT politikası; thesis_guidelines yapı özeti eşit; dizin thesis_guidelines_organization_idx: thesis_guidelines yapı özeti eşit | Kabul edilen sapma: depodaki yinelenen universities SELECT politikası zararsız |
| 55 | `20260924100034` kilavuz_eslestirme_kurumu_gozetir | **BELİRSİZ** | sync fonksiyonu md5 eşit; best_guideline_for 20260926131150'de değişti (EKSİK); kılavuz yeniden eşleştirme update'i doğrulanamaz; best_guideline_for(): 20260926131150 yerine geçti; sync_academic_project_guideline() md5 eşit | Şema kısmı eşit; veri adımı belgelenip geçmişe kaydedilir (yeniden çalıştırılmaz) |
| 56 | `20260924100035` kilavuz_bildirimi_stili_soyluyor | **EŞDEĞER** | citation_style_label(): 20261103162214 yerine geçti; notify_project_changes() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 57 | `20260925110522` hesap_silme | **EŞDEĞER** | academic_projects yapı özeti eşit; consultancy_requests yapı özeti eşit; project_manuscripts yapı özeti eşit; scoring_criteria yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 58 | `20260926131150` kilavuz_secimi_kararli | **EKSİK** | best_guideline_for() gövdesi farklı | P4 ile uygula, sonra geçmişe kaydet |
| 59 | `20260926135648` ocr_tek_tik_onaya_girmesin | **BELİRSİZ** | fonksiyon md5 eşit; tek tıkla onaya düşen kılavuzları geri çeken update doğrulanamaz; set_thesis_guideline_ready() md5 eşit | Şema kısmı eşit; veri adımı belgelenip geçmişe kaydedilir (yeniden çalıştırılmaz) |
| 60 | `20260926150217` asistan_model_ozeti_veritabaninda | **EŞDEĞER** | asistan_model_ozetleri() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 61 | `20261025131500` kilavuz_sayi_bicimi | **EŞDEĞER** | sütun+kısıt yapı özeti eşit; veri: 9 onaylı anlık görüntünün 9'unda anahtar var; thesis_guidelines yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 62 | `20261025222734` calisma_kilavuzu | **EŞDEĞER** | calisma_kilavuzu yapı özeti eşit; calisma_kilavuzu@authenticated yetkisi var; calisma_kilavuzu_sinyali@authenticated yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 63 | `20261026064755` calisma_kilavuzu_tablo_yetkileri | **EŞDEĞER** | calisma_kilavuzu@authenticated yetkisi var; calisma_kilavuzu@service_role yetkisi var; calisma_kilavuzu_sinyali@authenticated yetkisi var; calisma_kilavuzu_sinyali@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 64 | `20261026065320` kanit_zinciri_ve_makale_calisma_alani | **EŞDEĞER** | kanit_metni_normallestir() md5 eşit; kanit_kaydi_denetle() md5 eşit; kanit_kayitlari yapı özeti eşit; makale_profili yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 65 | `20261026073148` calisma_hareketlerim | **EŞDEĞER** | calisma_hareketlerim() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 66 | `20261026075358` yazim_ritmi | **EŞDEĞER** | yazim_ritmi() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 67 | `20261026101921` calisma_yapilacaklari | **EŞDEĞER** | calisma_yapilacaklari yapı özeti eşit; dizin calisma_yapilacaklari_proje_idx: calisma_yapilacaklari yapı özeti eşit; dizin calisma_yapilacaklari_tekil_idx: calisma_yapilacaklari yapı özeti eşit; calisma_yapilacaklari@authenticated yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 68 | `20261026110024` kaynak_pdfleri | **EŞDEĞER** | kaynak_pdfleri yapı özeti eşit; dizin kaynak_pdfleri_proje_idx: kaynak_pdfleri yapı özeti eşit; kaynak_pdfleri@authenticated yetkisi var; kaynak_pdfleri@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 69 | `20261026120339` calisma_ornek_atif | **EŞDEĞER** | academic_projects yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 70 | `20261026131044` analiz_teze_ekleme | **EŞDEĞER** | analiz_sonuclari yapı özeti eşit; dizin analiz_sonuclari_proje_sira_idx: analiz_sonuclari yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 71 | `20261026181929` bireysel_ai_kredisi | **EŞDEĞER** | ai_bireysel_aylik_hak() md5 eşit; ai_bireysel_mi() md5 eşit; ai_bireysel_hesabini_hazirla(): 20261029133812 yerine geçti; ai_kredi_dus(): 20261029133812 yerine geçti | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 72 | `20261026202222` yazim_kontrol_gecmisi | **EŞDEĞER** | yazim_kontrolleri yapı özeti eşit; dizin yazim_kontrolleri_proje_tarih_idx: yazim_kontrolleri yapı özeti eşit; yazim_kontrolleri@authenticated yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 73 | `20261027061010` tez_icindekiler_varsayilan | **EŞDEĞER** | veri: içindekiler kutusu kapalı tez sayısı 0 | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 74 | `20261027070012` arvoos_uye_adi_her_esitlemede | **EŞDEĞER** | arvoos_uye_adini_isle() md5 eşit; arvoos_uye_adini_isle tetikleyici var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 75 | `20261027074716` destek_yazismasi | **EŞDEĞER** | destek_mesaji_hazirla() md5 eşit; destek_talebini_yeniden_ac() md5 eşit; guard_support_request_update(): yalnız yorum/CRLF farkı (satır satır); destek_mesajlari yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 76 | `20261027081037` docentlik_hedef_yazar_belge_tarih | **EŞDEĞER** | docentlik_profili yapı özeti eşit; docentlik_hedefleri yapı özeti eşit; scoring_criteria yapı özeti eşit; academic_score_entries yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 77 | `20261027083309` uak_tablolari_temel_alan | **EŞDEĞER** | uak_tablolari yapı özeti eşit; scoring_criteria yapı özeti eşit; docentlik_hedefleri yapı özeti eşit; docentlik_profili yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 78 | `20261027122336` docentlik_tavan_esit_bolusum | **EŞDEĞER** | scoring_criteria yapı özeti eşit; docentlik_hedefleri yapı özeti eşit; dizin docentlik_hedefleri_kapsam_grup_key: docentlik_hedefleri yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 79 | `20261027142035` docentlik_alt_alan | **EŞDEĞER** | scoring_criteria yapı özeti eşit; docentlik_hedefleri yapı özeti eşit; docentlik_profili yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 80 | `20261028035441` tez_takvimi | **EŞDEĞER** | calisma_takvimi yapı özeti eşit; dizin calisma_takvimi_proje_idx: calisma_takvimi yapı özeti eşit; dizin calisma_takvimi_tekil_idx: calisma_takvimi yapı özeti eşit; calisma_takvimi@authenticated yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 81 | `20261028092453` arayuz_dili | **EŞDEĞER** | profiles.arayuz_dili var; tablonun farkı yalnız kvkk_onay_at ve rol varsayılanında | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 82 | `20261028174054` bildirim_odeme_turu | **EŞDEĞER** | notifications yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 83 | `20261028180659` kurum_kredi_hareketleri | **EŞDEĞER** | ai_kurum_kredi_hareketleri() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 84 | `20261029113842` harvard_atif_stili | **EŞDEĞER** | citation_style_label(): 20261103162214 yerine geçti | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 85 | `20261029115836` kagit_boyutu | **EŞDEĞER** | project_manuscripts yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 86 | `20261029133812` ai_kredi_yenileme_ve_kayit_yetkisi | **EŞDEĞER** | ai_kredi_hesabini_hazirla() md5 eşit; ai_bireysel_hesabini_hazirla() md5 eşit; ai_kredi_dus() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 87 | `20261029140126` profil_silme_ve_kvkk_korumasi | **EŞDEĞER** | guard_profile_lifecycle(): 20261029164231 yerine geçti; guard_profile_lifecycle_trigger tetikleyici var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 88 | `20261029143148` kanit_hukmu_korumasi | **EŞDEĞER** | guard_kanit_hukmu() md5 eşit; guard_kanit_hukmu tetikleyici var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 89 | `20261029143810` kilavuz_esitleme_kurum_kapsami | **EŞDEĞER** | resync_project_guidelines() md5 eşit; product_feedback_kurumu() md5 eşit; product_feedback_kurumu tetikleyici var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 90 | `20261029151315` abonelik_aynasi_erisim_karari | **EŞDEĞER** | subscription_open() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 91 | `20261029152936` arvoos_uyelik_baglama_kurum_doner | **EŞDEĞER** | arvoos_uyeligimi_bagla_kurum() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 92 | `20261029153742` sozlesme_onaylari | **EŞDEĞER** | sozlesme_onayi_degismez() md5 eşit; sozlesme_onaylari yapı özeti eşit; dizin sozlesme_onaylari_kullanici_idx: sozlesme_onaylari yapı özeti eşit; sozlesme_onaylari@authenticated yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 93 | `20261029163058` sozlesme_onay_konumu | **EŞDEĞER** | sozlesme_onaylari yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 94 | `20261029164231` profil_koruma_kvkk_sutunsuz | **EŞDEĞER** | guard_profile_lifecycle() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 95 | `20261102102456` deneme_bitti_bildirimi | **EŞDEĞER** | deneme_bitti sütunu+dizini var; tablonun farkı yalnız deneme_hatirlatildi_at'te | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 96 | `20261102124048` sozlesme_onayi_kayit_olayi | **EŞDEĞER** | sozlesme_onaylari yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 97 | `20261102134543` etik_kurul | **EŞDEĞER** | etik_kurul yapı özeti eşit; consultancy_requests yapı özeti eşit; etik_kurul@authenticated yetkisi var; etik_kurul@service_role yetkisi var | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 98 | `20261102151330` dipnot_atif_stili | **EŞDEĞER** | citation_style_label(): 20261103162214 yerine geçti | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 99 | `20261102175708` kaynak_basim_yeri | **EŞDEĞER** | literature_sources yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 100 | `20261102195427` kilavuz_yetenegi | **EŞDEĞER** | ai_assistant_runs yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 101 | `20261103124752` yazim_yetenegi | **EŞDEĞER** | ai_assistant_runs yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 102 | `20261103131215` kaynak_sohbeti_yetenegi | **EŞDEĞER** | ai_assistant_runs yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 103 | `20261103162214` csl_atif_stilleri | **EŞDEĞER** | citation_style_label() md5 eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 104 | `20261104064252` literatur_kaynak_proje_indeksi | **EŞDEĞER** | dizin literature_sources_project_status_idx: literature_sources yapı özeti eşit | Değişiklik yok; doğrulama sonrası geçmişe kaydet |
| 105 | `20261106184046` eposta_onayi_kimlik_sabitleme | **EKSİK** | eposta_onayinda_sifreyi_temizle() yok; eposta_onayinda_profili_kur() yok; eposta_onayinda_sifreyi_temizle tetikleyicisi yok; eposta_onayinda_profili_kur tetikleyicisi yok | P5 ile uygula, sonra geçmişe kaydet |
| 106 | `20261107113542` sifre_durumum | **EKSİK** | sifre_durumum(): depoda sonradan kaldırıldı | Uygulanmaz (sonraki migration fonksiyonu kaldırıyor); P5 kapsamında yalnızca geçmişe kaydedilir |
| 107 | `20261107120542` ilk_sifre_gerekli | **EKSİK** | ilk_sifre_gerekli() yok | P5 ile uygula, sonra geçmişe kaydet |
| 108 | `20261112195236` rate_limit_take | **EKSİK** | rate_limit_take() yok | P1 ile uygula, sonra geçmişe kaydet |
| 109 | `20261115203504` metin_surum_damgasi | **EKSİK** | metin_surum_damgasi() yok; metin_surum_damgasi tetikleyicisi yok | P2 ile uygula, sonra geçmişe kaydet |

## 3. Fonksiyon, RLS ve yetki sapmalarının risk analizi

### 3.1 Gövdesi farklı fonksiyonlar (otomatik DEĞİŞTİRİLMEDİ)

| Fonksiyon | Production'daki sürüm | Neden farklı | Bağlı akış | Risk / karar |
|---|---|---|---|---|
| `handle_new_user` | 20260924100011 | 20260924100026 (KVKK) hiç uygulanmamış | Her kayıt (auth.users INSERT) | KVKK onay zamanı **yazılmıyor**; `/api/hesabim/verilerim` var olmayan sütunu seçiyor. → P3 |
| `best_guideline_for` | 20260924100034 | 20260926131150 uygulanmamış | Yeni çalışmaya kılavuz atama | Eşitlikte seçim kararsız; veri bozulmaz. → P4 |
| `arvoos_uyeligini_bagla` | 20260924100015 | G1 (20261106184046) uygulanmamış | Kurum bağı | Onaysız hesap kuruma bağlanabiliyor (G1 açığı; bugün onaysız hesap 0). → P5 |
| `guard_support_request_update` | depoyla anlamca aynı | Yalnız yorum ve CRLF satır sonu | — | Risk yok, değiştirilmez. Tetikleyicisi eksik → P6 |

Production'da hiç olmayan 7 fonksiyon: `rate_limit_take` (P1), `metin_surum_damgasi` (P2),
`eposta_onayinda_profili_kur`, `eposta_onayinda_sifreyi_temizle`, `ilk_sifre_gerekli` (P5),
`set_academic_unit_updated_at`, `validate_academic_unit_parent` (P7). Production'a özgü
`rls_auto_enable` Supabase platformunun, dokunulmaz. `rate_limit_hit` birebir aynı.

### 3.2 RLS politikaları

- Bütün politika grupları (storage.objects dahil) eşit, iki istisna:
  - `organizations` SELECT: Production `id = get_my_organization_id() or has_role(iç ekip)`;
    depo aynı kuralı alt sorguyla yazıyor. Anlamca eşdeğer; **kabul edilen sapma**.
  - `universities`: depoda fazladan bir SELECT politikası (yinelenen). Zararsız; kabul.
- `gozetim_kapsami` ve kurum sınırı politikaları Production'da depoyla aynı (md5).

### 3.3 Yetki sapması (Production daha DAR)

- **Tablo:** 82 özet satırı. Production'da `service_role` birçok tabloda SELECT/INSERT/
  UPDATE/DELETE taşımıyor, `authenticated` birkaç tabloda DELETE taşımıyor. Depoda bu
  yetkiler Supabase'in varsayılan ayrıcalıklarından geliyor; Production tabloları elle
  ve daraltılmış kuruldu. **Sütun düzeyi yetkiler üç tarafta (Production, taklit, depo)
  birebir aynı** (13 sütun; paylaşım bağlantısı INSERT'i dahil).
- **Fonksiyon:** 48 satır; Production'da `service_role`'ün tetikleyici/iç fonksiyonlarda
  EXECUTE'u yok. Uygulamanın çağırdığı her RPC'nin gerekli yetkisi Production'da var.
- **Uygulamaya etkisi ölçüldü:** yönetici istemcisi (service_role) kullanan bütün
  yollar (31 tablo×işlem, 4 RPC) Production yetkileriyle prova veritabanında
  sınandı — **biri hariç hepsi geçiyor**:
  - `app/api/cron/hesap-silme/route.ts:96` — auth kaydı olmayan **yetim profil** silme.
    Production'da service_role'ün `profiles` DELETE'i yok; hata okunmadığı için sayaç
    "silindi" der, profil kalır ve her koşuda yeniden denenir. Olağan yol (GoTrue
    `deleteUser` + FK kaskadı) etkilenmez. Paketlerden bağımsız, önceden var olan
    sapma; **düzeltme ayrı karar** (dar bir `grant delete on profiles to service_role`
    ya da yolun hatayı okuması).
- **Karar gereken:** Production'ın dar yetkileri doğru güvenlik duruşu gibi görünüyor;
  ama depo bunu bilmiyor. Yeni bir kod yolu service_role ile bu tablolardan birine
  dokunursa yerelde/Test'te geçer, Production'da düşer. Öneri: Production yetkilerini
  depoya bir "yetki sabitleme" migration'ı olarak yazmak (Production'ı değiştirmez,
  depoyu Production'a eşitler) ya da tersine Production'a eksik yetkileri vermek.
  Bu turda hiçbiri yapılmadı.

### 3.4 Tablo yapısı

44 tabloda sütun, tip, varsayılan, kısıt, dizin ve RLS birebir aynı. Farklar:
`profiles.kvkk_onay_at` ve `individual_subscriptions.deneme_hatirlatildi_at` (+dizin) yok
(P3); `profiles.role` varsayılanı (P8); `academic_units` dizinleri ve
`academic_unit_import_staging` farklı **soydan** (Production'da ayrıca `academic_programs`,
`academic_program_import_staging`, `data_sources`; yalnızca çevrimdışı
`scripts/academic-directory` kullanıyor, uygulamanın çalışma anı değil) — kabul edilen
sapma, dokunulmaz.

## 4. İzole prova sonuçları

Kurulum: depodan şema, Production'da uygulanmamış 8 migration atlanarak; üstüne
`prova/00-production-taklidi.sql` (Production'ın tablo, sütun ve fonksiyon yetkileri,
eksik tetikleyiciler, akademik dizinler, organizations ifadesi, rol varsayılanı —
hepsi katalogdan). Taklidin Production'la özet karşılaştırmasında kalan farklar
yalnızca Production'a özgü nesneler (`rls_auto_enable`, akademik soy tabloları) ve
ACL yazım biçimi (varsayılan ↔ açık PUBLIC).

| Konu | Sonuç | Kanıt |
|---|---|---|
| P1–P8 ilk uygulama | **PASS** | her biri 40–58 ms, hata yok |
| Tekrar çalıştırma (her paket ×2) | **PASS** | ikinci uygulamada şema özeti farkı 0 satır |
| Kısmi hata | **PASS** | P5 commit'ten önce düşürüldü: şema farkı 0, G1 fonksiyonu 0, sentetik onaysız profilin kurum bağı yerinde |
| Bağımlılık sırası | **PASS** | ters sıra (P8,P5,P3,P7,P6,P1,P4,P2) olağan sırayla aynı son özeti verdi |
| Geri dönüş R8→R1 (×2) | **PASS** | paketlerden önceki özetle fark 0 satır; R3 varsayılan kipi sütunları koruyor |
| Son durum ↔ depo hedefi | 136 satır, **beklenen** | tablo yetkisi 82, fonksiyon yetkisi 48, academic_units dizini 3, politika 3 — hepsi §3'te kabul edilen/karar bekleyen sapma; fonksiyon gövdeleri ve tetikleyiciler birebir |
| rate_limit_take | **PASS** | PostgREST üzerinden service_role: 3/2/0 atomik kısmi karşılama; anon `permission denied` |
| metin_surum_damgasi | **PASS** | kayıt bütünlüğü 14/14 (S4, S11 tetikleyiciye bağlı) |
| G1 kimlik | **PASS** | kimlik-kabul 15/15 (gerçek Next + GoTrue): mevcut kullanıcı, davetli kapısı, ilk şifre, kurtarma, ArvoOS üyesi, yönetici API'si (K13) |
| Destek/danışmanlık guard tetikleyicileri | **PASS** | P6 sonrası tetikleyiciler var, tekrar/geri dönüş temiz |
| Akademik birim (P7) | **PASS** (prova) | Production ön koşulu: uyumsuz üst birim 0 / 17 124 |
| Farklı fonksiyon gövdeleri | **PASS** | P3/P4/P5 sonrası gövdeler depo md5'iyle aynı; R3/R4/R5 Production md5'ine döndü |
| RLS / yetki sapması | **PASS** (uygulama yolları) · 1 bulgu | §3.3 (yetim profil silme) |
| DOI çalışma zamanı | **PASS** | `test:doi-runtime` 29/29 |
| Kayıt bütünlüğü | **PASS** | 14/14 (P1–P6 ve P1–P8 durumlarında ayrı ayrı) |
| Yazım Stüdyosu | **PASS** (şemaya bağlı senaryolar) · U3 **aralıklı FAIL** (UI, şemadan bağımsız) | Altı tam koşu (`sonuclar/studyo-kosulari.md`): ısınmış sunucuda iki kez 57/57. **R3** (10 eşzamanlı seçim tek çözümlemeye iner) taze `next dev`'deki her ilk koşuda düştü (3/3; sayaç 0→2), ısınmış koşuların hepsinde geçti: tekilleştirme süreç içi `Map`, ilk derlemede iki modül örneği; sayaç `rate_limit_hit` Production'da birebir aynı. **U3** (asistan yaprağı araç çubuğunu örtmez) 6 koşunun 3'ünde düştü, ayrı tanı döngüsünde 12 denemede 1: yaprağın üstü 345 yerine ~300 px'te açılıp araç çubuğunu örtüyor (örten öğe `yazim-paneli-bos`). İstemci yerleşimi, veritabanı yok; RC05'te 57/57 kaydedilmişti → **ayrı UI bulgusu**, bu turda düzeltilmedi |
| Asistan hattı (gerçek model) | **UNVERIFIED** | yalnızca yerel taklit |

Prova sırasında bulunan ve düzeltilen düzenek hataları:
- `kayit-butunlugu.mjs` hesabı şifre + `email_confirm` ile tek istekte açıyordu; G1
  tetikleyicisi onay anında şifreyi siler (bilerek, K13) → G1'li veritabanında her
  giriş düşüyordu. Şifre artık onaydan sonra konuyor (kimlik-kabul ile aynı yol).
  Uygulama kodunda bu kalıp yok (`auth.admin.createUser` çağrısı yok). **İşletim
  notu:** P5'ten sonra Supabase panelinde "Create user + Auto Confirm" ile şifreli
  açılan hesabın şifresi düşer; kullanıcı kurtarma bağlantısıyla şifre belirler.
- Taklit katmanı `revoke all` ile sütun yetkilerini de siliyor ve rol varsayılanını
  depodaki gibi bırakıyordu; özet sütun yetkisini hiç ölçmüyordu. Üçü düzeltildi,
  sonuçlar düzeltmeden sonra yeniden alındı.

## 5. Paketler (sıralı, küçük, geri dönüşü sınanmış)

Hepsi `paketler/`, her biri tek `begin … commit`, tekrar çalıştırılabilir. Geri
dönüşler `paketler/geri/`, etkileri `paketler/GERI_DONUS.md`.

| Sıra | Paket | Kaynak migration | Veri değiştirir mi | Önerilen zaman |
|---|---|---|---|---|
| 1 | P1 rate_limit_take | 20261112195236 | Hayır | İlk dalga |
| 2 | P2 metin_surum_damgasi | 20261115203504 | Hayır | İlk dalga |
| 3 | P6 destek/danışmanlık guard | 20260913120000 (tetikleyiciler) | Hayır | İlk dalga |
| 4 | P4 kılavuz seçimi | 20260926131150 | Hayır | İlk dalga |
| 5 | P3 KVKK + deneme işareti | 20260924100026 + 100027 | Hayır (sütunlar NULL eklenir) | İlk dalga |
| 6 | P5 G1 kimlik | 20261106184046 + 20261107120542 | **Evet** (onaysız hesabın kurum bağı; bugün 0 satır) | Yedek doğrulandıktan sonra, ayrı pencere |
| 7 | P8 rol varsayılanı | schema.sql | Hayır (yalnız varsayılan) | **Karar gerekli** |
| 8 | P7 akademik birim | 20260806234000 (tetikleyiciler) | Hayır | Ertelenebilir |

Her paket için ön koşul (salt okunur), doğrulama ve durdurma ölçütü:

| Paket | Ön koşul | Doğrulama | Durdurma |
|---|---|---|---|
| P1 | `select 1 from pg_proc where proname='rate_limit_take'` → boş | imza `(text, integer, interval, integer)`, secdef, EXECUTE yalnız service_role | fonksiyon yok ya da anon/authenticated'da EXECUTE |
| P2 | `metin_surum_damgasi` tetikleyicisi 0 | `BEFORE UPDATE ON project_manuscripts` | tetikleyici yok ya da işlem içi örnek UPDATE hata verir |
| P3 | iki sütun yok | iki sütun var; `handle_new_user` md5 = depo (960976d0…) | sütun eklenemez ya da fonksiyon derlenmez |
| P4 | `best_guideline_for` md5 = f6ae7d06… | md5 = 64bbbddb…, yetki yalnız service_role | derlenmez |
| P5 | onaysız hesap sayısı (17.11: **0**), sökülecek bağ (17.11: **0**), şifresiz hesap (17.11: 0); kimlik listesi kaydedilir; GoTrue OTP süresi (UNVERIFIED) | `auth.users` üzerinde 2 `eposta_onayinda_*` tetikleyicisi; `ilk_sifre_gerekli` var; PostgREST önbelleği yenilendi; uygulamada ilk şifre kapısı | tetikleyici eklenemez ya da veri adımı ön koşuldan fazla satır etkiler → işlemi geri al |
| P6 | iki tetikleyici yok | iki tetikleyici var | oluşmazsa |
| P7 | uyumsuz üst birim sayısı 0 (17.11: **0**) | academic_units'te iki tetikleyici | ön koşul 0 değilse UYGULAMA |
| P8 | varsayılan `'employee'::user_role` | `'client'::user_role` | — |

Her paketten sonra ortak doğrulama: `sema-ozeti.sql` Production'da çalıştırılır ve
provadaki aynı adımın özetiyle karşılaştırılır; tek satır sapma = dur.

**P8 neden karar gerektiriyor:** Production'daki `handle_new_user` rol yazmıyor, yeni
her hesap `'employee'` (Personel) oluyor: personel menüleri (`STAFF_ROLES`) açılıyor,
abonelik kapısı yine uygulanıyor. Bugün 4 profilden 2'si employee. P8 yalnızca bundan
sonrasını düzeltir; mevcut iki hesabın gerçekten personel mi olduğu ayrı bir soru.

## 6. Yedek durumu — **UNVERIFIED → HOLD**

- Doğrulanan (salt okunur): plan **pro**; `archive_mode=on`, `wal_level=logical`,
  `archive_timeout=120` → WAL arşivleme açık.
- Doğrulanamayan: günlük yedek listesi, PITR eklentisinin açık olup olmadığı, geri
  dönülebilecek en eski an, bir geri yüklemenin gerçekten çalıştığı. Bunlar MCP
  üzerinden görünmüyor; geri yükleme denenmedi.
- Şema geri dönüşü yedeğe bağlı değil (R1–R8, sınandı). Veri geri dönüşü (P5'in
  veri adımı, P3 `tam=1`) yedeğe bağlı.
- Yapılması gereken (kullanıcı): Dashboard → Database → Backups ve Point in Time
  Recovery ekranlarında son yedeğin tarihi ve PITR aralığı. Yeni yedek almak ya da
  ayar değiştirmek ayrı onay ister; bu turda yapılmadı.

## 7. Production'da çalıştırılan sorgular (hepsi salt okunur)

Katalog (pg_proc, pg_trigger, pg_policies, information_schema yetkileri,
pg_attribute.attacl, pg_constraint, storage.buckets tanımı) ve toplu sayımlar:
onaysız/şifresiz hesap, sökülecek kurum bağı, uyumsuz üst birim, rol dağılımı,
onaylı kılavuz anlık görüntüsü, içindekiler kapalı tez, bridge_health satırı,
geçmiş tablosu kaydı. Kişisel veri, e-posta, metin, dosya okunmadı.

## 8. Migration geçmişi onarımı — yeniden değerlendirme

Production'ın `supabase_migrations.schema_migrations` tablosunda 12 kayıt var
(20260815134724…20260818091259); adları ve sürümleri depodakilerle uyuşmuyor
(ör. `thesis_guideline_intelligence` depoda 20260807113000). Depodaki 109 sürümün
hiçbiri kayıtlı değil.

**Yöntem:** toplu "hepsini uygulandı say" YOK. Sıra:
1. Paketler uygulanır; her paketten sonra Production özeti provanın özetiyle eşleşir.
2. Ancak eşleşmeden sonra, o paketin kaynak migration'ları geçmişe yazılır
   (`supabase migration repair --status applied <sürüm>`, sürüm sürüm).
3. EŞDEĞER (90) migration'lar tek seferde değil, bu raporun tablosu ile birlikte bir
   onay adımında kaydedilir; kanıt sütunu kaydın gerekçesidir.
4. BELİRSİZ (6) yalnızca veri adımı belgelenip (yeniden çalıştırılmayacağı yazılarak)
   kaydedilir.
5. SAPMIŞ olanlar ancak karar sonrasında: ya paket uygulanır (P6, P7) ya da "kabul
   edilen sapma" olarak belgelenip kaydedilir.
6. Depoda olmayan 12 eski kayıt `--status reverted` ile işaretlenir; bırakılırsa
   `db push` ve entegrasyon "uzakta olup yerelde olmayan sürüm" diye durur.

**Zamanlama:** geçmiş onarımı **main birleştirmesinden ve Supabase GitHub
entegrasyonu doğrulanmadan önce** yapılmalı; aksi hâlde entegrasyon depodaki bütün
migration'ları yeniden uygulamaya kalkabilir. Onarım da bir Production yazmasıdır,
ayrı onay ister.

## 9. Engeller ve bir sonraki adım

| Engel | Tür | Sahibi |
|---|---|---|
| Yedek / PITR doğrulaması | dış ayar, UNVERIFIED | Kullanıcı (Dashboard) |
| Supabase GitHub entegrasyonu: Production dalı ve otomatik dağıtım | dış ayar, UNVERIFIED | Kullanıcı (Dashboard) |
| Gerçek AI testi | anahtar yok, UNVERIFIED | Kullanıcı (test anahtarı) |
| P8 rol varsayılanı | karar | Kullanıcı |
| Tablo yetki politikası (depo ↔ Production) | karar | Kullanıcı |
| Yetim profil silme yolu | küçük hata, paket dışı | Ayrı iş |
| Yazım Stüdyosu U3 aralıklı örtüşme | UI bulgusu, paket dışı | Ayrı iş |

Bu engeller kalkınca önerilen en kısa güvenli yol: yedek doğrulaması → ilk dalga
(P1, P2, P6, P4, P3) tek pencerede, her paket sonrası özet karşılaştırması → geçmiş
onarımı (bu paketlerin sürümleri + EŞDEĞER'ler) → P5 ayrı pencerede → P8 karar →
entegrasyon doğrulaması → main.

## Dosyalar

- `sema-ozeti.sql` — karşılaştırma özeti (Production'da da salt okunur çalışır)
- `prova/00-production-taklidi.sql` — Production benzeri şema katmanı
- `prova.sh` · `prova-hata.sh` · `prova-geri.sh` — üç prova
- `paketler/P1…P8*.sql` · `paketler/geri/R1…R8*.sql` · `paketler/GERI_DONUS.md`
- `sonuclar/` — prova çıktılarının özeti
