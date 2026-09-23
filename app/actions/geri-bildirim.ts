"use server";

import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";

import { revalidatePath } from "next/cache";
import { getAuthContext, requireRole, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { ADMIN_ROLES, MANAGER_ROLES } from "@/lib/project-labels";
import {
  BOLUM_SECENEKLERI,
  soruSorulsunMu,
  type GeriBildirimDurumu,
  type GeriBildirimKaydi,
} from "@/lib/geri-bildirim";

const PROJE_SINIRI = 100;

/** Ana sayfa: kullanım geri bildirimi şimdi sorulsun mu? */
export async function geriBildirimSorusu(): Promise<{ sorulsun: boolean; baglam: string | null }> {
  const hayir = { sorulsun: false, baglam: null };
  const ctx = await getAuthContext();
  if (!ctx) return hayir;
  const { supabase, user } = ctx;
  // Sistemi yapanlara sorulmaz: cevapları okuyan kişi kendi panelinde
  // "işinizi kolaylaştırdı mı" sorusuyla karşılaşmasın.
  if (ctx.role && ADMIN_ROLES.includes(ctx.role)) return hayir;

  const { data: kayit } = await supabase
    .from("product_feedback")
    .select("status, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  // Cevaplanmış ya da kapatılmış soru için kullanım sorgularını hiç çalıştırma.
  const kayitli: GeriBildirimKaydi | null = kayit
    ? { status: kayit.status as GeriBildirimDurumu, updatedAt: kayit.updated_at }
    : null;
  if (kayitli && kayitli.status !== "postponed") return hayir;

  const { data: projeler } = await supabase
    .from("academic_projects")
    .select("id")
    .eq("owner_id", user.id)
    .limit(PROJE_SINIRI);
  const projeKimlikleri = (projeler ?? []).map((satir) => satir.id);

  /*
    En uzun metin tek satırla okunuyor (sırala + limit 1). Bütün metinleri
    çekip toplamak hem gereksiz hem yanıltıcı olurdu: ölçmek istediğimiz
    "bu kişi gerçekten bir şey yazdı mı", kaç çalışması olduğu değil.
  */
  const [enUzun, atif, belge] = await Promise.all([
    projeKimlikleri.length
      ? supabase
          .from("project_manuscripts")
          .select("word_count")
          .in("project_id", projeKimlikleri)
          .order("word_count", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("citation_checks").select("id", { count: "exact", head: true }).eq("created_by", user.id),
    supabase
      .from("document_uploads")
      .select("id", { count: "exact", head: true })
      .eq("uploaded_by", user.id)
      .eq("status", "analyzed"),
  ]);

  return soruSorulsunMu(kayitli, {
    enUzunMetin: enUzun.data?.word_count ?? 0,
    atifKontrolu: atif.count ?? 0,
    belgeKontrolu: belge.count ?? 0,
  });
}

async function durumYaz(status: GeriBildirimDurumu, alanlar: Record<string, unknown> = {}): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const { error } = await ctx.supabase.from("product_feedback").upsert(
    {
      user_id: ctx.user.id,
      organization_id: ctx.organizationId,
      status,
      updated_at: new Date().toISOString(),
      ...alanlar,
    },
    { onConflict: "user_id" }
  );
  if (error) {
    console.error(error);
    return { error: "Geri bildiriminiz kaydedilemedi. Birazdan tekrar deneyin." };
  }
  revalidatePath("/dashboard");
  return { success: true };
}

export async function geriBildirimGonder(formData: FormData): Promise<ActionResult> {
  const puan = Number(formData.get("score"));
  if (!Number.isInteger(puan) || puan < 1 || puan > 5) {
    return { error: "Önce bir puan seçin." };
  }
  const bolum = String(formData.get("most_used") ?? "");
  const yorum = String(formData.get("comment") ?? "").trim();

  return durumYaz("answered", {
    score: puan,
    most_used: BOLUM_SECENEKLERI.some((secenek) => secenek.deger === bolum) ? bolum : null,
    comment: yorum ? yorum.slice(0, 2000) : null,
    asked_context: String(formData.get("context") ?? "").slice(0, 60) || null,
  });
}

/** "Sonra" — iki hafta sonra yeniden sorulur (lib/geri-bildirim.ts). */
export async function geriBildirimErtele(): Promise<ActionResult> {
  return durumYaz("postponed");
}

/** "Bir daha sorma" — kapı tamamen kapanır. */
export async function geriBildirimIstemiyorum(): Promise<ActionResult> {
  return durumYaz("declined");
}

export interface GeriBildirimSatiri {
  userId: string;
  ad: string;
  score: number | null;
  mostUsed: string | null;
  comment: string | null;
  askedContext: string | null;
  updatedAt: string;
}

/** Yönetim: gelen bütün cevaplar (yeniden eskiye). */
export async function tumGeriBildirimler(): Promise<ListeSonucu<GeriBildirimSatiri>> {
  const auth = await requireRole(MANAGER_ROLES);
  if ("error" in auth) return listeBasarili([]);

  const { data, error } = await auth.supabase
    .from("product_feedback")
    .select("user_id, score, most_used, comment, asked_context, updated_at")
    .eq("status", "answered")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error(error);
    // "Hiç geri bildirim gelmemiş" ile "okuyamadım" ayrı: ilki ürün hakkında
    // bir bilgi, ikincisi arıza. İkisi aynı ekranı veriyordu.
    return listeOkunamadi();
  }
  const satirlar = data ?? [];
  if (satirlar.length === 0) return listeBasarili([]);

  // Ad ayrı sorguda: product_feedback auth.users'a bağlı, profiles'a değil.
  const { data: profiller } = await auth.supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", satirlar.map((satir) => satir.user_id));
  const adlar = new Map((profiller ?? []).map((profil) => [profil.id, profil.full_name]));

  return listeBasarili(satirlar.map((satir) => ({
    userId: satir.user_id,
    ad: adlar.get(satir.user_id) || "Adı girilmemiş kullanıcı",
    score: satir.score,
    mostUsed: satir.most_used,
    comment: satir.comment,
    askedContext: satir.asked_context,
    updatedAt: satir.updated_at,
  })));
}
