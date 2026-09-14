import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <main className="auth-simple-page">
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
