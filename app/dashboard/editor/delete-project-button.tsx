"use client";

import { Trash2 } from "lucide-react";
import { deleteProject } from "@/app/actions/projects";
import ActionForm from "../action-form";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  ÇALIŞMAYI SİL. Onay metni, sunucu eylemi (deleteProject) ve yetki
  kontrolü değişmedi; yalnızca düğmenin GÖRÜNÜMÜ çağırana bırakıldı
  (22.11.2026): aynı bileşen hem çalışma ayrıntıları kartının altındaki
  "⋯" menüsünde hem Çalışmalarım'ın öne çıkan kartının ana "⋯"
  menüsünde çiziliyor ve ikisinin düğme sınıfı aynı değil. `className`
  verilmezse eski görünüm aynen korunur.
*/
export default function DeleteProjectButton({
  projectId,
  projectTitle,
  className = "button-danger button-compact",
}: {
  projectId: string;
  projectTitle: string;
  className?: string;
}) {
  const t = useCeviri();
  return (
    <ActionForm
      action={deleteProject.bind(null, projectId)}
      confirmMessage={t({
        tr: `"${projectTitle}" adlı çalışmayı silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz — çalışmaya bağlı tüm belge yüklemeleri, kaynakça kontrolleri ve panelde yazılmış metin de silinecektir.`,
        en: `Are you sure you want to delete the work "${projectTitle}"?\n\nThis cannot be undone — all document uploads, reference list checks and text written in the panel for this work will also be deleted.`,
      })}
      successMessage={t({ tr: `"${projectTitle}" silindi.`, en: `"${projectTitle}" was deleted.` })}
      confirmButtonLabel={t({ tr: "Evet, sil", en: "Yes, delete" })}
    >
      <button type="submit" className={className}>
        <Trash2 size={15} aria-hidden="true" />
        {t({ tr: "Çalışmayı sil", en: "Delete work" })}
      </button>
    </ActionForm>
  );
}
