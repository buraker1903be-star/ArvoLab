"use client";

import { useState, useTransition } from "react";
import { MessageSquareHeart } from "lucide-react";
import ActionForm from "../action-form";
import { geriBildirimErtele, geriBildirimGonder, geriBildirimIstemiyorum } from "@/app/actions/geri-bildirim";
import { BAGLAM_METNI_METIN, BOLUM_SECENEKLERI_METIN, PUAN_ETIKETLERI_METIN } from "@/lib/geri-bildirim";
import { useCeviri } from "@/app/_components/dil-saglayici";
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
  const t = useCeviri();
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

  const baglamMetni = baglam && BAGLAM_METNI_METIN[baglam] ? t(BAGLAM_METNI_METIN[baglam]) : null;

  return (
    <section className="geri-bildirim-karti" aria-label={t({ tr: "Kullanım geri bildirimi", en: "Usage feedback" })}>
      <div className="geri-bildirim-bas">
        <span className="dashboard-kicker">
          <MessageSquareHeart size={14} aria-hidden="true" />
          {t({ tr: "Sizden bir dakika", en: "One minute of your time" })}
        </span>
        <div className="geri-bildirim-kapat">
          <button type="button" onClick={() => kapat(geriBildirimErtele, t({ tr: "Sonra soracağız.", en: "We'll ask later." }))} disabled={bekliyor}>
            {t({ tr: "Sonra", en: "Later" })}
          </button>
          <button
            type="button"
            onClick={() => kapat(geriBildirimIstemiyorum, t({ tr: "Bir daha sormayacağız.", en: "We won't ask again." }))}
            disabled={bekliyor}
          >
            {t({ tr: "Bir daha sorma", en: "Don't ask again" })}
          </button>
        </div>
      </div>

      <h2>{t({ tr: "ArvoLab işinizi kolaylaştırdı mı?", en: "Has ArvoLab made your work easier?" })}</h2>
      <p className="muted text-sm">
        {baglamMetni
          ? t({
              tr: `Az önceki kullanımınız (${baglamMetni}) için soruyoruz. `,
              en: `We're asking about what you just used (${baglamMetni}). `,
            })
          : ""}
        {t({
          tr: "Cevabınız yalnızca ArvoLab yönetimine gider ve neyi önce geliştireceğimizi belirler.",
          en: "Your answer goes only to the ArvoLab team and decides what we improve first.",
        })}
      </p>

      <ActionForm
        className="geri-bildirim-form"
        action={geriBildirimGonder}
        successMessage={t({ tr: "Teşekkürler; geri bildiriminiz bize ulaştı.", en: "Thank you; your feedback has reached us." })}
      >
        <input type="hidden" name="context" value={baglam ?? ""} />
        <input type="hidden" name="score" value={puan ?? ""} />

        <div className="geri-bildirim-puanlar" role="group" aria-label={t({ tr: "Puan", en: "Rating" })}>
          {[1, 2, 3, 4, 5].map((deger) => (
            <button
              key={deger}
              type="button"
              className="geri-bildirim-puan"
              aria-pressed={puan === deger}
              onClick={() => setPuan(deger)}
            >
              <strong>{deger}</strong>
              <span>{t(PUAN_ETIKETLERI_METIN[deger])}</span>
            </button>
          ))}
        </div>

        {puan ? (
          <div className="geri-bildirim-detay">
            <label>
              <span>{t({ tr: "En çok neyi kullandınız?", en: "What did you use most?" })}</span>
              <select name="most_used" defaultValue="">
                <option value="">{t({ tr: "Belirtmek istemiyorum", en: "Prefer not to say" })}</option>
                {BOLUM_SECENEKLERI_METIN.map((secenek) => (
                  <option key={secenek.deger} value={secenek.deger}>
                    {t(secenek.etiket)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t({ tr: "Eksik bulduğunuz, zorlandığınız bir yer var mı? (isteğe bağlı)", en: "Anything missing or hard to use? (optional)" })}</span>
              <textarea name="comment" rows={3} maxLength={2000} placeholder={t({ tr: "Tek cümle bile yeter.", en: "Even one sentence helps." })} />
            </label>
            <button type="submit" className="projects-primary-button button-compact">
              {t({ tr: "Gönder", en: "Send" })}
            </button>
          </div>
        ) : null}
      </ActionForm>
    </section>
  );
}
