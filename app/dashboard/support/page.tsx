import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ceviri } from "@/lib/dil-sunucu";

export async function generateMetadata(): Promise<Metadata> {
  const t = await ceviri();
  return { title: t({ tr: "Destek", en: "Support" }) };
}

/*
  Uygulama desteği artık Destek sayfasının sağ kartı
  (expert-requests/page.tsx, 26.10.2026). Eski bağlantılar (kullanıcı
  menüsü, hata mesajlarındaki "Uygulama Destek'ten bildirin") oraya gider.
*/
export default function SupportPage() {
  redirect("/dashboard/expert-requests");
}
