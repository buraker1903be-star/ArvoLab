import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeConfirmNext } from "@/lib/auth-link";

// Supabase e-posta bağlantılarının (şifre sıfırlama vb.) döndüğü adres.
// Varsayılan e-posta şablonu ?code= (PKCE) ile, özel şablonlar ise
// ?token_hash=&type= ile gelir; ikisi de desteklenir.
// Supabase → Authentication → URL Configuration → Redirect URLs listesine
// https://<alan-adınız>/auth/confirm** eklenmelidir.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeConfirmNext(searchParams.get("next"));

  const supabase = await createClient();
  let verified = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
    if (error) console.error(error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    verified = !error;
    if (error) console.error(error);
  }

  return NextResponse.redirect(new URL(verified ? next : "/?error=link-invalid", origin));
}
