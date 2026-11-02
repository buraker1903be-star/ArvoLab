import { redirect } from "next/navigation";
import { calismaAdresi } from "@/lib/calisma-karti";

/*
  ÇALIŞMA ÖZETİ SAYFASI KALDIRILDI (02.11.2026, kurum sahibinin kararı:
  "personelde yer alan çalışma merkezi sayfasına gerek yok").

  Öğrenci bu sayfayı 26.10.2026'dan beri görmüyordu; personel de artık
  görmüyor. Özet, eksikler, kılavuz, etik, literatür, kaynakça, analiz,
  teslim hazırlığı, teslim paketi ve atıf stili düzeltmesi Çalışmalarım'daki
  kartta (öğrencide calisma-durum-karti.tsx, personelde
  personel-calisma-karti.tsx). Adres kalkmadı: eski bağlantılar ve yer
  imleri çalışma seçili olarak Çalışmalarım'a iner; ?kilavuz=1 (yeni tezde
  kılavuz eşleşmediyse) kılavuz penceresini açar.
*/
export default async function CalismaSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sorgu] = await Promise.all([params, searchParams]);
  redirect(calismaAdresi(id, { kilavuz: sorgu.kilavuz === "1" }));
}
