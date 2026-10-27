"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, FileUp, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { belgeKaldir, belgeYuklendi } from "@/app/actions/scoring";
import { PDF_EN_FAZLA_BAYT } from "@/lib/kaynak-pdf";
import { showToast } from "../_components/toast-events";

/*
  Faaliyetin kanıt belgesi (yayın, kabul yazısı, proje sözleşmesi).
  Dosya tarayıcıdan kullanıcının kendi klasörüne yükleniyor; sunucu
  PDF olduğunu doğrulayıp kayda bağlıyor (app/actions/scoring.ts,
  belgeYuklendi). Kaynak PDF'leriyle aynı akış.
*/
export default function BelgeSatiri({ entryId, ownerId, belgeYolu }: { entryId: string; ownerId: string; belgeYolu: string | null }) {
  const router = useRouter();
  const dosyaRef = useRef<HTMLInputElement>(null);
  const [mesgul, setMesgul] = useState(false);

  const ac = async () => {
    if (!belgeYolu) return;
    const { data, error } = await createClient().storage.from("project-files").createSignedUrl(belgeYolu, 600);
    if (error || !data?.signedUrl) {
      showToast("error", "Belge açılamadı; tekrar deneyin.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const yukle = async (dosya: File) => {
    if (dosya.type !== "application/pdf" && !dosya.name.toLowerCase().endsWith(".pdf")) {
      showToast("error", "Yalnızca PDF yüklenebilir.");
      return;
    }
    if (dosya.size > PDF_EN_FAZLA_BAYT) {
      showToast("error", "Belge en fazla 20 MB olabilir.");
      return;
    }
    setMesgul(true);
    try {
      const yol = `${ownerId}/docentlik/${entryId}-${Date.now()}.pdf`;
      const { error } = await createClient().storage.from("project-files").upload(yol, dosya, { contentType: "application/pdf", upsert: false });
      if (error) {
        console.error(error);
        showToast("error", "Dosya yüklenemedi; tekrar deneyin.");
        return;
      }
      const sonuc = await belgeYuklendi(entryId, yol);
      if (sonuc.error) {
        showToast("error", sonuc.error);
        return;
      }
      showToast("success", "Belge eklendi.");
      router.refresh();
    } finally {
      setMesgul(false);
      if (dosyaRef.current) dosyaRef.current.value = "";
    }
  };

  const kaldir = async () => {
    if (!window.confirm("Belge kaldırılsın mı?")) return;
    setMesgul(true);
    try {
      const sonuc = await belgeKaldir(entryId);
      if (sonuc.error) showToast("error", sonuc.error);
      else {
        showToast("success", "Belge kaldırıldı.");
        router.refresh();
      }
    } finally {
      setMesgul(false);
    }
  };

  return (
    <div className="kaynak-pdf-satiri">
      <span className="status-pill" data-tone={belgeYolu ? "success" : "warning"}>
        {belgeYolu ? "Belge eklendi" : "Belge eksik"}
      </span>
      <span className="kaynak-pdf-eylemler">
        {belgeYolu ? (
          <>
            <button type="button" className="projects-filter-button button-compact" onClick={() => void ac()}>
              <FileCheck2 size={14} aria-hidden="true" /> Belgeyi aç
            </button>
            <button type="button" className="link-button" disabled={mesgul} onClick={() => void kaldir()}>
              <X size={14} aria-hidden="true" /> Kaldır
            </button>
          </>
        ) : null}
        <button
          type="button"
          className={belgeYolu ? "link-button" : "projects-filter-button button-compact"}
          disabled={mesgul}
          onClick={() => dosyaRef.current?.click()}
        >
          <FileUp size={14} aria-hidden="true" /> {mesgul ? "Yükleniyor…" : belgeYolu ? "Değiştir" : "Belge yükle (PDF)"}
        </button>
        <input
          ref={dosyaRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => {
            const dosya = e.target.files?.[0];
            if (dosya) void yukle(dosya);
          }}
        />
      </span>
    </div>
  );
}
