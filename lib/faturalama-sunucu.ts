/*
  Yazdırma sayfalarının (makbuz, proforma) faturalama okuması.

  Abonelik sayfasıyla AYNI kapsam kararı: bireysel abone kendi, kurum
  yöneticisi kurumunun, iç ekip kendi kurumunun listesini görür. Bir süre
  (27.10–20.11.2026) iç ekip kurum seçiciyle başka bir kurumun listesini de
  açabiliyordu; seçici kalktı (ArvoLab başka kurumlara kiralanmıyor).

  Belge yalnızca bu listede varsa açılır; kimlik tahmin edilerek
  başkasının ödemesi ya da proforması görülemez.

  Bilerek "use server" DEĞİL (AGENTS.md).
*/
import { getAuthContext } from "@/lib/auth-guards";
import { getAccessState } from "@/lib/access";
import { getCurrentProfile } from "@/app/actions/profile";
import { faturalamaKapsami } from "@/lib/faturalama";
import { faturalamaYukle } from "@/lib/subscription";

/*
  Faturalama kapsamı TEK yerde kurulur (28.10.2026): abonelik sayfası,
  yazdırma sayfaları ve kurumun kredi satın alma işlemi
  (app/actions/subscription.ts → kurumKrediSatinAl) aynı kararı okur.
  Kurum adına kredi satın almak faturaları görmekle aynı yetkiye bağlı;
  ikisi ayrı yerde kurulsaydı sayfa düğmeyi gösterip işlem reddedebilir
  (ya da tersi) olurdu.
*/
export async function faturalamaKapsamim() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  const access = await getAccessState(await getCurrentProfile());
  const kapsam = faturalamaKapsami(access.kind, ctx.role, ctx.organizationId);
  return { ctx, access, kapsam };
}

export async function yazdirmaFaturalamasi() {
  const kapsamim = await faturalamaKapsamim();
  if (!kapsamim) return { durum: "oturum-yok" as const };
  const { ctx, kapsam } = kapsamim;
  if (!kapsam || !ctx.user.email) return { durum: "yetki-yok" as const };
  const veri = await faturalamaYukle(kapsam, { id: ctx.user.id, email: ctx.user.email });
  return { durum: "tamam" as const, ctx, kapsam, veri };
}
