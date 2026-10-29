import { aktifDil } from "@/lib/dil-sunucu";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeConfirmNext } from "@/lib/auth-link";
import { sendEmail } from "@/lib/email/resend";
import { hosgeldinizEmail } from "@/lib/email/auth-emails";

// Supabase e-posta bağlantılarının (şifre sıfırlama vb.) döndüğü adres.
// Varsayılan e-posta şablonu ?code= (PKCE) ile, özel şablonlar ise
// ?token_hash=&type= ile gelir; ikisi de desteklenir.
// Supabase → Authentication → URL Configuration → Redirect URLs listesine
// https://<alan-adınız>/auth/confirm** eklenmelidir.
/*
  ?token_hash= bağlantısı GET'te DOĞRULANMAZ, bir onay sayfasına gider
  (/auth/dogrula); doğrulama yalnızca o sayfadaki düğmeyle gelen POST'ta.
  Eskiden GET doğrudan verifyOtp çağırıyordu: kurumsal posta kutularının
  bağlantı tarayıcıları (Outlook Safe Links, Defender) postadaki adresi
  önceden açıp tek kullanımlık belirteci harcıyor, gerçek kullanıcı kayıt,
  şifre sıfırlama ve davet bağlantısında "bağlantı geçersiz" ile
  karşılaşıyordu. Tarayıcılar form göndermiyor.

  ?code= (PKCE) GET'te kalıyor: değişim, bağlantıyı isteyen tarayıcıdaki
  doğrulayıcı çereze bağlı; tarayıcı botu onsuz kodu harcayamaz.
*/
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeConfirmNext(searchParams.get("next"));

  if (!code && tokenHash && type) {
    const onay = new URL("/auth/dogrula", origin);
    onay.searchParams.set("token_hash", tokenHash);
    onay.searchParams.set("type", type);
    onay.searchParams.set("next", next);
    return NextResponse.redirect(onay);
  }

  let verified = false;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    verified = !error;
    if (error) console.error(error);
  }
  return NextResponse.redirect(new URL(verified ? next : "/?error=link-invalid", origin));
}

/* Onay sayfasındaki düğme (app/auth/dogrula/page.tsx). */
export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl;
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "") as EmailOtpType;
  const next = safeConfirmNext(String(form.get("next") ?? ""));

  const supabase = await createClient();
  let verified = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    verified = !error;
    if (error) console.error(error);
  }

  /*
    Hoş geldiniz postası yalnızca KAYIT doğrulamasında ve yalnızca bir kez:
    belirteç verifyOtp ile tüketiliyor, aynı bağlantı ikinci kez
    doğrulanamıyor. Ayrı bir "gönderildi" işaretine gerek yok.

    Gönderim başarısız olursa akış bozulmaz — kişi zaten içeri girdi,
    postayı alamamış olması onu kapıda bırakmamalı.
  */
  if (verified && type === "signup") {
    const { data } = await supabase.auth.getUser();
    const eposta = data.user?.email;
    if (eposta) {
      try {
        await sendEmail({ to: eposta, ...hosgeldinizEmail(new URL("/dashboard", origin).toString(), await aktifDil()) });
      } catch (sorun) {
        console.error("[kayit] hoş geldiniz postası gönderilemedi", sorun instanceof Error ? sorun.message : sorun);
      }
    }
  }

  // 303: POST'tan sonra hedef GET ile açılsın.
  return NextResponse.redirect(new URL(verified ? next : "/?error=link-invalid", origin), 303);
}
