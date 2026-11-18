// Önizleme: @/lib/supabase/server yerine (sahte-istemci.ts).
import { sahteIstemci } from "./sahte-istemci";
export async function createClient() {
  return sahteIstemci() as never;
}
/*
  createDogrulamaClient (16.11.2026, şifre değişikliğinde mevcut şifreyi doğrulayan
  çerezsiz istemci) gerçek modüle sonradan eklendi; önizleme karşılığı
  yoktu ve bu dosyayı içe aktaran her sayfa "Export createDogrulamaClient
  doesn't exist" ile 500 veriyordu — tarayıcı kabul betikleri hiç
  açılamıyordu (17.11.2026'da fark edildi). Önizlemede ağ yok: aynı sahte
  istemci yeter.
*/
export function createDogrulamaClient() {
  return sahteIstemci() as never;
}
