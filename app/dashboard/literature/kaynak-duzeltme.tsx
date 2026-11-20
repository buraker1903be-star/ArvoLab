"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Wand2, X } from "lucide-react";
import { kaynakDuzeltmeOnerisi, kaynakDuzeltmeUygula } from "@/app/actions/kaynak-duzeltme";
import type { DuzeltmeAlani, DuzeltmeFarki } from "@/lib/kaynak-duzeltme";
import { showToast } from "../_components/toast-events";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  Eski kaynak için ONAYLI düzeltme (20.11.2026, lib/kaynak-duzeltme.ts).
  Öğrenci farkı görür, istediği alanları işaretler ve uygular; hiçbir alan
  kendiliğinden değişmez. Varsayılan olarak hepsi işaretli DEĞİL: öğrenci
  bir alanı bilerek elle düzeltmiş olabilir, kabul onun kararıdır.
*/
const ALAN_ADI: Record<DuzeltmeAlani, { tr: string; en: string }> = {
  authors: { tr: "Yazarlar", en: "Authors" },
  year: { tr: "Yıl", en: "Year" },
  title: { tr: "Başlık", en: "Title" },
  container_title: { tr: "Dergi / kitap", en: "Journal / book" },
  volume: { tr: "Cilt", en: "Volume" },
  issue: { tr: "Sayı", en: "Issue" },
  pages: { tr: "Sayfalar", en: "Pages" },
  publisher: { tr: "Yayınevi", en: "Publisher" },
};

export default function KaynakDuzeltme({ kaynakId, baslik }: { kaynakId: string; baslik: string }) {
  const t = useCeviri();
  const router = useRouter();
  const [durum, setDurum] = useState<"kapali" | "yukleniyor" | "acik" | "uygulaniyor">("kapali");
  const [farklar, setFarklar] = useState<DuzeltmeFarki[]>([]);
  const [secilen, setSecilen] = useState<Set<DuzeltmeAlani>>(new Set());

  const oner = async () => {
    setDurum("yukleniyor");
    const sonuc = await kaynakDuzeltmeOnerisi(kaynakId).catch(() => ({ hata: t({ tr: "Dizine ulaşılamadı.", en: "Couldn't reach the index." }) }));
    if ("hata" in sonuc) {
      setDurum("kapali");
      showToast("error", sonuc.hata);
      return;
    }
    if (!sonuc.farklar.length) {
      setDurum("kapali");
      showToast("success", t({ tr: "Kayıt dizindeki bilgilerle uyumlu; önerilecek düzeltme yok.", en: "The record matches the index; nothing to correct." }));
      return;
    }
    setFarklar(sonuc.farklar);
    setSecilen(new Set());
    setDurum("acik");
  };

  const uygula = async () => {
    setDurum("uygulaniyor");
    const sonuc = await kaynakDuzeltmeUygula(kaynakId, [...secilen]).catch(() => ({ hata: t({ tr: "Düzeltme kaydedilemedi.", en: "The correction couldn't be saved." }) }));
    if ("hata" in sonuc) {
      setDurum("acik");
      showToast("error", sonuc.hata);
      return;
    }
    setDurum("kapali");
    showToast("success", t({ tr: `${sonuc.guncellenen.length} alan dizindeki bilgiyle güncellendi.`, en: `${sonuc.guncellenen.length} field(s) updated from the index.` }));
    router.refresh();
  };

  if (durum === "kapali" || durum === "yukleniyor") {
    return (
      <button type="button" className="projects-filter-button button-compact" disabled={durum === "yukleniyor"} onClick={() => void oner()}>
        <Wand2 size={14} aria-hidden="true" />
        {durum === "yukleniyor" ? t({ tr: "Dizine bakılıyor…", en: "Checking the index…" }) : t({ tr: "Dizinden düzeltme öner", en: "Suggest correction from index" })}
      </button>
    );
  }
  return (
    <div className="kaynak-duzeltme" role="group" aria-label={t({ tr: `${baslik}: dizinden düzeltme önerisi`, en: `${baslik}: correction from index` })}>
      <p className="hint">{t({ tr: "Crossref'teki kayıtla farklı alanlar. Uygulamak istediklerinizi işaretleyin; işaretlemediğiniz alan değişmez.", en: "Fields that differ from the Crossref record. Tick the ones to apply; unticked fields stay as they are." })}</p>
      <table className="kaynak-duzeltme-tablo">
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">{t({ tr: "Uygula", en: "Apply" })}</span></th>
            <th scope="col">{t({ tr: "Alan", en: "Field" })}</th>
            <th scope="col">{t({ tr: "Şimdiki", en: "Current" })}</th>
            <th scope="col">{t({ tr: "Dizindeki", en: "In the index" })}</th>
          </tr>
        </thead>
        <tbody>
          {farklar.map((f) => (
            <tr key={f.alan}>
              <td>
                <input
                  type="checkbox"
                  aria-label={t({ tr: `${ALAN_ADI[f.alan].tr} alanını uygula`, en: `Apply ${ALAN_ADI[f.alan].en}` })}
                  checked={secilen.has(f.alan)}
                  onChange={(e) =>
                    setSecilen((o) => {
                      const y = new Set(o);
                      if (e.target.checked) y.add(f.alan);
                      else y.delete(f.alan);
                      return y;
                    })
                  }
                />
              </td>
              <th scope="row">{t(ALAN_ADI[f.alan])}</th>
              <td className="kaynak-duzeltme-eski">{f.mevcut ?? <em>{t({ tr: "boş", en: "empty" })}</em>}</td>
              <td className="kaynak-duzeltme-yeni">{f.onerilen}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cluster mt-sm">
        <button type="button" className="projects-primary-button button-compact" disabled={!secilen.size || durum === "uygulaniyor"} onClick={() => void uygula()}>
          <Check size={14} aria-hidden="true" />
          {durum === "uygulaniyor" ? t({ tr: "Uygulanıyor…", en: "Applying…" }) : t({ tr: `Seçilenleri uygula (${secilen.size})`, en: `Apply selected (${secilen.size})` })}
        </button>
        <button type="button" className="projects-filter-button button-compact" onClick={() => setDurum("kapali")}>
          <X size={14} aria-hidden="true" /> {t({ tr: "Vazgeç", en: "Cancel" })}
        </button>
      </div>
    </div>
  );
}
