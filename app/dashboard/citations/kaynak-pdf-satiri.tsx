"use client";

import { useRef, useState } from "react";
import { ExternalLink, FileCheck2, FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { kaynakPdfiYuklendi } from "@/app/actions/kaynak-pdf";
import { PDF_EN_FAZLA_BAYT, type KaynakPdfSatiri } from "@/lib/kaynak-pdf";
import { showToast } from "../_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";
import type { Metin } from "@/lib/dil";

/*
  Bir künyenin PDF durumu ve eylemi (Kaynakça penceresindeki her kaynak
  kartının altında). Durumun sözü öğrenciye ne yapacağını söylüyor:
  "Açık erişim PDF yok → kendi PDF'inizi yükleyin" gibi. "Kayıt yok"
  sahte demek DEĞİL; künyeye bakılması gerektiğini söylüyor.
*/

const DURUM: Record<KaynakPdfSatiri["durum"], { etiket: Metin; ton: string }> = {
  indirildi: { etiket: { tr: "PDF hazır · açık erişim", en: "PDF ready · open access" }, ton: "success" },
  yuklendi: { etiket: { tr: "PDF yüklendi", en: "PDF uploaded" }, ton: "success" },
  bulunamadi: { etiket: { tr: "Açık erişim PDF yok · siz yükleyin", en: "No open-access PDF · upload your own" }, ton: "warning" },
  erisilemedi: { etiket: { tr: "PDF indirilemedi · siz yükleyin", en: "PDF couldn't be downloaded · upload your own" }, ton: "warning" },
  kayit_yok: { etiket: { tr: "Dizinde kayıt yok · künyeyi kontrol edin", en: "No index record · check the reference" }, ton: "danger" },
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
  const t = useCeviri();
  const dosyaRef = useRef<HTMLInputElement>(null);
  const [yukleniyor, setYukleniyor] = useState(false);

  const ac = async () => {
    if (!satir?.depo_yolu) return;
    const { data, error } = await createClient().storage.from("project-files").createSignedUrl(satir.depo_yolu, 600);
    if (error || !data?.signedUrl) {
      showToast("error", t({ tr: "PDF açılamadı; tekrar deneyin.", en: "Couldn't open the PDF; please try again." }));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const yukle = async (dosya: File) => {
    if (dosya.type !== "application/pdf" && !dosya.name.toLowerCase().endsWith(".pdf")) {
      showToast("error", t({ tr: "Yalnızca PDF yüklenebilir.", en: "Only PDFs can be uploaded." }));
      return;
    }
    if (dosya.size > PDF_EN_FAZLA_BAYT) {
      showToast("error", t({ tr: "PDF en fazla 20 MB olabilir.", en: "PDFs can be at most 20 MB." }));
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
        showToast("error", t({ tr: "Dosya yüklenemedi; tekrar deneyin.", en: "Couldn't upload the file; please try again." }));
        return;
      }
      const sonuc = await kaynakPdfiYuklendi(projectId, { kunye, doi, depoYolu: yol });
      if (sonuc.error || !sonuc.satir) {
        showToast("error", sonuc.error ?? t({ tr: "Kaydedilemedi.", en: "Couldn't save." }));
        return;
      }
      onGuncelle(sonuc.satir);
      showToast(
        sonuc.satir.baslik_eslesti === false ? "error" : "success",
        sonuc.satir.baslik_eslesti === false
          ? t({
              tr: "PDF yüklendi, ama künyenin başlığı PDF'te bulunamadı. Doğru dosya olduğundan emin olun.",
              en: "PDF uploaded, but the reference's title wasn't found in the PDF. Make sure it's the right file.",
            })
          : t({ tr: "PDF yüklendi.", en: "PDF uploaded." }),
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
          {t(durum.etiket)}
        </span>
      ) : (
        <span className="muted text-sm">{t({ tr: "PDF'e henüz bakılmadı", en: "PDF not checked yet" })}</span>
      )}
      {satir?.durum === "yuklendi" && satir.baslik_eslesti === false ? (
        <span className="tone-text text-sm" data-tone="warning">
          {t({ tr: "Başlık PDF'te bulunamadı; doğru dosya mı?", en: "Title not found in the PDF; is this the right file?" })}
        </span>
      ) : null}
      <span className="kaynak-pdf-eylemler">
        {dosyaVar ? (
          <button type="button" className="projects-filter-button button-compact" onClick={() => void ac()}>
            <FileCheck2 size={14} aria-hidden="true" /> {t({ tr: "PDF'i aç", en: "Open PDF" })}
          </button>
        ) : null}
        {satir?.durum === "erisilemedi" && satir.kaynak_adres ? (
          <a className="projects-filter-button button-compact" href={satir.kaynak_adres} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} aria-hidden="true" /> {t({ tr: "Kaynağa git", en: "Go to source" })}
          </a>
        ) : null}
        <button
          type="button"
          className={dosyaVar ? "link-button" : "projects-filter-button button-compact"}
          disabled={yukleniyor}
          onClick={() => dosyaRef.current?.click()}
        >
          <FileUp size={14} aria-hidden="true" /> {yukleniyor ? t({ tr: "Yükleniyor…", en: "Uploading…" }) : dosyaVar ? t({ tr: "Değiştir", en: "Replace" }) : t({ tr: "PDF yükle", en: "Upload PDF" })}
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
