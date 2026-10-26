import Link from "next/link";

/*
  ÇALIŞMANIN SEKMELERİ: Merkez · Yazım · Kanıt · Makale.

  Eskiden merkez, kanıt matrisi ve makale alanı birbirine üst çubuktaki
  düğmelerle ve sayfa içindeki karolarla bağlanıyordu; her sayfada
  başka bir yerde, başka bir adla. ArvoOS'taki bölüm şeridi gibi tek bir
  sıra, her sayfada aynı yerde.

  Dock'un bölüm listesine konmadı (lib/os/uygulamalar.ts): adresler
  çalışmanın kimliğini taşıyor ve "Makale" yalnızca makale türünde
  anlamlı — bunu bilen tek yer çalışmayı okuyan sunucu bileşeni.
*/
export type CalismaSekmesi = "merkez" | "yazim" | "kanit" | "makale";

export default function CalismaSekmeleri({
  calisma,
  aktif,
}: {
  calisma: { id: string; project_type: string };
  aktif: CalismaSekmesi;
}) {
  const sekmeler: { anahtar: CalismaSekmesi; etiket: string; href: string }[] = [
    { anahtar: "merkez", etiket: "Merkez", href: `/dashboard/editor/${calisma.id}` },
    { anahtar: "yazim", etiket: "Yazım", href: `/dashboard/editor/${calisma.id}/write` },
    { anahtar: "kanit", etiket: "Kanıt matrisi", href: `/dashboard/editor/${calisma.id}/kanit` },
    ...(calisma.project_type === "article"
      ? [{ anahtar: "makale" as const, etiket: "Makale", href: `/dashboard/editor/${calisma.id}/makale` }]
      : []),
  ];

  return (
    <nav className="segmented calisma-sekmeleri" aria-label="Çalışma bölümleri">
      {sekmeler.map((sekme) => (
        <Link key={sekme.anahtar} href={sekme.href} aria-current={sekme.anahtar === aktif ? "page" : undefined}>
          {sekme.etiket}
        </Link>
      ))}
    </nav>
  );
}
