"use client";

import { useState } from "react";
import LiteraturBulucu from "./literatur-bulucu";
import LiteraturAsistani from "./literatur-asistani";

type Proje = { id: string; title: string };

/*
  Bulucu ile asistanı tek yerde tutan kabuk.

  İkisi ayrı dursaydı asistanın kurduğu arama dizesini bulucuya taşımanın
  yolu olmazdı; öğrenci dizeyi elle kopyalar, iki kutunun aynı işin iki
  ucu olduğunu kendi kafasında kurardı. Aradaki tek bağ bu: dize yukarı
  çıkar, arama orada çalışır.
*/
export default function LiteraturCalismaAlani({
  projeler,
  asistanAcik,
  secilenCalisma = null,
}: {
  projeler: Proje[];
  asistanAcik: boolean;
  secilenCalisma?: string | null;
}) {
  const [sorgu, setSorgu] = useState("");

  return (
    <>
      <LiteraturBulucu
        projeler={projeler}
        secilenCalisma={secilenCalisma}
        sorgu={sorgu}
        onSorguDegis={setSorgu}
      />
      <LiteraturAsistani
        projeler={projeler}
        asistanAcik={asistanAcik}
        secilenCalisma={secilenCalisma}
        onAramaCalistir={(arama) => {
          setSorgu(arama);
          // Bulucu sayfanın üstünde; dize oraya gidince kullanıcı da gitmeli.
          document.querySelector("#kaynak-bul")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />
    </>
  );
}
