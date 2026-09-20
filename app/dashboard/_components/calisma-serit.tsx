import Link from "next/link";
import { ArrowLeft, BookOpenCheck, ChartNoAxesCombined, FileCheck2, PenLine, Quote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

/*
  Birim sayfalarının üstünde duran çalışma bağlamı.

  Ekosistemin arayüzdeki eksik halkasıydı: çalışma merkezi birimlere
  "?calisma=<id>" taşıyarak bağlanıyor, birim sayfası da çalışmayı hazır
  seçiyor — ama kullanıcı HANGİ çalışmanın içinde olduğunu göremiyordu.
  Literatürü toplayıp kaynakçaya geçmek için merkeze dönmek gerekiyordu.

  Şerit yalnızca bağlam VARKEN çıkar. Çalışma seçilmeden girilen sayfada
  boş bir çubuk göstermek yer kaplamaktan başka işe yaramaz.
*/

const BIRIMLER = [
  { anahtar: "literatur", etiket: "Literatür", ikon: BookOpenCheck, yol: "/dashboard/literature" },
  { anahtar: "yazim", etiket: "Yazım", ikon: PenLine, yol: null },
  { anahtar: "kaynakca", etiket: "Kaynakça", ikon: Quote, yol: "/dashboard/citations" },
  { anahtar: "belge", etiket: "Belge", ikon: FileCheck2, yol: "/dashboard/documents" },
  { anahtar: "analiz", etiket: "Analiz", ikon: ChartNoAxesCombined, yol: "/dashboard/analysis" },
] as const;

export default async function CalismaSerit({
  calismaId,
  aktif,
}: {
  calismaId: string | undefined;
  /** Bulunulan birim; o sekme bağlantı değil, işaretli durum olur. */
  aktif: (typeof BIRIMLER)[number]["anahtar"];
}) {
  if (!calismaId) return null;

  const supabase = await createClient();
  // RLS erişimi kararlaştırır: yetkisi olmayan kullanıcıya satır hiç dönmez.
  const { data: calisma } = await supabase
    .from("academic_projects")
    .select("id, title")
    .eq("id", calismaId)
    .maybeSingle();

  // Erişilemeyen ya da silinmiş çalışma için şerit çizmek yanıltıcı olurdu.
  if (!calisma) return null;

  return (
    <nav className="calisma-serit" aria-label="Çalışma bağlamı">
      <Link href={`/dashboard/editor/${calisma.id}`} className="calisma-serit-baslik">
        <ArrowLeft size={15} aria-hidden="true" />
        <span className="calisma-serit-etiket">Çalışma merkezi</span>
        <strong>{calisma.title}</strong>
      </Link>
      <ul className="calisma-serit-birimler">
        {BIRIMLER.map((birim) => {
          const Ikon = birim.ikon;
          // Yazım birimi çalışmanın kendi adresinde; diğerleri bağlamı sorguyla taşır.
          const href = birim.yol ? `${birim.yol}?calisma=${calisma.id}` : `/dashboard/editor/${calisma.id}/write`;
          const buradayiz = birim.anahtar === aktif;
          return (
            <li key={birim.anahtar}>
              {buradayiz ? (
                <span className="calisma-serit-birim" aria-current="page">
                  <Ikon size={14} aria-hidden="true" />
                  {birim.etiket}
                </span>
              ) : (
                <Link href={href} className="calisma-serit-birim">
                  <Ikon size={14} aria-hidden="true" />
                  {birim.etiket}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
