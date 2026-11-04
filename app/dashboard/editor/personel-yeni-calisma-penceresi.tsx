"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { University } from "@/app/actions/universities";
import PanelDrawer from "../_components/panel-drawer";
import YeniCalismaFormu from "./new/yeni-calisma-formu";
import { useAdrestenAcilis } from "./adresten-acilis";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  Personelin "Yeni çalışma" penceresi (02.11.2026, kurum sahibinin isteği:
  öğrencide olduğu gibi personelde de açılır pencere). Eskiden düğme ayrı
  bir sayfaya (/dashboard/editor/new) gidiyordu. Form aynı
  (new/yeni-calisma-formu.tsx); anahtar her açılışta artar, yarım kalan
  form bir sonraki açılışa taşınmaz.
*/
export default function PersonelYeniCalismaPenceresi({
  universities,
  universiteOkunamadi,
  acikBasla = false,
  triggerClassName,
}: {
  universities: University[];
  universiteOkunamadi: boolean;
  acikBasla?: boolean;
  /** Boş listede ikincil görünür; ana eylem boş durumun düğmesi (Phase 3). */
  triggerClassName?: string;
}) {
  const t = useCeviri();
  // Adresteki ?yeni=1 sonradan da pencereyi açar; kapanınca adresten silinir (adresten-acilis.ts).
  const { acik, setAcik, adresiTemizle } = useAdrestenAcilis(acikBasla);
  const [surum, setSurum] = useState(0);
  const degis = (deger: boolean) => {
    setAcik(deger);
    if (!deger) {
      setSurum((s) => s + 1);
      adresiTemizle();
    }
  };

  return (
    <PanelDrawer
      triggerLabel={t({ tr: "Yeni çalışma", en: "New work" })}
      triggerIcon={<Plus size={18} aria-hidden="true" />}
      triggerClassName={triggerClassName}
      kicker={t({ tr: "Yeni kayıt", en: "New record" })}
      title={t({ tr: "Yeni Akademik Çalışma", en: "New Academic Work" })}
      description={t({
        tr: "Başlığı ve kurumunuzu seçin; tez yazım kılavuzunuz otomatik uygulanır ve editör açılır.",
        en: "Enter the title and choose your institution; your thesis writing guideline is applied automatically and the editor opens.",
      })}
      boy="tam"
      acik={acik}
      onAcikDegis={degis}
    >
      <YeniCalismaFormu key={surum} universities={universities} universiteOkunamadi={universiteOkunamadi} onIptal={() => degis(false)} />
    </PanelDrawer>
  );
}
