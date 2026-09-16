-- ArvoOS köprüsünün sağlık kaydı.
--
-- Bireysel abonelik durumu ArvoOS'tan sorulur. ArvoOS'a ulaşılamadığında
-- kullanıcı ENGELLENMEZ: geçici bir arıza yüzünden ödemiş müşteriyi kapıda
-- bırakmak, birkaç saat bedava kullandırmaktan daha pahalı.
--
-- Ama sessiz kalmamalı. Yanlış yazılmış bir PRODUCT_BRIDGE_SECRET köprüyü
-- kalıcı olarak kırar ve herkes süresiz bedava kullanır; bunun tek izi sunucu
-- log'u olursa aylarca fark edilmez.
--
-- Bu yüzden her çağrının sonucu buraya yazılır. ArvoOS bu tabloyu kendi
-- servis anahtarıyla okuyup Platform ekranında uyarı gösterir — köprü kopuk
-- olsa bile bu yol çalışır, çünkü okuma doğrudan veritabanından yapılır.

create table if not exists public.bridge_health (
  id text primary key,
  last_ok_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  -- 'permanent': yapılandırma hatası (anahtar yok/yanlış, 401, 400).
  -- 'transient': ağ hatası ya da geçici sunucu hatası.
  last_error_kind text check (last_error_kind in ('permanent','transient')),
  updated_at timestamptz not null default now()
);

insert into public.bridge_health (id) values ('arvoos')
on conflict (id) do nothing;

alter table public.bridge_health enable row level security;
-- Yalnızca sunucu (service_role) yazar ve okur; kullanıcıya açılmaz.
revoke all on public.bridge_health from anon, authenticated;

comment on table public.bridge_health is
  'ArvoOS köprüsünün son durumu. ArvoOS Platform ekranı buradan okur; yazan taraf ArvoLab sunucusudur.';
