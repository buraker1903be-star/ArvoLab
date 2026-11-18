import { redirect } from "next/navigation";
import { ceviri } from "@/lib/dil-sunucu";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Kaynaklar", en: "Sources" }) };
}

/*
  Kaynakça doğrulama Kaynaklar sayfasında (literature/page.tsx,
  26.10.2026). 17.11.2026'dan beri orada ayrı bir sekme: eski bağlantılar
  (yer imleri) çalışmasıyla Kaynakça sekmesine gider. Eskiden Kaynaklar
  sekmesine düşüyordu; kaynakça sağ kartta yan yana durduğu için fark
  etmiyordu.
*/
export default async function CitationsPage({ searchParams }: { searchParams: Promise<{ calisma?: string }> }) {
  const { calisma } = await searchParams;
  redirect(calisma ? `/dashboard/literature?calisma=${encodeURIComponent(calisma)}&sekme=kaynakca` : "/dashboard/literature");
}
