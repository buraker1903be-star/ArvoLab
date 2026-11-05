import { createServerClient } from "@supabase/ssr";
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
