// Server action'lar için ortak oturum/rol kontrolü.
// Bu dosya bilinçli olarak "use server" DEĞİLDİR: "use server" dosyasındaki
// her export dışarıdan çağrılabilir bir uç noktaya dönüşür.
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ilkSifreDurumu } from "@/lib/supabase/sifre-durumu";
import { SIFRE_VAR_CEREZI, ilkSifreGerekli, ilkSifreSorulmali } from "@/lib/ilk-sifre";
import { amrYontemleri } from "@/lib/auth-link";
import { ceviri } from "./dil-sunucu";
import type { Metin } from "./dil";
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

/*
  İstek başına bir kez (React cache): ana sayfa bunu dolaylı yoldan altı-yedi
  kez çağırıyordu ve her çağrı Auth sunucusuna ayrı bir getUser ile profil
  okuması demekti. Sunucu işlemi kendi isteğinde çalıştığı için önbellek
  işlemler arasında taşınmaz.
*/
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // İlk şifre kapısı sunucu tarafında da (aşağıda ilkSifreBekliyor): kapı açık değilse bağlam yok.
  if (await ilkSifreBekliyor(supabase, user.id)) return null;

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
});

// RLS asıl güvenlik katmanıdır; bu kontrol yetkisiz isteklerin sessizce
// "başarılı" görünmesini engeller ve kullanıcıya anlaşılır mesaj verir.
export async function requireRole(
  allowed: readonly UserRole[],
  message: string | Metin = { tr: "Bu işlem için yetkiniz yok.", en: "You do not have permission for this action." }
): Promise<GuardResult> {
  const ctx = await getAuthContext();
  const t = await ceviri();
  if (!ctx) return { error: t((await ilkSifreKapisiKapali()) ? ILK_SIFRE_GEREKLI : OTURUM_YOK), reason: "unauthenticated" };
  if (!ctx.role || !allowed.includes(ctx.role)) return { error: typeof message === "string" ? message : t(message), reason: "forbidden" };
  return ctx;
}

/*
  Oturum yok mesajı, kullanıcının dilinde (lib/dil.ts). Eskiden sabit bir
  nesneydi (SESSION_MISSING); sabit istek başına dil bilemediği için
  işleve döndü.
*/
export const OTURUM_YOK: Metin = {
  tr: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
  en: "No active session. Please sign in again.",
};

export async function oturumYokMesaji(): Promise<string> {
  return (await ceviri())(OTURUM_YOK);
}

/*
  İLK ŞİFRE KAPISI, SUNUCU TARAFI (16.11.2026, RELEASE CLOSURE 03).

  Kapı proxy.ts'te yalnızca /dashboard yollarını kapatıyordu. Sunucu
  işlemleri ise SAYFADAN BAĞIMSIZ çağrılabilir: işlemin kimliği bilinince
  herhangi bir yola (ör. /reset-password, "/") POST edilir ve proxy'nin
  /dashboard koşuluna hiç girmez. Şifresini belirlemeden oturumu açık
  kalan kişi böylece panelin işlemlerini çalıştırabiliyordu.

  Karar proxy'dekiyle AYNI ve aynı yerden (lib/ilk-sifre.ts,
  public.ilk_sifre_gerekli): şifreyle açılmış oturum ve proxy'nin "şifre
  var" çerezini taşıyan oturum sorgulanmaz; sorgu okunamazsa kapı
  KAPANMAZ (geçici arıza kimseyi dışarıda bırakmamalı — mevcut kullanıcı
  kilitlenmez). İstek başına bir kez (React cache).

  getAuthContext üzerinden doksanı aşkın çağrı noktasını kapsar. Bağlamı
  kullanmayan kritik işlemler (hesap silme, ödeme başlatma) ilkSifreEngeli
  ile ayrıca kapatılır.
*/
export const ILK_SIFRE_GEREKLI: Metin = {
  tr: "Devam etmek için önce şifrenizi belirleyin.",
  en: "Set your password before continuing.",
};

const ilkSifreBekliyor = cache(async (supabase: AuthContext["supabase"], kullaniciId: string): Promise<boolean> => {
  const cerezDeposu = await cookies();
  if (cerezDeposu.get(SIFRE_VAR_CEREZI)?.value === kullaniciId) return false;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!ilkSifreSorulmali(amrYontemleri(session?.access_token))) return false;
  return ilkSifreGerekli(await ilkSifreDurumu(supabase));
});

/** Bu istekte oturum var ama ilk şifre belirlenmemiş mi (requireRole mesajı için). */
const ilkSifreKapisiKapali = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? ilkSifreBekliyor(supabase, user.id) : false;
});

/** Bağlamı kullanmayan kritik işlemler için: kapı kapalıysa kullanıcıya gösterilecek metin, değilse null. */
export async function ilkSifreEngeli(supabase: AuthContext["supabase"], kullaniciId: string): Promise<string | null> {
  if (!(await ilkSifreBekliyor(supabase, kullaniciId))) return null;
  return (await ceviri())(ILK_SIFRE_GEREKLI);
}
