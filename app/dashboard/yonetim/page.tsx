import { ceviri } from "@/lib/dil-sunucu";
import AnaSayfaIcerik from "../ana-sayfa-icerik";
import { yonetimKapisi } from "./kapi";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Yönetim", en: "Management" }) };
}

/*
  Yönetim · genel bakış: eski personel ana sayfası (sayaçlar, dikkat
  isteyenler, uzman ve destek kuyrukları, kurumun çalışma hareketi).
  Kişinin kendi tezi burada değil, Ana Sayfa'da (lib/yonetim.ts).
*/
export default async function YonetimPage() {
  await yonetimKapisi();
  return <AnaSayfaIcerik kapsam="yonetim" />;
}
