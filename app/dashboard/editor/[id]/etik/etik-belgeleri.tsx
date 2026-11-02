"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp, Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { etikBelgeleriniKaydet, etikYonergesiniTara } from "@/app/actions/etik-kurul";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";
import { EN_COK_BELGE, type BelgeDurumu, type EtikBelge } from "@/lib/etik/belgeler";
import type { Metin } from "@/lib/dil";

/*
  ETİK KURUL BELGE KONTROL LİSTESİ (02.11.2026).

  Liste iki kaynaktan gelir ve kaynağı her satırda yazar: kurulun
  yönergesinde GEÇEN belgeler (sözlükle bulunur, geçtiği cümle "Yönergede
  ne diyor" altında) ve öğrencinin elle eklediği belgeler. "Yönergede
  geçiyor" etiketi yalnızca gerçekten geçen belgeye konur; öğrenci hangi
  maddenin kurula, hangisinin kendi notuna ait olduğunu ayırt edebilmeli.

  Yönerge dosyası tarayıcıdan kullanıcının kendi klasörüne yüklenir,
  sunucu okuyup listeyi çıkarır ve dosyayı siler (app/actions/etik-kurul.ts).
*/
const DURUM_ADI: Record<BelgeDurumu, Metin> = {
  eksik: { tr: "Eksik", en: "Missing" },
  hazirlaniyor: { tr: "Hazırlanıyor", en: "In progress" },
  hazir: { tr: "Hazır", en: "Ready" },
};
const DURUM_TONU: Record<BelgeDurumu, string> = { eksik: "danger", hazirlaniyor: "warning", hazir: "success" };

