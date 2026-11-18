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

/*
  ÜST ÇUBUK DİL MENÜSÜ (premium çalışma alanı, 17.11.2026): onaylı
  tasarımda üst çubukta tema düğmesinin yanında kısa bir dil seçici var
  ("TR ▾"). Eskiden dil yalnızca hesap menüsünün ve Ayarlar'ın içindeydi;
  yanlış dilde açılan bir ekranda kullanıcı onu arayıp bulmak zorundaydı.
  Karar ve kayıt aynı yoldan (dilSec): ikinci bir dil mekanizması yok.
  Menü <details> ile: klavye ve ekran okuyucu yerleşik davranışı alır,
  dışarı tıklayınca panelin AcilirKapatici'si kapatır.
*/
export function UstDilSecici() {
  const dil = useDil();
  const router = useRouter();
  const [bekliyor, basla] = useTransition();
  return (
    <details className="ust-dil">
      <summary aria-label={dil === "tr" ? "Dil: Türkçe" : "Language: English"} title={dil === "tr" ? "Dil" : "Language"}>
        <Languages size={16} aria-hidden="true" />
        <span>{dil.toLocaleUpperCase("tr")}</span>
      </summary>
      <div className="ust-dil-menu" role="group" aria-label="Language / Dil">
        {DILLER.map((secenek) => (
          <button
            key={secenek}
            type="button"
            lang={secenek}
            aria-pressed={dil === secenek}
            disabled={bekliyor}
            onClick={(olay) => {
              olay.currentTarget.closest("details")?.removeAttribute("open");
              basla(async () => {
                await dilSec(secenek);
                router.refresh();
              });
            }}
          >
            {DIL_ADLARI[secenek]}
            {dil === secenek ? <Check size={15} aria-hidden="true" /> : null}
          </button>
        ))}
      </div>
    </details>
  );
}
