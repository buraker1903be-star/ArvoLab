"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DIL_CEREZI, dilMi } from "@/lib/dil";

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
  revalidatePath("/", "layout");
  return { success: true };
}
