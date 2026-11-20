import { ceviri } from "@/lib/dil-sunucu";
import CalismaListesi from "./calisma-listesi";

export async function generateMetadata() {
  const t = await ceviri();
  return { title: t({ tr: "Çalışmalarım", en: "My works" }) };
}

/* Kaynak PDF'lerini bulan sunucu işlemi dış arşivlerden indirme yapıyor
   (app/actions/kaynak-pdf.ts, süre bütçesi 40 sn). Kılavuz okuma da bu
   sayfadan çalışıyor (kilavuzuTara: PDF, gerekirse OCR, ardından model;
   modelin süresi 150 sn) — 60 sn'de işlem yarıda kesilirdi (02.11.2026). */
export const maxDuration = 300;

/* Herkesin kendi çalışmaları, aynı düzende (lib/kisisel-calismalar.ts). */
export default function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <CalismaListesi searchParams={searchParams} />;
}
