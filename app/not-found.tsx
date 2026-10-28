import { ceviri } from "@/lib/dil-sunucu";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ThemeToggle from "@/app/_components/theme-toggle";

export default async function NotFound() {
  const t = await ceviri();
  return (
    <main className="auth-simple-page">
      {/* Giriş sayfasında tema düğmesi vardı, kardeş sayfalarında yoktu:
          koyu temadaki kullanıcı buraya gelince değiştiremiyordu. Stil
          (auth.css .auth-theme-toggle) zaten yazılmıştı, bağlanmamıştı. */}
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="login-card">
        <div className="login-heading">
          <span className="login-kicker">404</span>
          <h2>{t({ tr: "Sayfa bulunamadı", en: "Page not found" })}</h2>
          <p>
            {t({
              tr: "Aradığınız sayfa taşınmış, silinmiş ya da görüntüleme yetkiniz olmayabilir.",
              en: "The page may have moved, been deleted, or you may not have permission to view it.",
            })}
          </p>
        </div>
        <Link href="/dashboard" className="login-button">
          {t({ tr: "Panele dön", en: "Back to dashboard" })}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
