"use client";

import { Trash2 } from "lucide-react";
import { deleteProject } from "@/app/actions/projects";
import ActionForm from "../action-form";

export default function DeleteProjectButton({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  return (
    <ActionForm
      action={deleteProject.bind(null, projectId)}
      confirmMessage={`"${projectTitle}" adlı çalışmayı silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz — çalışmaya bağlı tüm belge yüklemeleri, kaynakça kontrolleri ve panelde yazılmış metin de silinecektir.`}
    >
      <button type="submit" className="button-danger">
        <Trash2 size={15} aria-hidden="true" />
        Çalışmayı Sil
      </button>
    </ActionForm>
  );
}
