"use client";

import { Trash2 } from "lucide-react";
import { deleteProject } from "@/app/actions/projects";

export default function DeleteProjectButton({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  return (
    <form
      action={async () => {
        await deleteProject(projectId);
      }}
      onSubmit={(e) => {
        const confirmed = window.confirm(
          `"${projectTitle}" adlı çalışmayı silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz — çalışmaya bağlı tüm belge yüklemeleri, kaynakça kontrolleri ve panelde yazılmış metin de silinecektir.`
        );
        if (!confirmed) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="projects-filter-button" style={{ color: "var(--danger)" }}>
        <Trash2 size={15} />
        Çalışmayı Sil
      </button>
    </form>
  );
}
