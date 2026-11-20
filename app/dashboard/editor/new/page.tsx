import { redirect } from "next/navigation";

/*
  Yeni çalışma pencerede açılıyor (02.11.2026); 20.11.2026'dan beri
  herkes için TEK pencere (yeni-calisma-penceresi.tsx). Bu adres yer
  imleri ve eski bağlantılar için duruyor; Çalışmalarım'a gidip pencereyi
  açıyor.
*/
export default function NewProjectPage() {
  redirect("/dashboard/editor?yeni=1");
}
