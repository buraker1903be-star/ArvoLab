"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ornekAtifKaydet } from "@/app/actions/calisma-kilavuzu";
import { kalipOzeti, ornekKalibi } from "@/lib/atif/tyk";
import { showToast } from "@/app/dashboard/_components/toast-events";
import { useCeviri, useDil } from "@/app/_components/dil-saglayici";

/*
  KILAVUZUN ÖRNEK ATIFI (kılavuz penceresi). Öğrenci ya da kurum
  çalışanı kılavuzdaki örneği bir kez yapıştırıyor; yazarken hangi
  kuralların okunduğu canlı görünüyor ("Yazar ile yıl arasında virgül,
  yıl ile sayfa arasında ':'"). Yanlış okunursa kaydetmeden görülsün.
*/
export default function OrnekAtifFormu({ projectId, mevcut }: { projectId: string; mevcut: string | null }) {
  const t = useCeviri();
  const dil = useDil();
  const router = useRouter();
  const [deger, setDeger] = useState(mevcut ?? "");
  const [bekleniyor, basla] = useTransition();
  const kalip = ornekKalibi(deger);
  const degisti = deger.trim() !== (mevcut ?? "");

  return (
    <div className="ornek-atif">
      <label className="dialog-field">
        <span>{t({ tr: "Kılavuzunuzdaki örnek atıf", en: "Example citation from your guideline" })}</span>
        <input
          className="picker-search"
          value={deger}
          maxLength={300}
          onChange={(e) => setDeger(e.target.value)}
          placeholder={t({ tr: "Kılavuzdaki örneği yapıştırın, ör. (Yılmaz, 2020: 14)", en: "Paste the example from the guideline, e.g. (Smith, 2020: 14)" })}
        />
      </label>
      {deger.trim() ? (
        kalip ? (
          <ul className="ornek-atif-kurallar">
            {kalipOzeti(kalip, dil).map((satir) => (
              <li key={satir}>{satir}</li>
            ))}
          </ul>
        ) : (
          <p className="tone-text text-sm" data-tone="warning">
            {t({ tr: "Parantez içinde yazar ve yıl olan bir atıf bulunamadı.", en: "No citation with an author and year in parentheses was found." })}
          </p>
        )
      ) : (
        <p className="hint">
          {t({
            tr: "Girerseniz kaynakça denetimi atıflarınızı bu örneğin noktalamasına göre (virgül, iki nokta, “s.”) denetler ve editör atıfları bu biçimde yazar.",
            en: "If you enter one, the reference check checks your citations against this example's punctuation (comma, colon, “p.”) and the editor writes citations in this format.",
          })}
        </p>
      )}
      <button
        type="button"
        className="projects-filter-button button-compact"
        disabled={bekleniyor || !degisti || (Boolean(deger.trim()) && !kalip)}
        onClick={() =>
          basla(async () => {
            const sonuc = await ornekAtifKaydet(projectId, deger);
            if (sonuc.error) {
              showToast("error", sonuc.error);
              return;
            }
            showToast("success", deger.trim()
                ? t({ tr: "Örnek atıf kaydedildi.", en: "Example citation saved." })
                : t({ tr: "Örnek atıf kaldırıldı.", en: "Example citation removed." }));
            router.refresh();
          })
        }
      >
        {bekleniyor ? t({ tr: "Kaydediliyor…", en: "Saving…" }) : t({ tr: "Kaydet", en: "Save" })}
      </button>
    </div>
  );
}
