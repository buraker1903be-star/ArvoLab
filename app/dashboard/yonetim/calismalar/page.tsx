import { ceviri } from "@/lib/dil-sunucu";
import CalismaListesi from "../../editor/calisma-listesi";
import { yonetimKapisi } from "../kapi";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Yönetim · çalışmalar", en: "Management · works" }) };
}

/* Çalışmalarım ile aynı: seçili çalışmanın kartından kılavuz okuma burada da çalışıyor (model süresi 150 sn). */
export const maxDuration = 300;

/* Yetkinin kapsadığı çalışmalar: onay, sorumlu, sayaçlar (eski personel listesi). */
export default async function YonetimCalismalarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await yonetimKapisi();
  return <CalismaListesi kapsam="yonetim" searchParams={searchParams} />;
}
