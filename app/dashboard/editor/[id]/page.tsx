import { redirect } from "next/navigation";
import { calismaAdresi } from "@/lib/calisma-karti";
import { getAuthContext } from "@/lib/auth-guards";
import { calismaninListesi } from "@/lib/yonetim";

/*
  ÇALIŞMA ÖZETİ SAYFASI KALDIRILDI (02.11.2026, kurum sahibinin kararı:
  "personelde yer alan çalışma merkezi sayfasına gerek yok").

  Özet, eksikler, kılavuz, etik, literatür, kaynakça, analiz, teslim
  hazırlığı, teslim paketi ve atıf stili düzeltmesi çalışma listesindeki
  kartta. Adres kalkmadı: eski bağlantılar, yer imleri, destek kuyruğu ve
  çalışma içindeki "Özet ve teslim" buraya gelip çalışma SEÇİLİ olarak
  listeye iner; ?kilavuz=1 kılavuz penceresini açar.

  HANGİ LİSTE (20.11.2026, lib/yonetim.ts): kendi çalışması kişinin
  Çalışmalarım'ına, başkasının çalışması (yetkiliyse) Yönetim'deki listeye.
  Eskiden herkes Çalışmalarım'a iniyordu; Çalışmalarım artık yalnızca kişinin
  kendi çalışmalarını gösterdiği için personel, destek kuyruğundan açtığı
  öğrenci tezini orada bulamazdı. Sahiplik RLS altında okunuyor: satırı
  göremeyen kişi için karar değişmiyor (kişisel liste, çalışma seçilemez).
*/
export default async function CalismaSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sorgu, ctx] = await Promise.all([params, searchParams, getAuthContext()]);
  const kilavuz = sorgu.kilavuz === "1";
  if (!ctx) redirect(calismaAdresi(id, { kilavuz }));
  const { data, error } = await ctx.supabase.from("academic_projects").select("owner_id").eq("id", id).maybeSingle();
  /* Okunamazsa kişisel listeye: yönlendirme bir yetki kararı değil, en zararsız varsayılan. */
  if (error) console.error("[çalışma adresi] sahip okunamadı:", error.message);
  redirect(calismaninListesi({ calismaId: id, sahipId: data?.owner_id ?? null, kullaniciId: ctx.user.id, rol: ctx.role, kilavuz }));
}
