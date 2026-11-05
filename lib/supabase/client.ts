import { createBrowserClient } from "@supabase/ssr";
import { supabaseOrtaminiDogrula } from "./ortam-guvenligi";

/*
  Tarayıcıda process.env bir nesne olarak YOK; Next yalnızca adıyla yazılan
  değerleri derlemede gömer. Ortam güvenliği değişkenleri next.config.ts'te
  (env) gömülür; hepsi gizli olmayan değerler (proje kimlikleri ve etiket).
  Gizli anahtarlar buraya hiç yazılmaz.
*/
const tarayiciOrtami = () => ({
  VERCEL_ENV: process.env.ARVOLAB_DAGITIM_ORTAMI,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  ARVOLAB_SUPABASE_ORTAMI: process.env.ARVOLAB_SUPABASE_ORTAMI,
  ARVOLAB_URETIM_SUPABASE_REF: process.env.ARVOLAB_URETIM_SUPABASE_REF,
  ARVOLAB_TEST_SUPABASE_REF: process.env.ARVOLAB_TEST_SUPABASE_REF,
  ARVOLAB_ONIZLEME: process.env.ARVOLAB_ONIZLEME,
});

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase ortam değişkenleri eksik. NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY değerlerini tanımlayın.",
    );
  }

  supabaseOrtaminiDogrula(tarayiciOrtami());
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
