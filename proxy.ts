import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DIL_CEREZI, ilkZiyaretDili } from "@/lib/dil";

// Next.js 16 "proxy" katmanı (eski adıyla middleware):
// 1) Supabase oturum çerezini her istekte yeniler (Server Component'ler çerez yazamaz).
// 2) Oturumu olmayan ziyaretçiyi /dashboard altından giriş sayfasına yönlendirir.
// 3) Oturumu açık kullanıcıyı giriş/şifre sıfırlama isteği sayfalarından panele alır.
const SIGNED_OUT_ONLY_PATHS = ["/", "/forgot-password"];

export async function proxy(request: NextRequest) {
  /*
    ARAYÜZ DİLİ İLK ZİYARETTE BİR KEZ KARARLAŞTIRILIR (28.10.2026, lib/dil.ts).
    Dil çerezi yoksa: oturum çerezi olan (mevcut müşteri) Türkçe'de kalır —
    İngilizce ayarlı tarayıcı kullanan Türk öğrencinin paneli güncellemeyle
    birden İngilizceye dönmesin. Oturumu olmayan yeni ziyaretçiye tarayıcının
    dili. Karar çereze yazılır; sonrasında kullanıcının seçimi geçerli.
    İstek çerezine de yazılıyor ki bu ilk istekteki sayfa da aynı dille çizilsin.
  */
  const yeniDil = ilkZiyaretDili(
    request.cookies.get(DIL_CEREZI)?.value,
    request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token")),
    request.headers.get("accept-language"),
  );
  if (yeniDil) request.cookies.set(DIL_CEREZI, yeniDil);
  const dilCereziniYaz = (yanit: NextResponse) => {
    if (yeniDil) yanit.cookies.set(DIL_CEREZI, yeniDil, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return yanit;
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return dilCereziniYaz(NextResponse.next({ request }));

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
    return dilCereziniYaz(redirect);
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

  return dilCereziniYaz(response);
}

// _next/ altındaki her şey (static, image, geliştirmede hmr soketi) proxy'den geçmez;
// aksi halde geliştirme sunucusunun canlı yenileme bağlantısı kopuyordu.
export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
