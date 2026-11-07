import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DIL_CEREZI, ilkZiyaretDili } from "@/lib/dil";
import { BASKA_CIHAZ_BILGISI, baskaCihazdanKapatildiMi, oturumCereziMi } from "@/lib/tek-oturum";
import { amrYontemleri } from "@/lib/auth-link";
import { SIFRE_VAR_CEREZI, ilkSifreGerekli, ilkSifreSorulmali } from "@/lib/ilk-sifre";
import { sifreDurumu } from "@/lib/supabase/sifre-durumu";

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
    request.cookies.getAll().some((c) => oturumCereziMi(c.name)),
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

  // getUser oturumu reddedince çerezi kendisi siler; "çerez vardı mı" ondan ÖNCE okunur (lib/tek-oturum.ts).
  const oturumCereziVardi = request.cookies.getAll().some((c) => oturumCereziMi(c.name));
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
    error: oturumHatasi,
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

  /*
    Oturum başka bir cihazdan yapılan girişle kapatıldı (lib/tek-oturum.ts):
    bu tarayıcının çerezleri silinir ve kişi NEDENİYLE giriş ekranına iner.
    Bu kural yokken aynı durum sessiz bir yönlendirme olurdu; kişi "neden
    çıkış yaptım" diye kalırdı.
  */
  if (!user && pathname.startsWith("/dashboard") && baskaCihazdanKapatildiMi(oturumHatasi, oturumCereziVardi)) {
    await supabase.auth.signOut({ scope: "local" });
    return redirectTo("/", { bilgi: BASKA_CIHAZ_BILGISI });
  }
  if (!user && pathname.startsWith("/dashboard")) {
    return redirectTo("/", { next: `${pathname}${search}` });
  }
  if (!user && pathname === "/reset-password") {
    return redirectTo("/", { error: "link-invalid" });
  }
  if (user && SIGNED_OUT_ONLY_PATHS.includes(pathname)) {
    return redirectTo("/dashboard");
  }

  /*
    İLK ŞİFRE KAPISI (G1, 07.11.2026; lib/ilk-sifre.ts). Kayıt/davet
    doğrulamasıyla (ya da yöntemi bilinmeyen bir bağlantıyla) açılmış ve
    hesabında şifre olmayan oturum, panelin hiçbir yolunu (sunucu işlemleri
    de bu yollara POST ediliyor) açamadan şifre sayfasına gider. ArvoOS
    magic link oturumu ve şifreyle giriş hiç sorgulanmaz; şifresi olduğu bir
    kez görülen oturum çerezle işaretlenir, sonraki isteklerde sorgu yok.
    Çerezi taklit etmek yalnızca kişinin KENDİ kapısını atlatır.
  */
  if (user && pathname.startsWith("/dashboard") && request.cookies.get(SIFRE_VAR_CEREZI)?.value !== user.id) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const yontemler = amrYontemleri(session?.access_token);
    if (ilkSifreSorulmali(yontemler)) {
      const sifreVar = await sifreDurumu(supabase);
      if (ilkSifreGerekli(yontemler, sifreVar)) return redirectTo("/reset-password", { ilk: "1" });
      if (sifreVar === true) {
        response.cookies.set(SIFRE_VAR_CEREZI, user.id, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 30 });
      }
    }
  }

  return dilCereziniYaz(response);
}

// _next/ altındaki her şey (static, image, geliştirmede hmr soketi) proxy'den geçmez;
// aksi halde geliştirme sunucusunun canlı yenileme bağlantısı kopuyordu.
export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
