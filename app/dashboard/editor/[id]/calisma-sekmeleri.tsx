import Link from "next/link";
import { ceviri } from "@/lib/dil-sunucu";

/*
  ÇALIŞMANIN SEKMELERİ: Özet · Yazım · Kanıt · Makale.

  Eskiden merkez, kanıt matrisi ve makale alanı birbirine üst çubuktaki
  düğmelerle ve sayfa içindeki karolarla bağlanıyordu; her sayfada
  başka bir yerde, başka bir adla. ArvoOS'taki bölüm şeridi gibi tek bir
  sıra, her sayfada aynı yerde.

  Dock'un bölüm listesine konmadı (lib/os/uygulamalar.ts): adresler
  çalışmanın kimliğini taşıyor ve "Makale" yalnızca makale türünde
  anlamlı — bunu bilen tek yer çalışmayı okuyan sunucu bileşeni.
*/
export type CalismaSekmesi = "merkez" | "yazim" | "kanit" | "makale";

export default async function CalismaSekmeleri({
  calisma,
  aktif,
}: {
  calisma: { id: string; project_type: string };
  aktif: CalismaSekmesi;
}) {
  const t = await ceviri();
  const sekmeler: { anahtar: CalismaSekmesi; etiket: string; href: string }[] = [
    { anahtar: "merkez", etiket: t({ tr: "Özet", en: "Overview" }), href: `/dashboard/editor/${calisma.id}` },
    { anahtar: "yazim", etiket: t({ tr: "Yazım", en: "Writing" }), href: `/dashboard/editor/${calisma.id}/write` },
    { anahtar: "kanit", etiket: t({ tr: "Kanıt matrisi", en: "Evidence matrix" }), href: `/dashboard/editor/${calisma.id}/kanit` },
    ...(calisma.project_type === "article"
      ? [{ anahtar: "makale" as const, etiket: t({ tr: "Makale", en: "Article" }), href: `/dashboard/editor/${calisma.id}/makale` }]
      : []),
  ];

  return (
    <nav className="segmented calisma-sekmeleri" aria-label={t({ tr: "Çalışma bölümleri", en: "Work sections" })}>
      {sekmeler.map((sekme) => (
        <Link key={sekme.anahtar} href={sekme.href} aria-current={sekme.anahtar === aktif ? "page" : undefined}>
          {sekme.etiket}
        </Link>
      ))}
    </nav>
  );
}
