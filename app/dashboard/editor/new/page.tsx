import { redirect } from "next/navigation";

/*
  Yeni çalışma artık pencerede açılıyor (02.11.2026): öğrencide
  yeni-calisma-penceresi.tsx, personelde personel-yeni-calisma-penceresi.tsx
  (form: new/yeni-calisma-formu.tsx). Bu adres yer imleri ve eski
  bağlantılar için duruyor; çalışmalar sayfasına gidip pencereyi açıyor.
*/
export default function NewProjectPage() {
  redirect("/dashboard/editor?yeni=1");
}
