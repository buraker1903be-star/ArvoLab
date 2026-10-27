"use client";

import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "../_components/toast-events";

/* Yüklenen ÜAK PDF'ini imzalı, kısa ömürlü bir adresle açar (onaydan önce yan yana karşılaştırmak için). */
export default function UakPdfAc({ yol }: { yol: string }) {
  const ac = async () => {
    const { data, error } = await createClient().storage.from("project-files").createSignedUrl(yol, 600);
    if (error || !data?.signedUrl) {
      showToast("error", "PDF açılamadı; tekrar deneyin.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };
  return (
    <button type="button" className="projects-filter-button button-compact" onClick={() => void ac()}>
      <FileText size={13} aria-hidden="true" /> PDF
    </button>
  );
}
