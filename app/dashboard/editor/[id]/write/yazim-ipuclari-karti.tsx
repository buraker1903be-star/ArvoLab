"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Lightbulb } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import YanKutu from "./yan-kutu";
import { belgeIpuclari, type BelgeIpucu, type IpucuTuru } from "@/lib/yazim-ipuclari";
import type { Dugum } from "@/lib/kaynakca-bolumu";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  Sağ paneldeki "Yazım ipuçları" kartı (03.11.2026). Kurallar
  lib/yazim-ipuclari.ts'te (saf, testli): atıfsız iddia, aşırı kesin dil,
  kişisel görüş, uzun cümle/paragraf. Yazarken kendiliğinden güncellenir;
  model çağırmaz, kredi harcamaz.

  Sayım, yazma durduktan sonra yapılır (bekleme): her tuşta bütün belgeyi
  JSON'a çevirmek uzun tezde yazmayı yavaşlatırdı.
*/
const BEKLEME_MS = 900;

const TUR_ADI: Record<IpucuTuru, { tr: string; en: string }> = {
  "atifsiz-iddia": { tr: "Atıfsız iddia", en: "Uncited claim" },
  "kesin-dil": { tr: "Aşırı kesin dil", en: "Overstated language" },
  "kisisel-gorus": { tr: "Kişisel görüş", en: "Personal opinion" },
  "uzun-cumle": { tr: "Uzun cümle", en: "Long sentence" },
  "uzun-paragraf": { tr: "Uzun paragraf", en: "Long paragraph" },
};

export default function YazimIpuclariKarti({ editor, onFind }: { editor: Editor; onFind: (metin: string) => void }) {
  const t = useCeviri();
  const [ipuclari, setIpuclari] = useState<BelgeIpucu[] | null>(null);
  const [acik, setAcik] = useState(false);

  useEffect(() => {
    let zamanlayici: ReturnType<typeof setTimeout> | undefined;
    const hesapla = () => setIpuclari(belgeIpuclari((editor.getJSON().content ?? []) as Dugum[]));
    const planla = () => {
      clearTimeout(zamanlayici);
      zamanlayici = setTimeout(hesapla, BEKLEME_MS);
    };
    planla();
    editor.on("update", planla);
    return () => {
      clearTimeout(zamanlayici);
      editor.off("update", planla);
    };
  }, [editor]);

  const sayi = ipuclari?.length ?? null;
  return (
    <>
      <YanKutu
        ikon={Lightbulb}
        baslik={t({ tr: "Yazım ipuçları", en: "Writing tips" })}
        aciklama={t({ tr: "Atıfsız iddia, aşırı kesin dil, kişisel görüş, uzun cümle; yazarken güncellenir.", en: "Uncited claims, overstated language, opinion, long sentences; updates as you write." })}
        deger={sayi ?? "…"}
        alt={sayi === null ? t({ tr: "okunuyor", en: "reading" }) : sayi ? t({ tr: "göz atın", en: "take a look" }) : t({ tr: "öneri yok", en: "no suggestions" })}
        ton={sayi ? "warning" : undefined}
        onClick={() => setAcik(true)}
      />
      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        kicker={t({ tr: "Yazım ipuçları", en: "Writing tips" })}
        title={t({ tr: "Metninizde dikkat isteyen yerler", en: "Places in your text worth a look" })}
        description={t({
          tr: "Yazarken kendiliğinden güncellenir. Bunlar hata değil öneridir: atıfsız iddia, aşırı kesin dil, kişisel görüş kalıbı ve çok uzun cümle/paragraf aranır. Kaynakça ve listeler okunmaz.",
          en: "Updates as you write. These are suggestions, not errors: uncited claims, overstated language, personal-opinion phrases and very long sentences/paragraphs. The reference list and lists are not read.",
        })}
      >
        {ipuclari?.length ? (
          <ul className="bekleyen-kaynaklar">
            {ipuclari.slice(0, 60).map((ipucu, i) => (
              <li key={`${ipucu.paragraf}-${ipucu.tur}-${i}`}>
                <span>
                  <b>{t(TUR_ADI[ipucu.tur])}</b>
                  <small>{ipucu.paragrafBasi}</small>
                  <span className="text-sm">{t(ipucu.mesaj)}</span>
                </span>
                <button
                  type="button"
                  className="projects-filter-button button-compact"
                  onClick={() => {
                    setAcik(false);
                    onFind(ipucu.parca ?? ipucu.paragrafBasi.replace(/…$/, ""));
                  }}
                >
                  {t({ tr: "Göster", en: "Show" })}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted text-sm">{t({ tr: "Şu an bir öneri yok.", en: "No suggestions right now." })}</p>
        )}
        {ipuclari && ipuclari.length > 60 ? (
          <p className="muted text-sm">
            {t({ tr: `İlk 60 öneri gösteriliyor (toplam ${ipuclari.length}).`, en: `Showing the first 60 suggestions (${ipuclari.length} in total).` })}
          </p>
        ) : null}
      </Dialog>
    </>
  );
}
