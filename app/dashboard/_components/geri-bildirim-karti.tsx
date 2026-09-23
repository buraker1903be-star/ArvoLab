"use client";

import { useState, useTransition } from "react";
import { MessageSquareHeart } from "lucide-react";
import ActionForm from "../action-form";
import { geriBildirimErtele, geriBildirimGonder, geriBildirimIstemiyorum } from "@/app/actions/geri-bildirim";
import { BAGLAM_METNI, BOLUM_SECENEKLERI, PUAN_ETIKETLERI } from "@/lib/geri-bildirim";
import { showToast } from "./toast-events";

/*
  Kullanım geri bildirimi kartı. Ana sayfada, yalnızca kullanıcı sistemi
  gerçekten kullandıktan sonra ve yalnızca bir kez görünür (kural:
  lib/geri-bildirim.ts).

  Soru tek adımda açılmıyor: önce beş puan görünüyor, biri seçilince
  gerisi (bölüm ve yorum) iniyor. Uzun bir form ana sayfanın ortasında
  duvar gibi durur ve kimse doldurmaz; tek tık her zaman yapılır, gerisi
  isteyene kalır.
*/
export default function GeriBildirimKarti({ baglam }: { baglam: string | null }) {
  const [puan, setPuan] = useState<number | null>(null);
  const [gizli, setGizli] = useState(false);
  const [bekliyor, startTransition] = useTransition();

  if (gizli) return null;

  const kapat = (eylem: () => Promise<{ error?: string }>, mesaj: string) => {
    startTransition(async () => {
      const sonuc = await eylem();
      if (sonuc?.error) {
        showToast("error", sonuc.error);
        return;
      }
      setGizli(true);
      showToast("success", mesaj);
    });
  };

  const baglamMetni = baglam ? BAGLAM_METNI[baglam] : null;

  return (
    <section className="geri-bildirim-karti" aria-label="Kullanım geri bildirimi">
      <div className="geri-bildirim-bas">
        <span className="dashboard-kicker">
          <MessageSquareHeart size={14} aria-hidden="true" />
          Sizden bir dakika
        </span>
        <div className="geri-bildirim-kapat">
          <button type="button" onClick={() => kapat(geriBildirimErtele, "Sonra soracağız.")} disabled={bekliyor}>
            Sonra
          </button>
          <button
            type="button"
            onClick={() => kapat(geriBildirimIstemiyorum, "Bir daha sormayacağız.")}
            disabled={bekliyor}
          >
            Bir daha sorma
          </button>
        </div>
      </div>

      <h2>ArvoLab işinizi kolaylaştırdı mı?</h2>
      <p className="muted text-sm">
        {baglamMetni ? `Az önceki kullanımınız (${baglamMetni}) için soruyoruz. ` : ""}
        Cevabınız yalnızca ArvoLab yönetimine gider ve neyi önce geliştireceğimizi belirler.
      </p>

      <ActionForm
        className="geri-bildirim-form"
        action={geriBildirimGonder}
        successMessage="Teşekkürler; geri bildiriminiz bize ulaştı."
      >
        <input type="hidden" name="context" value={baglam ?? ""} />
        <input type="hidden" name="score" value={puan ?? ""} />

        <div className="geri-bildirim-puanlar" role="group" aria-label="Puan">
          {[1, 2, 3, 4, 5].map((deger) => (
            <button
              key={deger}
              type="button"
              className="geri-bildirim-puan"
              aria-pressed={puan === deger}
              onClick={() => setPuan(deger)}
            >
              <strong>{deger}</strong>
              <span>{PUAN_ETIKETLERI[deger]}</span>
            </button>
          ))}
        </div>

        {puan ? (
          <div className="geri-bildirim-detay">
            <label>
              <span>En çok neyi kullandınız?</span>
              <select name="most_used" defaultValue="">
                <option value="">Belirtmek istemiyorum</option>
                {BOLUM_SECENEKLERI.map((secenek) => (
                  <option key={secenek.deger} value={secenek.deger}>
                    {secenek.etiket}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Eksik bulduğunuz, zorlandığınız bir yer var mı? (isteğe bağlı)</span>
              <textarea name="comment" rows={3} maxLength={2000} placeholder="Tek cümle bile yeter." />
            </label>
            <button type="submit" className="projects-primary-button button-compact">
              Gönder
            </button>
          </div>
        ) : null}
      </ActionForm>
    </section>
  );
}
