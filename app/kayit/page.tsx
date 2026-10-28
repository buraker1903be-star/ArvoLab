import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ThemeToggle from "@/app/_components/theme-toggle";
import KayitFormu from "./kayit-formu";
import { ceviri } from "@/lib/dil-sunucu";

export async function generateMetadata() {
  const t = await ceviri();
  return {
    title: t({ tr: "Kayıt", en: "Sign up" }),
    description: t({
      tr: "ArvoLab hesabı oluşturun; tez yazımı, kaynak doğrulama ve kılavuz denetimi tek yerde.",
      en: "Create an ArvoLab account: thesis writing, source verification and guideline checks in one place.",
    }),
  };
}

export default async function KayitPage() {
  const t = await ceviri();
  return (
    <main className="auth-simple-page">
      <div className="auth-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="login-card">
        <KayitFormu />
        <Link href="/" className="auth-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          {t({ tr: "Giriş ekranı", en: "Sign-in page" })}
        </Link>
      </div>
    </main>
  );
}
