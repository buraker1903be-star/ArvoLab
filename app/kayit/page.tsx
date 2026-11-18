import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import KimlikYerlesimi from "@/app/_components/kimlik/kimlik-yerlesimi";
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

/*
  Kayıt SAYFASI: sitedeki "Ücretsiz deneyin" bağlantıları ve JavaScript'siz
  giriş buraya gelir (giriş ekranında aynı form bir pencerede). Signature
  OS 5 / Phase 2'de ortak kimlik yerleşimine geçti; form tek sütun
  (kayit-formu.tsx), eskiden iki sütunlu geniş bir karttı.
*/
export default async function KayitPage() {
  const t = await ceviri();
  return (
    <KimlikYerlesimi>
      <KayitFormu />
      <Link href="/" className="os5-kimlik-geri">
        <ArrowLeft size={16} aria-hidden="true" />
        {t({ tr: "Giriş ekranı", en: "Sign-in page" })}
      </Link>
    </KimlikYerlesimi>
  );
}
