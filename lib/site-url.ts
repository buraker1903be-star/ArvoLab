import { headers } from "next/headers";

/**
 * E-posta bağlantılarında (şifre sıfırlama, davet) kullanılacak site adresi.
 * NEXT_PUBLIC_SITE_URL tanımlıysa o kullanılır; değilse istek başlıklarından
 * türetilir. Supabase, dönüş adresini Redirect URLs listesine göre ayrıca doğrular.
 */
export async function siteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