export default function EtikBelgeleri({ projectId, baslangic, yonergeAdi }: { projectId: string; baslangic: EtikBelge[]; yonergeAdi: string | null }) {
  const t = useCeviri();
  const [belgeler, setBelgeler] = useState<EtikBelge[]>(baslangic);
  const [kirli, setKirli] = useState(false);
  const [yeniAd, setYeniAd] = useState("");
  const [yonerge, setYonerge] = useState(yonergeAdi);
  const [durum, setDurum] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();
  const dosyaKutusu = useRef<HTMLInputElement>(null);

  const degistir = (yeni: EtikBelge[]) => {
    setBelgeler(yeni);
    setKirli(true);
  };

  const kaydet = () =>
    basla(async () => {
      const sonuc = await etikBelgeleriniKaydet(projectId, belgeler);
      if ("error" in sonuc) return showToast("error", sonuc.error);
      setBelgeler(sonuc.belgeler);
      setKirli(false);
      showToast("success", t({ tr: "Belge listesi kaydedildi.", en: "Document list saved." }));
    });

  const yonergeyiOku = async (dosya: File) => {
    const ad = dosya.name.toLowerCase();
    if (!ad.endsWith(".pdf") && !ad.endsWith(".docx")) {
      showToast("error", t({ tr: "Yönergeyi PDF ya da Word (.docx) olarak yükleyin.", en: "Upload the guideline as a PDF or Word (.docx) file." }));
      return;
    }
    if (dosya.size > 20 * 1024 * 1024) {
      showToast("error", t({ tr: "Dosya 20 MB sınırını aşıyor.", en: "The file exceeds the 20 MB limit." }));
      return;
    }
    if (kirli) {
      showToast("error", t({ tr: "Önce listedeki değişiklikleri kaydedin; yönerge kayıtlı listeye eklenir.", en: "Save your list changes first; the guideline is merged into the saved list." }));
      return;
    }
    basla(async () => {
      try {
        setDurum(t({ tr: "Yönerge yükleniyor…", en: "Uploading the guideline…" }));
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          showToast("error", t({ tr: "Oturumunuz sona erdi. Yeniden giriş yapın.", en: "Your session has expired. Sign in again." }));
          return;
        }
        const yol = `${user.id}/etik/${Date.now()}-${dosya.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error } = await supabase.storage.from("project-files").upload(yol, dosya, { contentType: dosya.type || undefined, upsert: false });
        if (error) {
          console.error(error);
          showToast("error", t({ tr: "Dosya yüklenemedi. Yeniden deneyin.", en: "The file could not be uploaded. Try again." }));
          return;
        }
        setDurum(t({ tr: "Yönerge okunuyor… Taranmış bir belgeyse yarım dakikayı bulabilir.", en: "Reading the guideline… A scanned document can take up to half a minute." }));
        const sonuc = await etikYonergesiniTara(projectId, yol, dosya.name);
        if ("error" in sonuc) {
          showToast("error", sonuc.error);
          return;
        }
        setBelgeler(sonuc.belgeler);
        setYonerge(dosya.name);
        setKirli(false);
        showToast(
          "success",
          sonuc.bulunan
            ? t({ tr: `Yönergede ${sonuc.bulunan} belge bulundu ve listeye eklendi.`, en: `${sonuc.bulunan} document(s) found in the guideline and added to the list.` })
            : t({ tr: "Yönergede tanınan bir belge adı bulunamadı; kurulun istediklerini elle ekleyin.", en: "No known document names were found in the guideline; add what the committee requires by hand." }),
        );
      } finally {
        setDurum(null);
        if (dosyaKutusu.current) dosyaKutusu.current.value = "";
      }
    });
  };

  const elleEkle = () => {
    const ad = yeniAd.replace(/\s+/g, " ").trim();
    if (!ad) return;
    if (belgeler.length >= EN_COK_BELGE) return showToast("error", t({ tr: `En fazla ${EN_COK_BELGE} belge eklenebilir.`, en: `You can add at most ${EN_COK_BELGE} documents.` }));
    let n = 1;
    while (belgeler.some((b) => b.anahtar === `elle-${n}`)) n += 1;
    degistir([...belgeler, { anahtar: `elle-${n}`, ad: ad.slice(0, 200), durum: "eksik", kaynak: "elle", alinti: null }]);
    setYeniAd("");
  };

  const hazir = belgeler.filter((b) => b.durum === "hazir").length;

  return (
    <div className="etik-belgeler">
      <div className="etik-yonerge">
        <div>
          <b>{t({ tr: "Kurulun yönergesi", en: "Committee guideline" })}</b>
          <small>
            {yonerge
              ? t({ tr: `Son okunan: ${yonerge}`, en: `Last read: ${yonerge}` })
              : t({
                  tr: "Etik kurulunuzun başvuru yönergesini ya da formunu yükleyin; istenen belgeleri listeye çıkaralım. Dosya okunduktan sonra silinir.",
                  en: "Upload your ethics committee's application guideline or form and we'll list the required documents. The file is deleted after reading.",
                })}
          </small>
        </div>
        <label className="projects-filter-button button-compact etik-yukle">
          <FileUp size={15} aria-hidden="true" />
          {yonerge ? t({ tr: "Yeni yönerge oku", en: "Read a new guideline" }) : t({ tr: "Yönerge yükle", en: "Upload guideline" })}
          <input
            ref={dosyaKutusu}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            disabled={bekliyor}
            onChange={(e) => {
              const dosya = e.target.files?.[0];
              if (dosya) void yonergeyiOku(dosya);
            }}
          />
        </label>
      </div>
      {durum ? <p className="muted text-sm" role="status">{durum}</p> : null}

      {belgeler.length ? (
        <>
          <p className="muted text-sm">{t({ tr: `${belgeler.length} belgeden ${hazir} tanesi hazır.`, en: `${hazir} of ${belgeler.length} documents ready.` })}</p>
          <ul className="etik-liste">
            {belgeler.map((b, sira) => (
              <li key={b.anahtar} data-tone={DURUM_TONU[b.durum]}>
                <div className="etik-satir-govde">
                  <b>{b.ad}</b>
                  <span className="etik-kaynak" data-kaynak={b.kaynak}>
                    {b.kaynak === "yonerge" ? t({ tr: "Yönergede geçiyor", en: "In the guideline" }) : t({ tr: "Elle eklendi", en: "Added by you" })}
                  </span>
                  {b.kaynak === "yonerge" && b.alinti ? (
                    <details>
                      <summary>{t({ tr: "Yönergede ne diyor", en: "What the guideline says" })}</summary>
                      <q>{b.alinti}</q>
                    </details>
                  ) : null}
                </div>
                <select
                  aria-label={t({ tr: `${b.ad} durumu`, en: `${b.ad} status` })}
                  value={b.durum}
                  onChange={(e) => degistir(belgeler.map((x, i) => (i === sira ? { ...x, durum: e.target.value as BelgeDurumu } : x)))}
                >
                  {(Object.keys(DURUM_ADI) as BelgeDurumu[]).map((d) => (
                    <option key={d} value={d}>{t(DURUM_ADI[d])}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="dashboard-icon-button"
                  aria-label={t({ tr: `${b.ad} satırını kaldır`, en: `Remove ${b.ad}` })}
                  onClick={() => degistir(belgeler.filter((_, i) => i !== sira))}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="gb-bos">{t({ tr: "Henüz belge yok. Yönergeyi yükleyin ya da belgeleri elle ekleyin.", en: "No documents yet. Upload the guideline or add documents by hand." })}</p>
      )}

      <div className="etik-ekle">
        <input
          type="text"
          className="field-control"
          value={yeniAd}
          maxLength={200}
          placeholder={t({ tr: "Belge adı (ör. etik eğitim sertifikası)", en: "Document name (e.g. ethics training certificate)" })}
          aria-label={t({ tr: "Eklenecek belgenin adı", en: "Name of the document to add" })}
          onChange={(e) => setYeniAd(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              elleEkle();
            }
          }}
        />
        <button type="button" className="projects-filter-button button-compact" onClick={elleEkle} disabled={!yeniAd.trim()}>
          <Plus size={15} aria-hidden="true" /> {t({ tr: "Ekle", en: "Add" })}
        </button>
        <button type="button" className="projects-primary-button button-compact" onClick={kaydet} disabled={!kirli || bekliyor}>
          <Save size={15} aria-hidden="true" /> {bekliyor ? t({ tr: "Kaydediliyor…", en: "Saving…" }) : t({ tr: "Listeyi kaydet", en: "Save list" })}
        </button>
      </div>
    </div>
  );
}
