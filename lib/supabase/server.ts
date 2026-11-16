import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseOrtaminiDogrula } from "./ortam-guvenligi";

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase ortam değişkenleri eksik. NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY değerlerini tanımlayın.",
    );
  }

  /* Ortam güvenliği (lib/supabase/ortam-guvenligi.ts): yanlış projeye bağlanmadan önce durur. */
  supabaseOrtaminiDogrula(process.env, process.env.ARVOLAB_DAGITIM_ORTAMI);

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component içinde çerez yazımı mümkün olmayabilir.
          // Oturum yenileme işlemi proxy katmanında ele alınacaktır.
        }
      },
    },
  });
}

/*
  MEVCUT ŞİFRE DOĞRULAMA İSTEMCİSİ (16.11.2026, RELEASE CLOSURE 03).

  Ayarlar'da şifre değiştirilirken mevcut şifre Supabase'e karşı
  doğrulanıyor. Bunu kullanıcının kendi istemcisiyle (createClient)
  yapmak, signInWithPassword'ün yeni oturumunu ÇEREZE yazar ve işlem
  ortasında tarayıcının oturumunu değiştirirdi. Bu istemci çereze
  dokunmaz ve oturumu bellekte tutmaz; doğrulamanın açtığı oturumu çağıran
  hemen kapatır (app/actions/auth.ts → mevcutSifreyiDogrula).
*/
export function createDogrulamaClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase ortam değişkenleri eksik.");
  }
  supabaseOrtaminiDogrula(process.env, process.env.ARVOLAB_DAGITIM_ORTAMI);
  return createSupabaseJsClient(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
