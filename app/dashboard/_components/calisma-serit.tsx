import Link from "next/link";
import { ArrowLeft, BookOpenCheck, ChartNoAxesCombined, FileCheck2, PenLine, Quote, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BIRIMLER, birimYolu, type BirimAnahtari } from "@/lib/calisma-ozeti";

/*
  Birim sayfalarının üstünde duran çalışma bağlamı.

  Ekosistemin arayüzdeki eksik halkasıydı: çalışma merkezi birimlere
  "?calisma=<id>" taşıyarak bağlanıyor, birim sayfası da çalışmayı hazır
  seçiyor — ama kullanıcı HANGİ çalışmanın içinde olduğunu göremiyordu.
  Literatürü toplayıp kaynakçaya geçmek için merkeze dönmek gerekiyordu.

  Şerit yalnızca bağlam VARKEN çıkar. Çalışma seçilmeden girilen sayfada
  boş bir çubuk göstermek yer kaplamaktan başka işe yaramaz.
*/

/*
  Birimlerin KENDİSİ artık burada tanımlı değil: liste, adres kuralı ve
  sıra lib/calisma-ozeti.ts'te. Burada yalnızca ikon eşlemesi var, çünkü
  o modül React'e dokunmuyor (saf ve testleri tarayıcısız koşuyor).

  Eskiden liste burada da, merkezin adımlarında da ayrı yazılıydı ve
  ayrışmıştı: şeritte beş birim, merkezde dört. Merkezdeki adımları
  takip eden kullanıcı analizden hiç haberdar olmuyordu.
*/
const IKONLAR: Record<BirimAnahtari, LucideIcon> = {
  literatur: BookOpenCheck,
  yazim: PenLine,
  kaynakca: Quote,
  belge: FileCheck2,
  analiz: ChartNoAxesCombined,
};

export default async function CalismaSerit({
  calismaId,
  aktif,
}: {
  calismaId: string | undefined;
  /** Bulunulan birim; o sekme bağlantı değil, işaretli durum olur. */
  aktif: BirimAnahtari;
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
        <span className="calisma-serit-etiket">Çalışma özeti</span>
        <strong>{calisma.title}</strong>
      </Link>
      <ul className="calisma-serit-birimler">
        {BIRIMLER.map((birim) => {
          const Ikon = IKONLAR[birim.anahtar];
          const href = birimYolu(birim.anahtar, calisma.id);
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
