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
        aciklama={t({ tr: "ArvoLab'da kabul ettiğiniz asistan önerilerinin metindeki payı; eklemeleri listeler ve vurgular.", en: "Share of the text from assistant suggestions you accepted in ArvoLab; lists and highlights them." })}
        deger={rapor ? `%${rapor.yuzde}` : "…"}
        alt={
          rapor === null
            ? t({ tr: "okunuyor", en: "reading" })
            : rapor.asistanKelime
              ? t({ tr: "izlenen asistan eklemesi", en: "tracked assistant insertions" })
              : t({ tr: "izlenen asistan eklemesi yok", en: "no tracked assistant insertions" })
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
                tr: `Gövdenin %${rapor.yuzde}'i ArvoLab'da kabul edilen asistan önerilerinden`,
                en: `${rapor.yuzde}% of the body comes from assistant suggestions accepted in ArvoLab`,
              })
            : t({ tr: "Yazarlık raporu", en: "Authorship report" })
        }
        description={t({
          tr: "Yalnızca ArvoLab'ın izleyebildiği eklemeler sayılır: yazım asistanından \"Kabul et\", \"Düzenleyerek kabul et\", \"Paragrafın altına ekle\" ya da satır içi öneride Tab ile eklenip hâlâ belgede duran metin. Kopyala–yapıştırla alınan ya da başka bir yerden eklenen metnin kaynağı bilinemez; bu metin asistanın ya da sizin yazdığınız olarak sınıflandırılmaz, yüzdenin geri kalanı da insan yazımı anlamına gelmez. Bu bir yapay zekâ tespit puanı değildir. Asistan metninin içine yazdığınız sözcükler de asistanınki sayılır.",
          en: "Only insertions ArvoLab can track are counted: text added from the writing assistant with \"Accept\", \"Edit and accept\", \"Insert below paragraph\" or Tab on an inline suggestion that is still in the document. The origin of copy–pasted text or text added from elsewhere cannot be known; it is not classified as written by the assistant or by you, and the rest of the percentage does not mean human-written. This is not an AI-detection score. Words you type inside assistant text also count as the assistant's.",
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
