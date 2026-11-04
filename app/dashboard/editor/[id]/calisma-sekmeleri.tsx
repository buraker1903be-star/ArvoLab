import { calismaAdresi } from "@/lib/calisma-karti";
import Link from "next/link";
import { ceviri } from "@/lib/dil-sunucu";
import { CalismaBaglamiYayinla } from "../../_components/calisma-baglami";

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
export type CalismaSekmesi = "merkez" | "yazim" | "kanit" | "etik" | "makale";

export default async function CalismaSekmeleri({
  calisma,
  aktif,
}: {
  calisma: { id: string; project_type: string; title?: string | null };
  aktif: CalismaSekmesi;
}) {
  const t = await ceviri();
  const sekmeler: { anahtar: CalismaSekmesi; etiket: string; href: string }[] = [
    /* Özet artık Çalışmalarım'daki kart (ayrı sayfa 02.11.2026'da kalktı). */
    { anahtar: "merkez", etiket: t({ tr: "Özet", en: "Overview" }), href: calismaAdresi(calisma.id) },
    { anahtar: "yazim", etiket: t({ tr: "Yazım", en: "Writing" }), href: `/dashboard/editor/${calisma.id}/write` },
    { anahtar: "kanit", etiket: t({ tr: "Kanıt matrisi", en: "Evidence matrix" }), href: `/dashboard/editor/${calisma.id}/kanit` },
    /* Etik kurul (02.11.2026): tez, makale ve projede; veri toplayan her çalışmada gerekebilir. */
    { anahtar: "etik", etiket: t({ tr: "Etik kurul", en: "Ethics" }), href: `/dashboard/editor/${calisma.id}/etik` },
    ...(calisma.project_type === "article"
      ? [{ anahtar: "makale" as const, etiket: t({ tr: "Makale", en: "Article" }), href: `/dashboard/editor/${calisma.id}/makale` }]
      : []),
  ];

  /*
    Phase 3 (04.11.2026): sekmeler masaüstünde gizli, aynı bölümler kenar
    çubuğunda (os-gezinme.tsx) duruyor; çalışmayı oraya bu bileşen
    bildiriyor. Tablet ve telefonda sekmeler sayfadaki tek bölüm gezinmesi.
  */
  return (
    <>
    <CalismaBaglamiYayinla id={calisma.id} baslik={calisma.title ?? ""} tur={calisma.project_type} />
    <nav className="segmented calisma-sekmeleri" aria-label={t({ tr: "Çalışma bölümleri", en: "Work sections" })}>
      {sekmeler.map((sekme) => (
        <Link key={sekme.anahtar} href={sekme.href} aria-current={sekme.anahtar === aktif ? "page" : undefined}>
          {sekme.etiket}
        </Link>
      ))}
    </nav>
    </>
  );
}
