"use client";

import { Upload } from "lucide-react";
import PanelDrawer from "@/app/dashboard/_components/panel-drawer";
import DocumentUploadForm from "@/app/dashboard/documents/document-upload-form";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  "BELGE YÜKLE" PENCERESİ (03.11.2026). Kart menüsündeki bağlantı eskiden
  Belge Kontrol sayfasına gidiyor, öğrenci orada aynı düğmeyi bir daha
  arıyordu. Yükleme artık kartın üstünde; bitince sonuçların okunduğu
  Belge Kontrol'e geçilir (o çalışma seçili).
*/
export default function BelgeYuklePenceresi({ calisma }: { calisma: { id: string; title: string; university: string | null } }) {
  const t = useCeviri();
  return (
    <PanelDrawer
      triggerLabel={t({ tr: "Belge yükle", en: "Upload document" })}
      triggerIcon={<Upload size={15} aria-hidden="true" />}
      triggerClassName=""
      kicker={t({ tr: "Belge Kontrol", en: "Document Check" })}
      title={calisma.title}
      description={t({
        tr: "Tezinizin ya da makalenizin Word (.docx) veya PDF dosyası, en fazla 20 MB. Dosya yalnızca sizin ve yetkili rollerin görebileceği şekilde saklanır.",
        en: "The Word (.docx) or PDF file of your thesis or article, up to 20 MB. The file is stored so that only you and authorized roles can see it.",
      })}
    >
      <DocumentUploadForm projects={[calisma]} secilenCalisma={calisma.id} gomulu sonucAdresi={`/dashboard/documents?calisma=${calisma.id}`} />
    </PanelDrawer>
  );
}
