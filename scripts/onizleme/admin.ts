// Önizleme: @/lib/supabase/admin yerine. Yönetici istemcisi yok sayılır (sayaçlar atlanır).
import { sahteIstemci } from "./sahte-istemci";
export function createAdminClient() {
  return sahteIstemci() as never;
}
export function adminIstemcisiVarsa() {
  return null;
}
