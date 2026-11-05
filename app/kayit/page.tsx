import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import KimlikKabugu from "@/app/_components/kimlik-kabugu";
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
    /* Logo, dil ve tema ortak kabukta (kimlik-kabugu.tsx); eskiden yalnızca köşede yüzen bir tema düğmesi vardı. */
    <KimlikKabugu>
      {/* Kayıt formu iki sütunlu (02.11.2026): giriş kartından geniş. */}
      <div className="login-card kayit-kart">
        <KayitFormu />
        <Link href="/" className="auth-back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          {t({ tr: "Giriş ekranı", en: "Sign-in page" })}
        </Link>
      </div>
    </KimlikKabugu>
  );
}
