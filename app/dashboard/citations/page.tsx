import { redirect } from "next/navigation";
import { ceviri } from "@/lib/dil-sunucu";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Kaynaklar", en: "Sources" }) };
}

/*
  Kaynakça doğrulama artık Kaynaklar sayfasının sağ kartı ve onun
  penceresi (literature/page.tsx, 26.10.2026). Eski bağlantılar
  (çalışma özeti adımları, yer imleri) çalışmasıyla oraya gider.
*/
export default async function CitationsPage({ searchParams }: { searchParams: Promise<{ calisma?: string }> }) {
  const { calisma } = await searchParams;
  redirect(calisma ? `/dashboard/literature?calisma=${encodeURIComponent(calisma)}` : "/dashboard/literature");
}
