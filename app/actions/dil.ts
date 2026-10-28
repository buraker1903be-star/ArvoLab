"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DIL_CEREZI, dilMi } from "@/lib/dil";
import { createClient } from "@/lib/supabase/server";

/*
  Arayüz dilini değiştirir. Giriş gerektirmez: giriş sayfasında da dil
  seçilebiliyor. Abonelik kapısı yok — dil seçmek içerik üretmiyor ve
  engellenen kullanıcı da kendi dilinde okuyabilmeli.
*/
export async function dilSec(dil: string): Promise<{ error?: string; success?: boolean }> {
  if (!dilMi(dil)) return { error: "Unsupported language." };
  (await cookies()).set(DIL_CEREZI, dil, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  /*
    Oturum varsa tercih profile de yazılır (migration 20261028092453):
    başka cihazda girişte çereze aktarılıyor, e-postalar da bu dilde gidiyor.
    Yazılamazsa (oturum yok, geçici arıza) seçim yine bu tarayıcıda geçerli;
    dil seçmek bir arıza yüzünden düşmemeli.
  */
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from("profiles").update({ arayuz_dili: dil }).eq("id", user.id);
      if (error) console.error("[dil] tercih profile yazılamadı:", error.message);
    }
  } catch (hata) {
    console.error("[dil] tercih profile yazılamadı:", hata);
  }
  revalidatePath("/", "layout");
  return { success: true };
}
