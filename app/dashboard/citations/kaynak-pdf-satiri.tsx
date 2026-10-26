"use client";

import { useRef, useState } from "react";
import { ExternalLink, FileCheck2, FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { kaynakPdfiYuklendi } from "@/app/actions/kaynak-pdf";
import { PDF_EN_FAZLA_BAYT, type KaynakPdfSatiri } from "@/lib/kaynak-pdf";
import { showToast } from "../_components/toast-events";

/*
  Bir künyenin PDF durumu ve eylemi (Kaynakça penceresindeki her kaynak
  kartının altında). Durumun sözü öğrenciye ne yapacağını söylüyor:
  "Açık erişim PDF yok → kendi PDF'inizi yükleyin" gibi. "Kayıt yok"
  sahte demek DEĞİL; künyeye bakılması gerektiğini söylüyor.
*/

const DURUM: Record<KaynakPdfSatiri["durum"], { etiket: string; ton: string }> = {
  indirildi: { etiket: "PDF hazır · açık erişim", ton: "success" },
  yuklendi: { etiket: "PDF yüklendi", ton: "success" },
  bulunamadi: { etiket: "Açık erişim PDF yok · siz yükleyin", ton: "warning" },
  erisilemedi: { etiket: "PDF indirilemedi · siz yükleyin", ton: "warning" },
  kayit_yok: { etiket: "Dizinde kayıt yok · künyeyi kontrol edin", ton: "danger" },
};

export default function KaynakPdfSatiri({
  projectId,
  kunye,
  doi,
  satir,
  onGuncelle,
}: {
  projectId: string;
  kunye: string;
  doi: string | null;
  satir: KaynakPdfSatiri | null;
  onGuncelle: (satir: KaynakPdfSatiri) => void;
}) {
  const dosyaRef = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  const ac = async () => {
    if (!satir?.depo_yolu) return;
    const { data, error } = await createClient().storage.from("project-files").createSignedUrl(satir.depo_yolu, 600);
    if (error || !data?.signedUrl) {
      showToast("error", "PDF açılamadı; tekrar deneyin.");
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
      showToast("error", "PDF en fazla 20 MB olabilir.");
      return;
    }
    setYukleniyor(true);
    try {
      const yol = `${projectId}/kaynak-pdf/y-${Date.now()}.pdf`;
      const { error } = await createClient().storage.from("project-files").upload(yol, dosya, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (error) {
        console.error(error);
        showToast("error", "Dosya yüklenemedi; tekrar deneyin.");
        return;
      }
      const sonuc = await kaynakPdfiYuklendi(projectId, { kunye, doi, depoYolu: yol });
      if (sonuc.error || !sonuc.satir) {
        showToast("error", sonuc.error ?? "Kaydedilemedi.");
        return;
      }
      onGuncelle(sonuc.satir);
      showToast(
        sonuc.satir.baslik_eslesti === false ? "error" : "success",
        sonuc.satir.baslik_eslesti === false
          ? "PDF yüklendi, ama künyenin başlığı PDF'te bulunamadı. Doğru dosya olduğundan emin olun."
          : "PDF yüklendi.",
      );
    } finally {
      setYukleniyor(false);
      if (dosyaRef.current) dosyaRef.current.value = "";
    }
  };

  const dosyaVar = satir?.durum === "indirildi" || satir?.durum === "yuklendi";
  const durum = satir ? DURUM[satir.durum] : null;

  return (
    <div className="kaynak-pdf-satiri">
      {durum ? (
        <span className="status-pill" data-tone={durum.ton}>
          {durum.etiket}
        </span>
      ) : (
        <span className="muted text-sm">PDF&apos;e henüz bakılmadı</span>
      )}
      {satir?.durum === "yuklendi" && satir.baslik_eslesti === false ? (
        <span className="tone-text text-sm" data-tone="warning">
          Başlık PDF&apos;te bulunamadı; doğru dosya mı?
        </span>
      ) : null}
      <span className="kaynak-pdf-eylemler">
        {dosyaVar ? (
          <button type="button" className="projects-filter-button button-compact" onClick={() => void ac()}>
            <FileCheck2 size={14} aria-hidden="true" /> PDF&apos;i aç
          </button>
        ) : null}
        {satir?.durum === "erisilemedi" && satir.kaynak_adres ? (
          <a className="projects-filter-button button-compact" href={satir.kaynak_adres} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} aria-hidden="true" /> Kaynağa git
          </a>
        ) : null}
        <button
          type="button"
          className={dosyaVar ? "link-button" : "projects-filter-button button-compact"}
          disabled={yukleniyor}
          onClick={() => dosyaRef.current?.click()}
        >
          <FileUp size={14} aria-hidden="true" /> {yukleniyor ? "Yükleniyor…" : dosyaVar ? "Değiştir" : "PDF yükle"}
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
