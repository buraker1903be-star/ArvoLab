import { redirect } from "next/navigation";

export const metadata = { title: "Destek" };

/*
  Uygulama desteği artık Destek sayfasının sağ kartı
  (expert-requests/page.tsx, 26.10.2026). Eski bağlantılar (kullanıcı
  menüsü, hata mesajlarındaki "Uygulama Destek'ten bildirin") oraya gider.
*/
export default function SupportPage() {
  redirect("/dashboard/expert-requests");
}
