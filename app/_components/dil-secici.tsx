"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Languages } from "lucide-react";
import { dilSec } from "@/app/actions/dil";
import { DILLER, DIL_ADLARI } from "@/lib/dil";
import { useDil } from "./dil-saglayici";

/*
  Dil seçici: kullanıcı menüsünde ve giriş sayfasında. Dil adları KENDİ
  dillerinde yazılı ("English", "Türkçe"): yanlış dilde açılmış bir
  ekranda kullanıcı kendi dilini ancak böyle tanır.
*/
export default function DilSecici({ sinif = "os-kullanici-gorunum" }: { sinif?: string }) {
  const dil = useDil();
  const router = useRouter();
  const [bekliyor, basla] = useTransition();
  return (
    <div className={sinif} role="group" aria-label="Language / Dil">
      <small>
        <Languages size={13} aria-hidden="true" /> {dil === "tr" ? "Dil" : "Language"}
      </small>
      {DILLER.map((secenek) => (
        <button
          key={secenek}
          type="button"
          lang={secenek}
          aria-pressed={dil === secenek}
          disabled={bekliyor}
          onClick={() =>
            basla(async () => {
              await dilSec(secenek);
              router.refresh();
            })
          }
        >
          {DIL_ADLARI[secenek]}
          {dil === secenek ? <Check size={15} aria-hidden="true" /> : null}
        </button>
      ))}
    </div>
  );
}
