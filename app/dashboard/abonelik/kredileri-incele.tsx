"use client";

import { useState } from "react";
import { useCeviri } from "@/app/_components/dil-saglayici";
import type { KrediPaketi } from "@/lib/kredi-paketleri";
import KredileriKarsilastir from "./kredileri-karsilastir";

/** "Kredi paketlerini incele" düğmesi ve karşılaştırma penceresi. */
export default function KredileriIncele({ paketler, kurum }: { paketler: KrediPaketi[]; kurum: boolean }) {
  const t = useCeviri();
  const [acik, setAcik] = useState(false);
  return (
    <>
      <button type="button" className="projects-primary-button" onClick={() => setAcik(true)}>
        {t({ tr: "Kredi paketlerini incele", en: "Review credit packages" })}
      </button>
      <KredileriKarsilastir acik={acik} kapat={() => setAcik(false)} paketler={paketler} kurum={kurum} />
    </>
  );
}
