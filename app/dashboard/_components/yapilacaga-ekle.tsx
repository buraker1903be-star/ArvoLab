"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListPlus } from "lucide-react";
import { yapilacaklaraEkle } from "@/app/actions/yapilacaklar";
import { showToast } from "./toast-events";

/*
  Asistan bulgusunun sağındaki "Yapılacaklara ekle" (Kaynakça penceresi).
  Bulgu, Çalışmalarım kartının "Başka neler var" listesine iner ve öğrenci
  "Yaptım" diyene kadar orada kalır (calisma_yapilacaklari).

  "Zaten ekli" bir hata değil: aynı açık madde veritabanında tekil; düğme
  eklendi durumuna geçer. Eklenince kart da yenilenir (router.refresh).
*/
export default function YapilacagaEkle({
  projectId,
  baslik,
  aciklama,
  asistanKaydi,
}: {
  projectId: string;
  baslik: string;
  aciklama?: string | null;
  asistanKaydi?: string | null;
}) {
  const router = useRouter();
  const [eklendi, setEklendi] = useState(false);
  const [bekleniyor, basla] = useTransition();

  if (eklendi) {
    return (
      <span className="status-pill" data-tone="success">
        <Check size={12} aria-hidden="true" /> Yapılacaklarda
      </span>
    );
  }

  return (
    <button
      type="button"
      className="projects-filter-button button-compact"
      disabled={bekleniyor}
      onClick={() =>
        basla(async () => {
          const sonuc = await yapilacaklaraEkle({ projectId, baslik, aciklama, asistanKaydi });
          if (sonuc.error && !/zaten/.test(sonuc.error)) {
            showToast("error", sonuc.error);
            return;
          }
          setEklendi(true);
          showToast("success", sonuc.error ?? "Yapılacaklara eklendi; Çalışmalarım kartında görünür.");
          router.refresh();
        })
      }
    >
      <ListPlus size={14} aria-hidden="true" /> {bekleniyor ? "Ekleniyor…" : "Yapılacaklara ekle"}
    </button>
  );
}
