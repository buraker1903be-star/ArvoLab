/*
  TEZLERDE İÇİNDEKİLER AÇIK (27.10.2026, kurum sahibinin bildirimi:
  "Word olarak indirdiğimde içindekiler bölümü gelmiyor, PDF'te de").

  project_manuscripts.include_toc varsayılanı false'tu (20260916090000) ve
  editördeki kutu sayfa ayarlarının içinde duruyordu: öğrencilerin hemen
  hiçbiri açmamıştı, Word ve PDF çıktısı içindekilersiz çıkıyordu. Bütün
  tez kılavuzları içindekiler istiyor.

  Kod tarafında yeni tezler kutu AÇIK başlıyor (write/page.tsx). Bu
  migration MEVCUT tezleri bir kez açıyor. Makale ve projelere
  dokunulmuyor. Kutuyu bilerek kapatan öğrenciyi ayırt etmenin yolu yok
  (sütun yalnızca son değeri tutuyor); kapatmak isteyen editörden tekrar
  kapatır — ters yöndeki hata (tezin içindekilersiz teslim edilmesi)
  daha pahalı.
*/
update public.project_manuscripts m
set include_toc = true
from public.academic_projects p
where p.id = m.project_id
  and p.project_type = 'thesis'
  and m.include_toc = false;
