/*
  Hesap menüsünün "Kullanım" satırı için veriyi toplar. Bilerek
  "use server" DEĞİL (AGENTS.md): yardımcılar dışarıdan çağrılabilir uç
  noktaya dönüşmemeli.

  Abonelik ve Kredi ekranıyla AYNI kaynaklar okunuyor (ai_kredi_durumum
  ve deneme hakkı): iki ekran farklı bakiye gösterirse hangisinin doğru
  olduğu anlaşılmaz.
*/
import { createClient } from "@/lib/supabase/server";
import { denemeAsistanHakkim } from "@/lib/ai/erisim";
import { DENEME_ASISTAN_HAKKI } from "@/lib/ai/deneme-hakki";
import type { KrediSatiri } from "@/lib/ai/kredi-ozeti";
import { kullanimOzeti, type KullanimHakki } from "@/lib/kullanim-ozeti";
import type { AccessState } from "@/lib/access";

export async function kullanimHaklarim(
  access: Pick<AccessState, "kind" | "status" | "periodEnd" | "trialEndsAt">,
  kullaniciId: string | null,
): Promise<KullanimHakki[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ai_kredi_durumum").maybeSingle();
  if (error) console.error("[kullanım] kredi durumu okunamadı:", error.message);
  /* Deneme sayacı yalnızca DENEMEDEKİ bireysel abonede okunuyor: ötekinde
     gereksiz bir sayım sorgusu olurdu. */
  const deneme =
    kullaniciId && access.kind === "individual" && access.status === "trialing"
      ? await denemeAsistanHakkim(kullaniciId)
      : { denemede: false as const };
  return kullanimOzeti({
    kredi: (data as KrediSatiri | null) ?? null,
    deneme: deneme.denemede && typeof deneme.kalan === "number" ? { kalan: deneme.kalan, toplam: DENEME_ASISTAN_HAKKI } : null,
    yenilenme: access.status === "trialing" ? (access.trialEndsAt ?? access.periodEnd) : access.periodEnd,
  });
}
