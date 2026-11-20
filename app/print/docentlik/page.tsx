import { redirect } from "next/navigation";

/*
  Doçentlik puan dökümünün yazdırma sayfasıydı; modül 20.11.2026'da
  kaldırıldı (gerekçe app/dashboard/associate-professorship/page.tsx).
  Yazdırma sekmesinde açık kalmış ya da kaydedilmiş adres Ana Sayfa'ya iner.
*/
export default function DocentlikDokumuKaldirildi() {
  redirect("/dashboard");
}
