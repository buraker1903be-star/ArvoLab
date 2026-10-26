import { redirect } from "next/navigation";

/*
  Uygulama desteği artık Destek sayfasının sağ kartı
  (expert-requests/page.tsx, 26.10.2026). Eski bağlantılar (kullanıcı
  menüsü, hata mesajlarındaki "Uygulama Destek'ten bildirin") oraya gider.
*/
export default function SupportPage() {
  redirect("/dashboard/expert-requests");
}
