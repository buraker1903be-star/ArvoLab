"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Fingerprint } from "lucide-react";
import Dialog from "@/app/dashboard/_components/dialog";
import YanKutu from "./yan-kutu";
import { yazarlikRaporu, type YazarlikRaporu } from "@/lib/yazarlik-raporu";
import type { Dugum } from "@/lib/kaynakca-bolumu";
import { useCeviri } from "@/app/_components/dil-saglayici";

/*
  Sağ paneldeki "Yazarlık" kartı (03.11.2026). Belgenin ne kadarının
  yazım asistanından eklendiğini gösterir (lib/yazarlik-raporu.ts).
  Sayı belgenin kendisinden hesaplanıyor, ayrı bir kayıttan değil —
  öğrenci asistan metnini silip kendi yazdığında pay da düşmeli.

  "Vurgula" asistan izli metni editörde renklendirir; yalnızca ekranda,
  belgeye ve çıktıya hiçbir şey yazmaz.
*/
const BEKLEME_MS = 900;

export default function YazarlikRaporuKarti({ editor, onFind }: { editor: Editor; onFind: (metin: string) => void }) {
  const t = useCeviri();
  const [rapor, setRapor] = useState<YazarlikRaporu | null>(null);
  const [acik, setAcik] = useState(false);
  const [vurgu, setVurgu] = useState(false);

  useEffect(() => {
    let zamanlayici: ReturnType<typeof setTimeout> | undefined;
    const hesapla = () => setRapor(yazarlikRaporu((editor.getJSON().content ?? []) as Dugum[]));
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

  useEffect(() => {
    const kok = editor.view.dom;
    kok.classList.toggle("asistan-vurgu", vurgu);
    return () => kok.classList.remove("asistan-vurgu");
  }, [editor, vurgu]);

  return (
    <>
      <YanKutu
        ikon={Fingerprint}
        baslik={t({ tr: "Yazarlık", en: "Authorship" })}
        deger={rapor ? `%${rapor.yuzde}` : "…"}
        alt={
          rapor === null
            ? t({ tr: "okunuyor", en: "reading" })
            : rapor.asistanKelime
              ? t({ tr: "asistandan eklendi", en: "inserted from the assistant" })
              : t({ tr: "asistan metni yok", en: "no assistant text" })
        }
        onClick={() => setAcik(true)}
      />
      <Dialog
        open={acik}
        onClose={() => setAcik(false)}
        kicker={t({ tr: "Yazarlık raporu", en: "Authorship report" })}
        title={
          rapor
            ? t({
                tr: `Gövdenin %${rapor.yuzde}'i yazım asistanından eklendi`,
                en: `${rapor.yuzde}% of the body was inserted from the writing assistant`,
              })
            : t({ tr: "Yazarlık raporu", en: "Authorship report" })
        }
        description={t({
          tr: "Yazım asistanından \"İmlece ekle\" ya da \"Seçilenin yerine koy\" ile eklenip hâlâ belgede duran metin. Kopyala–yapıştır ile alınan metin ve ArvoLab dışındaki araçlar bu sayıya girmez; bu bir yapay zekâ tespit puanı değildir. Asistan metninin içine yazdığınız sözcükler de asistanınki sayılır.",
          en: "Text inserted from the writing assistant with \"Insert at cursor\" or \"Replace selection\" that is still in the document. Text taken by copy–paste and tools outside ArvoLab are not counted; this is not an AI-detection score. Words you type inside assistant text also count as the assistant's.",
        })}
      >
        {rapor ? (
          <div className="stack-sm">
            <p className="text-sm">
              {t({
                tr: `Gövde ${rapor.toplamKelime.toLocaleString("tr-TR")} sözcük; bunun ${rapor.asistanKelime.toLocaleString("tr-TR")} sözcüğü ${rapor.eklemeler.length} eklemeden geliyor. Kaynakça ve listeler sayılmaz.`,
                en: `The body is ${rapor.toplamKelime.toLocaleString("en-US")} words; ${rapor.asistanKelime.toLocaleString("en-US")} of them come from ${rapor.eklemeler.length} insertions. The reference list and lists are not counted.`,
              })}
            </p>
            {rapor.eklemeler.length ? (
              <>
                <label className="cluster text-sm">
                  <input type="checkbox" checked={vurgu} onChange={(e) => setVurgu(e.target.checked)} />
                  {t({ tr: "Asistan metnini editörde vurgula", en: "Highlight assistant text in the editor" })}
                </label>
                <ul className="bekleyen-kaynaklar">
                  {rapor.eklemeler.map((e, i) => (
                    <li key={e.kayit ?? `adsiz-${i}`}>
                      <span>
                        <b>{t({ tr: `${e.kelime} sözcük`, en: `${e.kelime} words` })}</b>
                        <small>{e.ornek}</small>
                      </span>
                      <button
                        type="button"
                        className="projects-filter-button button-compact"
                        onClick={() => {
                          setAcik(false);
                          onFind(e.ornek);
                        }}
                      >
                        {t({ tr: "Göster", en: "Show" })}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
