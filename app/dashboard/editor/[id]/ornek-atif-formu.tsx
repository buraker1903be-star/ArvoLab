"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ornekAtifKaydet } from "@/app/actions/calisma-kilavuzu";
import { kalipOzeti, ornekKalibi } from "@/lib/atif/tyk";
import { showToast } from "@/app/dashboard/_components/toast-events";

/*
  KILAVUZUN ÖRNEK ATIFI (kılavuz penceresi). Öğrenci ya da kurum
  çalışanı kılavuzdaki örneği bir kez yapıştırıyor; yazarken hangi
  kuralların okunduğu canlı görünüyor ("Yazar ile yıl arasında virgül,
  yıl ile sayfa arasında ':'"). Yanlış okunursa kaydetmeden görülsün.
*/
export default function OrnekAtifFormu({ projectId, mevcut }: { projectId: string; mevcut: string | null }) {
  const router = useRouter();
  const [deger, setDeger] = useState(mevcut ?? "");
  const [bekleniyor, basla] = useTransition();
  const kalip = ornekKalibi(deger);
  const degisti = deger.trim() !== (mevcut ?? "");

  return (
    <div className="ornek-atif">
      <label className="dialog-field">
        <span>Kılavuzunuzdaki örnek atıf</span>
        <input
          className="picker-search"
          value={deger}
          maxLength={300}
          onChange={(e) => setDeger(e.target.value)}
          placeholder="Kılavuzdaki örneği yapıştırın, ör. (Yılmaz, 2020: 14)"
        />
      </label>
      {deger.trim() ? (
        kalip ? (
          <ul className="ornek-atif-kurallar">
            {kalipOzeti(kalip).map((satir) => (
              <li key={satir}>{satir}</li>
            ))}
          </ul>
        ) : (
          <p className="tone-text text-sm" data-tone="warning">
            Parantez içinde yazar ve yıl olan bir atıf bulunamadı.
          </p>
        )
      ) : (
        <p className="hint">
          Girerseniz kaynakça denetimi atıflarınızı bu örneğin noktalamasına göre (virgül, iki nokta, “s.”) denetler ve
          editör atıfları bu biçimde yazar.
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
            showToast("success", deger.trim() ? "Örnek atıf kaydedildi." : "Örnek atıf kaldırıldı.");
            router.refresh();
          })
        }
      >
        {bekleniyor ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </div>
  );
}
