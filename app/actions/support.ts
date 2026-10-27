"use server";

import { seciliKurum } from "@/lib/kurum-secimi-sunucu";
import { listeBasarili, listeOkunamadi, type ListeSonucu } from "@/lib/liste-sonucu";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext, requireRole, SESSION_MISSING, type ActionResult } from "@/lib/auth-guards";
import { ADMIN_ROLES } from "@/lib/project-labels";

// Destek tek sayfa (expert-requests); /dashboard/support oraya yönleniyor.
const PAGE_PATH = "/dashboard/expert-requests";
const CATEGORIES = ["bug", "access", "feature_request", "billing", "other"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const STATUSES = ["open", "in_progress", "resolved"];

export interface AppSupportRequest {
  id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  /** Talebi açan; yalnızca yönetici kuyruğunda okunuyor (kimden geldiği görünsün). */
  requested_by?: string;
  /** Sistem yöneticisinin yanıtı; yalnızca o yazabilir (migration …100022). */
  admin_note?: string | null;
  answered_at?: string | null;
}

export async function createSupportRequest(formData: FormData): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx) return SESSION_MISSING;

  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!subject || !message) return { error: "Konu ve mesaj alanları zorunludur." };

  const category = String(formData.get("category") ?? "other");
  const priority = String(formData.get("priority") ?? "normal");

  const { error } = await ctx.supabase.from("app_support_requests").insert({
    requested_by: ctx.user.id,
    subject,
    message,
    category: CATEGORIES.includes(category) ? category : "other",
    priority: PRIORITIES.includes(priority) ? priority : "normal",
    status: "open",
  });

  if (error) {
    console.error(error);
    return { error: "Talep gönderilirken bir hata oluştu." };
  }

  revalidatePath(PAGE_PATH);
  return { success: true };
}

export async function getMySupportRequests(): Promise<ListeSonucu<AppSupportRequest>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return listeBasarili([]);

  const { data, error } = await supabase
    .from("app_support_requests")
    .select("id, subject, message, category, priority, status, created_at, admin_note, answered_at")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

export async function getAllSupportRequests(): Promise<ListeSonucu<AppSupportRequest>> {
  const supabase = await createClient();
  const kurum = await seciliKurum();
  // İç ekibin kurum seçimi: talebi açanın kurumuna göre (lib/kurum-secimi.ts).
  if (kurum && !kurum.kullanicilar.length) return listeBasarili([]);
  let sorgu = supabase
    .from("app_support_requests")
    .select("id, requested_by, subject, message, category, priority, status, created_at, admin_note, answered_at")
    .neq("status", "resolved");
  if (kurum) sorgu = sorgu.in("requested_by", kurum.kullanicilar);
  const { data, error } = await sorgu.order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return listeOkunamadi();
  }
  return listeBasarili(data);
}

/*
  Yanıt artık yazışmada (app/actions/destek-yazisma.ts, 27.10.2026).
  Eskiden burada answerSupportRequest vardı ve tek bir yanıt alanına
  (admin_note) yazıyordu: kullanıcı geri yazamıyor, ikinci yanıt
  birincinin üzerine yazılıyordu. Eski yanıtlar yazışmada gösteriliyor.
*/

export async function updateSupportRequestStatus(requestId: string, status: string): Promise<ActionResult> {
  const auth = await requireRole(ADMIN_ROLES, "Talep durumunu yalnızca Sistem Yöneticisi veya Kurucu değiştirebilir.");
  if ("error" in auth) return { error: auth.error };
  if (!STATUSES.includes(status)) return { error: "Geçersiz durum." };

  const { data, error } = await auth.supabase
    .from("app_support_requests")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .select("id");

  if (error) {
    console.error(error);
    return { error: "Güncellenirken bir hata oluştu." };
  }
  if (!data?.length) return { error: "Talep bulunamadı." };

  revalidatePath(PAGE_PATH);
  return { success: true };
}
