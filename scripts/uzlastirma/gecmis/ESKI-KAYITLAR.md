# Production'daki 12 eski geçmiş kaydı — iz ve yer tutucular (RC06c)

## Amaç
Production'ın `supabase_migrations.schema_migrations` tablosunda depodan ÖNCE, elle kaydedilmiş 12 sürüm var.
Depoda karşılıkları yok. Supabase CLI ve GitHub entegrasyonu "uzakta olup yerelde olmayan sürüm" gördüğünde
**durur** (`DbPushMissingLocalError`, provada gösterildi); CLI'ın kendi önerisi bu kayıtları `reverted`
yapmak, yani geçmişi silmek. Bunun yerine depoya aynı sürümle **boş** bir dosya konur: geçmiş korunur,
hiçbir şey yeniden çalışmaz.

## Sınır (yer tutucunun YAPMADIĞI şey)
- İçeriği yalnızca yorum + `select 1;`. Production'daki işlemi **yeniden üretmez, belgelemez, onarmaz**.
- Yeni bir ortamda hiçbir şey kurmaz. Şemanın kaynağı depodaki gerçek migration'lardır (4 kaydın eşi
  depoda zaten var; 8'i Production'a özgü tek seferlik veri işlemi ve yeni ortamda bilerek yok).
- Production'daki kaydın içeriğini değiştirmez; `migration repair` ile bu 12 sürüme DOKUNULMAZ.
- Yer tutucunun içine gerçek SQL yazılamaz: `check-migrations` istisnası yalnızca bu 12 sürüm için ve
  yalnızca "select 1;" gövdesine izin verir (`check-migrations-yer-tutucu.patch`; sahte içerik provada reddedildi).

## Doğrulama (yerel, 17.11.2026)
| Sınama | Sonuç |
|---|---|
| Yer tutucular `supabase/migrations/`'ta, istisnasız `check:migrations` | **FAIL** — "sürümü gönderilmiş en son migration'dan küçük" (istisna şart) |
| + istisna yaması | PASS (121 dosya) |
| + istisna, yer tutucuya gerçek SQL yazılınca | reddedildi (beklenen) |
| Temiz yerel kurulum (`kur-depo.sh`, 121 dosya) ↔ depo hedefi (109 dosya) | **0 satır** şema özeti farkı (1492 satırlık özet) |
| `test:db` (PGlite, 350 test) yer tutucular varken | 350/350 |
| `test:unit` istisna yamasıyla | 2239/2239 |
| CLI geçmiş provası (`prova-gecmis.sh`) | yer tutucusuz duruyor; yer tutucuyla son durum 121/0/0, bekleyen 0 |

Doğrulamadan sonra yer tutucular ve yama depodan geri alındı; depoya alınmaları ayrı PR ve onay ister.

## İz: Production kaydı ↔ depo ↔ yer tutucu
Yalnızca güvenli üst veri tutuldu: ifade sayısı (hepsi 1), uzunluk, boşlukları silinmiş metnin md5'i, işlem
türü ve hedef tablo. İçerik kopyalanmadı (bir kayıt profil rolü güncelliyor ve kişisel veri içerebilir; sır
olup olmadığı içerik okunmadan bilinemeyeceği için hiçbiri kopyalanmadı). Her yer tutucu dosyası aynı
parmak izini taşır.

| Production sürümü | Ad | Uzunluk | md5 (boşluksuz) | İşlem | Depo karşılığı | Eşleşme | Not |
|---|---|---|---|---|---|---|---|
| `20260815134724` | thesis_guideline_intelligence | 3631 | `b60f0bd8525b1ca07ac6e312a6b7b823` | alter/create index/function/trigger + update public.thesis_guidelines | 20260807113000_thesis_guideline_intelligence.sql | AYNI ŞEMA, VERİ ADIMI FARKLI | aynı DDL; geri doldurmanın 2. adımında birim türü İngilizce (Production) / Türkçe (depo) — md5 farklı (depo 041bbb65…, yorumsuz) |
| `20260815134754` | verified_guideline_sources_batch_01 | 2251 | `973f44356d61bc8b9dae1b42e86e9607` | insert into public.thesis_guidelines (on conflict YOK) | — | DEPODA YOK | Production'a özgü veri |
| `20260815143714` | bootstrap_initial_academic_managers | 339 | `e5a5aaf6cbe286a754c552e9f0dc4cd3` | alter table + update public.profiles (rol) | — | DEPODA YOK | Production'a özgü veri; KİŞİSEL VERİ içerebilir — içerik okunmadı/kopyalanmadı |
| `20260815145249` | verified_guideline_sources_batch_02 | 4981 | `c5a828f20022bae1c0de0b8804cb9c7e` | insert into public.thesis_guidelines (on conflict YOK) | — | DEPODA YOK | Production'a özgü veri |
| `20260817140252` | fix_academic_unit_access_and_seed_istanbul | 4992 | `c78d70228d77c3aa715ca03a370e2ed0` | alter table + create policy + insert public.academic_units | 20260817120000_seed_istanbul_university_root_units.sql | BİREBİR | boşluksuz md5 BİREBİR (c78d7022…) |
| `20260818072457` | grant_academic_units_service_role_access | 84 | `d06b9f239c03cdf8818bfeebc1c50527` | grant on public.academic_units | 20260818110000_grant_academic_units_service_role_access.sql | BİREBİR (yorum hariç) | yorumlar çıkarılınca boşluksuz md5 BİREBİR (d06b9f23…) |
| `20260818073414` | guideline_automatic_discovery | 516 | `bb9d8c965d3a8a093bf9394a20b41d02` | alter + index public.universities, grant | 20260818113000_guideline_automatic_discovery.sql | BİREBİR | boşluksuz md5 BİREBİR (bb9d8c96…) |
| `20260818084045` | add_verified_guidelines_adiyaman_afyon_cukurova | 1179 | `585ec7a819ba2823a8bd5db9503d7058` | insert into public.thesis_guidelines (on conflict YOK) | — | DEPODA YOK | Production'a özgü veri |
| `20260818085709` | prioritize_verified_guidelines_for_immediate_scan | 218 | `180143142e70872589c1352869a9a6ac` | update public.thesis_guidelines | — | DEPODA YOK | Production'a özgü veri |
| `20260818090326` | retry_pdf_guidelines_after_dommatrix_fix | 229 | `bc9190ec647d6f5226d75c51b319ac61` | update public.thesis_guidelines | — | DEPODA YOK | Production'a özgü; sonraki iki kayıtla aynı md5 |
| `20260818090724` | retry_pdf_guidelines_after_worker_fix | 229 | `bc9190ec647d6f5226d75c51b319ac61` | update public.thesis_guidelines | — | DEPODA YOK | aynı md5 (bc9190ec…) |
| `20260818091259` | retry_pdf_guidelines_after_tracing_fix | 229 | `bc9190ec647d6f5226d75c51b319ac61` | update public.thesis_guidelines | — | DEPODA YOK | aynı md5 (bc9190ec…) |
