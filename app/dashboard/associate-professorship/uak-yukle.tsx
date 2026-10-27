"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uakPdfiKaydet } from "@/app/actions/uak-tablosu";
import { PDF_EN_FAZLA_BAYT } from "@/lib/kaynak-pdf";
import { announceActionSuccess, showToast } from "../_components/toast-events";

/*
  ÜAK PDF'ini yükleme formu. Dosya tarayıcıdan doğrudan kullanıcının
  klasörüne gidiyor (project-files/<kişi>/uak/…; sunucu eylemi 20 MB'lık
  bir gövdeyi taşıyamaz); sunucu PDF'i doğrulayıp tabloya bağlıyor
  (uakPdfiKaydet). Aynı temel alanın eski tablosu varsa yerine geçer.
*/
export default function UakYukle({
  kullaniciId,
  alanlar,
  donemler,
  varsayilanAlan,
}: {
  kullaniciId: string;
  alanlar: string[];
  donemler: string[];
  varsayilanAlan: string | null;
}) {
  const router = useRouter();
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const gonder = async (form: HTMLFormElement) => {
    const veri = new FormData(form);
    const temelAlan = String(veri.get("temelAlan") ?? "").trim();
    const donem = String(veri.get("donem") ?? "").trim();
    const dosya = veri.get("pdf");
    if (!temelAlan || !donem || !(dosya instanceof File) || !dosya.size) {
      setHata("Temel alan, dönem ve PDF zorunlu.");
      return;
    }
    if (dosya.type !== "application/pdf" && !dosya.name.toLowerCase().endsWith(".pdf")) {
      setHata("Yalnızca PDF yüklenebilir.");
      return;
    }
    if (dosya.size > PDF_EN_FAZLA_BAYT) {
      setHata("PDF en fazla 20 MB olabilir.");
      return;
    }
    setHata(null);
    setMesgul(true);
    try {
      const yol = `${kullaniciId}/uak/${Date.now()}.pdf`;
      const { error } = await createClient().storage.from("project-files").upload(yol, dosya, { contentType: "application/pdf", upsert: false });
      if (error) {
        console.error(error);
        setHata("Dosya yüklenemedi; tekrar deneyin.");
        return;
      }
      const sonuc = await uakPdfiKaydet({ temelAlan, donem, yol, dosyaAdi: dosya.name });
      if (sonuc.error) {
        setHata(sonuc.error);
        return;
      }
      showToast("success", sonuc.message ?? "Tablo yüklendi.");
      form.reset();
      announceActionSuccess();
      router.refresh();
    } finally {
      setMesgul(false);
    }
  };

  return (
    <form
      className="project-form-grid"
      aria-busy={mesgul}
      onSubmit={(e) => {
        e.preventDefault();
        void gonder(e.currentTarget);
      }}
    >
      {hata ? (
        <p className="alert project-form-full" data-tone="danger" role="alert">
          {hata}
        </p>
      ) : null}
      <label>
        <span>Temel alan</span>
        <input name="temelAlan" type="text" list="uak-temel-alanlar" defaultValue={varsayilanAlan ?? ""} placeholder="PDF'teki adıyla" required />
        <datalist id="uak-temel-alanlar">
          {alanlar.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </label>
      <label>
        <span>Başvuru dönemi</span>
        <select name="donem" defaultValue={donemler[0]}>
          {donemler.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className="project-form-full">
        <span>ÜAK PDF&apos;i</span>
        <input name="pdf" type="file" accept="application/pdf,.pdf" required />
      </label>
      <p className="hint project-form-full">
        Bu temel alanın önceki tablosu varsa yerine geçer ve eski PDF silinir. Mevcut kriterler, yeni tabloyu yorumlatıp
        onaylayana kadar yürürlükte kalır.
      </p>
      <div className="project-form-actions">
        <button type="submit" className="projects-primary-button" disabled={mesgul}>
          <FileUp size={16} aria-hidden="true" /> {mesgul ? "Yükleniyor…" : "Yükle"}
        </button>
      </div>
    </form>
  );
}
