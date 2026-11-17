-- R9 — P9'un geri dönüşü. Veri etkisi yok; yetim profil dalı yeniden "ertelendi" olur (düzeltilmiş kodda raporlanır).
begin;
revoke delete on public.profiles from service_role;
commit;
