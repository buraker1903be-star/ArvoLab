// Server action'lar için ortak oturum/rol kontrolü.
// Bu dosya bilinçli olarak "use server" DEĞİLDİR: "use server" dosyasındaki
// her export dışarıdan çağrılabilir bir uç noktaya dönüşür.
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/project-labels";

export interface ActionResult {
  error?: string;
  success?: boolean;
  /**
   * İşlem BAŞARILI ama kullanıcının bilmesi gereken bir durum var.
   * Hatadan farkı: işlem geri alınmadı. Onay gibi kararlarda kullanılır —
   * kontrolörü engellemeden uyarmak için (o, kuralın dışına çıkmayı
   * bilerek seçebilir).
   */
  warning?: string;
  /**
   * İşlemin KENDİ başarı metni; ActionForm'a verilen sabit successMessage'ın
   * yerine geçer. Sonucu ancak eylem bilebiliyorsa gerekir — "3 kılavuz
   * bulundu" ile "kılavuz bulunamadı" ikisi de başarılı bir çalışmadır ama
   * sabit bir metinle anlatılamaz.
   */
  message?: string;
}

export interface AuthContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string };
  role: UserRole | null;
  organizationId: string | null;
}

export type GuardResult = AuthContext | { error: string; reason: "unauthenticated" | "forbidden" };

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .maybeSingle();

  return {
    supabase,
    user: { id: user.id, email: user.email },
    role: (profile?.role as UserRole | undefined) ?? null,
    organizationId: profile?.organization_id ?? null,
  };
}

// RLS asıl güvenlik katmanıdır; bu kontrol yetkisiz isteklerin sessizce
// "başarılı" görünmesini engeller ve kullanıcıya anlaşılır mesaj verir.
export async function requireRole(
  allowed: readonly UserRole[],
  message = "Bu işlem için yetkiniz yok."
): Promise<GuardResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın.", reason: "unauthenticated" };
  if (!ctx.role || !allowed.includes(ctx.role)) return { error: message, reason: "forbidden" };
  return ctx;
}

export const SESSION_MISSING: ActionResult = { error: "Oturum bulunamadı. Lütfen tekrar giriş yapın." };
