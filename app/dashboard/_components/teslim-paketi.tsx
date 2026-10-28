"use client";

import { useState } from "react";
import { zipSync, strToU8 } from "fflate";
import { PackageCheck } from "lucide-react";
import { teslimPaketi } from "@/app/actions/kaynak-pdf";
import { KAYNAK_KLASORU, paketAdi, RAPOR_DOSYASI } from "@/lib/kaynak-pdf";
import { dosyayiKaydet, wordBlobu } from "./word-indir";
import { showToast } from "./toast-events";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";

/*
  TESLİM PAKETİ (ZIP): tez Word dosyası + "Kaynaklar" klasöründe kaynak
  PDF'leri + "Kaynak raporu.txt" (kurum sahibinin isteği: "çalışmayı
  bitirip indirdiğinde zip şeklinde, tez dokümanı ve kaynakların bir
  arada olduğu PDF klasörü ile").

  ZIP TARAYICIDA kuruluyor: sunucunun tek yanıt sınırı (~4,5 MB) birkaç
  PDF'le aşılır. PDF'ler depodan kısa ömürlü bağlantılarla iniyor;
  sıkıştırılmıyor (PDF ve DOCX zaten sıkıştırılmış, tekrar sıkıştırmak
  yalnızca bekletir). Bir PDF inemezse paket yine iner, rapor eksik olanı
  yazar — tek dosya yüzünden bütün paket düşmemeli.
*/
export default function TeslimPaketi({
  projectId,
  className = "projects-filter-button button-compact",
  etiket,
}: {
  projectId: string;
  className?: string;
  etiket?: string;
}) {
  const t = useCeviri();
  const dil = useDil();
  const [durum, setDurum] = useState<string | null>(null);

  const indir = async () => {
    setDurum(t({ tr: "Hazırlanıyor…", en: "Preparing…" }));
    try {
      const [paket, word] = await Promise.all([teslimPaketi(projectId), wordBlobu(projectId, dil)]);
      if (paket.error || !paket.baslik) {
        showToast("error", paket.error ?? t({ tr: "Paket hazırlanamadı.", en: "The package could not be prepared." }));
        return;
      }
      if ("hata" in word) {
        showToast("error", word.hata);
        return;
      }

      const dosyalar: Record<string, [Uint8Array, { level: 0 }]> = {};
      dosyalar[word.ad] = [new Uint8Array(await word.blob.arrayBuffer()), { level: 0 }];
      const inemeyen: string[] = [];
      const pdfler = paket.dosyalar ?? [];
      for (let i = 0; i < pdfler.length; i++) {
        setDurum(t({ tr: `Kaynaklar iniyor… ${i + 1}/${pdfler.length}`, en: `Downloading sources… ${i + 1}/${pdfler.length}` }));
        try {
          const yanit = await fetch(pdfler[i].url);
          if (!yanit.ok) throw new Error(String(yanit.status));
          dosyalar[`${KAYNAK_KLASORU[dil]}/${pdfler[i].ad}`] = [new Uint8Array(await yanit.arrayBuffer()), { level: 0 }];
        } catch {
          inemeyen.push(pdfler[i].ad);
        }
      }
      const rapor =
        (paket.rapor ?? "") +
        (inemeyen.length
          ? t({
              tr: `\r\nBu indirmede inemeyen dosyalar (tekrar deneyin): ${inemeyen.join(", ")}\r\n`,
              en: `\r\nFiles that failed to download this time (try again): ${inemeyen.join(", ")}\r\n`,
            })
          : "");
      dosyalar[RAPOR_DOSYASI[dil]] = [strToU8(rapor), { level: 0 }];

      setDurum(t({ tr: "Paketleniyor…", en: "Packaging…" }));
      const zip = zipSync(dosyalar);
      dosyayiKaydet(new Blob([zip as BlobPart], { type: "application/zip" }), paketAdi(paket.baslik, dil));
      showToast(
        inemeyen.length ? "error" : "success",
        inemeyen.length
          ? t({
              tr: `Paket indi; ${inemeyen.length} kaynak PDF'i inemedi (raporda yazıyor).`,
              en: `Package downloaded; ${inemeyen.length} source PDF${inemeyen.length === 1 ? "" : "s"} failed (listed in the report).`,
            })
          : t({
              tr: `Paket indi: tez ve ${pdfler.length} kaynak PDF'i.`,
              en: `Package downloaded: the thesis and ${pdfler.length} source PDF${pdfler.length === 1 ? "" : "s"}.`,
            }),
      );
    } catch (hata) {
      console.error(hata);
      showToast("error", t({ tr: "Paket hazırlanamadı; tekrar deneyin.", en: "The package could not be prepared; try again." }));
    } finally {
      setDurum(null);
    }
  };

  return (
    <button type="button" className={className} disabled={durum !== null} onClick={() => void indir()}>
      <PackageCheck size={15} aria-hidden="true" /> {durum ?? etiket ?? t({ tr: "Teslim paketi (ZIP)", en: "Submission package (ZIP)" })}
    </button>
  );
}
