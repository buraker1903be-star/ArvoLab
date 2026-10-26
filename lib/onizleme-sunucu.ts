/*
  Önizleme çerezinin sunucu tarafı okuması. Karar saf modülde
  (lib/onizleme.ts); burası yalnızca Next'in çerez deposuna dokunuyor.

  Bilerek "use server" DEĞİL (AGENTS.md): yardımcılar böyle dosyalarda durmaz.
*/
import { cookies } from "next/headers";
import { ONIZLEME_CEREZI, gorunumKarari, type GorunumKarari } from "./onizleme";

export async function sayfaGorunumu(girdi: {
  rol: string | null | undefined;
  personelRolu: boolean;
  kurumVar: boolean;
}): Promise<GorunumKarari> {
  const cerez = (await cookies()).get(ONIZLEME_CEREZI)?.value;
  return gorunumKarari({ ...girdi, cerez });
}
