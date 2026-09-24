import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "@/app/_components/theme-toggle";
import KayitFormu from "./kayit-formu";

export const metadata = {
  title: "Kayıt · ArvoLab",
  description: "ArvoLab hesabı oluşturun; tez yazımı, kaynak doğrulama ve kılavuz denetimi tek yerde.",
};

export default function KayitPage() {
  return (
    <main className="auth-simple-page">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="login-card">
        <KayitFormu />
        <Link href="/" className="auth-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Giriş ekranı
        </Link>
      </div>
    </main>
  );
}
