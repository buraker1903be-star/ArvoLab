import { ceviri } from "@/lib/dil-sunucu";
import AnaSayfaIcerik from "./ana-sayfa-icerik";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Ana Sayfa", en: "Home" }) };
}

/* Herkesin ana sayfası aynı: yalnızca kendi çalışmaları (lib/yonetim.ts). */
export default function DashboardPage() {
  return <AnaSayfaIcerik kapsam="kisisel" />;
}
