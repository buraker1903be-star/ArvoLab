"use client";

import { useState } from "react";
import { zipSync, strToU8 } from "fflate";
import { PackageCheck } from "lucide-react";
import { teslimPaketi } from "@/app/actions/kaynak-pdf";
import { paketAdi } from "@/lib/kaynak-pdf";
import { dosyayiKaydet, wordBlobu } from "./word-indir";
import { showToast } from "./toast-events";

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
  etiket = "Teslim paketi (ZIP)",
}: {
  projectId: string;
  className?: string;
  etiket?: string;
}) {
  const [durum, setDurum] = useState<string | null>(null);

  const indir = async () => {
    setDurum("Hazırlanıyor…");
    try {
      const [paket, word] = await Promise.all([teslimPaketi(projectId), wordBlobu(projectId)]);
      if (paket.error || !paket.baslik) {
        showToast("error", paket.error ?? "Paket hazırlanamadı.");
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
        setDurum(`Kaynaklar iniyor… ${i + 1}/${pdfler.length}`);
        try {
          const yanit = await fetch(pdfler[i].url);
          if (!yanit.ok) throw new Error(String(yanit.status));
          dosyalar[`Kaynaklar/${pdfler[i].ad}`] = [new Uint8Array(await yanit.arrayBuffer()), { level: 0 }];
        } catch {
          inemeyen.push(pdfler[i].ad);
        }
      }
      const rapor =
        (paket.rapor ?? "") +
        (inemeyen.length ? `\r\nBu indirmede inemeyen dosyalar (tekrar deneyin): ${inemeyen.join(", ")}\r\n` : "");
      dosyalar["Kaynak raporu.txt"] = [strToU8(rapor), { level: 0 }];

      setDurum("Paketleniyor…");
      const zip = zipSync(dosyalar);
      dosyayiKaydet(new Blob([zip as BlobPart], { type: "application/zip" }), paketAdi(paket.baslik));
      showToast(
        inemeyen.length ? "error" : "success",
        inemeyen.length
          ? `Paket indi; ${inemeyen.length} kaynak PDF'i inemedi (raporda yazıyor).`
          : `Paket indi: tez ve ${pdfler.length} kaynak PDF'i.`,
      );
    } catch (hata) {
      console.error(hata);
      showToast("error", "Paket hazırlanamadı; tekrar deneyin.");
    } finally {
      setDurum(null);
    }
  };

  return (
    <button type="button" className={className} disabled={durum !== null} onClick={() => void indir()}>
      <PackageCheck size={15} aria-hidden="true" /> {durum ?? etiket}
    </button>
  );
}
