/*
  Yazdırma sayfalarının (makbuz, proforma) faturalama okuması.

  Abonelik sayfasıyla AYNI kapsam kararı: bireysel abone kendi, kurum
  yöneticisi kurumunun, iç ekip kurum seçicide seçili kurumun (yoksa
  kendi kurumunun) listesini görür. Eskiden makbuz sayfası seçili kurumu
  bilmiyordu: kurucu başka bir kurumu seçip "Makbuz"a basınca kendi
  kurumunun listesinde aranıyor ve 404 alıyordu (27.10.2026).

  Belge yalnızca bu listede varsa açılır; kimlik tahmin edilerek
  başkasının ödemesi ya da proforması görülemez.

  Bilerek "use server" DEĞİL (AGENTS.md).
*/
import { getAuthContext } from "@/lib/auth-guards";
import { getAccessState } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import { faturalamaKapsami } from "@/lib/faturalama";
import { seciliKurum } from "@/lib/kurum-secimi-sunucu";
import { faturalamaYukle } from "@/lib/subscription";

export async function yazdirmaFaturalamasi() {
  const ctx = await getAuthContext();
  if (!ctx) return { durum: "oturum-yok" as const };
  const access = await getAccessState(await getCurrentProfile());
  const secili = access.kind === "staff" ? await seciliKurum() : null;
  const kapsam = faturalamaKapsami(access.kind, ctx.role, secili?.id ?? ctx.organizationId);
  if (!kapsam || !ctx.user.email) return { durum: "yetki-yok" as const };
  const veri = await faturalamaYukle(kapsam, { id: ctx.user.id, email: ctx.user.email });
  return { durum: "tamam" as const, ctx, kapsam, veri };
}
