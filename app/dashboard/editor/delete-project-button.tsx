"use client";

import { Trash2 } from "lucide-react";
import { deleteProject } from "@/app/actions/projects";
import ActionForm from "../action-form";
import { useCeviri } from "@/app/_components/dil-saglayici";

export default function DeleteProjectButton({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const t = useCeviri();
  return (
    <ActionForm
      action={deleteProject.bind(null, projectId)}
      confirmMessage={t({
        tr: `"${projectTitle}" adlı çalışmayı silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz — çalışmaya bağlı tüm belge yüklemeleri, kaynakça kontrolleri ve panelde yazılmış metin de silinecektir.`,
        en: `Are you sure you want to delete the work "${projectTitle}"?\n\nThis cannot be undone — all document uploads, reference list checks and text written in the panel for this work will also be deleted.`,
      })}
      successMessage={t({ tr: `"${projectTitle}" silindi.`, en: `"${projectTitle}" was deleted.` })}
    >
      <button type="submit" className="button-danger button-compact">
        <Trash2 size={15} aria-hidden="true" />
        {t({ tr: "Çalışmayı sil", en: "Delete work" })}
      </button>
    </ActionForm>
  );
}
