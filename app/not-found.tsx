import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ThemeToggle from "@/app/_components/theme-toggle";

export default function NotFound() {
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
          <h2>Sayfa bulunamadı</h2>
          <p>Aradığınız sayfa taşınmış, silinmiş ya da görüntüleme yetkiniz olmayabilir.</p>
        </div>
        <Link href="/dashboard" className="login-button">
          Panele dön
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
