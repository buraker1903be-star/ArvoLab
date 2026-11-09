// Önizleme: @/lib/supabase/admin yerine. Yönetici istemcisi yok sayılır (sayaçlar atlanır).
import { sahteIstemci } from "./sahte-istemci";
export function createAdminClient() {
  return sahteIstemci() as never;
}
/*
  SAATLİK HAK DOLU (V4.3-C2-6, ai-yetki-kabul.mjs). ONIZLEME_HAK=bitti iken
  yönetici istemcisi VARDIR ve rate_limit_hit "hayır" döner (veri.ts):
  asistanın saatlik hak kapısı gerçek sunucu işlemiyle sınanabilsin.
  Varsayılan kapalı: öteki kabul senaryoları sayacın atlandığı hâle göre
  yazılmış. Yalnızca önizleme; üretimde bu dosya hiç yüklenmez.
*/
export function adminIstemcisiVarsa() {
  return process.env.ONIZLEME_HAK === "bitti" ? (sahteIstemci() as never) : null;
}
