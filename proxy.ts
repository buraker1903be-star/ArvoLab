import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next.js 16 "proxy" katmanı (eski adıyla middleware):
// 1) Supabase oturum çerezini her istekte yeniler (Server Component'ler çerez yazamaz).
// 2) Oturumu olmayan ziyaretçiyi /dashboard altından giriş sayfasına yönlendirir.
// 3) Oturumu açık kullanıcıyı giriş/şifre sıfırlama isteği sayfalarından panele alır.
const SIGNED_OUT_ONLY_PATHS = ["/", "/forgot-password"];

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() token'ı Supabase Auth sunucusunda doğrular ve süresi dolmuşsa yeniler.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string, params: Record<string, string> = {}) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = new URLSearchParams(params).toString();
    const redirect = NextResponse.redirect(url);
    // Yenilenen oturum çerezleri yönlendirmede kaybolmasın.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user && pathname.startsWith("/dashboard")) {
    return redirectTo("/", { next: `${pathname}${search}` });
  }
  if (!user && pathname === "/reset-password") {
    return redirectTo("/", { error: "link-invalid" });
  }
  if (user && SIGNED_OUT_ONLY_PATHS.includes(pathname)) {
    return redirectTo("/dashboard");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
